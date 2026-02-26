using UnityEngine;

/// <summary>
/// Ability that can be slotted into one of the 3 ability slots (maps to A1/A2/A3). Non-stackable.
/// </summary>
[CreateAssetMenu(fileName = "NewAbility", menuName = "Helerion/Ability Item")]
public class AbilityItemDefinition : ItemDefinition
{
    [Tooltip("Optional: ability ID or reference for actual ability logic. For now a placeholder.")]
    public string abilityId;

    private void OnValidate()
    {
        maxStackSize = 1;
    }
}
