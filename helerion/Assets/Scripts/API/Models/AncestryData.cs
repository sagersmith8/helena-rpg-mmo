using System;

namespace Helerion.API.Models
{
    /// <summary>Matches backend ancestries table (PostgREST snake_case).</summary>
    [Serializable]
    public class AncestryData
    {
        public int id;
        public string name;
        public string description;
        public int bonus_speed;
        public int bonus_health;
        public int bonus_mana;
        public string base_size;
        public int bonus_strength;
        public int bonus_dexterity;
        public int bonus_intelligence;
        public int bonus_charisma;
        public int bonus_wisdom;
        public int bonus_constitution;
        public string image;
    }
}
