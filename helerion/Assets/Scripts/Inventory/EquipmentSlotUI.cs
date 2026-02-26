using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

/// <summary>
/// Displays one equipment slot. Tap to select (show tooltip) or unequip. Used by InventoryPanelUI.
/// Supports optional placeholder image and/or text when the slot is empty.
/// </summary>
public class EquipmentSlotUI : MonoBehaviour, IPointerClickHandler
{
    [SerializeField] private Image iconImage;
    [SerializeField] private Text labelText;

    private Image _placeholderImage;
    private Text _placeholderText;
    private EquipmentSlot _slot;
    private System.Action<EquipmentSlot> _onClicked;

    public EquipmentSlot Slot => _slot;

    public void SetReferences(Image icon, Text label)
    {
        iconImage = icon;
        labelText = label;
    }

    public void SetPlaceholder(Image placeholderImage, Text placeholderText)
    {
        _placeholderImage = placeholderImage;
        _placeholderText = placeholderText;
    }

    public void Setup(EquipmentSlot slot, System.Action<EquipmentSlot> onClicked)
    {
        _slot = slot;
        _onClicked = onClicked;
        if (labelText != null)
            labelText.text = slot.ToString();
        if (_placeholderText != null)
            _placeholderText.text = slot.ToString();
    }

    public void Refresh(ItemDefinition definition)
    {
        bool hasItem = definition != null && definition.icon != null;

        if (iconImage != null)
        {
            iconImage.enabled = hasItem;
            if (hasItem)
                iconImage.sprite = definition.icon;
        }

        if (_placeholderImage != null)
            _placeholderImage.enabled = !hasItem;

        if (_placeholderText != null)
            _placeholderText.enabled = !hasItem;
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        _onClicked?.Invoke(_slot);
    }
}
