using System;
using UnityEngine;

namespace Helerion.Combat
{
    /// <summary>
    /// Health for player or enemy. Fires events for UI and death.
    /// </summary>
    public class Health : MonoBehaviour
    {
        public int current = 10;
        public int max = 10;

        public event Action<int, int> OnChanged;
        public event Action OnDeath;

        public void TakeDamage(int amount)
        {
            if (amount <= 0) return;
            current = Mathf.Max(0, current - amount);
            OnChanged?.Invoke(current, max);
            if (current <= 0) OnDeath?.Invoke();
        }

        public void Heal(int amount)
        {
            if (amount <= 0) return;
            current = Mathf.Min(max, current + amount);
            OnChanged?.Invoke(current, max);
        }

        public void SetMax(int value)
        {
            max = Mathf.Max(1, value);
            current = Mathf.Min(current, max);
            OnChanged?.Invoke(current, max);
        }
    }
}
