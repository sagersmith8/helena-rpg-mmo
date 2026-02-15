using System;

namespace Helerion.API.Models
{
    /// <summary>Response from POST/GET characters (PostgREST snake_case).</summary>
    [Serializable]
    public class CharacterResponseDto
    {
        public int id;
        public string name;
        public int ancestry;
        public int background;
        public int class_id;
        public int level;
        public long gold;
        public int speed;
        public string size;
        public int experience;
        public int health;
        public int max_health;
        public int mana;
        public int max_mana;
        public double? latitude;
        public double? longitude;
        public int armor_class;
        public int strength;
        public int dexterity;
        public int intelligence;
        public int charisma;
        public int wisdom;
        public int constitution;
    }
}
