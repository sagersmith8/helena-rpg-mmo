using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Fetches elevation data for the map bbox (USGS 3DEP or Open-Elevation) and builds a Unity Terrain
/// aligned with OSMMapDisplay. Add to the same GameObject as OSMMapDisplay or a child of the Map.
/// </summary>
public class DEMTerrainBuilder : MonoBehaviour
{
    public enum ElevationSource
    {
        OpenElevation,
        OpenTopoData,
        USGS3DEP
    }

    [Header("References")]
    [Tooltip("Map display to align with. If null, will try to find on same GameObject or parent.")]
    public OSMMapDisplay mapDisplay;

    [Header("Terrain")]
    [Tooltip("Heightmap resolution (power of 2 + 1 recommended, e.g. 257).")]
    [Range(33, 513)]
    public int heightmapResolution = 257;

    [Tooltip("Terrain height in Unity units (vertical scale).")]
    public float terrainHeightScale = 100f;
    [Tooltip("If hills appear as valleys and vice versa, enable this to invert elevation.")]
    public bool invertElevation = true;
    [Tooltip("Flip heightmap rows so North (maxLat) aligns with terrain +Z. Enable if N/S looks reversed vs the map.")]
    public bool flipHeightmapNorthSouth = true;
    [Tooltip("Smoothing passes to reduce boxiness. Open-Elevation often returns integer meters from coarse DEMs, so use 2–4 passes and/or radius 2.")]
    [Range(0, 6)]
    public int heightmapSmoothPasses = 3;
    [Tooltip("Smoothing kernel radius (1=3x3, 2=5x5). Larger = more blending of step edges from integer elevations.")]
    [Range(1, 3)]
    public int heightmapSmoothRadius = 2;

    [Header("Elevation source")]
    public ElevationSource elevationSource = ElevationSource.OpenTopoData;

    [Tooltip("Grid size (points per side). Lower = faster, less detail. Used for Open-Elevation and Open Topo Data.")]
    [Range(8, 65)]
    public int elevationGridSize = 33;
    [Tooltip("Open Topo Data dataset: ned10m (US 10m, float), srtm90m (global), etc. See opentopodata.org.")]
    public string openTopoDataDataset = "ned10m";
    [Tooltip("Points per request when using Open Topo Data (batched to avoid rate limits).")]
    [Range(50, 300)]
    public int openTopoDataBatchSize = 100;
    [Tooltip("Seconds to wait between Open Topo Data batch requests.")]
    [Range(0.1f, 2f)]
    public float openTopoDataBatchDelay = 0.3f;

    [Header("OSM overlay")]
    [Tooltip("When true, terrain uses the OSM map texture; when false, a plain color. Toggle in Inspector at runtime.")]
    public bool showOSMTexture = true;

    [Header("DEM debug")]
    [Tooltip("Log elevation request bbox, response min/max, and what was drawn (helps match hills to the map).")]
    public bool logDEMDiagnostics = true;
    [Tooltip("If set, write raw API response to this file in persistentDataPath (e.g. dem_response.json). Share to verify parsing.")]
    public string logElevationResponseToFile = "";
    [Tooltip("If set, write our interpreted grid (bbox, gridSize, elevations) to this file (e.g. dem_interpretation.json). Share to debug resolution/order.")]
    public string logDEMInterpretationToFile = "";

    private const string OpenElevationUrl = "https://api.open-elevation.com/api/v1/lookup";

    private Terrain _terrain;
    private bool _terrainReady;
    private float[,] _fetchedHeights;
    private Material _terrainMaterialOSM;
    private Material _terrainMaterialPlain;

    public bool IsTerrainReady => _terrainReady;
    public Terrain Terrain => _terrain;

    private void Awake()
    {
        if (mapDisplay == null)
            mapDisplay = GetComponent<OSMMapDisplay>() ?? GetComponentInParent<OSMMapDisplay>();
    }

    private void Start()
    {
        BuildTerrain();
    }

    public void BuildTerrain()
    {
        StartCoroutine(BuildTerrainCoroutine());
    }

    private IEnumerator BuildTerrainCoroutine()
    {
        if (mapDisplay == null)
        {
            Debug.LogError("DEMTerrainBuilder: No OSMMapDisplay assigned.");
            yield break;
        }

        double centerLat = mapDisplay.centerLatitude;
        double centerLon = mapDisplay.centerLongitude;
        int zoom = mapDisplay.zoomLevel;
        int tileGridSize = mapDisplay.tileGridSize;
        float worldScalePerTile = mapDisplay.worldScalePerTile;

        MapCoordinateHelper.GetMapBounds(centerLat, centerLon, zoom, tileGridSize,
            out double minLat, out double maxLat, out double minLon, out double maxLon);

        float mapSizeX = tileGridSize * worldScalePerTile;
        float mapSizeZ = tileGridSize * worldScalePerTile;

        if (logDEMDiagnostics)
            Debug.Log($"DEMTerrainBuilder: Requesting elevation for bbox lat [{minLat:F6}, {maxLat:F6}] lon [{minLon:F6}, {maxLon:F6}] (N→S lat decreases). Grid size={elevationGridSize}, map size (X,Z)=({mapSizeX:F1}, {mapSizeZ:F1}) units.");

        _fetchedHeights = null;
        if (elevationSource == ElevationSource.OpenElevation)
            yield return FetchOpenElevationGrid(minLat, maxLat, minLon, maxLon, elevationGridSize);
        else if (elevationSource == ElevationSource.OpenTopoData)
            yield return FetchOpenTopoDataGrid(minLat, maxLat, minLon, maxLon, elevationGridSize);
        else if (elevationSource == ElevationSource.USGS3DEP)
            yield return FetchUSGSElevationGrid(minLat, maxLat, minLon, maxLon);

        float[,] heights = _fetchedHeights;
        if (heights == null)
        {
            Debug.LogWarning("DEMTerrainBuilder: No elevation data; creating flat terrain.");
            int res = heightmapResolution;
            heights = new float[res, res];
            for (int y = 0; y < res; y++)
                for (int x = 0; x < res; x++)
                    heights[y, x] = 0.1f;
        }

        // Resample to heightmap resolution if needed
        int targetRes = heightmapResolution;
        if (heights.GetLength(0) != targetRes)
        {
            float[,] resampled = ResampleHeights(heights, targetRes);
            heights = resampled;
        }

        // Normalize to 0..1 for TerrainData
        float minH = float.MaxValue, maxH = float.MinValue;
        int hw = heights.GetLength(1), hh = heights.GetLength(0);
        for (int y = 0; y < hh; y++)
            for (int x = 0; x < hw; x++)
            {
                float v = heights[y, x];
                if (v < minH) minH = v;
                if (v > maxH) maxH = v;
            }

        float range = maxH - minH;
        if (range < 0.1f) range = 1f;

        if (logDEMDiagnostics)
            Debug.Log($"DEMTerrainBuilder: Raw heights (after resample): min={minH:F0}m max={maxH:F0}m range={range:F0}m. Normalizing to 0–1 then scaling Y by terrainHeightScale={terrainHeightScale} → world Y in [0, {terrainHeightScale}].");

        float[,] normalized = new float[hh, hw];
        for (int y = 0; y < hh; y++)
            for (int x = 0; x < hw; x++)
            {
                float n = Mathf.Clamp01((heights[y, x] - minH) / range);
                normalized[y, x] = invertElevation ? (1f - n) : n;
            }

        // Unity terrain: heightmap row 0 = South (Z=0), last row = North (Z=max). Our row 0 = North, last = South. Flip so N/S matches map.
        if (flipHeightmapNorthSouth)
        {
            float[,] flipped = new float[hh, hw];
            for (int y = 0; y < hh; y++)
                for (int x = 0; x < hw; x++)
                    flipped[hh - 1 - y, x] = normalized[y, x];
            normalized = flipped;
        }

        for (int pass = 0; pass < heightmapSmoothPasses; pass++)
            normalized = SmoothHeightmap(normalized, heightmapSmoothRadius);

        // Create TerrainData
        var terrainData = new TerrainData();
        terrainData.heightmapResolution = targetRes;
        terrainData.size = new Vector3(mapSizeX, terrainHeightScale, mapSizeZ);
        terrainData.SetHeights(0, 0, normalized);

        var terrainObj = new GameObject("DEMTerrain");
        terrainObj.transform.SetParent(transform);
        terrainObj.transform.localRotation = Quaternion.identity;
        terrainObj.transform.localScale = Vector3.one;
        // Center terrain on map origin: terrain extends [0,0] to [mapSizeX, mapSizeZ], so offset by half
        Vector3 terrainLocalPos = new Vector3(-mapSizeX * 0.5f, 0f, -mapSizeZ * 0.5f);
        terrainObj.transform.localPosition = terrainLocalPos;

        _terrain = terrainObj.AddComponent<Terrain>();
        _terrain.terrainData = terrainData;

        var collider = terrainObj.AddComponent<TerrainCollider>();
        collider.terrainData = terrainData;

        if (mapDisplay != null)
            mapDisplay.SetTerrainForHeight(_terrain);

        _terrainReady = true;

        if (logDEMDiagnostics)
            Debug.Log($"DEMTerrainBuilder: Terrain drawn: size=({mapSizeX:F1}, {terrainHeightScale:F1}, {mapSizeZ:F1}) local, position={terrainLocalPos}. Heightmap {targetRes}x{targetRes}, invert={invertElevation}, flipN/S={flipHeightmapNorthSouth}, smoothPasses={heightmapSmoothPasses}, smoothRadius={heightmapSmoothRadius}.");

        yield return StartCoroutine(ApplyOSMOverlayWhenReady());
        yield return null;
    }

    private IEnumerator ApplyOSMOverlayWhenReady()
    {
        if (mapDisplay == null || _terrain == null) yield break;

        while (!mapDisplay.IsMapReady)
            yield return null;

        Texture2D osmTexture = mapDisplay.MapTexture;
        // Use a Lit shader so terrain receives the Flying Beast's light; fall back to Unlit if Lit isn't available.
        Shader shader = Shader.Find("Universal Render Pipeline/Lit")
            ?? Shader.Find("Universal Render Pipeline/Simple Lit")
            ?? Shader.Find("Universal Render Pipeline/Unlit")
            ?? Shader.Find("Unlit/Texture");
        if (shader != null)
        {
            if (osmTexture != null)
            {
                _terrainMaterialOSM = new Material(shader);
                if (_terrainMaterialOSM.HasProperty("_BaseMap"))
                    _terrainMaterialOSM.SetTexture("_BaseMap", osmTexture);
                else
                    _terrainMaterialOSM.mainTexture = osmTexture;
                if (_terrainMaterialOSM.HasProperty("_BaseColor"))
                    _terrainMaterialOSM.SetColor("_BaseColor", Color.white);
            }
            _terrainMaterialPlain = new Material(shader);
            Color plainColor = new Color(0.5f, 0.52f, 0.48f); // neutral gray-green
            if (_terrainMaterialPlain.HasProperty("_BaseColor"))
                _terrainMaterialPlain.SetColor("_BaseColor", plainColor);
            else
                _terrainMaterialPlain.color = plainColor;

            ApplyTerrainMaterial();
        }

        if (mapDisplay.MapPlane != null)
            mapDisplay.MapPlane.SetActive(false);
    }

    private void ApplyTerrainMaterial()
    {
        if (_terrain == null) return;
        if (showOSMTexture && _terrainMaterialOSM != null)
            _terrain.materialTemplate = _terrainMaterialOSM;
        else if (_terrainMaterialPlain != null)
            _terrain.materialTemplate = _terrainMaterialPlain;
    }

    private void OnValidate()
    {
        if (_terrain != null && (_terrainMaterialOSM != null || _terrainMaterialPlain != null))
            ApplyTerrainMaterial();
    }

    /// <summary>
    /// Set whether the terrain shows the OSM map texture (true) or plain color (false). Call from UI or other scripts.
    /// </summary>
    public void SetShowOSMTexture(bool value)
    {
        showOSMTexture = value;
        ApplyTerrainMaterial();
    }

    private IEnumerator FetchOpenElevationGrid(double minLat, double maxLat, double minLon, double maxLon,
        int gridSize)
    {
        _fetchedHeights = null;

        var locationsList = new List<LatLon>();
        for (int iy = 0; iy < gridSize; iy++)
        {
            double lat = maxLat - (maxLat - minLat) * iy / (gridSize - 1);
            for (int ix = 0; ix < gridSize; ix++)
            {
                double lon = minLon + (maxLon - minLon) * ix / (gridSize - 1);
                locationsList.Add(new LatLon { latitude = lat, longitude = lon });
            }
        }

        if (logDEMDiagnostics)
        {
            int n = locationsList.Count;
            Debug.Log($"DEMTerrainBuilder: Request order: we send {n} points row-major (row=lat, col=lon). Index 0 (NW)=({locationsList[0].latitude:F6}, {locationsList[0].longitude:F6}), 1=({locationsList[1].latitude:F6}, {locationsList[1].longitude:F6}), {gridSize - 1} (NE)=({locationsList[gridSize - 1].latitude:F6}, {locationsList[gridSize - 1].longitude:F6}), {gridSize * (gridSize - 1)} (SW)=({locationsList[gridSize * (gridSize - 1)].latitude:F6}, {locationsList[gridSize * (gridSize - 1)].longitude:F6}), {n - 1} (SE)=({locationsList[n - 1].latitude:F6}, {locationsList[n - 1].longitude:F6}).");
        }

        string jsonBody = BuildLookupJson(locationsList);

        using (var req = new UnityWebRequest(OpenElevationUrl, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
            req.uploadHandler = new UploadHandlerRaw(bodyRaw);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Accept", "application/json");

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("DEMTerrainBuilder: Open-Elevation request failed: " + req.error);
                yield break;
            }

            string response = req.downloadHandler.text;

            if (!string.IsNullOrEmpty(logElevationResponseToFile))
            {
                try
                {
                    string path = System.IO.Path.Combine(Application.persistentDataPath, logElevationResponseToFile);
                    System.IO.File.WriteAllText(path, response);
                    Debug.Log($"DEMTerrainBuilder: Elevation response written to: {path}");
                }
                catch (Exception ex)
                {
                    Debug.LogWarning("DEMTerrainBuilder: Could not write elevation response file: " + ex.Message);
                }
            }

            var result = JsonUtility.FromJson<OpenElevationResponse>(response);
            if (result?.results == null || result.results.Length != gridSize * gridSize)
            {
                Debug.LogWarning("DEMTerrainBuilder: Open-Elevation response count mismatch. Expected " + (gridSize * gridSize) + ", got " + (result?.results?.Length ?? 0));
                yield break;
            }

            var grid = new float[gridSize, gridSize];
            float minElev = float.MaxValue, maxElev = float.MinValue;
            for (int i = 0; i < result.results.Length; i++)
            {
                int iy = i / gridSize;
                int ix = i % gridSize;
                float elev = (float)result.results[i].elevation;
                if (elev < -500f) elev = 0f; // no-data
                grid[iy, ix] = elev;
                if (elev > maxElev) maxElev = elev;
                if (elev < minElev) minElev = elev;
            }
            _fetchedHeights = grid;

            if (logDEMDiagnostics)
            {
                var r0 = result.results[0];
                var r1 = result.results[1];
                var rLast = result.results[result.results.Length - 1];
                Debug.Log($"DEMTerrainBuilder: Response order (assuming API returns same order as request): index 0 lat={r0.latitude:F6} lon={r0.longitude:F6} elev={r0.elevation:F0}m, index 1 lat={r1.latitude:F6} lon={r1.longitude:F6} elev={r1.elevation:F0}m, index {result.results.Length - 1} (SE) lat={rLast.latitude:F6} lon={rLast.longitude:F6} elev={rLast.elevation:F0}m.");
                float nw = grid[0, 0], ne = grid[0, gridSize - 1], sw = grid[gridSize - 1, 0], se = grid[gridSize - 1, gridSize - 1];
                int cy = gridSize / 2, cx = gridSize / 2;
                float center = grid[cy, cx];
                Debug.Log($"DEMTerrainBuilder: Elevation response: range {minElev:F0}m–{maxElev:F0}m. Grid samples: NW={nw:F0}m NE={ne:F0}m SW={sw:F0}m SE={se:F0}m center={center:F0}m (row0=North, row{gridSize - 1}=South, col0=West, col{gridSize - 1}=East).");
                var distinct = new HashSet<float>();
                for (int iy = 0; iy < gridSize; iy++)
                    for (int ix = 0; ix < gridSize; ix++)
                        distinct.Add(grid[iy, ix]);
                if (distinct.Count <= 10)
                    Debug.Log($"DEMTerrainBuilder: Only {distinct.Count} distinct elevations (API returns integer meters from coarse DEM). Use heightmapSmoothPasses=3–4 and heightmapSmoothRadius=2 for rounder terrain.");
            }

            if (!string.IsNullOrEmpty(logDEMInterpretationToFile))
            {
                try
                {
                    var flat = new float[gridSize * gridSize];
                    for (int iy = 0; iy < gridSize; iy++)
                        for (int ix = 0; ix < gridSize; ix++)
                            flat[iy * gridSize + ix] = grid[iy, ix];
                    var interpretation = new DEMInterpretationJson
                    {
                        minLat = minLat,
                        maxLat = maxLat,
                        minLon = minLon,
                        maxLon = maxLon,
                        gridSize = gridSize,
                        elevations = flat,
                        note = "elevations are row-major: row 0 = North (maxLat), last row = South; col 0 = West, last col = East. grid[iy,ix] = elevations[iy*gridSize+ix]."
                    };
                    string path = System.IO.Path.Combine(Application.persistentDataPath, logDEMInterpretationToFile);
                    string json = JsonUtility.ToJson(interpretation, true);
                    System.IO.File.WriteAllText(path, json);
                    Debug.Log($"DEMTerrainBuilder: Interpretation written to: {path} (grid {gridSize}x{gridSize}, share this file to debug).");
                }
                catch (Exception ex)
                {
                    Debug.LogWarning("DEMTerrainBuilder: Could not write interpretation file: " + ex.Message);
                }
            }
        }
    }

    [Serializable]
    private class DEMInterpretationJson
    {
        public double minLat;
        public double maxLat;
        public double minLon;
        public double maxLon;
        public int gridSize;
        public float[] elevations;
        public string note;
    }

    private static string BuildLookupJson(List<LatLon> locations)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("{\"locations\":[");
        for (int i = 0; i < locations.Count; i++)
        {
            if (i > 0) sb.Append(",");
            var p = locations[i];
            sb.Append("{\"latitude\":").Append(p.latitude.ToString("R", System.Globalization.CultureInfo.InvariantCulture))
                .Append(",\"longitude\":").Append(p.longitude.ToString("R", System.Globalization.CultureInfo.InvariantCulture)).Append("}");
        }
        sb.Append("]}");
        return sb.ToString();
    }

    [Serializable]
    private struct LatLon
    {
        public double latitude;
        public double longitude;
    }

    [Serializable]
    private class OpenElevationResult
    {
        public double latitude;
        public double longitude;
        public double elevation;
    }

    [Serializable]
    private class OpenElevationResponse
    {
        public OpenElevationResult[] results;
    }

    private IEnumerator FetchOpenTopoDataGrid(double minLat, double maxLat, double minLon, double maxLon,
        int gridSize)
    {
        _fetchedHeights = null;
        var locationsList = new List<LatLon>();
        for (int iy = 0; iy < gridSize; iy++)
        {
            double lat = maxLat - (maxLat - minLat) * iy / (gridSize - 1);
            for (int ix = 0; ix < gridSize; ix++)
            {
                double lon = minLon + (maxLon - minLon) * ix / (gridSize - 1);
                locationsList.Add(new LatLon { latitude = lat, longitude = lon });
            }
        }

        int total = locationsList.Count;
        var elevations = new float?[total];
        int batchSize = Mathf.Clamp(openTopoDataBatchSize, 50, 300);
        string baseUrl = "https://api.opentopodata.org/v1/" + openTopoDataDataset + "?interpolation=cubic&locations=";

        for (int start = 0; start < total; start += batchSize)
        {
            int count = Mathf.Min(batchSize, total - start);
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < count; i++)
            {
                if (i > 0) sb.Append("|");
                var p = locationsList[start + i];
                sb.Append(p.latitude.ToString("R", System.Globalization.CultureInfo.InvariantCulture));
                sb.Append(",");
                sb.Append(p.longitude.ToString("R", System.Globalization.CultureInfo.InvariantCulture));
            }
            string url = baseUrl + UnityEngine.Networking.UnityWebRequest.EscapeURL(sb.ToString());

            using (var req = UnityEngine.Networking.UnityWebRequest.Get(url))
            {
                req.timeout = 30;
                yield return req.SendWebRequest();

                if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    Debug.LogWarning("DEMTerrainBuilder: Open Topo Data request failed: " + req.error);
                    yield break;
                }

                string json = req.downloadHandler.text;
                ParseOpenTopoDataResponse(json, start, count, elevations);

                if (start + count < total && openTopoDataBatchDelay > 0f)
                    yield return new WaitForSeconds(openTopoDataBatchDelay);
            }
        }

        var grid = new float[gridSize, gridSize];
        float minElev = float.MaxValue, maxElev = float.MinValue;
        for (int i = 0; i < total; i++)
        {
            float v = elevations[i] ?? 0f;
            if (elevations[i] == null || v < -500f) v = 0f;
            int iy = i / gridSize;
            int ix = i % gridSize;
            grid[iy, ix] = v;
            if (v > maxElev) maxElev = v;
            if (v < minElev) minElev = v;
        }
        if (minElev == float.MaxValue) minElev = 0f;

        _fetchedHeights = grid;

        if (logDEMDiagnostics)
        {
            var distinct = new HashSet<float>();
            for (int iy = 0; iy < gridSize; iy++)
                for (int ix = 0; ix < gridSize; ix++)
                    distinct.Add(grid[iy, ix]);
            Debug.Log($"DEMTerrainBuilder: Open Topo Data ({openTopoDataDataset}): range {minElev:F1}m–{maxElev:F1}m, {distinct.Count} distinct values (float DEM, less boxy).");
        }
    }

    private static void ParseOpenTopoDataResponse(string json, int startIndex, int count, float?[] into)
    {
        int searchStart = 0;
        for (int i = 0; i < count && searchStart < json.Length; i++)
        {
            int elevKey = json.IndexOf("\"elevation\"", searchStart, StringComparison.Ordinal);
            if (elevKey < 0) break;
            int colon = json.IndexOf(':', elevKey);
            if (colon < 0) break;
            int valueStart = colon + 1;
            while (valueStart < json.Length && (json[valueStart] == ' ' || json[valueStart] == '\t')) valueStart++;
            if (valueStart >= json.Length) break;
            bool isNull = valueStart + 4 <= json.Length && json.Substring(valueStart, 4) == "null";
            if (isNull)
            {
                into[startIndex + i] = null;
                searchStart = valueStart + 4;
                continue;
            }
            int valueEnd = valueStart;
            while (valueEnd < json.Length && (char.IsDigit(json[valueEnd]) || json[valueEnd] == '-' || json[valueEnd] == '.' || json[valueEnd] == 'e' || json[valueEnd] == 'E')) valueEnd++;
            if (valueEnd == valueStart) break;
            string numStr = json.Substring(valueStart, valueEnd - valueStart);
            if (double.TryParse(numStr, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double v))
                into[startIndex + i] = (float)v;
            else
                into[startIndex + i] = null;
            searchStart = valueEnd;
        }
    }

    private IEnumerator FetchUSGSElevationGrid(double minLat, double maxLat, double minLon, double maxLon)
    {
        // USGS 3DEP raster would require TIFF download + parse. Use Open Topo Data (ned10m) for high-quality US DEM.
        yield return FetchOpenTopoDataGrid(minLat, maxLat, minLon, maxLon, elevationGridSize);
    }

    private static float[,] SmoothHeightmap(float[,] src, int radius)
    {
        int h = src.GetLength(0), w = src.GetLength(1);
        var dst = new float[h, w];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float sum = 0f;
                int n = 0;
                for (int dy = -radius; dy <= radius; dy++)
                    for (int dx = -radius; dx <= radius; dx++)
                    {
                        int ny = Mathf.Clamp(y + dy, 0, h - 1);
                        int nx = Mathf.Clamp(x + dx, 0, w - 1);
                        sum += src[ny, nx];
                        n++;
                    }
                dst[y, x] = sum / n;
            }
        return dst;
    }

    private static float[,] ResampleHeights(float[,] src, int targetRes)
    {
        int sh = src.GetLength(0), sw = src.GetLength(1);
        var dst = new float[targetRes, targetRes];
        for (int y = 0; y < targetRes; y++)
        {
            float sy = (y / (float)(targetRes - 1)) * (sh - 1);
            int iy0 = Mathf.Clamp((int)sy, 0, sh - 2);
            int iy1 = iy0 + 1;
            float ty = sy - iy0;
            for (int x = 0; x < targetRes; x++)
            {
                float sx = (x / (float)(targetRes - 1)) * (sw - 1);
                int ix0 = Mathf.Clamp((int)sx, 0, sw - 2);
                int ix1 = ix0 + 1;
                float tx = sx - ix0;
                float h00 = src[iy0, ix0];
                float h10 = src[iy1, ix0];
                float h01 = src[iy0, ix1];
                float h11 = src[iy1, ix1];
                dst[y, x] = Mathf.Lerp(Mathf.Lerp(h00, h01, tx), Mathf.Lerp(h10, h11, tx), ty);
            }
        }
        return dst;
    }
}
