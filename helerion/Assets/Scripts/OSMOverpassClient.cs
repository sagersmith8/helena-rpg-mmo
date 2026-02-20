using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Fetches OSM vector data (roads, buildings, water) from Overpass API for the map bbox
/// and returns ways with geometry in Unity local XZ coordinates.
/// </summary>
public class OSMOverpassClient : MonoBehaviour
{
    [Header("References")]
    public OSMMapDisplay mapDisplay;

    [Header("Overpass")]
    public string overpassUrl = "https://overpass-api.de/api/interpreter";
    [Tooltip("Timeout in seconds for the Overpass request.")]
    public int timeoutSeconds = 30;
    [Tooltip("If true, write the full Overpass JSON response to a file so you can share it for debugging.")]
    public bool logFullResponseToFile = false;
    [Tooltip("If true, log scale diagnostics: map extent, first building/road lat/lon vs local XZ and sizes.")]
    public bool logScaleDiagnostics = true;

    private void Awake()
    {
        if (mapDisplay == null)
            mapDisplay = GetComponent<OSMMapDisplay>() ?? GetComponentInParent<OSMMapDisplay>();
    }

    /// <summary>
    /// Fetch roads, buildings, and water ways for the current map bounds.
    /// Converts geometry to local XZ using map display settings.
    /// </summary>
    public void FetchOSMData(Action<OSMMapData> onComplete)
    {
        StartCoroutine(FetchOSMDataCoroutine(onComplete));
    }

    private IEnumerator FetchOSMDataCoroutine(Action<OSMMapData> onComplete)
    {
        if (mapDisplay == null)
        {
            Debug.LogError("OSMOverpassClient: No OSMMapDisplay assigned.");
            onComplete?.Invoke(null);
            yield break;
        }

        double centerLat = mapDisplay.centerLatitude;
        double centerLon = mapDisplay.centerLongitude;
        int zoom = mapDisplay.zoomLevel;
        float worldScalePerTile = mapDisplay.worldScalePerTile;

        MapCoordinateHelper.GetMapBounds(centerLat, centerLon, zoom, mapDisplay.tileGridSize,
            out double minLat, out double maxLat, out double minLon, out double maxLon);

        // Overpass bbox: south, west, north, east
        string bbox = $"{minLat:F6},{minLon:F6},{maxLat:F6},{maxLon:F6}";
        Debug.Log($"OSMOverpassClient: Fetching OSM data for bbox {bbox} (center {centerLat:F4}, {centerLon:F4}, zoom {zoom})");

        string query = $"[out:json][timeout:{timeoutSeconds}];(" +
            "way[\"highway\"](" + bbox + ");" +
            "way[\"building\"](" + bbox + ");" +
            "way[\"waterway\"](" + bbox + ");" +
            "way[\"natural\"=\"water\"](" + bbox + ");" +
            ");out body geom;";

        byte[] postData = System.Text.Encoding.UTF8.GetBytes(query);

        using (var req = new UnityWebRequest(overpassUrl, "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(postData);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("OSMOverpassClient: Request failed: " + req.error);
                onComplete?.Invoke(null);
                yield break;
            }

            string json = req.downloadHandler.text;
            Debug.Log($"OSMOverpassClient: Response received, {json.Length} chars. Map: center ({centerLat:F6},{centerLon:F6}) zoom {zoom} worldScalePerTile {worldScalePerTile} tileGridSize {mapDisplay.tileGridSize}");
            if (json.IndexOf("\"error\"", StringComparison.OrdinalIgnoreCase) >= 0 || json.IndexOf("\"remark\"", StringComparison.OrdinalIgnoreCase) >= 0)
                Debug.LogWarning("OSMOverpassClient: Response may contain an API error or rate-limit message. Check full response in a debugger or log.");
            if (logFullResponseToFile)
            {
                string path = System.IO.Path.Combine(Application.persistentDataPath, "overpass_response.json");
                try
                {
                    System.IO.File.WriteAllText(path, json);
                    Debug.Log($"OSMOverpassClient: Full response written to: {path}");
                }
                catch (Exception ex)
                {
                    Debug.LogWarning("OSMOverpassClient: Could not write response file: " + ex.Message);
                }
            }
            else
            {
                int elemStart = json.IndexOf("\"elements\"", StringComparison.Ordinal);
                if (elemStart >= 0)
                {
                    int snippetLen = Mathf.Min(1200, json.Length - elemStart);
                    Debug.Log("OSMOverpassClient: Response snippet (from 'elements'): " + json.Substring(elemStart, snippetLen) + (json.Length - elemStart > 1200 ? "..." : ""));
                }
            }
            int tileGridSize = mapDisplay.tileGridSize;
            float mapHalfExtent = (tileGridSize * worldScalePerTile) * 0.5f;
            Debug.Log($"OSMOverpassClient: Map extent: {tileGridSize} tiles × {worldScalePerTile} = {tileGridSize * worldScalePerTile} units total; half-extent from center = {mapHalfExtent} units.");
            Vector2 overlayOffset = new Vector2(mapDisplay.osmOverlayOffset.x, mapDisplay.osmOverlayOffset.y);
            var data = ParseOverpassResponse(json, centerLat, centerLon, zoom, worldScalePerTile, tileGridSize, overlayOffset, logScaleDiagnostics);
            Debug.Log($"OSMOverpassClient: Parsed -> Roads: {data.Roads.Count}, Buildings: {data.Buildings.Count}, Water: {data.Water.Count}");
            onComplete?.Invoke(data);
        }
    }

    private static int _parseElementsTotal;
    private static int _parseWaysSkippedType;
    private static int _parseWaysSkippedNoGeom;
    private static int _parseWaysSkippedTooFewPoints;
    private static int _parseWaysClassified;

    private static OSMMapData ParseOverpassResponse(string json, double centerLat, double centerLon, int zoom, float worldScalePerTile, int tileGridSize, Vector2 overlayOffset, bool logScaleDiagnostics)
    {
        var data = new OSMMapData();
        _parseElementsTotal = 0;
        _parseWaysSkippedType = 0;
        _parseWaysSkippedNoGeom = 0;
        _parseWaysSkippedTooFewPoints = 0;
        _parseWaysClassified = 0;

        // Minimal JSON parse: find "elements": [ ... ]
        int elementsStart = json.IndexOf("\"elements\"", StringComparison.Ordinal);
        if (elementsStart < 0)
        {
            Debug.LogWarning("OSMOverpassClient: No 'elements' key in response. Response may be an error. First 200 chars: " + (json.Length > 200 ? json.Substring(0, 200) + "..." : json));
            return data;
        }

        int arrayStart = json.IndexOf('[', elementsStart);
        if (arrayStart < 0)
        {
            Debug.LogWarning("OSMOverpassClient: Could not find elements array start in response.");
            return data;
        }

        int depth = 1;
        int i = arrayStart + 1;
        int elementStart = -1;
        bool loggedFirstBuilding = false;
        bool loggedFirstRoad = false;

        while (i < json.Length && depth > 0)
        {
            char c = json[i];
            if (c == '{')
            {
                if (depth == 1) elementStart = i;
                depth++;
            }
            else if (c == '}')
            {
                if (depth == 2 && elementStart >= 0)
                {
                    string elementJson = json.Substring(elementStart, i - elementStart + 1);
                    _parseElementsTotal++;
                    ParseElement(elementJson, centerLat, centerLon, zoom, worldScalePerTile, overlayOffset, data, logScaleDiagnostics, ref loggedFirstBuilding, ref loggedFirstRoad);
                    elementStart = -1;
                }
                depth--;
            }
            else if (c == '[')
                depth++;
            else if (c == ']')
                depth--;

            i++;
        }

        Debug.Log($"OSMOverpassClient: Parser stats -> elements in array: {_parseElementsTotal}, elements not way type: {_parseWaysSkippedType}, ways no geometry: {_parseWaysSkippedNoGeom}, ways <2 points: {_parseWaysSkippedTooFewPoints}, ways classified (road/building/water): {_parseWaysClassified}");
        return data;
    }

    private static void ParseElement(string elementJson, double centerLat, double centerLon, int zoom, float worldScalePerTile, Vector2 overlayOffset, OSMMapData data, bool logScaleDiagnostics, ref bool loggedFirstBuilding, ref bool loggedFirstRoad)
    {
        string type = GetJsonString(elementJson, "type");
        if (type != "way")
        {
            _parseWaysSkippedType++;
            return;
        }

        // Geometry array: "geometry":[{"lat":...,"lon":...},...]
        var points = new List<Vector2>();
        var latLonPairs = new List<(double lat, double lon)>();
        int geomStart = elementJson.IndexOf("\"geometry\"", StringComparison.Ordinal);
        if (geomStart < 0)
        {
            _parseWaysSkippedNoGeom++;
            return;
        }

        int geomArrayStart = elementJson.IndexOf('[', geomStart);
        if (geomArrayStart < 0)
        {
            _parseWaysSkippedNoGeom++;
            return;
        }

        // Only parse objects inside the geometry array; stop at the closing ']' so we don't pick up "tags" as a point (which would add 0,0 and blow up bounds).
        int geomArrayEnd = FindMatchingBracket(elementJson, geomArrayStart, '[', ']');
        if (geomArrayEnd < 0) geomArrayEnd = elementJson.Length;

        int idx = geomArrayStart + 1;
        while (idx < geomArrayEnd)
        {
            int objStart = elementJson.IndexOf('{', idx);
            if (objStart < 0 || objStart >= geomArrayEnd) break;
            int objEnd = elementJson.IndexOf('}', objStart);
            if (objEnd < 0) break;

            string coord = elementJson.Substring(objStart, objEnd - objStart + 1);
            double lat = GetJsonDouble(coord, "lat");
            double lon = GetJsonDouble(coord, "lon");
            // Reject objects that aren't coordinate pairs (e.g. stray "tags" or "bounds" if ever inside array)
            if (lat < -90d || lat > 90d || lon < -180d || lon > 180d)
                break;
            latLonPairs.Add((lat, lon));
            Vector2 xz = MapCoordinateHelper.LatLonToLocalXZ(lat, lon, centerLat, centerLon, zoom, worldScalePerTile);
            xz += overlayOffset;
            points.Add(xz);
            idx = objEnd + 1;
        }

        if (points.Count < 2)
        {
            _parseWaysSkippedTooFewPoints++;
            return;
        }

        var tags = new Dictionary<string, string>();
        int tagsStart = elementJson.IndexOf("\"tags\"", StringComparison.Ordinal);
        if (tagsStart >= 0)
        {
            int tagsObjStart = elementJson.IndexOf('{', tagsStart);
            int tagsObjEnd = elementJson.IndexOf('}', tagsObjStart);
            if (tagsObjStart >= 0 && tagsObjEnd > tagsObjStart)
            {
                string tagsStr = elementJson.Substring(tagsObjStart, tagsObjEnd - tagsObjStart + 1);
                ParseTags(tagsStr, tags);
            }
        }

        string highway = tags.TryGetValue("highway", out string h) ? h : null;
        string building = tags.TryGetValue("building", out string b) ? b : null;
        string waterway = tags.TryGetValue("waterway", out string w) ? w : null;
        string natural = tags.TryGetValue("natural", out string n) ? n : null;

        if (logScaleDiagnostics)
        {
            if (!string.IsNullOrEmpty(building) && !loggedFirstBuilding)
            {
                loggedFirstBuilding = true;
                float minX = points[0].x, maxX = points[0].x, minZ = points[0].y, maxZ = points[0].y;
                for (int i = 1; i < points.Count; i++)
                {
                    if (points[i].x < minX) minX = points[i].x; if (points[i].x > maxX) maxX = points[i].x;
                    if (points[i].y < minZ) minZ = points[i].y; if (points[i].y > maxZ) maxZ = points[i].y;
                }
                float sizeX = Mathf.Max(maxX - minX, 0.5f);
                float sizeZ = Mathf.Max(maxZ - minZ, 0.5f);
                Debug.Log($"OSMOverpassClient: [Scale] First building: lat {latLonPairs[0].lat:F6} lon {latLonPairs[0].lon:F6} -> local XZ ({points[0].x:F2}, {points[0].y:F2}). Bounds local: minX={minX:F2} maxX={maxX:F2} minZ={minZ:F2} maxZ={maxZ:F2} -> sizeX={sizeX:F2} sizeZ={sizeZ:F2} Unity units. (Expect ~5–30 for a typical house at zoom 16, worldScalePerTile=50)");
            }
            if (!string.IsNullOrEmpty(highway) && !loggedFirstRoad)
            {
                loggedFirstRoad = true;
                Debug.Log($"OSMOverpassClient: [Scale] First road: pt0 lat {latLonPairs[0].lat:F6} lon {latLonPairs[0].lon:F6} -> ({points[0].x:F2}, {points[0].y:F2}); pt1 lat {latLonPairs[1].lat:F6} lon {latLonPairs[1].lon:F6} -> ({points[1].x:F2}, {points[1].y:F2}); segment length = {(points[1] - points[0]).magnitude:F2} units.");
            }
        }

        var way = new OSMWay { Points = points, Tags = tags };

        _parseWaysClassified++;
        if (!string.IsNullOrEmpty(highway))
            data.Roads.Add(way);
        else if (!string.IsNullOrEmpty(building))
            data.Buildings.Add(way);
        else if (!string.IsNullOrEmpty(waterway) || (natural == "water"))
            data.Water.Add(way);
    }

    private static void ParseTags(string tagsJson, Dictionary<string, string> tags)
    {
        int i = 1; // skip '{'
        while (i < tagsJson.Length)
        {
            int keyStart = tagsJson.IndexOf('"', i);
            if (keyStart < 0) break;
            int keyEnd = tagsJson.IndexOf('"', keyStart + 1);
            if (keyEnd < 0) break;
            int colon = tagsJson.IndexOf(':', keyEnd);
            if (colon < 0) break;
            int valueStart = tagsJson.IndexOf('"', colon);
            if (valueStart < 0) break;
            int valueEnd = tagsJson.IndexOf('"', valueStart + 1);
            if (valueEnd < 0) break;

            string key = tagsJson.Substring(keyStart + 1, keyEnd - keyStart - 1);
            string value = tagsJson.Substring(valueStart + 1, valueEnd - valueStart - 1);
            tags[key] = value;
            i = valueEnd + 1;
        }
    }

    private static string GetJsonString(string json, string key)
    {
        string search = "\"" + key + "\":";
        int keyStart = json.IndexOf(search, StringComparison.Ordinal);
        if (keyStart < 0) return null;
        int valueStart = keyStart + search.Length;
        while (valueStart < json.Length && char.IsWhiteSpace(json[valueStart]))
            valueStart++;
        if (valueStart >= json.Length || json[valueStart] != '"') return null;
        valueStart++;
        int end = json.IndexOf('"', valueStart);
        if (end < 0) return null;
        return json.Substring(valueStart, end - valueStart);
    }

    private static double GetJsonDouble(string json, string key)
    {
        string search = "\"" + key + "\":";
        int keyStart = json.IndexOf(search, StringComparison.Ordinal);
        if (keyStart < 0) return 0;
        int start = keyStart + search.Length;
        while (start < json.Length && char.IsWhiteSpace(json[start]))
            start++;
        int end = start;
        while (end < json.Length && (char.IsDigit(json[end]) || json[end] == '-' || json[end] == '.' || json[end] == 'e' || json[end] == 'E' || json[end] == '+'))
            end++;
        if (end == start) return 0;
        return double.TryParse(json.Substring(start, end - start), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double v) ? v : 0;
    }

    /// <summary>
    /// Find the matching closing bracket for the opening bracket at openIndex.
    /// </summary>
    private static int FindMatchingBracket(string json, int openIndex, char openChar, char closeChar)
    {
        if (openIndex < 0 || openIndex >= json.Length || json[openIndex] != openChar) return -1;
        int depth = 1;
        for (int i = openIndex + 1; i < json.Length; i++)
        {
            if (json[i] == openChar) depth++;
            else if (json[i] == closeChar)
            {
                depth--;
                if (depth == 0) return i;
            }
        }
        return -1;
    }
}

/// <summary>
/// One OSM way: polyline or polygon in local XZ coordinates.
/// </summary>
[Serializable]
public class OSMWay
{
    public List<Vector2> Points;
    public Dictionary<string, string> Tags;
}

/// <summary>
/// Parsed OSM data for the map bbox: roads, buildings, water ways.
/// </summary>
[Serializable]
public class OSMMapData
{
    public List<OSMWay> Roads = new List<OSMWay>();
    public List<OSMWay> Buildings = new List<OSMWay>();
    public List<OSMWay> Water = new List<OSMWay>();
}
