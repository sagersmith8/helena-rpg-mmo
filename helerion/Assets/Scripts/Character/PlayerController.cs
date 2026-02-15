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
        public float rotationSpeed = 3f;
        [Header("Walk animation (hysteresis so steps can finish)")]
        [Tooltip("Start walking when distance to target is above this (or target moved more).")]
        public float walkThreshold = 0.04f;
        [Tooltip("Only go idle when distance is below this AND target barely moved. Keep below walkThreshold.")]
        public float idleThreshold = 0.015f;
        [Tooltip("Once walking, stay in walk for at least this many seconds so a step can play.")]
        public float minWalkDuration = 0.5f;

        private Vector3 _targetPos;
        private Vector3 _prevTargetPos;
        private bool _hasPrevTarget;
        private bool _isInWalkState;
        private float _walkStateUntil;

        private void Awake()
        {
            if (animator == null) animator = GetComponent<CharacterAnimator>();
        }

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

            float distToTarget = Vector3.Distance(transform.position, _targetPos);
            bool wouldBeMoving = distToTarget > walkThreshold || targetMoved > (walkThreshold * 0.5f);
            bool wouldBeIdle = distToTarget < idleThreshold && targetMoved < (idleThreshold * 0.5f);

            // Hysteresis: once walking, stay walking until we're clearly idle and min duration has passed
            if (wouldBeMoving)
            {
                _isInWalkState = true;
                _walkStateUntil = Mathf.Max(_walkStateUntil, Time.time + minWalkDuration);
            }
            if (_isInWalkState && wouldBeIdle && Time.time >= _walkStateUntil)
                _isInWalkState = false;

            bool actuallyMoving = _isInWalkState;

            // Face movement direction when moving; use heading when idle. Rotation speed kept low so it's not twitchy.
            Vector3 moveDir = _targetPos - transform.position;
            moveDir.y = 0f;
            float rotSpeed = rotationSpeed * Time.deltaTime;

            if (actuallyMoving && moveDir.sqrMagnitude > 0.0001f)
            {
                Quaternion targetRot = Quaternion.LookRotation(moveDir.normalized);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotSpeed);
            }
            else
            {
                float heading = GameManager.Instance.LocationService?.Heading ?? -1f;
                if (heading >= 0f)
                {
                    Quaternion targetRot = Quaternion.Euler(0f, heading, 0f);
                    transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotSpeed);
                }
            }
            _prevTargetPos = _targetPos;

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
