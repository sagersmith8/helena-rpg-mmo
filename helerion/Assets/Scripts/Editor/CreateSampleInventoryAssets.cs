using UnityEngine;
using UnityEditor;
using System.IO;

/// <summary>
/// Creates sample item ScriptableObjects for testing the inventory system.
/// Menu: Helerion > Create Sample Inventory Assets
/// </summary>
public static class CreateSampleInventoryAssets
{
    private const string ItemsPath = "Assets/Data/Items";

    [MenuItem("Helerion/Create Sample Inventory Assets")]
    public static void CreateAll()
    {
        if (!Directory.Exists(ItemsPath))
            Directory.CreateDirectory(ItemsPath);

        CreateHealthPotion();
        CreateIronHelmet();
        CreateWoodenSword();
        CreateFireballAbility();
        EditorUtility.DisplayDialog("Sample Items", "Sample inventory assets created in " + ItemsPath, "OK");
    }

    private static void CreateHealthPotion()
    {
        var asset = ScriptableObject.CreateInstance<ConsumableItemDefinition>();
        asset.id = "item_health_potion";
        asset.displayName = "Health Potion";
        asset.description = "Restores 50 Health.";
        asset.maxStackSize = 99;
        asset.effects.Add(new ConsumableEffect("Health", 50f));
        AssetDatabase.CreateAsset(asset, ItemsPath + "/HealthPotion.asset");
    }

    private static void CreateIronHelmet()
    {
        var asset = ScriptableObject.CreateInstance<EquipmentItemDefinition>();
        asset.id = "item_iron_helmet";
        asset.displayName = "Iron Helmet";
        asset.description = "A sturdy iron helmet.";
        asset.slot = EquipmentSlot.Helmet;
        asset.stats.Add(new StatModifier("Armor", 5f));
        AssetDatabase.CreateAsset(asset, ItemsPath + "/IronHelmet.asset");
    }

    private static void CreateWoodenSword()
    {
        var asset = ScriptableObject.CreateInstance<EquipmentItemDefinition>();
        asset.id = "item_wooden_sword";
        asset.displayName = "Wooden Sword";
        asset.description = "A simple wooden sword.";
        asset.slot = EquipmentSlot.MainHand;
        asset.stats.Add(new StatModifier("Damage", 8f));
        AssetDatabase.CreateAsset(asset, ItemsPath + "/WoodenSword.asset");
    }

    private static void CreateFireballAbility()
    {
        var asset = ScriptableObject.CreateInstance<AbilityItemDefinition>();
        asset.id = "ability_fireball";
        asset.displayName = "Fireball";
        asset.description = "Hurl a ball of fire.";
        asset.abilityId = "fireball";
        AssetDatabase.CreateAsset(asset, ItemsPath + "/FireballAbility.asset");
    }
}
