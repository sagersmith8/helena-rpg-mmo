using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

/// <summary>
/// Displays one inventory slot (icon, count). Tap to select; selection is used by InventoryPanelUI for Equip/Use.
/// </summary>
public class InventorySlotUI : MonoBehaviour, IPointerClickHandler
{
    [SerializeField] private Image iconImage;
    [SerializeField] private Text countText;

    private int _slotIndex;

    public void SetReferences(Image icon, Text count)
    {
        iconImage = icon;
        countText = count;
    }
    private System.Action<int> _onClicked;

    public int SlotIndex => _slotIndex;

    public void Setup(int slotIndex, System.Action<int> onClicked)
    {
        _slotIndex = slotIndex;
        _onClicked = onClicked;
    }

    public void Refresh(ItemDefinition definition, int count)
    {
        if (iconImage != null)
        {
            iconImage.enabled = definition != null && definition.icon != null;
            if (definition != null && definition.icon != null)
                iconImage.sprite = definition.icon;
        }
        if (countText != null)
        {
            countText.enabled = definition != null && count > 1;
            countText.text = count > 1 ? count.ToString() : "";
        }
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        _onClicked?.Invoke(_slotIndex);
    }
}
