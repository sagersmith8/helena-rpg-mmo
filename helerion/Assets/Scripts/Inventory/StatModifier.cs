using UnityEngine;

/// <summary>
/// A single stat modifier (e.g. "Armor" +5, "Damage" +10). Used for equipment bonuses and sorting/comparison.
/// </summary>
[System.Serializable]
public struct StatModifier
{
    public string statId;
    public float value;

    public StatModifier(string statId, float value)
    {
        this.statId = statId;
        this.value = value;
    }
}
