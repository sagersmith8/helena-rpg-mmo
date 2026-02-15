using System;

namespace Helerion.API.Models
{
    /// <summary>Payload for POST to characters table (PostgREST snake_case).</summary>
    [Serializable]
    public class CharacterPostDto
    {
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
        public double? longitude;
        public double? latitude;
        public int armor_class;
        public int strength;
        public int dexterity;
        public int intelligence;
        public int charisma;
        public int wisdom;
        public int constitution;
    }
}
