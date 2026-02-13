using UnityEngine;

namespace Helerion.Config
{
    /// <summary>
    /// Configuration for Helerion. Set in Inspector or via env.
    /// Uses same backend as Helena (PostgREST / Supabase).
    /// </summary>
    [CreateAssetMenu(fileName = "GameConfig", menuName = "Helerion/Game Config", order = 0)]
    public class GameConfig : ScriptableObject
    {
        [Header("Backend")]
        [Tooltip("PostgREST or Supabase REST base URL. No trailing slash.")]
        public string apiBaseUrl = "http://localhost:3000";

        [Header("OSRM")]
        [Tooltip("OSRM server for road-based enemy paths.")]
        public string osrmBaseUrl = "https://router.project-osrm.org";

        [Header("World")]
        [Tooltip("Meters per Unity unit at origin. 1 unit = 1 meter typical.")]
        public float metersPerUnit = 1f;

        [Tooltip("Scale factor when loading OSM/geo data into world space.")]
        public float worldScale = 1f;

        public static GameConfig Instance { get; private set; }

        private void OnEnable()
        {
            Instance = this;
        }

        private void OnDisable()
        {
            if (Instance == this)
                Instance = null;
        }
    }
}
