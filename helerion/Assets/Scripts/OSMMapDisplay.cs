using System.Collections;
using UnityEngine;

/// <summary>
/// Displays OpenStreetMap tiles on a plane and converts real-world lat/lon to Unity world position (XZ).
/// Add this to an empty GameObject; it will create a child plane with the map texture.
/// Set your center lat/lon and zoom, then use LatLonToWorld to position the player.
/// </summary>
public class OSMMapDisplay : MonoBehaviour
{
    [Header("Map center (where you want to play)")]
    [Tooltip("Latitude of map center (e.g. your city)")]
    public double centerLatitude = 37.7749;
    [Tooltip("Longitude of map center")]
    public double centerLongitude = -122.4194;

    [Header("Map settings")]
    [Tooltip("Zoom level 0–19. Higher = more detail, smaller area.")]
    [Range(0, 19)]
    public int zoomLevel = 16;
    [Tooltip("Unity units per OSM tile (1 tile ≈ 256px). Increase for a bigger map on screen.")]
    public float worldScalePerTile = 50f;
    [Tooltip("Number of tiles to load in each direction (1 = single tile, 2 = 2x2, etc.)")]
    [Range(1, 5)]
    public int tileGridSize = 2;

    [Header("OSM overlay alignment")]
    [Tooltip("Shift 3D OSM (roads/buildings) in map local space to match the raster overlay. +X = East, +Z = North. If vector data appears South/West of the map, try small positive values (e.g. 2–10).")]
    public Vector2 osmOverlayOffset = Vector2.zero;

    [Header("Optional")]
    [Tooltip("Custom tile server URL. {z} {x} {y} are replaced. Leave empty for default OSM.")]
    public string tileServerUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    private int _centerTileX, _centerTileY;
    private bool _mapReady;
    private Material _mapMaterial;
    private Texture2D _mapTexture;
    private GameObject _mapPlane;
    private Terrain _terrainForHeight;

    /// <summary> OSM raster texture (available after map is ready). Used for terrain overlay. </summary>
    public Texture2D MapTexture => _mapTexture;

    /// <summary> The flat map plane (optional: hide when using terrain overlay). </summary>
    public GameObject MapPlane => _mapPlane;

    private void Start()
    {
        StartCoroutine(BuildMap());
    }

    private IEnumerator BuildMap()
    {
        LatLonToTile(centerLatitude, centerLongitude, zoomLevel, out _centerTileX, out _centerTileY);

        int startX = _centerTileX - tileGridSize / 2;
        int startY = _centerTileY - tileGridSize / 2;
        int size = tileGridSize;
        int totalTiles = size * size;
        int tilePixels = 256;
        int texWidth = tilePixels * size;
        int texHeight = tilePixels * size;

        var texture = new Texture2D(texWidth, texHeight);
        texture.filterMode = FilterMode.Bilinear;
        int loaded = 0;
        string userAgent = "HelerionUnity/1.0 (location-based game)";

        for (int dy = 0; dy < size; dy++)
        {
            for (int dx = 0; dx < size; dx++)
            {
                int x = startX + dx;
                int y = startY + dy;
                string url = (string.IsNullOrEmpty(tileServerUrl)
                    ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    : tileServerUrl)
                    .Replace("{z}", zoomLevel.ToString())
                    .Replace("{x}", x.ToString())
                    .Replace("{y}", y.ToString());

                using (var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url))
                {
                    req.SetRequestHeader("User-Agent", userAgent);
                    yield return req.SendWebRequest();
                    if (req.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                    {
                        var tileTex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);
                        int px = dx * tilePixels;
                        int py = (size - 1 - dy) * tilePixels; // flip so north is up in Unity
                        var pixels = tileTex.GetPixels(0, 0, tilePixels, tilePixels);
                        texture.SetPixels(px, py, tilePixels, tilePixels, pixels);
                    }
                    loaded++;
                }
            }
        }

        texture.Apply();
        _mapTexture = texture;

        // Create plane
        var plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
        plane.name = "OSMMapPlane";
        _mapPlane = plane;
        plane.transform.SetParent(transform);
        plane.transform.localPosition = Vector3.zero;
        plane.transform.localRotation = Quaternion.identity;
        float planeScale = (tilePixels * size) / 10f; // Unity plane is 10x10 by default
        float scale = (worldScalePerTile * size) / 10f;
        plane.transform.localScale = new Vector3(scale, 1f, scale);

        // Use URP Unlit so we don't depend on lighting; fallback for non-URP
        Shader shader = Shader.Find("Universal Render Pipeline/Unlit")
            ?? Shader.Find("Unlit/Texture");
        _mapMaterial = new Material(shader);
        _mapMaterial.mainTexture = texture;
        plane.GetComponent<Renderer>().sharedMaterial = _mapMaterial;

        _mapReady = true;
        yield return null;
    }

    /// <summary>
    /// Convert latitude/longitude to Unity world position (X, 0, Z) relative to this map.
    /// Y is 0; set height on the object you place.
    /// </summary>
    public Vector3 LatLonToWorld(double lat, double lon)
    {
        if (!_mapReady)
            return transform.position;

        LatLonToTileContinuous(lat, lon, zoomLevel, out double tx, out double ty);
        double centerTx = _centerTileX + 0.5;
        double centerTy = _centerTileY + 0.5;
        // Tile coordinates: origin at center of center tile. OSM Y increases downward (south).
        float dx = (float)((tx - centerTx) * worldScalePerTile);
        float dz = (float)((centerTy - ty) * worldScalePerTile); // flip so north = +Z
        return transform.TransformPoint(new Vector3(dx, 0f, dz));
    }

    /// <summary>
    /// Convert latitude/longitude to Unity world position, with Y sampled from Terrain if assigned.
    /// </summary>
    public Vector3 LatLonToWorldWithHeight(double lat, double lon)
    {
        Vector3 p = LatLonToWorld(lat, lon);
        if (_terrainForHeight != null)
            p.y = _terrainForHeight.SampleHeight(p);
        return p;
    }

    /// <summary>
    /// Set the Terrain used for height sampling (e.g. by DEMTerrainBuilder when terrain is ready).
    /// </summary>
    public void SetTerrainForHeight(Terrain terrain)
    {
        _terrainForHeight = terrain;
    }

    /// <summary>
    /// Sample height at a world XZ position. Uses Terrain if set, otherwise returns 0.
    /// </summary>
    public float SampleHeightAtWorld(Vector3 worldPos)
    {
        if (_terrainForHeight != null)
            return _terrainForHeight.SampleHeight(worldPos);
        return 0f;
    }

    /// <summary>
    /// True when the map texture has been built and LatLonToWorld is valid.
    /// </summary>
    public bool IsMapReady => _mapReady;

    /// <summary>
    /// OSM Slippy map: lat/lon to tile indices at given zoom (integer, for tile loading).
    /// </summary>
    public static void LatLonToTile(double lat, double lon, int zoom, out int tileX, out int tileY)
    {
        LatLonToTileContinuous(lat, lon, zoom, out double x, out double y);
        double n = 1 << zoom;
        tileX = Mathf.Clamp((int)x, 0, (int)n - 1);
        tileY = Mathf.Clamp((int)y, 0, (int)n - 1);
    }

    /// <summary>
    /// Lat/lon to continuous tile coordinates (sub-tile precision). Use for exact XZ placement.
    /// </summary>
    public static void LatLonToTileContinuous(double lat, double lon, int zoom, out double tileX, out double tileY)
    {
        double n = 1 << zoom;
        double latRad = lat * System.Math.PI / 180.0;
        tileX = (lon + 180.0) / 360.0 * n;
        tileY = (1.0 - System.Math.Log(System.Math.Tan(latRad) + 1.0 / System.Math.Cos(latRad)) / System.Math.PI) / 2.0 * n;
    }
}
