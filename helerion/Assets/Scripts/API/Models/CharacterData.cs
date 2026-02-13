using System;
using UnityEngine;

namespace Helerion.API.Models
{
    /// <summary>
    /// Matches backend characters table (PostgREST).
    /// </summary>
    [Serializable]
    public class CharacterData
    {
        public int id;
        public string name;
        public int? ancestry;
        public int? background;
        public int? classId;
        public int level;
        public long gold;
        public int speed;
        public string size;
        public int experience;
        public int health;
        public int maxHealth;
        public int mana;
        public int maxMana;
        public double? latitude;
        public double? longitude;
        public int armorClass;
        public int strength;
        public int dexterity;
        public int intelligence;
        public int charisma;
        public int wisdom;
        public int constitution;
    }
}
