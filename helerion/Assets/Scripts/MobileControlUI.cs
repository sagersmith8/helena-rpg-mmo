using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem.UI;

/// <summary>
/// Builds the mobile HUD at runtime: virtual joystick (bottom-left) and ability buttons (bottom-right).
/// Add this to a GameObject in the scene. Creates Canvas (Screen Space Overlay) and EventSystem if missing.
/// </summary>
public class MobileControlUI : MonoBehaviour
{
    [Header("Layout (pixels from edges, at 1080p reference)")]
    public float joystickMarginX = 120f;
    public float joystickMarginY = 120f;
    public float joystickSize = 200f;
    public float buttonMarginX = 120f;
    public float buttonMarginY = 120f;
    public float buttonSize = 90f;
    public float buttonSpacing = 12f;

    private Canvas _canvas;
    private CanvasScaler _scaler;

    private void Awake()
    {
        EnsureEventSystem();
        BuildCanvas();
    }

    private void EnsureEventSystem()
    {
        if (FindAnyObjectByType<UnityEngine.EventSystems.EventSystem>() == null)
        {
            var go = new GameObject("EventSystem");
            go.AddComponent<UnityEngine.EventSystems.EventSystem>();
            go.AddComponent<InputSystemUIInputModule>();
        }
    }

    private void BuildCanvas()
    {
        var root = new GameObject("MobileControlCanvas");
        root.transform.SetParent(transform);

        _canvas = root.AddComponent<Canvas>();
        _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        root.AddComponent<GraphicRaycaster>();

        _scaler = root.AddComponent<CanvasScaler>();
        _scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        _scaler.referenceResolution = new Vector2(1920f, 1080f);
        _scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        _scaler.matchWidthOrHeight = 0.5f; // balance for landscape

        if (MobileInputProvider.Instance == null)
        {
            var providerGo = new GameObject("MobileInputProvider");
            providerGo.transform.SetParent(transform);
            providerGo.AddComponent<MobileInputProvider>();
        }

        BuildJoystick(root.transform);
        BuildAbilityButtons(root.transform);
    }

    private void BuildJoystick(Transform parent)
    {
        var panel = new GameObject("JoystickPanel");
        panel.transform.SetParent(parent, false);

        var rect = panel.GetComponent<RectTransform>();
        if (rect == null) rect = panel.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 0);
        rect.anchorMax = new Vector2(0, 0);
        rect.pivot = new Vector2(0, 0);
        rect.anchoredPosition = new Vector2(joystickMarginX, joystickMarginY);
        rect.sizeDelta = new Vector2(joystickSize, joystickSize);

        var bg = new GameObject("JoystickBg");
        bg.transform.SetParent(panel.transform, false);
        var bgRect = bg.AddComponent<RectTransform>();
        bgRect.anchorMin = Vector2.zero;
        bgRect.anchorMax = Vector2.one;
        bgRect.offsetMin = Vector2.zero;
        bgRect.offsetMax = Vector2.zero;
        var bgImage = bg.AddComponent<Image>();
        bgImage.color = new Color(0.2f, 0.2f, 0.2f, 0.6f);
        bgImage.raycastTarget = true;

        var handle = new GameObject("Handle");
        handle.transform.SetParent(panel.transform, false);
        var handleRect = handle.AddComponent<RectTransform>();
        handleRect.anchorMin = new Vector2(0.5f, 0.5f);
        handleRect.anchorMax = new Vector2(0.5f, 0.5f);
        handleRect.pivot = new Vector2(0.5f, 0.5f);
        handleRect.anchoredPosition = Vector2.zero;
        float handleSize = joystickSize * 0.4f;
        handleRect.sizeDelta = new Vector2(handleSize, handleSize);
        var handleImage = handle.AddComponent<Image>();
        handleImage.color = new Color(0.5f, 0.5f, 0.5f, 0.9f);
        handleImage.raycastTarget = false;

        var joystick = panel.AddComponent<VirtualJoystick>();
        joystick.handle = handleRect;
        joystick.radius = joystickSize * 0.35f;
        joystick.snapBack = true;
    }

    private void BuildAbilityButtons(Transform parent)
    {
        var panel = new GameObject("AbilityButtonsPanel");
        panel.transform.SetParent(parent, false);

        var rect = panel.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(1, 0);
        rect.anchorMax = new Vector2(1, 0);
        rect.pivot = new Vector2(1, 0);
        rect.anchoredPosition = new Vector2(-buttonMarginX, buttonMarginY);
        float w = buttonSize * 2 + buttonSpacing;
        float h = buttonSize * 2 + buttonSpacing;
        rect.sizeDelta = new Vector2(w, h);

        float x0 = 0, x1 = buttonSize + buttonSpacing;
        float y0 = 0, y1 = buttonSize + buttonSpacing;
        AddAbilityButton(panel.transform, "A1", new Vector2(x0, y1), AbilityButton.Ability.Ability1);
        AddAbilityButton(panel.transform, "A2", new Vector2(x1, y1), AbilityButton.Ability.Ability2);
        AddAbilityButton(panel.transform, "A3", new Vector2(x0, y0), AbilityButton.Ability.Ability3);
        AddAbilityButton(panel.transform, "ULT", new Vector2(x1, y0), AbilityButton.Ability.Ultimate);
    }

    private void AddAbilityButton(Transform parent, string label, Vector2 anchoredPos, AbilityButton.Ability ability)
    {
        var go = new GameObject("Btn_" + label);
        go.transform.SetParent(parent, false);

        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 0);
        rect.anchorMax = new Vector2(0, 0);
        rect.pivot = new Vector2(0, 0);
        rect.anchoredPosition = anchoredPos;
        rect.sizeDelta = new Vector2(buttonSize, buttonSize);

        var image = go.AddComponent<Image>();
        image.color = new Color(0.25f, 0.4f, 0.6f, 0.85f);
        image.raycastTarget = true;

        var ab = go.AddComponent<AbilityButton>();
        ab.ability = ability;

        var textGo = new GameObject("Text");
        textGo.transform.SetParent(go.transform, false);
        var textRect = textGo.AddComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
        var text = textGo.AddComponent<Text>();
        text.text = label;
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = Mathf.RoundToInt(buttonSize * 0.35f);
        text.alignment = TextAnchor.MiddleCenter;
        text.color = Color.white;
    }
}
