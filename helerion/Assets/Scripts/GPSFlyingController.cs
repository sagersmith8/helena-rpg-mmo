using UnityEngine;

/// <summary>
/// Drives this GameObject's position from device GPS. Requires a Map with OSMMapDisplay to convert lat/lon to world space.
/// Attach to the Flying Beast (or any GPS-following character). Set flying height and optionally throttle updates.
/// </summary>
public class GPSFlyingController : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Map with OSM Map Display. Leave empty to auto-find in the scene.")]
    public OSMMapDisplay mapDisplay;

    [Header("Height")]
    [Tooltip("World-space Y for the flying character (Unity units).")]
    public float flyingHeight = 15f;

    [Header("GPS")]
    [Tooltip("Update position every N seconds. Set to 0 to update every frame.")]
    [Range(0f, 2f)]
    public float updateIntervalSeconds = 0.5f;

    [Tooltip("Desired accuracy in meters (passed to LocationService.Start).")]
    public float desiredAccuracyInMeters = 10f;

    [Tooltip("Minimum distance in meters before a location update (passed to LocationService.Start).")]
    public float updateDistanceInMeters = 5f;

    private float _lastUpdateTime;

    private void Start()
    {
        if (mapDisplay == null)
            mapDisplay = FindAnyObjectByType<OSMMapDisplay>();

        Input.location.Start(desiredAccuracyInMeters, updateDistanceInMeters);
    }

    private void OnDestroy()
    {
        Input.location.Stop();
    }

    private void Update()
    {
        if (mapDisplay == null || !mapDisplay.IsMapReady)
            return;

        if (Input.location.status != LocationServiceStatus.Running)
            return;

        if (updateIntervalSeconds > 0f && Time.time - _lastUpdateTime < updateIntervalSeconds)
            return;

        LocationInfo lastData = Input.location.lastData;
        Vector3 worldPos = mapDisplay.LatLonToWorld(lastData.latitude, lastData.longitude);
        worldPos.y = flyingHeight;
        transform.position = worldPos;

        _lastUpdateTime = Time.time;
    }
}
