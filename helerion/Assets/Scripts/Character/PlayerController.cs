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
        [Header("Movement")]
        [Tooltip("How fast the player transform catches up to GPS position.")]
        public float smoothSpeed = 5f;
        [Tooltip("Distance to target below which we consider 'idle'. Lower = walking anim triggers more easily when you physically move.")]
        public float movingThreshold = 0.03f;

        private Vector3 _targetPos;

        private void Update()
        {
            if (GameManager.Instance?.worldOrigin == null) return;
            if (!GameManager.Instance.HasCharacter) return;

            float lat = GameManager.Instance.LocationService?.Latitude ?? 0f;
            float lng = GameManager.Instance.LocationService?.Longitude ?? 0f;
            _targetPos = GameManager.Instance.worldOrigin.LatLngToWorld(lat, lng);

            Vector3 oldPos = transform.position;
            transform.position = Vector3.Lerp(transform.position, _targetPos, smoothSpeed * Time.deltaTime);
            GameManager.Instance.UpdatePlayerPosition(lat, lng);

            if (animator != null)
            {
                float dist = Vector3.Distance(transform.position, _targetPos);
                animator.SetMoving(dist > movingThreshold);
            }

            // Face movement direction so it's obvious you're walking
            Vector3 moveDir = transform.position - oldPos;
            if (moveDir.sqrMagnitude > 0.0001f)
            {
                moveDir.y = 0f;
                if (moveDir.sqrMagnitude > 0.0001f)
                    transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(moveDir.normalized), 10f * Time.deltaTime);
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
