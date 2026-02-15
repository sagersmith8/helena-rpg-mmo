using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Helerion.Game;
using Helerion.World;
using Helerion.Services;

namespace Helerion.Enemies
{
    /// <summary>
    /// Spawns enemies on a road path near the player (OSRM). Same idea as Helena.
    /// </summary>
    public class EnemySpawner : MonoBehaviour
    {
        [Header("Spawning")]
        public GameObject enemyPrefab;
        public float spawnRadiusMeters = 80f;
        public int pathWaypoints = 8;
        public float spawnInterval = 20f;

        private OsrmService _osrm;
        private float _nextSpawn;

        private void Start()
        {
            _osrm = new OsrmService();
            _nextSpawn = Time.time + 5f; // first spawn after 5s
        }

        private void Update()
        {
            if (enemyPrefab == null || GameManager.Instance?.worldOrigin == null) return;
            if (!GameManager.Instance.HasCharacter) return;

            if (Time.time < _nextSpawn) return;

            _nextSpawn = Time.time + spawnInterval;
            StartCoroutine(SpawnOne());
        }

        private IEnumerator SpawnOne()
        {
            var origin = WorldOrigin.Instance;
            if (origin == null) yield break;

            double lat = GameManager.Instance.PlayerCharacter?.latitude ?? origin.originLatitude;
            double lng = GameManager.Instance.PlayerCharacter?.longitude ?? origin.originLongitude;

            // Circle of waypoints for OSRM (road route)
            var waypoints = new List<(float lng, float lat)>();
            float radiusDeg = (float)(spawnRadiusMeters / 111320.0);
            for (int i = 0; i < pathWaypoints; i++)
            {
                float t = (2f * Mathf.PI * i) / pathWaypoints;
                float dLng = radiusDeg * Mathf.Cos(t) / Mathf.Cos((float)lat * Mathf.Deg2Rad);
                float dLat = radiusDeg * Mathf.Sin(t);
                waypoints.Add(((float)lng + dLng, (float)lat + dLat));
            }

            bool done = false;
            List<(float lng, float lat)> route = null;
            _osrm.GetRoute(waypoints, r => { route = r; done = true; }, _ => { done = true; });
            float timeout = 8f;
            while (!done && timeout > 0f) { timeout -= Time.deltaTime; yield return null; }

            Vector3 spawnPos;
            if (route != null && route.Count > 0)
            {
                spawnPos = origin.LatLngToWorld(route[0].lat, route[0].lng);
            }
            else
            {
                // Fallback: spawn at first waypoint if OSRM failed (e.g. no network)
                spawnPos = origin.LatLngToWorld(waypoints[0].lat, waypoints[0].lng);
            }

            var go = Instantiate(enemyPrefab, spawnPos, Quaternion.identity);
            var controller = go.GetComponent<EnemyController>();
            if (controller != null && route != null && route.Count > 0)
                controller.SetPath(route);

            var health = go.GetComponent<Combat.Health>();
            if (health != null) { health.current = 10; health.max = 10; }
        }
    }
}
