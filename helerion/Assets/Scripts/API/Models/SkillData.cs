using System;

namespace Helerion.API.Models
{
    /// <summary>Matches backend skills table (PostgREST snake_case).</summary>
    [Serializable]
    public class SkillData
    {
        public int id;
        public string name;
        public string description;
        public string type;
        public string image;
    }
}
