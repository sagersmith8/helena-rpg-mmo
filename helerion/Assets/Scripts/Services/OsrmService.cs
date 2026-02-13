using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using Helerion.Config;

namespace Helerion.Services
{
    /// <summary>
    /// Fetches road routes from OSRM for enemy pathfinding (same idea as Helena).
    /// </summary>
    public class OsrmService
    {
        private readonly string _baseUrl;

        public OsrmService()
        {
            _baseUrl = GameConfig.Instance != null ? GameConfig.Instance.osrmBaseUrl : "https://router.project-osrm.org";
        }

        public void GetRoute(IReadOnlyList<(float lng, float lat)> waypoints, Action<List<(float lng, float lat)>> onSuccess, Action<string> onError)
        {
            if (waypoints == null || waypoints.Count < 2)
            {
                onError?.Invoke("Need at least 2 waypoints");
                return;
            }
            var coords = string.Join(";", waypoints.ConvertAll(w => $"{w.lng},{w.lat}"));
            var url = $"{_baseUrl}/route/v1/driving/{Uri.EscapeDataString(coords)}?overview=full&geometries=geojson";
            var req = UnityWebRequest.Get(url);
            var op = req.SendWebRequest();
            op.completed += _ =>
            {
                if (req.result != UnityWebRequest.Result.Success)
                {
                    onError?.Invoke(req.error);
                    req.Dispose();
                    return;
                }
                try
                {
                    var json = req.downloadHandler.text;
                    req.Dispose();
                    var route = ParseRouteGeoJson(json);
                    onSuccess?.Invoke(route);
                }
                catch (Exception e)
                {
                    onError?.Invoke(e.Message);
                    req.Dispose();
                }
            };
        }

        private static List<(float lng, float lat)> ParseRouteGeoJson(string json)
        {
            var list = new List<(float, float)>();
            // Minimal parse: find "coordinates":[[lng,lat],...]
            int i = json.IndexOf("\"coordinates\"", StringComparison.OrdinalIgnoreCase);
            if (i < 0) return list;
            i = json.IndexOf('[', i);
            if (i < 0) return list;
            int depth = 1;
            var sb = new System.Text.StringBuilder();
            for (i++; i < json.Length && depth > 0; i++)
            {
                char c = json[i];
                if (c == '[') depth++;
                else if (c == ']') depth--;
                else if (depth == 1 && (char.IsDigit(c) || c == '-' || c == '.' || c == ',' || c == ' '))
                    sb.Append(c);
                else if (depth == 1 && c == ',')
                {
                    var part = sb.ToString().Trim();
                    sb.Clear();
                    if (part.Contains(","))
                    {
                        var pair = part.Split(',');
                        if (pair.Length >= 2 && float.TryParse(pair[0].Trim(), out float lng) && float.TryParse(pair[1].Trim(), out float lat))
                            list.Add((lng, lat));
                    }
                }
            }
            return list;
        }
    }
}
