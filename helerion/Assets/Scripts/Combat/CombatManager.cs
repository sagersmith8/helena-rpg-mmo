using UnityEngine;
using Helerion.Character;
using Helerion.Game;

namespace Helerion.Combat
{
    /// <summary>
    /// Resolves melee hit: apply damage, trigger attack/hit animations.
    /// Extend for abilities and backend sync (patch character health, etc.).
    /// </summary>
    public class CombatManager : MonoBehaviour
    {
        public static CombatManager Instance { get; private set; }

        [Header("Combat")]
        public int baseDamage = 3;
        public float attackRange = 2f;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        /// <summary>
        /// Try to perform melee attack from attacker to defender. Returns true if in range and hit.
        /// </summary>
        public bool TryMeleeAttack(Transform attacker, Transform defender, Health defenderHealth, CharacterAnimator attackerAnimator, int damageOverride = -1)
        {
            if (attacker == null || defender == null || defenderHealth == null) return false;
            float dist = Vector3.Distance(attacker.position, defender.position);
            if (dist > attackRange) return false;

            int dmg = damageOverride >= 0 ? damageOverride : baseDamage;
            defenderHealth.TakeDamage(dmg);
            attackerAnimator?.TriggerAttack();
            var defenderAnim = defender.GetComponent<CharacterAnimator>();
            defenderAnim?.TriggerHit();

            // Sync to backend if defender is player
            if (GameManager.Instance?.HasCharacter == true && defender.CompareTag("Player"))
                GameManager.Instance.Api.PatchCharacter(GameManager.Instance.PlayerCharacter.id, GameManager.Instance.PlayerCharacter, () => { }, _ => { });

            return true;
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }
    }
}
