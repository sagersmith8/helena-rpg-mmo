using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Base ScriptableObject for all items. No weight; stacking is by definition identity and maxStackSize.
/// </summary>
public abstract class ItemDefinition : ScriptableObject
{
    [Tooltip("Unique identifier for this item (e.g. item_health_potion).")]
    public string id;

    [Tooltip("Display name shown in UI.")]
    public string displayName;

    [Tooltip("Short description for tooltips.")]
    [TextArea(2, 4)]
    public string description;

    [Tooltip("Icon shown in inventory/equipment slots.")]
    public Sprite icon;

    [Tooltip("Max stack size. 1 = non-stackable.")]
    [Min(1)]
    public int maxStackSize = 1;

    [Tooltip("Stat modifiers (e.g. Armor +5, Damage +10). Used for equipment bonuses and for sort/compare.")]
    public List<StatModifier> stats = new List<StatModifier>();

    /// <summary>True if this item can stack (maxStackSize > 1).</summary>
    public bool IsStackable => maxStackSize > 1;

    /// <summary>Get stat value by id, or 0 if not present.</summary>
    public float GetStatValue(string statId)
    {
        if (stats == null) return 0f;
        foreach (var s in stats)
        {
            if (s.statId == statId) return s.value;
        }
        return 0f;
    }

    /// <summary>Compare this definition to another by a given stat (higher = better). Returns &lt;0, 0, or &gt;0.</summary>
    public int CompareByStat(ItemDefinition other, string statId)
    {
        float a = GetStatValue(statId);
        float b = other != null ? other.GetStatValue(statId) : 0f;
        return a.CompareTo(b);
    }
}
