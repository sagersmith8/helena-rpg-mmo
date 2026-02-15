using UnityEngine;
using Helerion.Config;

namespace Helerion.World
{
    /// <summary>
    /// Converts real-world lat/lng to Unity world space.
    /// Place at scene origin; set OriginLat/Lng once (e.g. first GPS fix) so we don't drift.
    /// </summary>
    public class WorldOrigin : MonoBehaviour
    {
        public static WorldOrigin Instance { get; private set; }

        [Header("Origin (set at runtime or in Editor for testing)")]
        public double originLatitude = 37.7749;
        public double originLongitude = -122.4194;

        [Header("Scale")]
        [Tooltip("Meters per degree latitude at origin (approx 111320 at equator).")]
        public float metersPerDegreeLat = 111320f;
        [Tooltip("Meters per degree longitude at origin (cos(lat) * 111320).")]
        public float metersPerDegreeLng = 85390f;

        private void Awake()
        {
            Instance = this;
            if (metersPerDegreeLng <= 0)
                metersPerDegreeLng = metersPerDegreeLat * Mathf.Cos((float)originLatitude * Mathf.Deg2Rad);
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Set world origin to this lat/lng (e.g. first player location).
        /// </summary>
        public void SetOrigin(double lat, double lng)
        {
            originLatitude = lat;
            originLongitude = lng;
            metersPerDegreeLng = metersPerDegreeLat * Mathf.Cos((float)lat * Mathf.Deg2Rad);
        }

        /// <summary>
        /// Convert lat/lng to Unity XZ (flat world). Y can be terrain later.
        /// </summary>
        public Vector3 LatLngToWorld(double lat, double lng)
        {
            float scale = GameConfig.Instance != null ? GameConfig.Instance.worldScale : 1f;
            float x = (float)((lng - originLongitude) * metersPerDegreeLng) * scale;
            float z = (float)((lat - originLatitude) * metersPerDegreeLat) * scale;
            return new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Convert Unity XZ to lat/lng.
        /// </summary>
        public void WorldToLatLng(Vector3 world, out double lat, out double lng)
        {
            float scale = GameConfig.Instance != null ? GameConfig.Instance.worldScale : 1f;
            if (scale <= 0) scale = 1f;
            lng = originLongitude + (world.x / (metersPerDegreeLng * scale));
            lat = originLatitude + (world.z / (metersPerDegreeLat * scale));
        }
    }
}
