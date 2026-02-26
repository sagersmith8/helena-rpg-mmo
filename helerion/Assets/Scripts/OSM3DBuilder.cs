using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Builds 3D representation of OSM data: roads as mesh strips, buildings as extruded meshes, water as flat meshes.
/// Uses terrain for height sampling when available. Add to Map GameObject with OSMOverpassClient and DEMTerrainBuilder.
/// </summary>
public class OSM3DBuilder : MonoBehaviour
{
    [Header("References")]
    public OSMMapDisplay mapDisplay;
    public OSMOverpassClient overpassClient;
    public DEMTerrainBuilder terrainBuilder;

    [Header("Roads")]
    public float defaultRoadWidth = 4f;
    [Tooltip("Subdivide segments longer than this (Unity units) for smoother curves. 0 = no subdivision.")]
    public float roadSubdivideMaxSegmentLength = 8f;
    [Tooltip("Raise road mesh above sampled terrain by this amount (Unity units) to avoid clipping through.")]
    public float roadHeightOffset = 0.15f;
    public Material roadMaterial;

    [Header("Buildings")]
    [Tooltip("Height when OSM has no levels/height tag.")]
    public float defaultBuildingHeight = 3f;
    [Tooltip("Height per building:levels (e.g. 3 = 1 level = 3m).")]
    public float metersPerLevel = 3f;
    [Tooltip("Minimum height for all buildings (use e.g. 8–15 so 1-level buildings are visible).")]
    public float minimumBuildingHeight = 6f;
    public Material buildingMaterial;

    [Header("Water")]
    public float waterHeightOffset = -0.1f;
    public Material waterMaterial;

    [Header("Build")]
    [Tooltip("Build OSM 3D after this many seconds (allow map and terrain to load).")]
    public float buildDelaySeconds = 3f;
    [Tooltip("If true, log first building and road placement/size for scale debugging.")]
    public bool logScaleDiagnostics = true;

    [Header("Decoration seed")]
    [Tooltip("Seed for deterministic placement of prefabs and scatter. Same seed = same layout.")]
    public int decorationSeed;
    [Tooltip("If true, seed is derived from map center lat/lon so each map location gets a stable layout.")]
    public bool seedFromMapCenter = true;

    [Header("Building prefabs")]
    [Tooltip("When true and house prefabs are assigned, use them instead of cubes. Leave prefabs empty to keep cubes.")]
    public bool useHousePrefabs = true;
    [Tooltip("House prefabs from Mega Fantasy Props Pack (e.g. House.001, house.002, house.003). One is chosen per building by seed.")]
    public GameObject[] housePrefabs;
    [Tooltip("Approximate size of house prefabs in Unity units (X, height, Z) used to scale to OSM footprint. Tweak in Editor if houses look wrong.")]
    public Vector3 houseReferenceSize = new Vector3(10f, 6f, 10f);

    [Header("Roadside decoration")]
    [Tooltip("Prefabs to place along roads (barrels, boxes, fences). Assign from Mega Fantasy Props Pack.")]
    public GameObject[] roadSideDecorPrefabs;
    [Tooltip("Place decor every N units along road centerline.")]
    public float roadDecorInterval = 12f;
    [Tooltip("Probability (0–1) to place decor at each interval.")]
    [Range(0f, 1f)]
    public float roadDecorProbability = 0.15f;
    [Tooltip("Max decor instances per road way (cap for performance).")]
    public int roadDecorMaxPerRoad = 20;

    [Header("Building scatter")]
    [Tooltip("Prefabs to place near buildings (barrels, boxes).")]
    public GameObject[] buildingScatterPrefabs;
    [Tooltip("Max scatter objects per building.")]
    [Range(0, 5)]
    public int buildingScatterMaxPerBuilding = 2;
    [Tooltip("Probability (0–1) to place each scatter object.")]
    [Range(0f, 1f)]
    public float buildingScatterProbability = 0.5f;

    [Header("Nature (trees and bushes)")]
    [Tooltip("Tree prefabs from NatureStarterKit2 (e.g. tree01–tree04).")]
    public GameObject[] treePrefabs;
    [Tooltip("Bush prefabs from NatureStarterKit2 (e.g. bush01–bush06).")]
    public GameObject[] bushPrefabs;
    [Tooltip("Grid step in Unity units for nature placement. Smaller = denser.")]
    public float natureGridStep = 15f;
    [Tooltip("Probability (0–1) to place a tree at each grid point (if not on road/building).")]
    [Range(0f, 1f)]
    public float treeProbability = 0.08f;
    [Tooltip("Probability (0–1) to place a bush at each grid point (if not on road/building).")]
    [Range(0f, 1f)]
    public float bushProbability = 0.12f;
    [Tooltip("Min distance from road centerline to place nature.")]
    public float natureMinDistanceFromRoad = 4f;
    [Tooltip("Min distance from building center to place nature.")]
    public float natureMinDistanceFromBuilding = 3f;
    [Tooltip("Max nature instances total (cap for performance).")]
    public int natureMaxTotal = 400;

    private Transform _mapTransform;
    private int _buildingsBuilt;
    private int _roadsBuilt;
    private Terrain _terrain;

    private void Awake()
    {
        if (mapDisplay == null) mapDisplay = GetComponent<OSMMapDisplay>() ?? GetComponentInParent<OSMMapDisplay>();
        if (overpassClient == null) overpassClient = GetComponent<OSMOverpassClient>() ?? GetComponentInParent<OSMOverpassClient>();
        if (terrainBuilder == null) terrainBuilder = GetComponent<DEMTerrainBuilder>() ?? GetComponentInParent<DEMTerrainBuilder>();
        _mapTransform = mapDisplay != null ? mapDisplay.transform : transform;
    }

    private void Start()
    {
        StartCoroutine(BuildWhenReady());
    }

    private IEnumerator BuildWhenReady()
    {
        Debug.Log("OSM3DBuilder: Waiting for build delay...");
        yield return new WaitForSeconds(buildDelaySeconds);
        if (terrainBuilder != null && terrainBuilder.Terrain != null)
            _terrain = terrainBuilder.Terrain;
        if (overpassClient == null)
        {
            Debug.LogError("OSM3DBuilder: No Overpass Client assigned. Cannot fetch OSM data.");
            yield break;
        }
        Debug.Log("OSM3DBuilder: Requesting OSM data from Overpass...");
        overpassClient.FetchOSMData(OnOSMDataReceived);
    }

    private void OnOSMDataReceived(OSMMapData data)
    {
        if (data == null)
        {
            Debug.LogWarning("OSM3DBuilder: Received null OSM data. Check Overpass request/response above.");
            return;
        }

        if (seedFromMapCenter && mapDisplay != null)
        {
            double lat = mapDisplay.centerLatitude;
            double lon = mapDisplay.centerLongitude;
            decorationSeed = (int)((lat * 1e6) * 31 + (lon * 1e6));
        }

        float mapHalfExtent = (mapDisplay.tileGridSize * mapDisplay.worldScalePerTile) * 0.5f;
        Vector3 mapScale = _mapTransform.lossyScale;
        Debug.Log($"OSM3DBuilder: Building 3D from OSM data -> Roads: {data.Roads.Count}, Buildings: {data.Buildings.Count}, Water: {data.Water.Count}. Map half-extent = {mapHalfExtent:F1} units (buildings/roads should fit within ±{mapHalfExtent:F0}). Map transform lossyScale = {mapScale} (if not (1,1,1), parent scale will make objects look larger/smaller). Decoration seed = {decorationSeed}.");

        var roadsParent = new GameObject("OSMRoads");
        roadsParent.transform.SetParent(_mapTransform);
        roadsParent.transform.localPosition = Vector3.zero;
        roadsParent.transform.localRotation = Quaternion.identity;
        roadsParent.transform.localScale = Vector3.one;

        foreach (var way in data.Roads)
            BuildRoadMesh(way, roadsParent.transform);

        var buildingsParent = new GameObject("OSMBuildings");
        buildingsParent.transform.SetParent(_mapTransform);
        buildingsParent.transform.localPosition = Vector3.zero;
        buildingsParent.transform.localRotation = Quaternion.identity;
        buildingsParent.transform.localScale = Vector3.one;

        for (int i = 0; i < data.Buildings.Count; i++)
            BuildBuildingMesh(data.Buildings[i], buildingsParent.transform, i);

        var waterParent = new GameObject("OSMWater");
        waterParent.transform.SetParent(_mapTransform);
        waterParent.transform.localPosition = Vector3.zero;
        waterParent.transform.localRotation = Quaternion.identity;
        waterParent.transform.localScale = Vector3.one;

        foreach (var way in data.Water)
            BuildWaterMesh(way, waterParent.transform);

        var decorationParent = new GameObject("OSMDecoration");
        decorationParent.transform.SetParent(_mapTransform);
        decorationParent.transform.localPosition = Vector3.zero;
        decorationParent.transform.localRotation = Quaternion.identity;
        decorationParent.transform.localScale = Vector3.one;

        Random.InitState(decorationSeed);
        PlaceRoadSideDecoration(data.Roads, decorationParent.transform);
        PlaceBuildingScatter(data.Buildings, decorationParent.transform);
        PlaceNature(data, mapHalfExtent, decorationParent.transform);
    }

    private float SampleTerrainHeightLocal(float localX, float localZ)
    {
        if (_terrain == null) return 0f;
        Vector3 worldPos = _mapTransform.TransformPoint(localX, 0f, localZ);
        float worldY = _terrain.SampleHeight(worldPos);
        return _mapTransform.InverseTransformPoint(new Vector3(worldPos.x, worldY, worldPos.z)).y;
    }

    private void BuildRoadMesh(OSMWay way, Transform parent)
    {
        if (way.Points == null || way.Points.Count < 2) return;

        // Remove duplicate consecutive points so direction is never zero
        var points = new List<Vector2>();
        points.Add(way.Points[0]);
        for (int i = 1; i < way.Points.Count; i++)
        {
            Vector2 prev = way.Points[i - 1];
            Vector2 cur = way.Points[i];
            if ((cur - prev).sqrMagnitude < 1e-10f) continue;
            points.Add(cur);
        }
        if (points.Count < 2) return;

        // Subdivide long segments so roads follow curves instead of looking boxy
        if (roadSubdivideMaxSegmentLength > 0f)
        {
            points = SubdividePolyline(points, roadSubdivideMaxSegmentLength);
            if (points.Count < 2) return;
        }

        float width = defaultRoadWidth;
        if (way.Tags != null && way.Tags.TryGetValue("width", out string wStr) && float.TryParse(wStr.Replace(" m", ""), out float w))
            width = w;

        var verts = new List<Vector3>();
        var indices = new List<int>();
        Vector2 dirPrev = (points[1] - points[0]).normalized;
        if (dirPrev.sqrMagnitude < 1e-6f) return;

        for (int i = 0; i < points.Count; i++)
        {
            Vector2 p = points[i];
            if (float.IsNaN(p.x) || float.IsNaN(p.y) || float.IsInfinity(p.x) || float.IsInfinity(p.y))
                p = i > 0 ? points[i - 1] : points[1];
            float y = SampleTerrainHeightLocal(p.x, p.y) + roadHeightOffset;

            Vector2 dir;
            if (i == 0)
                dir = (points[1] - points[0]).normalized;
            else if (i == points.Count - 1)
                dir = (points[i] - points[i - 1]).normalized;
            else
                dir = ((points[i + 1] - points[i]) + (points[i] - points[i - 1])).normalized;

            if (dir.sqrMagnitude < 1e-6f) dir = dirPrev;
            else dirPrev = dir;

            Vector2 perp = new Vector2(-dir.y, dir.x);
            Vector3 left = new Vector3(p.x - perp.x * width * 0.5f, y, p.y - perp.y * width * 0.5f);
            Vector3 right = new Vector3(p.x + perp.x * width * 0.5f, y, p.y + perp.y * width * 0.5f);
            verts.Add(left);
            verts.Add(right);
        }

        if (verts.Count < 4) return;

        for (int i = 0; i < (verts.Count / 2) - 1; i++)
        {
            int a = i * 2, b = i * 2 + 1, c = (i + 1) * 2 + 1, d = (i + 1) * 2;
            indices.Add(a); indices.Add(b); indices.Add(c);
            indices.Add(a); indices.Add(c); indices.Add(d);
        }

        string roadName = logScaleDiagnostics && _roadsBuilt == 0 ? "Road_first" : "Road";
        if (logScaleDiagnostics && _roadsBuilt == 0)
        {
            _roadsBuilt++;
            Debug.Log($"OSM3DBuilder: [Scale] First road mesh: {verts.Count} verts, width={width:F1}, first segment length≈{(verts.Count >= 4 ? Vector3.Distance(verts[0], verts[2]) : 0):F1} units.");
        }
        CreateMeshGo(roadName, verts, indices, roadMaterial ?? GetDefaultRoadMaterial(), parent);
    }

    private static List<Vector2> SubdividePolyline(List<Vector2> points, float maxSegmentLength)
    {
        var result = new List<Vector2> { points[0] };
        for (int i = 1; i < points.Count; i++)
        {
            Vector2 a = points[i - 1];
            Vector2 b = points[i];
            float len = (b - a).magnitude;
            if (len <= maxSegmentLength)
            {
                result.Add(b);
                continue;
            }
            int steps = Mathf.Max(1, Mathf.CeilToInt(len / maxSegmentLength));
            for (int k = 1; k <= steps; k++)
            {
                float t = (float)k / steps;
                result.Add(Vector2.Lerp(a, b, t));
            }
        }
        return result;
    }

    private void BuildBuildingMesh(OSMWay way, Transform parent, int buildingIndex)
    {
        if (way.Points == null || way.Points.Count < 2) return;

        float height = defaultBuildingHeight;
        if (way.Tags != null)
        {
            if (way.Tags.TryGetValue("building:levels", out string levelsStr) && int.TryParse(levelsStr, out int levels))
                height = levels * metersPerLevel;
            else if (way.Tags.TryGetValue("height", out string heightStr) && float.TryParse(heightStr.Replace(" m", "").Replace("m", ""), out float h))
                height = h;
        }
        height = Mathf.Max(height, minimumBuildingHeight);

        float minX = way.Points[0].x, maxX = way.Points[0].x;
        float minZ = way.Points[0].y, maxZ = way.Points[0].y;
        for (int i = 1; i < way.Points.Count; i++)
        {
            float x = way.Points[i].x, z = way.Points[i].y;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        float cx = (minX + maxX) * 0.5f;
        float cz = (minZ + maxZ) * 0.5f;
        float baseY = SampleTerrainHeightLocal(cx, cz);

        float sizeX = Mathf.Max(maxX - minX, 0.5f);
        float sizeZ = Mathf.Max(maxZ - minZ, 0.5f);

        if (logScaleDiagnostics && _buildingsBuilt == 0)
        {
            _buildingsBuilt++;
            Debug.Log($"OSM3DBuilder: [Scale] First building: center=({cx:F1},{cz:F1}) sizeX={sizeX:F1} sizeZ={sizeZ:F1} height={height:F1} (all Unity units). If these are 100s–1000s, scale is wrong vs map overlay.");
        }

        bool usePrefab = useHousePrefabs && housePrefabs != null && housePrefabs.Length > 0;
        if (usePrefab)
        {
            int prefabIndex = Mathf.Abs((decorationSeed + buildingIndex) * 31) % housePrefabs.Length;
            GameObject prefab = housePrefabs[prefabIndex];
            if (prefab != null)
            {
                GameObject instance = Instantiate(prefab, parent);
                instance.name = "Building_" + buildingIndex;

                float scaleX = sizeX / Mathf.Max(houseReferenceSize.x, 0.01f);
                float scaleZ = sizeZ / Mathf.Max(houseReferenceSize.z, 0.01f);
                float scaleY = height / Mathf.Max(houseReferenceSize.y, 0.01f);
                float scaleYCap = 2.5f;
                scaleY = Mathf.Min(scaleY, scaleYCap);
                instance.transform.localScale = new Vector3(scaleX, scaleY, scaleZ);
                instance.transform.localPosition = new Vector3(cx, baseY, cz);
                instance.transform.localRotation = Quaternion.identity;

                Vector2 firstEdge = way.Points.Count > 1 ? (way.Points[1] - way.Points[0]) : Vector2.zero;
                if (firstEdge.sqrMagnitude > 1e-6f)
                {
                    float angle = Mathf.Atan2(firstEdge.x, firstEdge.y) * Mathf.Rad2Deg;
                    instance.transform.localRotation = Quaternion.Euler(0f, angle, 0f);
                }
                return;
            }
        }

        var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
        box.name = logScaleDiagnostics && _buildingsBuilt == 1 ? "Building_first" : "Building";
        box.transform.SetParent(parent);
        box.transform.localPosition = new Vector3(cx, baseY + height * 0.5f, cz);
        box.transform.localRotation = Quaternion.identity;
        box.transform.localScale = new Vector3(sizeX, height, sizeZ);

        var mr = box.GetComponent<MeshRenderer>();
        mr.sharedMaterial = buildingMaterial ?? GetDefaultBuildingMaterial();
    }

    private void BuildWaterMesh(OSMWay way, Transform parent)
    {
        if (way.Points == null || way.Points.Count < 3) return;

        float cx = 0f, cz = 0f;
        foreach (var p in way.Points) { cx += p.x; cz += p.y; }
        cx /= way.Points.Count;
        cz /= way.Points.Count;
        float y = SampleTerrainHeightLocal(cx, cz) + waterHeightOffset;

        var verts = new List<Vector3> { new Vector3(cx, y, cz) };
        for (int i = 0; i < way.Points.Count; i++)
            verts.Add(new Vector3(way.Points[i].x, y, way.Points[i].y));

        var indices = new List<int>();
        int numPoints = way.Points.Count;
        for (int i = 1; i < numPoints; i++)
        {
            indices.Add(0);
            indices.Add(i);
            indices.Add(i + 1);
        }
        indices.Add(0);
        indices.Add(numPoints);
        indices.Add(1);

        CreateMeshGo("Water", verts, indices, waterMaterial ?? GetDefaultWaterMaterial(), parent);
    }

    private static Material _defaultRoadMat, _defaultBuildingMat, _defaultWaterMat;

    private static void SetMaterialColor(Material mat, Color color)
    {
        mat.color = color;
        if (mat.HasProperty("_BaseColor"))
            mat.SetColor("_BaseColor", color);
        else if (mat.HasProperty("_Color"))
            mat.SetColor("_Color", color);
    }

    private void PlaceRoadSideDecoration(IList<OSMWay> roads, Transform parent)
    {
        if (roadSideDecorPrefabs == null || roadSideDecorPrefabs.Length == 0) return;

        foreach (var way in roads)
        {
            if (way.Points == null || way.Points.Count < 2) continue;
            var points = new List<Vector2> { way.Points[0] };
            for (int i = 1; i < way.Points.Count; i++)
            {
                if ((way.Points[i] - way.Points[i - 1]).sqrMagnitude >= 1e-10f)
                    points.Add(way.Points[i]);
            }
            if (points.Count < 2) continue;
            if (roadSubdivideMaxSegmentLength > 0f)
                points = SubdividePolyline(points, roadSubdivideMaxSegmentLength);
            if (points.Count < 2) continue;

            int placed = 0;
            float dist = 0f;
            for (int i = 0; i < points.Count - 1 && placed < roadDecorMaxPerRoad; i++)
            {
                Vector2 a = points[i];
                Vector2 b = points[i + 1];
                float segLen = (b - a).magnitude;
                while (dist < segLen && placed < roadDecorMaxPerRoad)
                {
                    if (Random.value > roadDecorProbability) { dist += roadDecorInterval; continue; }
                    float t = segLen > 0.0001f ? dist / segLen : 0f;
                    Vector2 p = Vector2.Lerp(a, b, t);
                    Vector2 dir = (b - a).normalized;
                    Vector2 perp = new Vector2(-dir.y, dir.x);
                    bool left = Random.value > 0.5f;
                    float off = defaultRoadWidth * 0.5f + 1f;
                    Vector2 pos = p + perp * (left ? -off : off);
                    float y = SampleTerrainHeightLocal(pos.x, pos.y);

                    GameObject prefab = roadSideDecorPrefabs[Random.Range(0, roadSideDecorPrefabs.Length)];
                    if (prefab != null)
                    {
                        var go = Instantiate(prefab, parent);
                        go.transform.localPosition = new Vector3(pos.x, y, pos.y);
                        go.transform.localRotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                        go.transform.localScale = Vector3.one;
                        placed++;
                    }
                    dist += roadDecorInterval;
                }
                dist -= segLen;
            }
        }
    }

    private void PlaceBuildingScatter(IList<OSMWay> buildings, Transform parent)
    {
        if (buildingScatterPrefabs == null || buildingScatterPrefabs.Length == 0 || buildingScatterMaxPerBuilding <= 0) return;

        for (int b = 0; b < buildings.Count; b++)
        {
            var way = buildings[b];
            if (way.Points == null || way.Points.Count < 2) continue;
            float minX = way.Points[0].x, maxX = way.Points[0].x;
            float minZ = way.Points[0].y, maxZ = way.Points[0].y;
            for (int i = 1; i < way.Points.Count; i++)
            {
                float x = way.Points[i].x, z = way.Points[i].y;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
            }
            float cx = (minX + maxX) * 0.5f;
            float cz = (minZ + maxZ) * 0.5f;
            float margin = 1.5f;
            int n = Random.Range(0, buildingScatterMaxPerBuilding + 1);
            for (int k = 0; k < n; k++)
            {
                if (Random.value > buildingScatterProbability) continue;
                float rx = cx + Random.Range(-(maxX - minX) * 0.4f - margin, (maxX - minX) * 0.4f + margin);
                float rz = cz + Random.Range(-(maxZ - minZ) * 0.4f - margin, (maxZ - minZ) * 0.4f + margin);
                float y = SampleTerrainHeightLocal(rx, rz);
                GameObject prefab = buildingScatterPrefabs[Random.Range(0, buildingScatterPrefabs.Length)];
                if (prefab != null)
                {
                    var go = Instantiate(prefab, parent);
                    go.transform.localPosition = new Vector3(rx, y, rz);
                    go.transform.localRotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                    go.transform.localScale = Vector3.one;
                }
            }
        }
    }

    private void PlaceNature(OSMMapData data, float mapHalfExtent, Transform parent)
    {
        if ((treePrefabs == null || treePrefabs.Length == 0) && (bushPrefabs == null || bushPrefabs.Length == 0)) return;
        if (natureGridStep <= 0f) return;

        var buildingCenters = new List<Vector2>();
        foreach (var way in data.Buildings)
        {
            if (way.Points == null || way.Points.Count == 0) continue;
            float cx = 0f, cz = 0f;
            foreach (var p in way.Points) { cx += p.x; cz += p.y; }
            cx /= way.Points.Count;
            cz /= way.Points.Count;
            buildingCenters.Add(new Vector2(cx, cz));
        }

        var roadPoints = new List<Vector2>();
        foreach (var way in data.Roads)
        {
            if (way.Points == null || way.Points.Count < 2) continue;
            var pts = new List<Vector2>(way.Points);
            if (roadSubdivideMaxSegmentLength > 0f)
                pts = SubdividePolyline(pts, roadSubdivideMaxSegmentLength);
            roadPoints.AddRange(pts);
        }

        int total = 0;
        for (float x = -mapHalfExtent; x <= mapHalfExtent && total < natureMaxTotal; x += natureGridStep)
        {
            for (float z = -mapHalfExtent; z <= mapHalfExtent && total < natureMaxTotal; z += natureGridStep)
            {
                Vector2 p = new Vector2(x, z);
                foreach (var bc in buildingCenters)
                    if ((p - bc).magnitude < natureMinDistanceFromBuilding) goto nextGrid;
                foreach (var rp in roadPoints)
                    if ((p - rp).magnitude < natureMinDistanceFromRoad) goto nextGrid;

                if (treePrefabs != null && treePrefabs.Length > 0 && Random.value < treeProbability)
                {
                    GameObject prefab = treePrefabs[Random.Range(0, treePrefabs.Length)];
                    if (prefab != null)
                    {
                        float y = SampleTerrainHeightLocal(x, z);
                        var go = Instantiate(prefab, parent);
                        go.transform.localPosition = new Vector3(x, y, z);
                        go.transform.localRotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                        go.transform.localScale = Vector3.one;
                        total++;
                    }
                }
                if (total < natureMaxTotal && bushPrefabs != null && bushPrefabs.Length > 0 && Random.value < bushProbability)
                {
                    GameObject prefab = bushPrefabs[Random.Range(0, bushPrefabs.Length)];
                    if (prefab != null)
                    {
                        float y = SampleTerrainHeightLocal(x, z);
                        var go = Instantiate(prefab, parent);
                        go.transform.localPosition = new Vector3(x, y, z);
                        go.transform.localRotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                        go.transform.localScale = Vector3.one;
                        total++;
                    }
                }
                nextGrid: ;
            }
        }
    }

    private static Material GetDefaultRoadMaterial()
    {
        if (_defaultRoadMat == null)
        {
            _defaultRoadMat = CreateDefaultMaterial();
            SetMaterialColor(_defaultRoadMat, new Color(0.4f, 0.4f, 0.45f)); // dark gray
        }
        return _defaultRoadMat;
    }

    private static Material GetDefaultBuildingMaterial()
    {
        if (_defaultBuildingMat == null)
        {
            _defaultBuildingMat = CreateDefaultMaterial();
            SetMaterialColor(_defaultBuildingMat, new Color(0.6f, 0.2f, 0.9f)); // purple
        }
        return _defaultBuildingMat;
    }

    private static Material GetDefaultWaterMaterial()
    {
        if (_defaultWaterMat == null)
        {
            _defaultWaterMat = CreateDefaultMaterial();
            SetMaterialColor(_defaultWaterMat, new Color(0.2f, 0.4f, 0.8f)); // blue
        }
        return _defaultWaterMat;
    }

    private void CreateMeshGo(string name, List<Vector3> verts, List<int> indices, Material mat, Transform parent)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent);
        go.transform.localPosition = Vector3.zero;
        go.transform.localRotation = Quaternion.identity;
        go.transform.localScale = Vector3.one;

        var mf = go.AddComponent<MeshFilter>();
        var mesh = new Mesh();
        mesh.SetVertices(verts);
        mesh.SetIndices(indices, MeshTopology.Triangles, 0);
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        mf.sharedMesh = mesh;

        var mr = go.AddComponent<MeshRenderer>();
        mr.sharedMaterial = mat != null ? mat : CreateDefaultMaterial();
    }

    private static Material CreateDefaultMaterial()
    {
        Shader s = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
        return new Material(s);
    }
}
