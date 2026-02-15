using Helerion.API.Models;

namespace Helerion.Game
{
    /// <summary>
    /// Same formulas as Helena (characterUtils): speed, attributes, HP, mana from ancestry + background + class.
    /// </summary>
    public static class CharacterCreationStats
    {
        public static int CalculateSpeed(AncestryData ancestry, BackgroundData background, ClassData classData)
        {
            return 30
                + (ancestry?.bonus_speed ?? 0)
                + (background?.bonus_speed ?? 0)
                + (classData?.bonus_speed ?? 0);
        }

        public static void CalculateAttributes(AncestryData ancestry, BackgroundData background, ClassData classData,
            out int strength, out int dexterity, out int constitution, out int intelligence, out int wisdom, out int charisma)
        {
            strength = 10 + (ancestry?.bonus_strength ?? 0) + (background?.bonus_strength ?? 0) + (classData?.bonus_strength ?? 0);
            dexterity = 10 + (ancestry?.bonus_dexterity ?? 0) + (background?.bonus_dexterity ?? 0) + (classData?.bonus_dexterity ?? 0);
            constitution = 10 + (ancestry?.bonus_constitution ?? 0) + (background?.bonus_constitution ?? 0) + (classData?.bonus_constitution ?? 0);
            intelligence = 10 + (ancestry?.bonus_intelligence ?? 0) + (background?.bonus_intelligence ?? 0) + (classData?.bonus_intelligence ?? 0);
            wisdom = 10 + (ancestry?.bonus_wisdom ?? 0) + (background?.bonus_wisdom ?? 0) + (classData?.bonus_wisdom ?? 0);
            charisma = 10 + (ancestry?.bonus_charisma ?? 0) + (background?.bonus_charisma ?? 0) + (classData?.bonus_charisma ?? 0);
        }

        public static int CalculateHP(AncestryData ancestry, BackgroundData background, ClassData classData)
        {
            return 10
                + (ancestry?.bonus_constitution ?? 0)
                + (background?.bonus_constitution ?? 0)
                + (classData?.bonus_constitution ?? 0);
        }

        public static int CalculateMana(AncestryData ancestry, BackgroundData background, ClassData classData)
        {
            return 10
                + (ancestry?.bonus_intelligence ?? 0)
                + (background?.bonus_intelligence ?? 0)
                + (classData?.bonus_intelligence ?? 0);
        }

        public static string Size(AncestryData ancestry)
        {
            if (ancestry != null && !string.IsNullOrEmpty(ancestry.base_size))
                return ancestry.base_size;
            return "medium";
        }
    }
}
