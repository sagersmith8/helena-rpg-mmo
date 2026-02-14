using System;

namespace Helerion.API.Models
{
    /// <summary>Matches backend classes table (PostgREST snake_case).</summary>
    [Serializable]
    public class ClassData
    {
        public int id;
        public string name;
        public string description;
        public int bonus_speed;
        public int bonus_health;
        public int bonus_mana;
        public int bonus_strength;
        public int bonus_dexterity;
        public int bonus_intelligence;
        public int bonus_charisma;
        public int bonus_wisdom;
        public int bonus_constitution;
        public string image;
    }
}
