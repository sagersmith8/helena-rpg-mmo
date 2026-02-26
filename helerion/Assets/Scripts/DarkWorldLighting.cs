using UnityEngine;
using UnityEngine.Rendering;

/// <summary>
/// Makes the world mostly dark at runtime so the Flying Beast's light is the main light source.
/// Add to any GameObject (e.g. Map or an empty "Lighting"); on Start, dims the directional light and ambient.
/// Optionally ensures the flying character has a visible Point Light.
/// </summary>
public class DarkWorldLighting : MonoBehaviour
{
    [Header("Directional light")]
    [Tooltip("Intensity for the main directional light (sun). Set to 0 to effectively disable it.")]
    [Range(0f, 1f)]
    public float directionalLightIntensity = 0.1f;

    [Header("Ambient")]
    [Tooltip("Ambient intensity (flat fill). Keep low so the flying character's light stands out.")]
    [Range(0f, 0.5f)]
    public float ambientIntensity = 0.12f;

    [Tooltip("Dark ambient color (used when switching to Flat mode).")]
    public Color ambientColor = new Color(0.04f, 0.04f, 0.06f, 1f);

    [Header("Flying character light (optional)")]
    [Tooltip("Name of the flying character GameObject. If set, ensures it has a visible Point Light.")]
    public string flyingCharacterName = "Flying Beast";

    [Tooltip("Minimum light range so the magic light reaches the ground. Applied if flying character has a Light.")]
    public float minLightRange = 50f;

    [Tooltip("Minimum light intensity so the magic is visible.")]
    public float minLightIntensity = 2.5f;

    private void Start()
    {
        // Dim or disable directional lights
        Light[] lights = FindObjectsByType<Light>(FindObjectsSortMode.None);
        foreach (Light light in lights)
        {
            if (light.type == LightType.Directional)
            {
                light.intensity = directionalLightIntensity;
                if (directionalLightIntensity <= 0f)
                    light.enabled = false;
            }
        }

        // Dark ambient
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = ambientColor;
        RenderSettings.ambientIntensity = ambientIntensity;

        // Ensure flying character has a visible light
        if (string.IsNullOrEmpty(flyingCharacterName)) return;

        GameObject flying = GameObject.Find(flyingCharacterName);
        if (flying == null) return;

        Light pointLight = flying.GetComponent<Light>();
        if (pointLight == null)
        {
            pointLight = flying.AddComponent<Light>();
            pointLight.type = LightType.Point;
            pointLight.color = new Color(0.9f, 0.92f, 1f);
            pointLight.range = minLightRange;
            pointLight.intensity = minLightIntensity;
        }
        else
        {
            if (pointLight.range < minLightRange) pointLight.range = minLightRange;
            if (pointLight.intensity < minLightIntensity) pointLight.intensity = minLightIntensity;
        }
    }
}
