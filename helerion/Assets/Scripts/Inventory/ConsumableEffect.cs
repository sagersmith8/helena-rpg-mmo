using UnityEngine;

/// <summary>
/// One effect applied when a consumable is used (e.g. Health +50).
/// </summary>
[System.Serializable]
public struct ConsumableEffect
{
    [Tooltip("Stat to modify (e.g. Health, Mana).")]
    public string statId;

    [Tooltip("Amount to add (e.g. 50 for +50 Health).")]
    public float value;

    public ConsumableEffect(string statId, float value)
    {
        this.statId = statId;
        this.value = value;
    }
}
