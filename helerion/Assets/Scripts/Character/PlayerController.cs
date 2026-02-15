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
        [Tooltip("Assign the Character Animator on this object (or leave empty to auto-find).")]
        public CharacterAnimator animator;
        [Header("Movement")]
        [Tooltip("How fast the player transform catches up to GPS position.")]
        public float smoothSpeed = 5f;
        [Tooltip("How fast the character rotates to face movement/heading. Lower = less twitchy.")]
        public float rotationSpeed = 1.5f;
        [Tooltip("Only sample GPS/compass this often (seconds). Higher = less jitter, character idles properly when still.")]
        public float locationPollInterval = 0.5f;
        [Header("Walk animation (hysteresis so steps can finish)")]
        [Tooltip("Start walking when distance to target is above this (or target moved more). Higher = less sensitive.")]
        public float walkThreshold = 0.1f;
        [Tooltip("Only go idle when distance is below this AND target barely moved. Keep below walkThreshold.")]
        public float idleThreshold = 0.03f;
        [Tooltip("Once walking, stay in walk for at least this many seconds so a step can play.")]
        public float minWalkDuration = 0.5f;

        private Vector3 _targetPos;
        private Vector3 _prevTargetPos;
        private bool _hasPrevTarget;
        private bool _isInWalkState;
        private float _walkStateUntil;
        private float _lastLocationPollTime = -999f;
        private float _lastHeading;
        private bool _hasLastHeading;

        private void Awake()
        {
            if (animator == null) animator = GetComponent<CharacterAnimator>();
        }

        private void Update()
        {
            if (GameManager.Instance?.worldOrigin == null) return;
            if (!GameManager.Instance.HasCharacter) return;

            float targetMoved = 0f;
            bool justPolled = (Time.time - _lastLocationPollTime) >= locationPollInterval;

            if (justPolled)
            {
                _lastLocationPollTime = Time.time;
                float lat = GameManager.Instance.LocationService?.Latitude ?? 0f;
                float lng = GameManager.Instance.LocationService?.Longitude ?? 0f;
                Vector3 newTarget = GameManager.Instance.worldOrigin.LatLngToWorld(lat, lng);
                targetMoved = _hasPrevTarget ? Vector3.Distance(newTarget, _targetPos) : 0f;
                _hasPrevTarget = true;
                _prevTargetPos = _targetPos;
                _targetPos = newTarget;
                GameManager.Instance.UpdatePlayerPosition(lat, lng);
                float h = GameManager.Instance.LocationService?.Heading ?? -1f;
                if (h >= 0f) { _lastHeading = h; _hasLastHeading = true; }
            }

            transform.position = Vector3.Lerp(transform.position, _targetPos, smoothSpeed * Time.deltaTime);

            float distToTarget = Vector3.Distance(transform.position, _targetPos);
            bool wouldBeMoving = distToTarget > walkThreshold || targetMoved > (walkThreshold * 0.5f);
            bool wouldBeIdle = distToTarget < idleThreshold && targetMoved < (idleThreshold * 0.5f);

            if (wouldBeMoving)
            {
                _isInWalkState = true;
                _walkStateUntil = Mathf.Max(_walkStateUntil, Time.time + minWalkDuration);
            }
            if (_isInWalkState && wouldBeIdle && Time.time >= _walkStateUntil)
                _isInWalkState = false;

            bool actuallyMoving = _isInWalkState;

            Vector3 moveDir = _targetPos - transform.position;
            moveDir.y = 0f;
            float rotSpeed = rotationSpeed * Time.deltaTime;

            if (actuallyMoving && moveDir.sqrMagnitude > 0.0001f)
            {
                Quaternion targetRot = Quaternion.LookRotation(moveDir.normalized);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotSpeed);
            }
            else if (_hasLastHeading)
            {
                Quaternion targetRot = Quaternion.Euler(0f, _lastHeading, 0f);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotSpeed);
            }

            if (animator != null)
                animator.SetMoving(actuallyMoving);
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
