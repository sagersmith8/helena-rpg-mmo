using UnityEngine;
using System.Collections.Generic;
using System;

/// <summary>
/// Character stats: current/max Health and a dictionary of stat modifiers (from equipment, etc.).
/// Consumables apply effects here (e.g. Health += value).
/// </summary>
public class CharacterStats : MonoBehaviour
{
    [Header("Health")]
    [SerializeField] private float maxHealth = 100f;
    [SerializeField] private float currentHealth = 100f;

    /// <summary>Current health. Clamped to [0, MaxHealth].</summary>
    public float CurrentHealth
    {
        get => currentHealth;
        set => currentHealth = Mathf.Clamp(value, 0f, MaxHealth);
    }

    /// <summary>Max health (base + modifiers).</summary>
    public float MaxHealth => maxHealth + GetModifier("Health");

    /// <summary>Base max health before modifiers.</summary>
    public float BaseMaxHealth => maxHealth;

    private Dictionary<string, float> _modifiers = new Dictionary<string, float>();

    /// <summary>Raised when health or modifiers change. (current, max)</summary>
    public event Action<float, float> OnHealthChanged;

    /// <summary>Raised when any stat modifiers are recalculated.</summary>
    public event Action OnStatsChanged;

    private void Awake()
    {
        currentHealth = Mathf.Clamp(currentHealth, 0f, maxHealth);
    }

    /// <summary>Set base max health (e.g. from config).</summary>
    public void SetBaseMaxHealth(float value)
    {
        maxHealth = Mathf.Max(1f, value);
        currentHealth = Mathf.Clamp(currentHealth, 0f, MaxHealth);
        OnHealthChanged?.Invoke(currentHealth, MaxHealth);
    }

    /// <summary>Get total modifier for a stat (from equipment, etc.).</summary>
    public float GetModifier(string statId)
    {
        return _modifiers.TryGetValue(statId, out float v) ? v : 0f;
    }

    /// <summary>Rebuild modifiers from a list of stat modifiers (e.g. from all equipped items).</summary>
    public void SetModifiersFromEquipment(IEnumerable<StatModifier> modifiers)
    {
        _modifiers.Clear();
        if (modifiers != null)
        {
            foreach (var m in modifiers)
            {
                if (string.IsNullOrEmpty(m.statId)) continue;
                if (!_modifiers.TryGetValue(m.statId, out float existing)) existing = 0f;
                _modifiers[m.statId] = existing + m.value;
            }
        }
        OnStatsChanged?.Invoke();
        OnHealthChanged?.Invoke(currentHealth, MaxHealth);
    }

    /// <summary>Apply a consumable effect once (e.g. Health +50).</summary>
    public void ApplyConsumableEffect(string statId, float value)
    {
        if (statId == "Health")
        {
            CurrentHealth += value;
            OnHealthChanged?.Invoke(currentHealth, MaxHealth);
        }
        else
        {
            // Other stats: add to modifiers temporarily or store as "current" stat if you add that later
            if (!_modifiers.TryGetValue(statId, out float existing)) existing = 0f;
            _modifiers[statId] = existing + value;
            OnStatsChanged?.Invoke();
        }
    }

    /// <summary>Take damage (reduces CurrentHealth).</summary>
    public void TakeDamage(float amount)
    {
        CurrentHealth -= amount;
        OnHealthChanged?.Invoke(currentHealth, MaxHealth);
    }
}
