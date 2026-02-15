using UnityEngine;
using UnityEngine.UIElements;
using Helerion.Game;

namespace Helerion.UI
{
    /// <summary>
    /// Bottom HUD showing location (lat/lng) and orientation (heading). Uses UI Toolkit.
    /// Add to a GameObject with UIDocument; assign LocationHud.uxml as Source Asset.
    /// Set Sort Order below character creation so HUD is visible in game. Only shown when HasCharacter.
    /// </summary>
    [AddComponentMenu("Helerion/Location HUD")]
    public class LocationHudUI : MonoBehaviour
    {
        [Tooltip("If null, uses UIDocument on this GameObject.")]
        public UIDocument uiDocument;

        private VisualElement _root;
        private Label _latLabel;
        private Label _lngLabel;
        private Label _headingLabel;

        private void OnEnable()
        {
            var doc = uiDocument != null ? uiDocument : GetComponent<UIDocument>();
            if (doc == null || doc.rootVisualElement == null) return;

            _root = doc.rootVisualElement.Q<VisualElement>("hud-root");
            if (_root == null) _root = doc.rootVisualElement;

            _latLabel = _root.Q<Label>("lat-label");
            _lngLabel = _root.Q<Label>("lng-label");
            _headingLabel = _root.Q<Label>("heading-label");
        }

        private void Update()
        {
            if (_root == null || GameManager.Instance == null) return;

            _root.style.display = GameManager.Instance.HasCharacter ? DisplayStyle.Flex : DisplayStyle.None;
            if (_root.style.display != DisplayStyle.Flex) return;

            var loc = GameManager.Instance.LocationService;
            if (loc != null)
            {
                if (_latLabel != null) _latLabel.text = $"Lat: {loc.Latitude:F5}";
                if (_lngLabel != null) _lngLabel.text = $"Lng: {loc.Longitude:F5}";
                float h = loc.Heading;
                if (_headingLabel != null)
                    _headingLabel.text = h >= 0 ? $"Heading: {h:F0}°" : "Heading: —";
            }
        }
    }
}
