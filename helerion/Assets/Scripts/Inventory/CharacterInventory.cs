using UnityEngine;
using System.Collections.Generic;
using System.Linq;
using System;

/// <summary>
/// Character inventory and equipment. Slots are expandable; no weight. Similar items stack by definition.
/// </summary>
public class CharacterInventory : MonoBehaviour
{
    [Header("Capacity")]
    [Tooltip("Starting number of inventory slots (expandable via ExpandCapacity()).")]
    [SerializeField] private int initialCapacity = 20;
    [Tooltip("Extra slots added when expanding (e.g. bag upgrade).")]
    [SerializeField] private int capacityIncrement = 10;

    private List<InventorySlot> _slots = new List<InventorySlot>();
    private Dictionary<EquipmentSlot, ItemDefinition> _equipment = new Dictionary<EquipmentSlot, ItemDefinition>();
    private CharacterStats _stats;
    private bool _dirtyEquipmentModifiers;

    /// <summary>Current number of inventory slots (expandable).</summary>
    public int SlotCount => _slots.Count;

    /// <summary>Get slot at index (read-only).</summary>
    public InventorySlot GetSlot(int index)
    {
        if (index < 0 || index >= _slots.Count) return InventorySlot.Empty;
        return _slots[index];
    }

    /// <summary>Get equipped item in slot, or null.</summary>
    public ItemDefinition GetEquipped(EquipmentSlot slot)
    {
        return _equipment.TryGetValue(slot, out var def) ? def : null;
    }

    /// <summary>All equipment slots.</summary>
    public IReadOnlyDictionary<EquipmentSlot, ItemDefinition> Equipment => _equipment;

    /// <summary>Raised when inventory slots change (add, remove, move).</summary>
    public event Action OnInventoryChanged;

    /// <summary>Raised when equipment changes.</summary>
    public event Action<EquipmentSlot, ItemDefinition> OnEquipmentChanged;

    private void Awake()
    {
        _stats = GetComponent<CharacterStats>();
        if (_stats == null) _stats = FindFirstObjectByType<CharacterStats>();

        for (int i = 0; i < initialCapacity; i++)
            _slots.Add(InventorySlot.Empty);

        foreach (EquipmentSlot slot in Enum.GetValues(typeof(EquipmentSlot)))
            _equipment[slot] = null;
    }

    private void LateUpdate()
    {
        if (_dirtyEquipmentModifiers && _stats != null)
        {
            _dirtyEquipmentModifiers = false;
            RebuildEquipmentModifiers();
        }
    }

    /// <summary>Expand inventory by capacityIncrement slots.</summary>
    public void ExpandCapacity()
    {
        for (int i = 0; i < capacityIncrement; i++)
            _slots.Add(InventorySlot.Empty);
        OnInventoryChanged?.Invoke();
    }

    /// <summary>Add item to inventory. Stacks if possible; otherwise uses first empty slot. Returns true if any was added.</summary>
    public bool AddItem(ItemDefinition definition, int amount = 1)
    {
        if (definition == null || amount <= 0) return false;

        int remaining = amount;
        int maxStack = definition.maxStackSize;

        // Stack into existing
        for (int i = 0; i < _slots.Count && remaining > 0; i++)
        {
            var slot = _slots[i];
            if (slot.definition != definition || slot.count >= maxStack) continue;
            int add = Mathf.Min(remaining, maxStack - slot.count);
            slot.count += add;
            remaining -= add;
            _slots[i] = slot;
        }

        // Fill empty slots
        for (int i = 0; i < _slots.Count && remaining > 0; i++)
        {
            if (!_slots[i].IsEmpty) continue;
            int add = Mathf.Min(remaining, maxStack);
            _slots[i] = new InventorySlot(definition, add);
            remaining -= add;
        }

        // If still remaining, expand and add (optional: you can refuse instead)
        while (remaining > 0)
        {
            ExpandCapacity();
            int idx = _slots.Count - capacityIncrement;
            for (int i = idx; i < _slots.Count && remaining > 0; i++)
            {
                if (!_slots[i].IsEmpty) continue;
                int add = Mathf.Min(remaining, maxStack);
                _slots[i] = new InventorySlot(definition, add);
                remaining -= add;
                break;
            }
        }

        OnInventoryChanged?.Invoke();
        return amount - remaining > 0;
    }

    /// <summary>Remove up to 'amount' of definition from slot index. Returns count actually removed.</summary>
    public int RemoveFromSlot(int slotIndex, int amount = 1)
    {
        if (slotIndex < 0 || slotIndex >= _slots.Count) return 0;
        var slot = _slots[slotIndex];
        if (slot.IsEmpty) return 0;
        int remove = Mathf.Min(amount, slot.count);
        slot.count -= remove;
        if (slot.count <= 0) slot = InventorySlot.Empty;
        _slots[slotIndex] = slot;
        OnInventoryChanged?.Invoke();
        return remove;
    }

    /// <summary>Remove one of definition from any stack. Returns true if removed.</summary>
    public bool RemoveItem(ItemDefinition definition, int amount = 1)
    {
        if (definition == null || amount <= 0) return false;
        int remaining = amount;
        for (int i = 0; i < _slots.Count && remaining > 0; i++)
        {
            if (_slots[i].definition != definition) continue;
            int remove = RemoveFromSlot(i, remaining);
            remaining -= remove;
        }
        return remaining < amount;
    }

    /// <summary>Equip from inventory slot index into the item's equipment slot. If slot is full, swap. Returns true if successful.</summary>
    public bool EquipFromSlot(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= _slots.Count) return false;
        var slot = _slots[slotIndex];
        if (slot.IsEmpty) return false;

        if (slot.definition is EquipmentItemDefinition equipDef)
        {
            return EquipToSlot(equipDef.slot, slot.definition, slotIndex);
        }
        if (slot.definition is AbilityItemDefinition)
        {
            // Must equip to Ability0/1/2 - try first empty ability slot
            for (int a = 0; a < 3; a++)
            {
                var es = (EquipmentSlot)((int)EquipmentSlot.Ability0 + a);
                if (_equipment[es] == null)
                    return EquipToSlot(es, slot.definition, slotIndex);
            }
            return EquipToSlot(EquipmentSlot.Ability0, slot.definition, slotIndex);
        }
        return false;
    }

    /// <summary>Equip a specific equipment slot (e.g. from drag). Puts item from slotIndex into equipSlot; if equipSlot had item, swap to slotIndex.</summary>
    public bool EquipToSlot(EquipmentSlot equipSlot, ItemDefinition definition, int slotIndex)
    {
        if (definition == null) return false;
        bool isEquipment = definition is EquipmentItemDefinition e && e.slot == equipSlot;
        bool isAbility = definition is AbilityItemDefinition && (equipSlot == EquipmentSlot.Ability0 || equipSlot == EquipmentSlot.Ability1 || equipSlot == EquipmentSlot.Ability2);
        if (!isEquipment && !isAbility) return false;

        var currentEquipped = _equipment[equipSlot];
        if (slotIndex >= 0 && slotIndex < _slots.Count && !_slots[slotIndex].IsEmpty && _slots[slotIndex].definition == definition)
            RemoveFromSlot(slotIndex, 1);
        else
        {
            if (!RemoveItem(definition, 1)) return false;
        }

        _equipment[equipSlot] = definition;
        if (currentEquipped != null)
            AddItem(currentEquipped, 1);
        _dirtyEquipmentModifiers = true;
        OnEquipmentChanged?.Invoke(equipSlot, definition);
        OnInventoryChanged?.Invoke();
        return true;
    }

    /// <summary>Unequip from equipment slot into inventory.</summary>
    public bool Unequip(EquipmentSlot equipSlot)
    {
        if (!_equipment.TryGetValue(equipSlot, out var def) || def == null) return false;
        _equipment[equipSlot] = null;
        AddItem(def, 1);
        _dirtyEquipmentModifiers = true;
        OnEquipmentChanged?.Invoke(equipSlot, null);
        OnInventoryChanged?.Invoke();
        return true;
    }

    /// <summary>Split stack at slotIndex: leave half (floor) in slot, put rest in first empty slot. Returns true if split.</summary>
    public bool SplitStack(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= _slots.Count) return false;
        var slot = _slots[slotIndex];
        if (slot.IsEmpty || !slot.definition.IsStackable || slot.count < 2) return false;
        int half = slot.count / 2;
        if (half < 1) return false;
        slot.count -= half;
        _slots[slotIndex] = slot;
        AddItem(slot.definition, half);
        OnInventoryChanged?.Invoke();
        return true;
    }

    /// <summary>Use one consumable from slot. Returns true if used.</summary>
    public bool UseConsumableAt(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= _slots.Count) return false;
        var slot = _slots[slotIndex];
        if (slot.IsEmpty || !(slot.definition is ConsumableItemDefinition consumable)) return false;

        if (_stats != null && consumable.effects != null)
        {
            foreach (var effect in consumable.effects)
                _stats.ApplyConsumableEffect(effect.statId, effect.value);
        }
        RemoveFromSlot(slotIndex, 1);
        return true;
    }

    /// <summary>Get inventory slots sorted by a stat (e.g. "Armor"), then by display name. Does not mutate underlying list order.</summary>
    public IReadOnlyList<InventorySlot> GetSlotsSortedBy(string statId, bool ascending = false)
    {
        var list = _slots
            .Where(s => !s.IsEmpty)
            .OrderBy(s => s.definition.GetStatValue(statId) * (ascending ? 1 : -1))
            .ThenBy(s => s.definition.displayName)
            .ToList();
        return list;
    }

    /// <summary>Sort inventory in-place by stat, then by name. Fills from top; empty slots at end.</summary>
    public void SortByStat(string statId, bool ascending = false)
    {
        var filled = _slots.Where(s => !s.IsEmpty).OrderBy(s => s.definition.GetStatValue(statId) * (ascending ? 1 : -1)).ThenBy(s => s.definition.displayName).ToList();
        int i = 0;
        for (; i < filled.Count; i++)
            _slots[i] = filled[i];
        for (; i < _slots.Count; i++)
            _slots[i] = InventorySlot.Empty;
        OnInventoryChanged?.Invoke();
    }

    /// <summary>Sort inventory in-place by display name.</summary>
    public void SortByName()
    {
        var filled = _slots.Where(s => !s.IsEmpty).OrderBy(s => s.definition.displayName).ToList();
        int i = 0;
        for (; i < filled.Count; i++)
            _slots[i] = filled[i];
        for (; i < _slots.Count; i++)
            _slots[i] = InventorySlot.Empty;
        OnInventoryChanged?.Invoke();
    }

    /// <summary>Sort inventory in-place by type (equipment, consumable, ability).</summary>
    public void SortByType()
    {
        int Order(ItemDefinition d)
        {
            if (d is EquipmentItemDefinition) return 0;
            if (d is ConsumableItemDefinition) return 1;
            if (d is AbilityItemDefinition) return 2;
            return 3;
        }
        var filled = _slots.Where(s => !s.IsEmpty).OrderBy(s => Order(s.definition)).ThenBy(s => s.definition.displayName).ToList();
        int i = 0;
        for (; i < filled.Count; i++)
            _slots[i] = filled[i];
        for (; i < _slots.Count; i++)
            _slots[i] = InventorySlot.Empty;
        OnInventoryChanged?.Invoke();
    }

    private void RebuildEquipmentModifiers()
    {
        var list = new List<StatModifier>();
        foreach (var kv in _equipment)
        {
            if (kv.Value == null || kv.Value.stats == null) continue;
            list.AddRange(kv.Value.stats);
        }
        _stats?.SetModifiersFromEquipment(list);
    }
}
