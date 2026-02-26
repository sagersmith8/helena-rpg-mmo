using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

/// <summary>
/// Expandable inventory panel: grid of slots, equipment strip, sort, tooltip/compare. Builds UI at runtime.
/// Add to a GameObject; assign CharacterInventory or it will be found. Toggle with Open/Close or a key.
/// </summary>
public class InventoryPanelUI : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Leave empty to find in scene.")]
    public CharacterInventory inventory;

    [Header("Layout (reference 1920x1080)")]
    public float panelWidth = 560f;
    public float panelHeightMin = 200f;
    public float panelHeightMax = 1150f;
    [Tooltip("Space between the top of the modal and the first row of content. Increase if content appears above the panel.")]
    public float panelMarginTop = 16f;
    [Tooltip("Space between the bottom of the modal and the tooltip/buttons. Increase if content appears below the panel.")]
    public float panelMarginBottom = 16f;
    [Tooltip("Space between the left edge of the modal and the content (e.g. Sort row, header).")]
    public float panelMarginLeft = 16f;
    [Tooltip("Space between the right edge of the modal and the content.")]
    public float panelMarginRight = 16f;
    [Header("Equipment panel (paper-doll, opens with inventory)")]
    [Tooltip("Width of the equipment panel (adjacent to inventory).")]
    public float equipmentPanelWidth = 280f;
    [Tooltip("Height of the equipment panel.")]
    public float equipmentPanelHeight = 640f;
    [Tooltip("Gap between inventory panel and equipment panel.")]
    public float gapBetweenPanels = 16f;
    [Tooltip("Slot size in the equipment paper-doll (larger = easier to read).")]
    public float equipmentSlotSize = 72f;
    [Tooltip("Optional placeholder sprite per slot when empty. Order: Helmet, Chest, Gloves, Bracers, Boots, Ring1, Ring2, Amulet, MainHand, OffHand, Ranged, Ability0, Ability1, Ability2. Leave element empty for text-only placeholder.")]
    public Sprite[] equipmentPlaceholderSprites = new Sprite[14];
    [Tooltip("Inventory grid slot size (match ability buttons = 90).")]
    public float inventorySlotSize = 90f;
    public float slotSpacing = 8f;
    public int inventoryColumns = 5;
    [Tooltip("Total number of inventory slots to show in the grid. Rows = ceil(slotCount / columns).")]
    [Range(1, 99)]
    public int inventorySlotCount = 40;

    private Canvas _canvas;
    private RectTransform _panelRoot;
    private RectTransform _equipmentPanelRoot;
    private RectTransform _inventoryGridRoot;
    private List<InventorySlotUI> _inventorySlots = new List<InventorySlotUI>();
    private List<EquipmentSlotUI> _equipmentSlots = new List<EquipmentSlotUI>();
    private Button _sortNameBtn;
    private Button _sortTypeBtn;
    private Button _sortArmorBtn;
    private Button _sortDamageBtn;
    private ItemTooltipUI _tooltip;
    private Button _useButton;
    private Button _equipButton;
    private Button _unequipButton;
    private Button _splitButton;
    private Button _expandButton;
    private bool _expanded = true;
    private int _selectedInventoryIndex = -1;
    private EquipmentSlot? _selectedEquipmentSlot;
    private CharacterStats _characterStats;

    private void Awake()
    {
        if (inventory == null) inventory = FindFirstObjectByType<CharacterInventory>();
        if (inventory != null) _characterStats = inventory.GetComponent<CharacterStats>();
        BuildPanel();
    }

    private void OnEnable()
    {
        if (inventory != null)
        {
            inventory.OnInventoryChanged += RefreshAll;
            inventory.OnEquipmentChanged += OnEquipmentChanged;
        }
        RefreshAll();
    }

    private void OnDisable()
    {
        if (inventory != null)
        {
            inventory.OnInventoryChanged -= RefreshAll;
            inventory.OnEquipmentChanged -= OnEquipmentChanged;
        }
    }

    private void OnEquipmentChanged(EquipmentSlot slot, ItemDefinition definition)
    {
        RefreshAll();
    }

    public void ToggleOpen()
    {
        if (_canvas != null) _canvas.enabled = !_canvas.enabled;
    }

    public void Open() { if (_canvas != null) _canvas.enabled = true; }
    public void Close() { if (_canvas != null) _canvas.enabled = false; }

    public void ToggleExpand()
    {
        _expanded = !_expanded;
        if (_panelRoot != null)
            _panelRoot.sizeDelta = new Vector2(panelWidth, _expanded ? panelHeightMax : panelHeightMin);
        if (_inventoryGridRoot != null)
            _inventoryGridRoot.gameObject.SetActive(_expanded);
    }

    private void BuildPanel()
    {
        var root = new GameObject("InventoryCanvas");
        root.transform.SetParent(transform);

        _canvas = root.AddComponent<Canvas>();
        _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        _canvas.sortingOrder = 10;
        root.AddComponent<GraphicRaycaster>();

        var scaler = root.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920f, 1080f);
        scaler.matchWidthOrHeight = 0.5f;

        // Full-screen dark overlay so there is always a visible dark background behind the panel
        var overlay = new GameObject("InventoryOverlay").AddComponent<RectTransform>();
        overlay.SetParent(root.transform, false);
        overlay.anchorMin = Vector2.zero;
        overlay.anchorMax = Vector2.one;
        overlay.offsetMin = Vector2.zero;
        overlay.offsetMax = Vector2.zero;
        var overlayImg = overlay.gameObject.AddComponent<Image>();
        overlayImg.color = new Color(0f, 0f, 0f, 0.6f);
        overlayImg.raycastTarget = true;

        // Inventory panel (left) and equipment panel (right) side by side
        float totalWidth = panelWidth + gapBetweenPanels + equipmentPanelWidth;
        float inventoryCenterX = -totalWidth * 0.5f + panelWidth * 0.5f;
        float equipmentCenterX = inventoryCenterX + panelWidth * 0.5f + gapBetweenPanels + equipmentPanelWidth * 0.5f;

        // Inventory panel (left)
        _panelRoot = new GameObject("InventoryPanel").AddComponent<RectTransform>();
        _panelRoot.SetParent(root.transform, false);
        _panelRoot.anchorMin = new Vector2(0.5f, 0.5f);
        _panelRoot.anchorMax = new Vector2(0.5f, 0.5f);
        _panelRoot.pivot = new Vector2(0.5f, 0.5f);
        _panelRoot.anchoredPosition = new Vector2(inventoryCenterX, 0f);
        _panelRoot.sizeDelta = new Vector2(panelWidth, panelHeightMax);

        var panelBg = _panelRoot.gameObject.AddComponent<Image>();
        panelBg.color = new Color(0.12f, 0.12f, 0.18f, 0.98f);
        panelBg.raycastTarget = true;

        // Equipment panel (right) - paper-doll layout, opens/closes with inventory
        _equipmentPanelRoot = new GameObject("EquipmentPanel").AddComponent<RectTransform>();
        _equipmentPanelRoot.SetParent(root.transform, false);
        _equipmentPanelRoot.anchorMin = new Vector2(0.5f, 0.5f);
        _equipmentPanelRoot.anchorMax = new Vector2(0.5f, 0.5f);
        _equipmentPanelRoot.pivot = new Vector2(0.5f, 0.5f);
        _equipmentPanelRoot.anchoredPosition = new Vector2(equipmentCenterX, 0f);
        _equipmentPanelRoot.sizeDelta = new Vector2(equipmentPanelWidth, equipmentPanelHeight);

        var equipmentBg = _equipmentPanelRoot.gameObject.AddComponent<Image>();
        equipmentBg.color = new Color(0.12f, 0.12f, 0.18f, 0.98f);
        equipmentBg.raycastTarget = true;

        // Layout from TOP down (y positive = below top of panel in local space)
        float top = panelHeightMax * 0.5f - panelMarginTop;

        // Header
        var header = new GameObject("Header").AddComponent<RectTransform>();
        header.SetParent(_panelRoot, false);
        header.anchorMin = new Vector2(0, 1);
        header.anchorMax = new Vector2(1, 1);
        header.pivot = new Vector2(0.5f, 1);
        header.anchoredPosition = new Vector2(0, 0);
        header.sizeDelta = new Vector2(0, 48);
        AddText(header, "Inventory", 26, TextAnchor.MiddleLeft, new Vector2(panelMarginLeft + 8, 0));
        _expandButton = AddButton(header, "−", 40, new Vector2(panelWidth - panelMarginRight - 88, 0), () => ToggleExpand());
        var closeBtn = AddButton(header, "×", 40, new Vector2(panelWidth - panelMarginRight - 40, 0), () => Close());
        top -= 56f;

        // Sort row (inset by left/right margins so it stays inside the modal)
        float sortRowWidth = panelWidth - panelMarginLeft - panelMarginRight;
        var sortRow = new GameObject("SortRow").AddComponent<RectTransform>();
        sortRow.SetParent(_panelRoot, false);
        sortRow.anchorMin = new Vector2(0.5f, 1);
        sortRow.anchorMax = new Vector2(0.5f, 1);
        sortRow.pivot = new Vector2(0.5f, 1);
        sortRow.anchoredPosition = new Vector2(0, top);
        sortRow.sizeDelta = new Vector2(sortRowWidth, 36);
        AddText(sortRow, "Sort:", 20, TextAnchor.MiddleLeft, new Vector2(-sortRowWidth * 0.5f + 16, 0));
        float sortX = -sortRowWidth * 0.5f + 80;
        _sortNameBtn = AddButton(sortRow, "Name", 72, new Vector2(sortX, 0), () => OnSortChanged(0));
        sortX += 76;
        _sortTypeBtn = AddButton(sortRow, "Type", 64, new Vector2(sortX, 0), () => OnSortChanged(1));
        sortX += 68;
        _sortArmorBtn = AddButton(sortRow, "Armor", 72, new Vector2(sortX, 0), () => OnSortChanged(2));
        sortX += 76;
        _sortDamageBtn = AddButton(sortRow, "Dmg", 56, new Vector2(sortX, 0), () => OnSortChanged(3));
        top -= 44f;

        // Inventory grid
        int rows = Mathf.CeilToInt((float)inventorySlotCount / inventoryColumns);
        float gridW = inventoryColumns * (inventorySlotSize + slotSpacing) - slotSpacing;
        float gridH = rows * (inventorySlotSize + slotSpacing) - slotSpacing;
        _inventoryGridRoot = new GameObject("InventoryGrid").AddComponent<RectTransform>();
        _inventoryGridRoot.SetParent(_panelRoot, false);
        _inventoryGridRoot.anchorMin = new Vector2(0.5f, 1);
        _inventoryGridRoot.anchorMax = new Vector2(0.5f, 1);
        _inventoryGridRoot.pivot = new Vector2(0.5f, 1);
        _inventoryGridRoot.anchoredPosition = new Vector2(0, top);
        _inventoryGridRoot.sizeDelta = new Vector2(gridW, gridH);
        top -= (gridH + 24f);

        for (int i = 0; i < inventorySlotCount; i++)
        {
            var slotUI = CreateInventorySlotUI(_inventoryGridRoot, i);
            _inventorySlots.Add(slotUI);
        }

        // Tooltip + action buttons at bottom of panel
        var tooltipPanel = new GameObject("TooltipPanel").AddComponent<RectTransform>();
        tooltipPanel.SetParent(_panelRoot, false);
        tooltipPanel.anchorMin = new Vector2(0, 0);
        tooltipPanel.anchorMax = new Vector2(1, 0);
        tooltipPanel.pivot = new Vector2(0.5f, 0);
        tooltipPanel.anchoredPosition = new Vector2(0, panelMarginBottom);
        tooltipPanel.sizeDelta = new Vector2(0, 130);

        var tooltipRoot = new GameObject("TooltipRoot").AddComponent<RectTransform>();
        tooltipRoot.SetParent(tooltipPanel, false);
        tooltipRoot.anchorMin = Vector2.zero;
        tooltipRoot.anchorMax = Vector2.one;
        tooltipRoot.offsetMin = new Vector2(12, 44);
        tooltipRoot.offsetMax = new Vector2(-12, -12);
        var tooltipBg = tooltipRoot.gameObject.AddComponent<Image>();
        tooltipBg.color = new Color(0.08f, 0.08f, 0.12f, 0.95f);

        var nameT = AddText(tooltipRoot, "", 20, TextAnchor.UpperLeft, new Vector2(10, -10));
        var descT = AddText(tooltipRoot, "", 18, TextAnchor.UpperLeft, new Vector2(10, -34));
        descT.verticalOverflow = VerticalWrapMode.Overflow;
        var statsT = AddText(tooltipRoot, "", 16, TextAnchor.UpperLeft, new Vector2(10, -60));
        statsT.verticalOverflow = VerticalWrapMode.Overflow;

        _tooltip = tooltipPanel.gameObject.AddComponent<ItemTooltipUI>();
        _tooltip.SetReferences(nameT, descT, statsT, tooltipRoot);
        _tooltip.Hide();

        var btnRow = new GameObject("ButtonRow").AddComponent<RectTransform>();
        btnRow.SetParent(tooltipPanel, false);
        btnRow.anchorMin = new Vector2(0, 0);
        btnRow.anchorMax = new Vector2(1, 0);
        btnRow.pivot = new Vector2(0.5f, 0);
        btnRow.anchoredPosition = Vector2.zero;
        btnRow.sizeDelta = new Vector2(0, 40);

        _useButton = AddButton(btnRow, "Use", 88, new Vector2(12, 0), OnUseClicked);
        _equipButton = AddButton(btnRow, "Equip", 88, new Vector2(108, 0), OnEquipClicked);
        _unequipButton = AddButton(btnRow, "Unequip", 96, new Vector2(204, 0), OnUnequipClicked);
        _splitButton = AddButton(btnRow, "Split", 72, new Vector2(308, 0), OnSplitClicked);

        // Equipment panel: paper-doll layout (rough body shape)
        float equipMargin = 20f;
        var equipmentHeader = new GameObject("EquipmentHeader").AddComponent<RectTransform>();
        equipmentHeader.SetParent(_equipmentPanelRoot, false);
        equipmentHeader.anchorMin = new Vector2(0, 1);
        equipmentHeader.anchorMax = new Vector2(1, 1);
        equipmentHeader.pivot = new Vector2(0.5f, 1f);
        equipmentHeader.anchoredPosition = Vector2.zero;
        equipmentHeader.offsetMin = new Vector2(equipMargin, -equipMargin - 36f);
        equipmentHeader.offsetMax = new Vector2(-equipMargin, -equipMargin);
        AddText(equipmentHeader, "Equipment", 22, TextAnchor.MiddleCenter, Vector2.zero);

        var equipmentContent = new GameObject("EquipmentContent").AddComponent<RectTransform>();
        equipmentContent.SetParent(_equipmentPanelRoot, false);
        equipmentContent.anchorMin = new Vector2(0, 1);
        equipmentContent.anchorMax = new Vector2(1, 1);
        equipmentContent.pivot = new Vector2(0.5f, 1f);
        equipmentContent.anchoredPosition = new Vector2(0, 0);
        equipmentContent.offsetMin = new Vector2(equipMargin, equipMargin);
        equipmentContent.offsetMax = new Vector2(-equipMargin, -56f);

        float cx = (equipmentPanelWidth - equipMargin * 2f) * 0.5f - equipmentSlotSize * 0.5f;
        float dy = equipmentSlotSize + slotSpacing;

        foreach (EquipmentSlot slot in System.Enum.GetValues(typeof(EquipmentSlot)))
        {
            Vector2 pos = GetPaperDollPosition(slot, cx, dy, equipmentSlotSize, slotSpacing);
            var slotUI = CreateEquipmentSlotUI(equipmentContent, slot, pos.x, pos.y);
            _equipmentSlots.Add(slotUI);
        }

        _canvas.enabled = false;
    }

    /// <summary>Paper-doll layout: positions for each slot in a rough body shape (top-left origin, y down).</summary>
    private static Vector2 GetPaperDollPosition(EquipmentSlot slot, float centerX, float rowHeight, float slotSize, float spacing)
    {
        float w = slotSize;
        float s = spacing;
        switch (slot)
        {
            case EquipmentSlot.Helmet:   return new Vector2(centerX, 0);
            case EquipmentSlot.Amulet:  return new Vector2(centerX, 1 * rowHeight);
            case EquipmentSlot.Chest:   return new Vector2(centerX, 2 * rowHeight);
            case EquipmentSlot.OffHand: return new Vector2(centerX - w - s, 2 * rowHeight);
            case EquipmentSlot.MainHand: return new Vector2(centerX + w + s, 2 * rowHeight);
            case EquipmentSlot.Bracers: return new Vector2(centerX - w - s, 3 * rowHeight);
            case EquipmentSlot.Gloves:  return new Vector2(centerX + w + s, 3 * rowHeight);
            case EquipmentSlot.Ring1:   return new Vector2(centerX - (w + s) * 0.5f, 4 * rowHeight);
            case EquipmentSlot.Ring2:   return new Vector2(centerX + (w + s) * 0.5f, 4 * rowHeight);
            case EquipmentSlot.Boots:   return new Vector2(centerX, 5 * rowHeight);
            case EquipmentSlot.Ability0: return new Vector2(0, 6 * rowHeight);
            case EquipmentSlot.Ability1: return new Vector2(centerX, 6 * rowHeight);
            case EquipmentSlot.Ability2: return new Vector2(centerX * 2f, 6 * rowHeight);
            case EquipmentSlot.Ranged:  return new Vector2(centerX, 7 * rowHeight);
            default: return Vector2.zero;
        }
    }

    private InventorySlotUI CreateInventorySlotUI(RectTransform parent, int slotIndex)
    {
        int col = slotIndex % inventoryColumns;
        int row = slotIndex / inventoryColumns;
        float x = col * (inventorySlotSize + slotSpacing);
        float y = -row * (inventorySlotSize + slotSpacing);

        var go = new GameObject("InvSlot_" + slotIndex);
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 1);
        rect.anchorMax = new Vector2(0, 1);
        rect.pivot = new Vector2(0, 1);
        rect.anchoredPosition = new Vector2(x, y);
        rect.sizeDelta = new Vector2(inventorySlotSize, inventorySlotSize);

        var bg = go.AddComponent<Image>();
        bg.color = new Color(0.25f, 0.25f, 0.3f, 1f);
        bg.raycastTarget = true;

        var iconGo = new GameObject("Icon");
        iconGo.transform.SetParent(go.transform, false);
        var iconRect = iconGo.AddComponent<RectTransform>();
        iconRect.anchorMin = Vector2.zero;
        iconRect.anchorMax = Vector2.one;
        iconRect.offsetMin = new Vector2(2, 2);
        iconRect.offsetMax = new Vector2(-2, -2);
        var iconImage = iconGo.AddComponent<Image>();
        iconImage.raycastTarget = false;

        var countGo = new GameObject("Count");
        countGo.transform.SetParent(go.transform, false);
        var countRect = countGo.AddComponent<RectTransform>();
        countRect.anchorMin = new Vector2(1, 0);
        countRect.anchorMax = new Vector2(1, 0);
        countRect.pivot = new Vector2(1, 0);
        countRect.anchoredPosition = new Vector2(-2, 2);
        countRect.sizeDelta = new Vector2(44, 28);
        var countText = countGo.AddComponent<Text>();
        countText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        countText.fontSize = Mathf.Clamp(Mathf.RoundToInt(inventorySlotSize * 0.28f), 18, 28);
        countText.color = Color.white;
        countText.alignment = TextAnchor.LowerRight;
        countText.raycastTarget = false;

        var slotUI = go.AddComponent<InventorySlotUI>();
        slotUI.SetReferences(iconImage, countText);
        slotUI.Setup(slotIndex, OnInventorySlotClicked);
        return slotUI;
    }

    private EquipmentSlotUI CreateEquipmentSlotUI(RectTransform parent, EquipmentSlot slot, float posX, float posY)
    {
        var go = new GameObject("Equip_" + slot);
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 1);
        rect.anchorMax = new Vector2(0, 1);
        rect.pivot = new Vector2(0, 1);
        rect.anchoredPosition = new Vector2(posX, -posY);
        rect.sizeDelta = new Vector2(equipmentSlotSize, equipmentSlotSize);

        var bg = go.AddComponent<Image>();
        bg.color = new Color(0.2f, 0.25f, 0.3f, 1f);
        bg.raycastTarget = true;

        Sprite slotPlaceholder = equipmentPlaceholderSprites != null && (int)slot < equipmentPlaceholderSprites.Length
            ? equipmentPlaceholderSprites[(int)slot]
            : null;
        Image placeholderImage = null;
        if (slotPlaceholder != null)
        {
            var placeImgGo = new GameObject("Placeholder");
            placeImgGo.transform.SetParent(go.transform, false);
            var placeRect = placeImgGo.AddComponent<RectTransform>();
            placeRect.anchorMin = Vector2.zero;
            placeRect.anchorMax = Vector2.one;
            placeRect.offsetMin = new Vector2(4, 4);
            placeRect.offsetMax = new Vector2(-4, -20);
            placeholderImage = placeImgGo.AddComponent<Image>();
            placeholderImage.sprite = slotPlaceholder;
            placeholderImage.color = new Color(0.4f, 0.4f, 0.45f, 0.7f);
            placeholderImage.raycastTarget = false;
        }

        var placeholderTextGo = new GameObject("PlaceholderText");
        placeholderTextGo.transform.SetParent(go.transform, false);
        var placeholderTextRect = placeholderTextGo.AddComponent<RectTransform>();
        placeholderTextRect.anchorMin = Vector2.zero;
        placeholderTextRect.anchorMax = Vector2.one;
        placeholderTextRect.offsetMin = new Vector2(4, 20);
        placeholderTextRect.offsetMax = new Vector2(-4, -4);
        var placeholderText = placeholderTextGo.AddComponent<Text>();
        placeholderText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        placeholderText.fontSize = Mathf.Max(11, Mathf.RoundToInt(equipmentSlotSize * 0.2f));
        placeholderText.color = new Color(0.5f, 0.5f, 0.55f, 0.9f);
        placeholderText.alignment = TextAnchor.MiddleCenter;
        placeholderText.raycastTarget = false;

        var iconGo = new GameObject("Icon");
        iconGo.transform.SetParent(go.transform, false);
        var iconRect = iconGo.AddComponent<RectTransform>();
        iconRect.anchorMin = Vector2.zero;
        iconRect.anchorMax = Vector2.one;
        iconRect.offsetMin = new Vector2(2, 2);
        iconRect.offsetMax = new Vector2(-2, -18);
        var iconImage = iconGo.AddComponent<Image>();
        iconImage.raycastTarget = false;

        var labelGo = new GameObject("Label");
        labelGo.transform.SetParent(go.transform, false);
        var labelRect = labelGo.AddComponent<RectTransform>();
        labelRect.anchorMin = new Vector2(0, 0);
        labelRect.anchorMax = new Vector2(1, 0);
        labelRect.pivot = new Vector2(0.5f, 0);
        labelRect.anchoredPosition = new Vector2(0, 2);
        labelRect.sizeDelta = new Vector2(0, 14);
        var labelText = labelGo.AddComponent<Text>();
        labelText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        labelText.fontSize = Mathf.Max(12, Mathf.RoundToInt(equipmentSlotSize * 0.36f));
        labelText.color = new Color(0.9f, 0.9f, 0.9f, 1f);
        labelText.alignment = TextAnchor.LowerCenter;
        labelText.raycastTarget = false;

        var slotUI = go.AddComponent<EquipmentSlotUI>();
        slotUI.SetReferences(iconImage, labelText);
        slotUI.SetPlaceholder(placeholderImage, placeholderText);
        slotUI.Setup(slot, OnEquipmentSlotClicked);
        return slotUI;
    }

    private void OnInventorySlotClicked(int index)
    {
        _selectedEquipmentSlot = null;
        _selectedInventoryIndex = index;
        if (inventory == null) return;
        var slot = inventory.GetSlot(index);
        ItemDefinition compareTo = null;
        if (slot.definition is EquipmentItemDefinition e)
            compareTo = inventory.GetEquipped(e.slot);
        _tooltip.Show(slot.definition, compareTo);
        _useButton.gameObject.SetActive(slot.definition is ConsumableItemDefinition);
        _equipButton.gameObject.SetActive(slot.definition is EquipmentItemDefinition || slot.definition is AbilityItemDefinition);
        _unequipButton.gameObject.SetActive(false);
        bool canSplit = slot.definition != null && slot.definition.IsStackable && slot.count > 1;
        _splitButton.gameObject.SetActive(canSplit);
    }

    private void OnEquipmentSlotClicked(EquipmentSlot slot)
    {
        _selectedInventoryIndex = -1;
        _selectedEquipmentSlot = slot;
        if (inventory == null) return;
        var def = inventory.GetEquipped(slot);
        _tooltip.Show(def);
        _useButton.gameObject.SetActive(false);
        _equipButton.gameObject.SetActive(false);
        _unequipButton.gameObject.SetActive(def != null);
        _splitButton.gameObject.SetActive(false);
    }

    private void OnUseClicked()
    {
        if (inventory == null || _selectedInventoryIndex < 0) return;
        inventory.UseConsumableAt(_selectedInventoryIndex);
        _tooltip.Hide();
        _selectedInventoryIndex = -1;
        _useButton.gameObject.SetActive(false);
    }

    private void OnEquipClicked()
    {
        if (inventory == null || _selectedInventoryIndex < 0) return;
        inventory.EquipFromSlot(_selectedInventoryIndex);
        _tooltip.Hide();
        _selectedInventoryIndex = -1;
        _equipButton.gameObject.SetActive(false);
    }

    private void OnUnequipClicked()
    {
        if (inventory == null || !_selectedEquipmentSlot.HasValue) return;
        inventory.Unequip(_selectedEquipmentSlot.Value);
        _tooltip.Hide();
        _selectedEquipmentSlot = null;
        _unequipButton.gameObject.SetActive(false);
    }

    private void OnSplitClicked()
    {
        if (inventory == null || _selectedInventoryIndex < 0) return;
        if (inventory.SplitStack(_selectedInventoryIndex))
        {
            var slot = inventory.GetSlot(_selectedInventoryIndex);
            _tooltip.Show(slot.definition);
            _splitButton.gameObject.SetActive(slot.definition != null && slot.definition.IsStackable && slot.count > 1);
        }
    }

    private void OnSortChanged(int sortIndex)
    {
        if (inventory == null) return;
        switch (sortIndex)
        {
            case 0: inventory.SortByName(); break;
            case 1: inventory.SortByType(); break;
            case 2: inventory.SortByStat("Armor", false); break;
            case 3: inventory.SortByStat("Damage", false); break;
        }
    }

    private void RefreshAll()
    {
        if (inventory == null) return;
        for (int i = 0; i < _inventorySlots.Count; i++)
        {
            if (i < inventory.SlotCount)
            {
                var slot = inventory.GetSlot(i);
                _inventorySlots[i].Refresh(slot.definition, slot.count);
            }
            else
                _inventorySlots[i].Refresh(null, 0);
        }
        foreach (EquipmentSlot slot in System.Enum.GetValues(typeof(EquipmentSlot)))
        {
            var def = inventory.GetEquipped(slot);
            int idx = (int)slot;
            if (idx < _equipmentSlots.Count)
                _equipmentSlots[idx].Refresh(def);
        }
    }

    private static Text AddText(RectTransform parent, string text, int fontSize, TextAnchor anchor, Vector2 offset)
    {
        var go = new GameObject("Text");
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 0.5f);
        rect.anchorMax = new Vector2(1, 0.5f);
        rect.pivot = new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = offset;
        rect.sizeDelta = new Vector2(-24, Mathf.Max(28, fontSize + 4));
        var t = go.AddComponent<Text>();
        t.text = text;
        t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        t.fontSize = fontSize;
        t.alignment = anchor;
        t.color = Color.white;
        t.raycastTarget = false;
        return t;
    }

    private static Button AddButton(RectTransform parent, string label, float width, Vector2 pos, System.Action onClick)
    {
        var go = new GameObject("Btn_" + label);
        go.transform.SetParent(parent, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0, 0);
        rect.anchorMax = new Vector2(0, 0);
        rect.pivot = new Vector2(0, 0);
        rect.anchoredPosition = pos;
        rect.sizeDelta = new Vector2(width, 40);
        var image = go.AddComponent<Image>();
        image.color = new Color(0.25f, 0.45f, 0.65f, 1f);
        var btn = go.AddComponent<Button>();
        btn.onClick.AddListener(() => onClick?.Invoke());
        var textGo = new GameObject("Text");
        textGo.transform.SetParent(go.transform, false);
        var textRect = textGo.AddComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = new Vector2(4, 4);
        textRect.offsetMax = new Vector2(-4, -4);
        var text = textGo.AddComponent<Text>();
        text.text = label;
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        text.fontSize = 22;
        text.alignment = TextAnchor.MiddleCenter;
        text.color = Color.white;
        text.raycastTarget = false;
        text.resizeTextForBestFit = true;
        text.resizeTextMinSize = 14;
        text.resizeTextMaxSize = 22;
        return btn;
    }
}
