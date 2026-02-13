using System;
using UnityEngine;

namespace Helerion.Services
{
    /// <summary>
    /// Wraps Unity's Input.location for GPS. In Editor, use mock location for testing.
    /// Named GpsLocationService to avoid conflict with UnityEngine.LocationService.
    /// </summary>
    public class GpsLocationService
    {
        public bool IsRunning => Input.location.status == UnityEngine.LocationServiceStatus.Running;
        public float Latitude => Input.location.status == UnityEngine.LocationServiceStatus.Running ? Input.location.lastData.latitude : _mockLat;
        public float Longitude => Input.location.status == UnityEngine.LocationServiceStatus.Running ? Input.location.lastData.longitude : _mockLng;

        private float _mockLat = 37.7749f;
        private float _mockLng = -122.4194f;

        /// <summary>
        /// Mock location for Editor / testing. Call before Start() if needed.
        /// </summary>
        public void SetMockLocation(float lat, float lng)
        {
            _mockLat = lat;
            _mockLng = lng;
        }

        public void Start(Action onSuccess, Action<string> onError)
        {
            if (Input.location.isEnabledByUser == false)
            {
                onError?.Invoke("Location not enabled by user");
                return;
            }
            Input.location.Start(1f, 1f);
            // Wait for status in a runner; caller can use coroutine.
            onSuccess?.Invoke();
        }

        public void Stop()
        {
            Input.location.Stop();
        }
    }
}
