using UnityEngine;
using System;

/// <summary>
/// Reads A1/A2/A3 from MobileInputProvider and triggers the ability slotted in CharacterInventory (Ability0/1/2).
/// Add to the player with CharacterInventory. Subscribe to OnAbilityTriggered to run ability logic.
/// </summary>
public class AbilitySlotTrigger : MonoBehaviour
{
    private CharacterInventory _inventory;

    /// <summary>Fired when an ability button is pressed and that slot has an ability. (abilitySlotIndex 0-2, abilityId from AbilityItemDefinition)</summary>
    public event Action<int, string> OnAbilityTriggered;

    private void Awake()
    {
        _inventory = GetComponent<CharacterInventory>();
        if (_inventory == null) _inventory = FindFirstObjectByType<CharacterInventory>();
    }

    private void Update()
    {
        if (_inventory == null || MobileInputProvider.Instance == null) return;

        if (MobileInputProvider.Instance.Ability1Down) TryTrigger(0);
        if (MobileInputProvider.Instance.Ability2Down) TryTrigger(1);
        if (MobileInputProvider.Instance.Ability3Down) TryTrigger(2);
    }

    private void TryTrigger(int slotIndex)
    {
        var slot = (EquipmentSlot)((int)EquipmentSlot.Ability0 + slotIndex);
        var def = _inventory.GetEquipped(slot);
        if (def is AbilityItemDefinition abilityDef)
        {
            string id = string.IsNullOrEmpty(abilityDef.abilityId) ? def.id : abilityDef.abilityId;
            OnAbilityTriggered?.Invoke(slotIndex, id);
        }
    }
}
