using System;

namespace Helerion.API.Models
{
    /// <summary>Payload for POST to character_skills (PostgREST snake_case).</summary>
    [Serializable]
    public class CharacterSkillPost
    {
        public int character_id;
        public int skill_id;
        public int level;
        public int experience;
    }
}
