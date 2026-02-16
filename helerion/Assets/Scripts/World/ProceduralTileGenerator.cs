using System.Collections.Generic;
using UnityEngine;

namespace Helerion.World
{
    public enum MapFeature
    {
        None,
        Tree,
        Rock
    }

    public struct MapSpawnPoint
    {
        public float u;
        public float v;
        public MapFeature feature;
    }

    /// <summary>
    /// Generates a single 256x256 map tile texture from tile coordinates (tx, ty, zoom).
    /// Uses world-space Perlin noise so adjacent tiles match at edges. No external assets required.
    /// Also provides spawn points for trees/rocks so a decorator can place prefabs to match the map.
    /// </summary>
    public static class ProceduralTileGenerator
    {
        public const int DefaultResolution = 256;

        // Terrain: use two layers so we get distinct water bodies and varied land (not just grass)
        // Water vs land (low freq) then land type (grass/dirt/rock)
        private const float WaterThreshold = 0.48f;
        private const float SandBand = 0.06f;
        private const float GrassLandThreshold = 0.5f;
        private const float DirtLandThreshold = 0.75f;

        // Noise scales (world-space so tile edges match)
        private const float WaterLandScale = 2.2f;
        private const float LandTypeScale = 5f;
        private const float DetailScale = 12f;
        private const float PathScale = 9f;
        private const float RoadWidthScale = 5f;
        private const float TreeClusterScale = 3.5f;
        private const float TreeDetailScale = 38f;
        private const float RockScale = 10f;

        // Feature thresholds – more trees/rocks visible on texture
        private const float RoadMax = 0.32f;
        private const float TreeClusterMin = 0.45f;
        private const float TreeDetailMin = 0.76f;
        private const float RockThreshold = 0.62f;
        // For 3D placement: lower = more trees/rocks placed
        private const float TreePlaceMin = 0.78f;
        private const float RockPlaceMin = 0.65f;

        /// <summary>
        /// Get spawn points for 3D props (trees, rocks) on this tile. Uses same noise as the texture
        /// so placements match the painted terrain. Only returns points on land (not water/sand).
        /// </summary>
        /// <param name="tx">Tile X (OSM style)</param>
        /// <param name="ty">Tile Y (OSM style)</param>
        /// <param name="zoom">Zoom level (same as map)</param>
        /// <param name="gridRes">Grid resolution per tile (e.g. 8 = 8x8 = 64 samples; higher = more dense props)</param>
        /// <param name="outPoints">List to fill with (u, v, feature); u,v in [0,1] within the tile</param>
        public static void GetSpawnPoints(int tx, int ty, int zoom, int gridRes, List<MapSpawnPoint> outPoints)
        {
            outPoints.Clear();
            float inv = 1f / gridRes;
            for (int j = 0; j < gridRes; j++)
            {
                float v = (j + 0.5f) * inv;
                float worldY = ty + v;
                for (int i = 0; i < gridRes; i++)
                {
                    float u = (i + 0.5f) * inv;
                    float worldX = tx + u;
                    SampleFeatureAt(worldX, worldY, zoom, out bool isLand, out bool isTree, out bool isRock, out float treeDetailN, out float rockN);
                    if (!isLand) continue;
                    if (isTree && treeDetailN >= TreePlaceMin) { outPoints.Add(new MapSpawnPoint { u = u, v = v, feature = MapFeature.Tree }); continue; }
                    if (isRock && rockN >= RockPlaceMin) outPoints.Add(new MapSpawnPoint { u = u, v = v, feature = MapFeature.Rock });
                }
            }
        }

        /// <summary>
        /// Sample the procedural map at a world (tx+u, ty+v) point. Use for placing props to match the texture.
        /// </summary>
        public static void SampleFeatureAt(float worldX, float worldY, int zoom, out bool isLand, out bool isTree, out bool isRock, out float treeDetailN, out float rockN)
        {
            float z = 1f / (1 << Mathf.Clamp(zoom, 10, 18));
            float wx = worldX * z * 100f;
            float wy = worldY * z * 100f;

            float waterLandN = Mathf.PerlinNoise(wx * WaterLandScale, wy * WaterLandScale);
            float treeClusterN = Mathf.PerlinNoise(wx * TreeClusterScale + 400f, wy * TreeClusterScale + 400f);
            treeDetailN = Mathf.PerlinNoise(wx * TreeDetailScale + 450f, wy * TreeDetailScale + 450f);
            rockN = Mathf.PerlinNoise(wx * RockScale + 500f, wy * RockScale + 500f);

            isLand = waterLandN >= WaterThreshold;
            isTree = isLand && treeClusterN > TreeClusterMin && treeDetailN > TreeDetailMin;
            isRock = isLand && rockN > RockThreshold;
        }

        /// <summary>
        /// Sample feature flags only (for callers that don't need placement strength).
        /// </summary>
        public static void SampleFeatureAt(float worldX, float worldY, int zoom, out bool isLand, out bool isTree, out bool isRock)
        {
            SampleFeatureAt(worldX, worldY, zoom, out isLand, out isTree, out isRock, out _, out _);
        }

        /// <summary>
        /// Generate a tile texture for the given OSM-style tile coordinates.
        /// Sampling uses (tx + u, ty + v) so neighboring tiles are continuous.
        /// </summary>
        public static Texture2D Generate(int tx, int ty, int zoom, int resolution = DefaultResolution)
        {
            var tex = new Texture2D(resolution, resolution);
            tex.filterMode = FilterMode.Bilinear;
            tex.wrapMode = TextureWrapMode.Clamp;

            float inv = 1f / resolution;
            for (int j = 0; j < resolution; j++)
            {
                float v = (j + 0.5f) * inv;
                float worldY = ty + v;
                for (int i = 0; i < resolution; i++)
                {
                    float u = (i + 0.5f) * inv;
                    float worldX = tx + u;

                    Color pixel = SampleTerrain(worldX, worldY, zoom);
                    tex.SetPixel(i, j, pixel);
                }
            }

            tex.Apply();
            return tex;
        }

        private static Color SampleTerrain(float worldX, float worldY, int zoom)
        {
            float z = 1f / (1 << Mathf.Clamp(zoom, 10, 18));
            float wx = worldX * z * 100f;
            float wy = worldY * z * 100f;

            // Layer 1: water vs land (big blobs of blue vs land)
            float waterLandN = Mathf.PerlinNoise(wx * WaterLandScale, wy * WaterLandScale);
            // Layer 2: on land, grass vs dirt vs rock
            float landTypeN = Mathf.PerlinNoise(wx * LandTypeScale + 100f, wy * LandTypeScale + 100f);
            float detailN = Mathf.PerlinNoise(wx * DetailScale + 200f, wy * DetailScale + 200f);
            float pathN = Mathf.PerlinNoise(wx * PathScale + 300f, wy * PathScale + 300f);
            float roadWidthN = Mathf.PerlinNoise(wx * RoadWidthScale + 350f, wy * RoadWidthScale + 350f);
            float treeClusterN = Mathf.PerlinNoise(wx * TreeClusterScale + 400f, wy * TreeClusterScale + 400f);
            float treeDetailN = Mathf.PerlinNoise(wx * TreeDetailScale + 450f, wy * TreeDetailScale + 450f);
            float rockN = Mathf.PerlinNoise(wx * RockScale + 500f, wy * RockScale + 500f);

            bool isTree = treeClusterN > TreeClusterMin && treeDetailN > TreeDetailMin;
            float path = Mathf.Abs(pathN - 0.5f) * 2f;
            float roadWidth = 0.2f + roadWidthN * 0.1f;
            bool onRoad = path < roadWidth && path < RoadMax;

            // --- Water / shore / land ---
            if (waterLandN < WaterThreshold - SandBand)
            {
                float t = waterLandN / (WaterThreshold - SandBand);
                return Color.Lerp(DeepWater(), ShallowWater(), t);
            }
            if (waterLandN < WaterThreshold)
            {
                float t = (waterLandN - (WaterThreshold - SandBand)) / SandBand;
                return Color.Lerp(ShallowWater(), Sand(), t);
            }

            // --- Land: grass / dirt / rock (distinct bands so not everything is green) ---
            float land = landTypeN * 0.6f + detailN * 0.4f;

            if (land < GrassLandThreshold)
            {
                float t = land / GrassLandThreshold;
                Color grass = Color.Lerp(Sand(), Grass(), t);
                grass = AddDetail(grass, detailN, 0.12f);
                if (onRoad) return Color.Lerp(grass, RoadColor(), 0.8f);
                if (isTree) return Color.Lerp(grass, TreeColor(), 0.88f);
                if (rockN > RockThreshold) return Color.Lerp(grass, Rock(), 0.55f);
                return grass;
            }
            if (land < DirtLandThreshold)
            {
                float t = (land - GrassLandThreshold) / (DirtLandThreshold - GrassLandThreshold);
                Color dirt = Color.Lerp(Grass(), Dirt(), t);
                dirt = AddDetail(dirt, detailN, 0.1f);
                if (onRoad) return Color.Lerp(dirt, RoadColor(), 0.85f);
                if (isTree) return Color.Lerp(dirt, TreeColor(), 0.8f);
                if (rockN > RockThreshold) return Color.Lerp(dirt, Rock(), 0.6f);
                return dirt;
            }

            Color rock = Rock();
            rock = AddDetail(rock, detailN, 0.12f);
            if (onRoad) return Color.Lerp(rock, RoadColor(), 0.55f);
            return rock;
        }

        private static Color AddDetail(Color baseColor, float noise, float amount)
        {
            float v = (noise - 0.5f) * amount;
            return new Color(
                Mathf.Clamp01(baseColor.r + v),
                Mathf.Clamp01(baseColor.g + v),
                Mathf.Clamp01(baseColor.b + v),
                baseColor.a
            );
        }

        // Distinct colors so the map reads as water / sand / grass / dirt / rock
        private static Color DeepWater() => new Color(0.08f, 0.20f, 0.50f);
        private static Color ShallowWater() => new Color(0.22f, 0.45f, 0.62f);
        private static Color Sand() => new Color(0.88f, 0.82f, 0.62f);
        private static Color Grass() => new Color(0.28f, 0.55f, 0.22f);
        private static Color Dirt() => new Color(0.52f, 0.40f, 0.28f);
        private static Color Rock() => new Color(0.50f, 0.48f, 0.46f);
        private static Color RoadColor() => new Color(0.55f, 0.48f, 0.40f);
        private static Color TreeColor() => new Color(0.08f, 0.32f, 0.05f);
    }
}
