using UnityEngine;

/// <summary>
/// Shared coordinate math: OSM tile bounds and lat/lon to world (XZ) for a given map configuration.
/// Used by terrain, OSM vector display, and map display so everything shares the same coordinate system.
/// </summary>
public static class MapCoordinateHelper
{
    /// <summary>
    /// Get geographic bounds (lat/lon) for the map given center, zoom, and tile grid size.
    /// Same formula as OSMMapDisplay so terrain and Overpass use the same bbox.
    /// </summary>
    public static void GetMapBounds(double centerLat, double centerLon, int zoom, int tileGridSize,
        out double minLat, out double maxLat, out double minLon, out double maxLon)
    {
        OSMMapDisplay.LatLonToTile(centerLat, centerLon, zoom, out int centerTileX, out int centerTileY);
        int startX = centerTileX - tileGridSize / 2;
        int startY = centerTileY - tileGridSize / 2;
        double n = 1 << zoom;

        minLon = (startX / n) * 360.0 - 180.0;
        maxLon = ((startX + tileGridSize) / n) * 360.0 - 180.0;

        // OSM tile Y: 0 = north, increases south. lat = 2*atan(exp(pi - 2*pi*y/n))*180/pi - 90
        maxLat = 90.0 - 360.0 * System.Math.Atan(System.Math.Exp(-System.Math.PI * (1.0 - 2.0 * startY / n))) / System.Math.PI;
        minLat = 90.0 - 360.0 * System.Math.Atan(System.Math.Exp(-System.Math.PI * (1.0 - 2.0 * (startY + tileGridSize) / n))) / System.Math.PI;
    }

    /// <summary>
    /// Convert lat/lon to local map XZ (Unity units) relative to map origin.
    /// Origin is at center of the map; +X = east, +Z = north.
    /// Uses continuous tile coordinates so buildings/roads get exact sub-tile placement.
    /// </summary>
    public static Vector2 LatLonToLocalXZ(double lat, double lon, double centerLat, double centerLon, int zoom,
        float worldScalePerTile)
    {
        OSMMapDisplay.LatLonToTileContinuous(centerLat, centerLon, zoom, out double centerTx, out double centerTy);
        OSMMapDisplay.LatLonToTileContinuous(lat, lon, zoom, out double tx, out double ty);
        // Center of center tile = origin; OSM Y increases south so flip for +Z = north
        float dx = (float)((tx - centerTx) * worldScalePerTile);
        float dz = (float)((centerTy - ty) * worldScalePerTile);
        return new Vector2(dx, dz);
    }
}
