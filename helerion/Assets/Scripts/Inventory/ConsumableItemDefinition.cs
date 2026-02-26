using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Consumable item: use to apply immediate one-shot effects (e.g. heal). Stackable; no weight.
/// </summary>
[CreateAssetMenu(fileName = "NewConsumable", menuName = "Helerion/Consumable Item")]
public class ConsumableItemDefinition : ItemDefinition
{
    [Tooltip("Effects applied when used (e.g. Health +50).")]
    public List<ConsumableEffect> effects = new List<ConsumableEffect>();

    private void OnValidate()
    {
        if (maxStackSize < 2) maxStackSize = 2;
    }
}
