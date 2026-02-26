using UnityEngine;

/// <summary>
/// Equipment (armor, weapons) that goes in a specific slot. Stats are used for bonuses when equipped.
/// </summary>
[CreateAssetMenu(fileName = "NewEquipment", menuName = "Helerion/Equipment Item")]
public class EquipmentItemDefinition : ItemDefinition
{
    [Tooltip("Which slot this item equips to.")]
    public EquipmentSlot slot;
}
