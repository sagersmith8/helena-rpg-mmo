using System;
using UnityEngine;
#if UNITY_ANDROID
using UnityEngine.Android;
#endif

namespace Helerion.Services
{
    /// <summary>
    /// Wraps Unity's Input.location for GPS. On Android, requests location permission at runtime so the user gets the prompt.
    /// Named GpsLocationService to avoid conflict with UnityEngine.LocationService.
    /// </summary>
    public class GpsLocationService
    {
        public bool IsRunning => Input.location.status == UnityEngine.LocationServiceStatus.Running;
        public float Latitude => Input.location.status == UnityEngine.LocationServiceStatus.Running ? Input.location.lastData.latitude : _mockLat;
        public float Longitude => Input.location.status == UnityEngine.LocationServiceStatus.Running ? Input.location.lastData.longitude : _mockLng;
        /// <summary>Heading in degrees (0 = north, 90 = east). -1 if compass not available.</summary>
        public float Heading => Input.compass.enabled ? Input.compass.trueHeading : -1f;

        private float _mockLat = 37.7749f;
        private float _mockLng = -122.4194f;
        private bool _permissionRequested;

        /// <summary>
        /// Mock location for Editor / testing. Call before Start() if needed.
        /// </summary>
        public void SetMockLocation(float lat, float lng)
        {
            _mockLat = lat;
            _mockLng = lng;
        }

        /// <summary>
        /// Call from main thread. On Android, requests fine location permission so the system prompt appears; when user allows, starts location.
        /// Use high accuracy (fine) location in Player Settings for this game, not low accuracy only.
        /// </summary>
        public void Start(Action onSuccess, Action<string> onError)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (!Permission.HasUserAuthorizedPermission(Permission.FineLocation))
            {
                if (!_permissionRequested)
                {
                    _permissionRequested = true;
                    var callbacks = new PermissionCallbacks();
                    callbacks.PermissionGranted += _ =>
                    {
                        Input.compass.enabled = true;
                        Input.location.Start(0.5f, 0.1f); // 0.5m accuracy, update every 0.1m for responsive walking
                        onSuccess?.Invoke();
                    };
                    callbacks.PermissionDenied += _ => onError?.Invoke("Location denied. Enable it in device Settings → Apps → this app.");
                    callbacks.PermissionDeniedAndDontAskAgain += _ => onError?.Invoke("Location denied. Enable in device Settings → Apps → this app → Permissions.");
                    Permission.RequestUserPermission(Permission.FineLocation, callbacks);
                }
                else
                    onError?.Invoke("Allow location when the system prompt appears (needed for map and movement).");
                return;
            }
#endif
            if (Input.location.isEnabledByUser == false)
            {
#if UNITY_EDITOR
                onSuccess?.Invoke();
                return;
#else
                onError?.Invoke("Location not enabled. Allow location when the system prompt appears.");
                return;
#endif
            }
            Input.compass.enabled = true;
            Input.location.Start(0.5f, 0.1f); // 0.5m accuracy, update every 0.1m for responsive walking
            onSuccess?.Invoke();
        }

        public void Stop()
        {
            Input.location.Stop();
        }
    }
}
