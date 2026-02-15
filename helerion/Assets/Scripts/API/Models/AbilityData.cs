using System;

namespace Helerion.API.Models
{
    [Serializable]
    public class AbilityData
    {
        public int id;
        public string name;
        public string description;
        public int damage;
        public int range;
        public int manaCost;
        public int cooldown;
        public bool active;
        public string image;
        public int? hits;
    }
}
