using System;

namespace Helerion.API.Models
{
    [Serializable]
    public class InventoryEntry
    {
        public int characterId;
        public int itemId;
        public string equippedSlot;
        public int quantity;
    }
}
