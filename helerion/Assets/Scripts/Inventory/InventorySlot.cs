using UnityEngine;

/// <summary>
/// A single inventory slot: optional item definition and count. Empty when definition is null.
/// </summary>
[System.Serializable]
public struct InventorySlot
{
    public ItemDefinition definition;
    public int count;

    public bool IsEmpty => definition == null || count <= 0;

    public static InventorySlot Empty => new InventorySlot { definition = null, count = 0 };

    public InventorySlot(ItemDefinition definition, int count)
    {
        this.definition = definition;
        this.count = count;
    }

    public bool CanStackWith(ItemDefinition other)
    {
        return definition != null && other != null && definition == other &&
               definition.IsStackable && count < definition.maxStackSize;
    }
}
