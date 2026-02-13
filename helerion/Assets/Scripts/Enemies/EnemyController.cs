using System.Collections.Generic;
using UnityEngine;
using Helerion.Combat;
using Helerion.Character;
using Helerion.Game;
using Helerion.World;

namespace Helerion.Enemies
{
    /// <summary>
    /// Enemy that follows a path (from OSRM) or chases player. Attacks when in range.
    /// </summary>
    public class EnemyController : MonoBehaviour
    {
        [Header("Movement")]
        public float moveSpeed = 3f;
        public float chaseRange = 10f;
        public float attackCooldown = 1.5f;

        [Header("References")]
        public Health health;
        public CharacterAnimator animator;
        public Transform playerTarget;

        private List<(float lng, float lat)> _path = new List<(float, float)>();
        private int _pathIndex;
        private float _lastAttackTime;

        private void Awake()
        {
            if (health == null) health = GetComponent<Health>();
            if (animator == null) animator = GetComponent<CharacterAnimator>();
        }

        private void Start()
        {
            if (playerTarget == null && GameManager.Instance != null)
            {
                var go = GameObject.FindGameObjectWithTag("Player");
                if (go != null) playerTarget = go.transform;
            }
            health.OnDeath += OnDeath;
        }

        /// <summary>
        /// Set path from OSRM (list of lng,lat in world order).
        /// </summary>
        public void SetPath(List<(float lng, float lat)> path)
        {
            _path = path ?? new List<(float, float)>();
            _pathIndex = 0;
        }

        private void Update()
        {
            if (health != null && health.current <= 0) return;

            var origin = WorldOrigin.Instance ?? FindFirstObjectByType<WorldOrigin>();
            if (origin == null) return;

            Vector3 myPos = transform.position;

            // Prefer chasing player if in range
            if (playerTarget != null)
            {
                float distToPlayer = Vector3.Distance(myPos, playerTarget.position);
                if (distToPlayer <= chaseRange)
                {
                    _chasing = true;
                    if (distToPlayer <= (CombatManager.Instance != null ? CombatManager.Instance.attackRange : 2f))
                    {
                        if (Time.time - _lastAttackTime >= attackCooldown && CombatManager.Instance != null)
                        {
                            var playerHealth = playerTarget.GetComponent<Health>();
                            var playerAnim = playerTarget.GetComponent<CharacterAnimator>();
                            if (CombatManager.Instance.TryMeleeAttack(transform, playerTarget, playerHealth, animator))
                                _lastAttackTime = Time.time;
                        }
                        if (animator != null) animator.SetMoving(false);
                        return;
                    }
                    Vector3 dir = (playerTarget.position - myPos).normalized;
                    transform.position = myPos + dir * (moveSpeed * Time.deltaTime);
                    if (animator != null) animator.SetMoving(true);
                    return;
                }
            }

            _chasing = false;

            // Follow path
            if (_path.Count == 0) { if (animator != null) animator.SetMoving(false); return; }

            Vector3 waypoint = origin.LatLngToWorld(_path[_pathIndex].lat, _path[_pathIndex].lng);
            float d = Vector3.Distance(myPos, waypoint);
            if (d < 0.5f)
            {
                _pathIndex = (_pathIndex + 1) % _path.Count;
                waypoint = _pathIndex < _path.Count ? origin.LatLngToWorld(_path[_pathIndex].lat, _path[_pathIndex].lng) : myPos;
            }
            Vector3 moveDir = (waypoint - myPos).normalized;
            transform.position = myPos + moveDir * (moveSpeed * Time.deltaTime);
            if (animator != null) animator.SetMoving(moveDir.sqrMagnitude > 0.01f);
        }

        private void OnDeath()
        {
            health.OnDeath -= OnDeath;
            // Drop loot, grant XP, etc. – hook to GameManager or LootManager
            Destroy(gameObject, 0.5f);
        }
    }
}
