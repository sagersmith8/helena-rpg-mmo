using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Helerion.Config;
using Helerion.Game;

namespace Helerion.World
{
    /// <summary>
    /// Places tree and rock prefabs on the map using the same procedural rules as the tile texture.
    /// Add to the same GameObject as MapGround (or a child). Assign prefabs in the Inspector; leave null to skip that type.
    /// Uses the same tile layout as MapGround so props line up with the painted terrain.
    ///
    /// Suggested assets (Unity Asset Store or free packs):
    /// - Trees: "Low Poly Trees", "Polygon - Nature Pack", "Nature Starter Kit", or any low-poly tree prefab (pivot at base).
    /// - Rocks: "Low Poly Rocks", "Polygon - Rock", or simple boulder prefabs. Keep poly count low; many instances are spawned.
    /// </summary>
    [AddComponentMenu("Helerion/Procedural Map Decorator")]
    public class ProceduralMapDecorator : MonoBehaviour
    {
        [Header("References")]
        public WorldOrigin worldOrigin;

        [Header("Prefabs (assign models you add to the project)")]
        [Tooltip("Tree prefab to place in forest areas. Low-poly, single or few meshes recommended.")]
        public GameObject treePrefab;
        [Tooltip("Rock/boulder prefab to place on rock terrain. Low-poly recommended.")]
        public GameObject rockPrefab;

        [Header("Placement")]
        [Tooltip("Must match MapGround: zoom level.")]
        [Range(14, 18)]
        public int tileZoom = 17;
        [Tooltip("Must match MapGround: tiles per side (e.g. 5 = 5x5 grid).")]
        [Range(2, 9)]
        public int tilesPerSide = 5;
        [Tooltip("Grid resolution per tile for sampling (e.g. 10 = 10x10). Higher = more props, heavier scene.")]
        [Range(4, 16)]
        public int placementGridRes = 10;
        [Tooltip("Random Y rotation (degrees) per instance to avoid copy-paste look.")]
        [Range(0f, 360f)]
        public float randomRotationY = 360f;
        [Tooltip("Random scale multiplier range (min, max) per instance.")]
        public Vector2 scaleRange = new Vector2(0.85f, 1.15f);
        [Tooltip("Multiply scale of all placed objects. Use 5–20 if prefabs are tiny (e.g. from asset packs) so they’re visible when zoomed out.")]
        public float placementScale = 10f;

        [Header("Timing")]
        [Tooltip("Seconds to wait before placing (should match MapGround tile load delay).")]
        public float placeDelay = 2f;
        [Tooltip("Y offset for placed objects (use if prefab pivot is at center so trees sit on ground).")]
        public float groundOffsetY = 0f;

        private GameObject _container;
        private static readonly List<MapSpawnPoint> SpawnPoints = new List<MapSpawnPoint>();

        private void Awake()
        {
            GameplayStatus.DecoratorStatus = "Decorator (starting)";
        }

        private void Start()
        {
            if (worldOrigin == null) worldOrigin = WorldOrigin.Instance;
            if (worldOrigin == null) worldOrigin = UnityEngine.Object.FindObjectOfType<WorldOrigin>();
            if (worldOrigin == null)
                GameplayStatus.DecoratorStatus = "Decorator: no WorldOrigin";
            else if (treePrefab == null && rockPrefab == null)
                GameplayStatus.DecoratorStatus = "Decorator: assign tree/rock prefabs";
            else
                StartCoroutine(PlaceAfterDelay());
        }

        private IEnumerator PlaceAfterDelay()
        {
            if (placeDelay > 0f)
                yield return new WaitForSeconds(placeDelay);
            PlaceDecorations();
        }

        private void PlaceDecorations()
        {
            if (worldOrigin == null) return;

            GameplayStatus.DecoratorStatus = "Placing…";
            int trees = 0, rocks = 0;
            float scale = GameConfig.Instance != null ? GameConfig.Instance.worldScale : 1f;
            if (scale <= 0) scale = 1f;

            int n = 1 << tileZoom;
            double lat = worldOrigin.originLatitude;
            double lng = worldOrigin.originLongitude;
            int centerTileX = (int)Mathf.Floor((float)((lng + 180.0) / 360.0 * n));
            int centerTileY = (int)Mathf.Floor((float)((1.0 - Math.Log(Math.Tan(lat * Mathf.Deg2Rad) + 1.0 / Math.Cos(lat * Mathf.Deg2Rad)) / Math.PI) / 2.0 * n));
            centerTileY = Mathf.Clamp(centerTileY, 0, n - 1);

            float degPerTile = 360f / n;
            float tileWorldWidth = degPerTile * worldOrigin.metersPerDegreeLng * scale;
            float tileWorldHeight = degPerTile * worldOrigin.metersPerDegreeLat * scale;

            _container = new GameObject("MapDecorations");
            _container.transform.SetParent(transform);
            _container.transform.localPosition = Vector3.zero;

            int half = tilesPerSide / 2;
            for (int dy = -half; dy <= half; dy++)
            {
                for (int dx = -half; dx <= half; dx++)
                {
                    int tx = centerTileX + dx;
                    int ty = centerTileY + dy;
                    if (tx < 0 || tx >= n || ty < 0 || ty >= n) continue;

                    ProceduralTileGenerator.GetSpawnPoints(tx, ty, tileZoom, placementGridRes, SpawnPoints);

                    float tileCenterX = dx * tileWorldWidth;
                    float tileCenterZ = -dy * tileWorldHeight;

                    foreach (var p in SpawnPoints)
                    {
                        float worldX = tileCenterX + (p.u - 0.5f) * tileWorldWidth;
                        float worldZ = tileCenterZ - (p.v - 0.5f) * tileWorldHeight;

                        GameObject prefab = p.feature == MapFeature.Tree ? treePrefab : rockPrefab;
                        if (prefab == null) continue;
                        if (p.feature == MapFeature.Tree) trees++; else rocks++;

                        var go = Instantiate(prefab, _container.transform);
                        go.transform.position = new Vector3(worldX, groundOffsetY, worldZ);
                        go.transform.rotation = Quaternion.Euler(0f, UnityEngine.Random.Range(0f, randomRotationY), 0f);
                        float s = placementScale * UnityEngine.Random.Range(scaleRange.x, scaleRange.y);
                        go.transform.localScale = new Vector3(s, s, s);
                    }
                }
            }

            GameplayStatus.DecoratorStatus = $"Trees: {trees}, Rocks: {rocks}";
            if (trees == 0 && rocks == 0 && (treePrefab != null || rockPrefab != null))
                UnityEngine.Debug.Log("[ProceduralMapDecorator] Placed 0 trees/rocks. Try: increase Placement Grid Res, or lower placement thresholds in ProceduralTileGenerator.");
        }
    }
}
