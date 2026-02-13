using System;

namespace Helerion.API.Models
{
    [Serializable]
    public class ItemData
    {
        public int id;
        public string name;
        public string description;
        public string type;
        public int mana;
        public string equipmentSlot;
        public int bonusDamage;
        public float weight;
        public long goldValue;
        public string tree;
        public string image;
        public int armorClass;
    }
}
