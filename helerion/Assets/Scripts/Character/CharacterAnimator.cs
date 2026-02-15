using UnityEngine;

namespace Helerion.Character
{
    /// <summary>
    /// Drives Animator for idle / walk / attack. Assign in Inspector.
    /// </summary>
    public class CharacterAnimator : MonoBehaviour
    {
        [Header("Animator")]
        public Animator animator;

        private static readonly int Move = Animator.StringToHash("Move");
        private static readonly int Attack = Animator.StringToHash("Attack");
        private static readonly int Hit = Animator.StringToHash("Hit");

        private void Awake()
        {
            if (animator == null) animator = GetComponent<Animator>();
        }

        public void SetMoving(bool moving)
        {
            if (animator != null) animator.SetBool(Move, moving);
        }

        public void TriggerAttack()
        {
            if (animator != null) animator.SetTrigger(Attack);
        }

        public void TriggerHit()
        {
            if (animator != null) animator.SetTrigger(Hit);
        }
    }
}
