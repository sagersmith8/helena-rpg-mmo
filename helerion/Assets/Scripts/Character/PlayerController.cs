using UnityEngine;
using Helerion.Game;
using Helerion.World;
using Helerion.Services;

namespace Helerion.Character
{
    /// <summary>
    /// Moves player transform to GPS position in world space. Hook up Animator for idle/walk.
    /// </summary>
    public class PlayerController : MonoBehaviour
    {
        [Header("References")]
        public CharacterAnimator animator;
        public float smoothSpeed = 5f;

        private Vector3 _targetPos;

        private void Update()
        {
            if (GameManager.Instance?.worldOrigin == null) return;
            // Move from GPS even without a backend character (demo mode)
            if (!GameManager.Instance.HasCharacter) return;

            float lat = GameManager.Instance.LocationService?.Latitude ?? 0f;
            float lng = GameManager.Instance.LocationService?.Longitude ?? 0f;
            _targetPos = GameManager.Instance.worldOrigin.LatLngToWorld(lat, lng);

            transform.position = Vector3.Lerp(transform.position, _targetPos, smoothSpeed * Time.deltaTime);
            GameManager.Instance.UpdatePlayerPosition(lat, lng);

            if (animator != null)
            {
                float dist = Vector3.Distance(transform.position, _targetPos);
                animator.SetMoving(dist > 0.1f);
            }
        }

        public void UpdateBackendPosition()
        {
            if (!GameManager.Instance?.HasCharacter == true) return;
            double lat = GameManager.Instance.LocationService?.Latitude ?? 0;
            double lng = GameManager.Instance.LocationService?.Longitude ?? 0;
            GameManager.Instance.UpdatePlayerPosition(lat, lng);
        }
    }
}
