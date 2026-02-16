using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using Helerion.Config;
using Helerion.Game;

namespace Helerion.World
{
    public enum MapTileStyle
    {
        ProceduralOnly,
        OsmOnly,
        ProceduralWithOsmFallback
    }

    /// <summary>
    /// Creates a ground plane and optionally loads map tiles (procedural terrain and/or OpenStreetMap).
    /// Add to a GameObject; assign WorldOrigin. It will create a large plane and a map layer
    /// when origin is set (or use default). OSM tiles show streets; use zoom 16–17 for walking scale.
    /// </summary>
    [AddComponentMenu("Helerion/Map Ground")]
    public class MapGround : MonoBehaviour
    {
        [Header("References")]
        public WorldOrigin worldOrigin;

        [Header("Ground plane")]
        [Tooltip("Size of the ground plane in Unity units (each side).")]
        public float groundSize = 500f;
        [Tooltip("Material for ground (optional; default is a simple gray).")]
        public Material groundMaterial;

        [Header("Map layer")]
        [Tooltip("Show map tiles on top of ground (OSM and/or procedural).")]
        public bool showMapTiles = true;
        [Tooltip("How to fill tiles: Procedural = generated terrain only; OSM = real map imagery; OSM with procedural fallback = try OSM, use procedural if load fails.")]
        public MapTileStyle mapTileStyle = MapTileStyle.ProceduralWithOsmFallback;
        [Tooltip("Zoom level (16–18 good for streets).")]
        [Range(14, 18)]
        public int tileZoom = 17;
        [Tooltip("Tiles per side (e.g. 5 = 5x5 grid around center).")]
        [Range(2, 9)]
        public int tilesPerSide = 5;
        [Tooltip("Tile server URL for OSM. {z} {x} {y} replaced. Used when style is OSM or procedural fallback.")]
        public string tileServerUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
        [Tooltip("Resolution of each procedural tile (pixels per side).")]
        [Range(128, 512)]
        public int proceduralTileResolution = 256;

        private GameObject _groundGo;
        private GameObject _tilesGo;
        private bool _tilesStarted;

        [Header("Timing")]
        [Tooltip("Seconds to wait before loading tiles (so GPS/origin is set).")]
        public float tileLoadDelay = 2f;

        private void Awake()
        {
            GameplayStatus.MapStatus = "MapGround (starting)";
        }

        private void Start()
        {
            if (worldOrigin == null) worldOrigin = WorldOrigin.Instance;
            if (worldOrigin == null) worldOrigin = UnityEngine.Object.FindObjectOfType<WorldOrigin>();
            CreateGround();
            if (worldOrigin != null)
                GameplayStatus.WorldOriginStatus = $"Origin: {worldOrigin.originLatitude:F4}, {worldOrigin.originLongitude:F4}";
            if (showMapTiles && worldOrigin != null)
            {
                GameplayStatus.MapStatus = "Loading tiles…";
                StartCoroutine(LoadTilesAfterDelay());
            }
            else if (showMapTiles)
            {
                GameplayStatus.MapStatus = "no WorldOrigin";
                GameplayStatus.WorldOriginStatus = "WorldOrigin not in scene";
            }
            else
                GameplayStatus.MapStatus = "tiles off (enable Show Map Tiles)";
        }

        private IEnumerator LoadTilesAfterDelay()
        {
            if (tileLoadDelay > 0f)
                yield return new WaitForSeconds(tileLoadDelay);
            yield return LoadTilesWhenReady();
        }

        private void CreateGround()
        {
            if (_groundGo != null) return;
            _groundGo = GameObject.CreatePrimitive(PrimitiveType.Plane);
            _groundGo.name = "MapGround_Plane";
            _groundGo.transform.SetParent(transform);
            _groundGo.transform.localPosition = Vector3.zero;
            _groundGo.transform.localRotation = Quaternion.identity;
            _groundGo.transform.localScale = new Vector3(groundSize / 10f, 1f, groundSize / 10f); // Plane is 10x10 default
            if (groundMaterial != null)
                _groundGo.GetComponent<Renderer>().sharedMaterial = groundMaterial;
            else
            {
                var mat = new Material(Shader.Find("Standard"));
                mat.color = new Color(0.4f, 0.45f, 0.4f);
                _groundGo.GetComponent<Renderer>().sharedMaterial = mat;
            }
        }

        private IEnumerator LoadTilesWhenReady()
        {
            if (_tilesStarted) yield break;
            _tilesStarted = true;
            double lat = worldOrigin.originLatitude;
            double lng = worldOrigin.originLongitude;
            float scale = GameConfig.Instance != null ? GameConfig.Instance.worldScale : 1f;
            if (scale <= 0) scale = 1f;

            int n = 1 << tileZoom;
            int centerTileX = (int)Mathf.Floor((float)((lng + 180.0) / 360.0 * n));
            int centerTileY = (int)Mathf.Floor((float)((1.0 - Math.Log(Math.Tan(lat * Mathf.Deg2Rad) + 1.0 / Math.Cos(lat * Mathf.Deg2Rad)) / Math.PI) / 2.0 * n));
            centerTileY = Mathf.Clamp(centerTileY, 0, n - 1);

            float degPerTile = 360f / n;
            float tileWorldWidth = degPerTile * worldOrigin.metersPerDegreeLng * scale;
            float tileWorldHeight = degPerTile * worldOrigin.metersPerDegreeLat * scale;

            _tilesGo = new GameObject("MapTiles");
            _tilesGo.transform.SetParent(transform);
            _tilesGo.transform.localPosition = Vector3.zero;

            int half = tilesPerSide / 2;
            for (int dy = -half; dy <= half; dy++)
            {
                for (int dx = -half; dx <= half; dx++)
                {
                    int tx = centerTileX + dx;
                    int ty = centerTileY + dy;
                    if (tx < 0 || tx >= n || ty < 0 || ty >= n) continue;

                    Texture2D tex = null;
                    bool useOsm = mapTileStyle == MapTileStyle.OsmOnly || mapTileStyle == MapTileStyle.ProceduralWithOsmFallback;

                    if (useOsm)
                    {
                        string url = tileServerUrl.Replace("{z}", tileZoom.ToString()).Replace("{x}", tx.ToString()).Replace("{y}", ty.ToString());
                        var req = UnityWebRequestTexture.GetTexture(url);
                        req.SetRequestHeader("User-Agent", "HelerionRPG/1.0 (Unity; location-based game; learn more: github.com)");
                        yield return req.SendWebRequest();

                        if (req.result == UnityWebRequest.Result.Success)
                        {
                            tex = (req.downloadHandler as DownloadHandlerTexture)?.texture;
                        }
                        else
                        {
                            UnityEngine.Debug.LogWarning($"[MapGround] OSM tile {tx},{ty} failed: {req.responseCode} {req.error}");
                        }
                        req.Dispose();
                    }

                    if (tex == null && (mapTileStyle == MapTileStyle.ProceduralOnly || mapTileStyle == MapTileStyle.ProceduralWithOsmFallback))
                    {
                        tex = ProceduralTileGenerator.Generate(tx, ty, tileZoom, proceduralTileResolution);
                    }

                    if (tex == null) continue;

                    var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
                    quad.name = $"Tile_{tx}_{ty}";
                    quad.transform.SetParent(_tilesGo.transform);
                    quad.transform.localRotation = Quaternion.Euler(90f, 0f, 0f); // Flat on XZ
                    quad.transform.localPosition = new Vector3(dx * tileWorldWidth, 0.02f, -dy * tileWorldHeight); // -dy so +Y tile is north
                    quad.transform.localScale = new Vector3(tileWorldWidth, tileWorldHeight, 1f);

                    var rend = quad.GetComponent<Renderer>();
                    Shader shader = Shader.Find("Unlit/Texture") ?? Shader.Find("Standard");
                    var mat = new Material(shader);
                    mat.mainTexture = tex;
                    rend.sharedMaterial = mat;
                }
            }

            int tileCount = _tilesGo != null ? _tilesGo.transform.childCount : 0;
            GameplayStatus.MapStatus = tileCount > 0 ? $"Tiles: {tileCount}" : "Tiles: 0 (check network or origin)";
        }
    }
}
