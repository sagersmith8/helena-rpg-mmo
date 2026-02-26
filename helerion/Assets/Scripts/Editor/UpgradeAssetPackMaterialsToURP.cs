using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Helps fix pink materials when using Built-in asset packs (Mega Fantasy Props Pack,
/// NatureStarterKit2) in a URP project. Use "Select Asset Pack Materials" then
/// Edit → Rendering → Materials → Convert Selected Built-in Materials to URP.
/// </summary>
public static class UpgradeAssetPackMaterialsToURP
{
    private const string MegaFantasyPath = "Assets/Mega Fantasy Props Pack";
    private const string NatureKitPath = "Assets/NatureStarterKit2";

    [MenuItem("Tools/Select Asset Pack Materials (for URP conversion)")]
    public static void SelectAssetPackMaterials()
    {
        var guids = new List<string>();
        guids.AddRange(AssetDatabase.FindAssets("t:Material", new[] { MegaFantasyPath }));
        guids.AddRange(AssetDatabase.FindAssets("t:Material", new[] { NatureKitPath }));
        var materials = new List<Object>();
        foreach (string guid in guids)
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (mat != null)
                materials.Add(mat);
        }
        Selection.objects = materials.ToArray();
        Debug.Log($"Selected {materials.Count} materials from Mega Fantasy Props Pack and NatureStarterKit2. Use Edit → Rendering → Materials → Convert Selected Built-in Materials to URP.");
    }
}
