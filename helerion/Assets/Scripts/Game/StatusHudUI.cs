using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Helerion.Game;
using Helerion.World;

namespace Helerion.UI
{
    /// <summary>
    /// Top-left status HUD for on-device debugging: map tiles, decorator, world origin.
    /// Add to a GameObject with UIDocument; assign StatusHud.uxml as Source Asset.
    /// Set Sort Order above other UI so it's visible. Always shown (no character required).
    /// If MapGround/Decorator/WorldOrigin are missing from the scene, shows "not in scene" after a short delay.
    /// </summary>
    [AddComponentMenu("Helerion/Status HUD")]
    public class StatusHudUI : MonoBehaviour
    {
        [Tooltip("If null, uses UIDocument on this GameObject.")]
        public UIDocument uiDocument;
        [Tooltip("Seconds after start before showing 'not in scene' when status is still default.")]
        public float detectMissingAfter = 0.5f;

        private VisualElement _root;
        private Label _mapLabel;
        private Label _decoratorLabel;
        private Label _originLabel;
        private Label _extraLabel;
        private float _startTime = -1f;

        private void OnEnable()
        {
            _startTime = Time.time;
            TryBindLabels();
        }

        private void TryBindLabels()
        {
            var doc = uiDocument != null ? uiDocument : GetComponent<UIDocument>();
            if (doc == null || doc.rootVisualElement == null) return;

            _root = doc.rootVisualElement.Q<VisualElement>("status-root");
            if (_root == null) _root = doc.rootVisualElement;

            _mapLabel = _root.Q<Label>("status-map");
            _decoratorLabel = _root.Q<Label>("status-decorator");
            _originLabel = _root.Q<Label>("status-origin");
            _extraLabel = _root.Q<Label>("status-extra");
        }

        private void Update()
        {
            if (_root == null) TryBindLabels();
            if (_root == null) return;

            float elapsed = _startTime >= 0 ? Time.time - _startTime : 0f;
            bool doFallback = elapsed >= detectMissingAfter;

            if (doFallback || IsStatusUnset(GameplayStatus.MapStatus))
            {
                if (IsStatusUnset(GameplayStatus.MapStatus))
                {
                    if (UnityEngine.Object.FindObjectOfType<MapGround>() == null)
                        GameplayStatus.MapStatus = "MapGround not in scene";
                    else
                        GameplayStatus.MapStatus = "running (no update yet)";
                }
                if (IsStatusUnset(GameplayStatus.DecoratorStatus))
                {
                    if (UnityEngine.Object.FindObjectOfType<ProceduralMapDecorator>() == null)
                        GameplayStatus.DecoratorStatus = "Decorator not in scene";
                    else
                        GameplayStatus.DecoratorStatus = "running (no update yet)";
                }
                if (IsStatusUnset(GameplayStatus.WorldOriginStatus))
                {
                    if (UnityEngine.Object.FindObjectOfType<WorldOrigin>() == null)
                        GameplayStatus.WorldOriginStatus = "WorldOrigin not in scene";
                    else
                        GameplayStatus.WorldOriginStatus = "set (no coords yet)";
                }
            }

            if (_mapLabel != null) _mapLabel.text = "Map: " + GameplayStatus.MapStatus;
            if (_decoratorLabel != null) _decoratorLabel.text = "Decorator: " + GameplayStatus.DecoratorStatus;
            if (_originLabel != null) _originLabel.text = GameplayStatus.WorldOriginStatus;
            if (_extraLabel != null)
            {
                _extraLabel.text = GameplayStatus.ExtraLine;
                _extraLabel.style.display = string.IsNullOrEmpty(GameplayStatus.ExtraLine) ? DisplayStyle.None : DisplayStyle.Flex;
            }
        }

        private static bool IsStatusUnset(string s)
        {
            if (string.IsNullOrEmpty(s)) return true;
            s = s.Trim();
            return s == "-" || s == "—" || s == "--" || s.Length <= 2 && s.All(c => c == '-' || c == '\u2014');
        }
    }
}
