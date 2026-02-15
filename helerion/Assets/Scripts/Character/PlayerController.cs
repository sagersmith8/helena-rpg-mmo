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
        [Tooltip("Distance to target below which we consider 'idle'. Lower = walking anim triggers on smaller GPS updates.")]
        public float movingThreshold = 0.008f;
        [Tooltip("Min target movement (world units) to count as 'target moved' for walk animation.")]
        public float targetMoveThreshold = 0.005f;

        private Vector3 _targetPos;
        private Vector3 _prevTargetPos;
        private bool _hasPrevTarget;

        private void Update()
        {
            if (GameManager.Instance?.worldOrigin == null) return;
            if (!GameManager.Instance.HasCharacter) return;

            float lat = GameManager.Instance.LocationService?.Latitude ?? 0f;
            float lng = GameManager.Instance.LocationService?.Longitude ?? 0f;
            _targetPos = GameManager.Instance.worldOrigin.LatLngToWorld(lat, lng);
            float targetMoved = _hasPrevTarget ? Vector3.Distance(_targetPos, _prevTargetPos) : 0f;
            _hasPrevTarget = true;

            transform.position = Vector3.Lerp(transform.position, _targetPos, smoothSpeed * Time.deltaTime);
            GameManager.Instance.UpdatePlayerPosition(lat, lng);

            // Rotate character by compass heading (0 = North = +Z). Camera will stay behind via local offset.
            float heading = GameManager.Instance.LocationService?.Heading ?? -1f;
            if (heading >= 0f)
            {
                // Unity: Y is up, 0° = North = +Z, 90° = East = +X
                Quaternion targetRot = Quaternion.Euler(0f, heading, 0f);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, 12f * Time.deltaTime);
            }
            else
            {
                // No compass: face movement direction when target moved
                if (targetMoved > targetMoveThreshold)
                {
                    Vector3 moveDir = _targetPos - _prevTargetPos;
                    moveDir.y = 0f;
                    if (moveDir.sqrMagnitude > 0.0001f)
                        transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(moveDir.normalized), 10f * Time.deltaTime);
                }
            }
            _prevTargetPos = _targetPos;

            // Walk when we're still catching up to target OR when target moved (small GPS updates still count)
            if (animator != null)
            {
                float distToTarget = Vector3.Distance(transform.position, _targetPos);
                bool moving = distToTarget > movingThreshold || targetMoved > targetMoveThreshold;
                animator.SetMoving(moving);
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
