using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Creates a small "Inv" button on the HUD to open/close the inventory panel.
/// Add to any GameObject; finds InventoryPanelUI in scene. Place on the same object as MobileControlUI to keep HUD together.
/// </summary>
public class InventoryToggleButton : MonoBehaviour
{
    [Header("Layout (pixels from top-left at 1920x1080)")]
    public float marginX = 120f;
    public float marginY = 120f;
    public float buttonSize = 70f;

    private Button _button;
    private InventoryPanelUI _panel;

    private void Start()
    {
        _panel = FindFirstObjectByType<InventoryPanelUI>();
        if (_panel == null) return;

        var root = new GameObject("InventoryToggleCanvas");
        root.transform.SetParent(transform);

        var canvas = root.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 5;
        root.AddComponent<GraphicRaycaster>();

        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920f, 1080f);
        scaler.matchWidthOrHeight = 0.5f;

        var panel = new GameObject("InvButtonPanel").AddComponent<RectTransform>();
        panel.SetParent(root.transform, false);
        panel.anchorMin = new Vector2(0, 1);
        panel.anchorMax = new Vector2(0, 1);
        panel.pivot = new Vector2(0, 1);
        panel.anchoredPosition = new Vector2(marginX, -marginY);
        panel.sizeDelta = new Vector2(buttonSize, buttonSize);

        var image = panel.gameObject.AddComponent<Image>();
        image.color = new Color(0.25f, 0.4f, 0.6f, 0.9f);
        _button = panel.gameObject.AddComponent<Button>();
        _button.onClick.AddListener(() => _panel.ToggleOpen());

        var textGo = new GameObject("Text");
        textGo.transform.SetParent(panel, false);
        var textRect = textGo.AddComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
        var text = textGo.AddComponent<Text>();
        text.text = "Inv";
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = Mathf.RoundToInt(buttonSize * 0.4f);
        text.alignment = TextAnchor.MiddleCenter;
        text.color = Color.white;
    }
}
