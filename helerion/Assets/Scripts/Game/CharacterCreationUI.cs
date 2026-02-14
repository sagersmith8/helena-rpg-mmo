using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Helerion.API;
using Helerion.API.Models;

namespace Helerion.Game
{
    /// <summary>
    /// Character creation panel: shown when no character is loaded. Name + ancestry/background/class;
    /// on Create, POSTs character and character_skills then sets the player character.
    /// Assign in inspector: creationPanel, nameInput, ancestryDropdown, backgroundDropdown, classDropdown, createButton, statusText (optional), statsText (optional).
    /// </summary>
    public class CharacterCreationUI : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject creationPanel;
        public InputField nameInput;
        public Dropdown ancestryDropdown;
        public Dropdown backgroundDropdown;
        public Dropdown classDropdown;
        public Button createButton;
        [Tooltip("Optional: show status/errors")]
        public Text statusText;
        [Tooltip("Optional: show computed stats")]
        public Text statsText;

        private List<AncestryData> _ancestries = new List<AncestryData>();
        private List<BackgroundData> _backgrounds = new List<BackgroundData>();
        private List<ClassData> _classes = new List<ClassData>();
        private List<SkillData> _skills = new List<SkillData>();
        private bool _creating;

        private void Start()
        {
            if (createButton != null)
                createButton.onClick.AddListener(OnCreateClicked);

            if (ancestryDropdown != null) ancestryDropdown.onValueChanged.AddListener(_ => RefreshStatsDisplay());
            if (backgroundDropdown != null) backgroundDropdown.onValueChanged.AddListener(_ => RefreshStatsDisplay());
            if (classDropdown != null) classDropdown.onValueChanged.AddListener(_ => RefreshStatsDisplay());
        }

        private void Update()
        {
            if (creationPanel == null || GameManager.Instance == null) return;
            creationPanel.SetActive(!GameManager.Instance.HasCharacter);

            if (creationPanel.activeSelf && _ancestries.Count == 0 && GameManager.Instance.IsReady)
                PopulateDropdowns();
        }

        private void PopulateDropdowns()
        {
            _ancestries.Clear();
            _backgrounds.Clear();
            _classes.Clear();
            _skills.Clear();
            if (GameManager.Instance.Ancestries != null) _ancestries.AddRange(GameManager.Instance.Ancestries);
            if (GameManager.Instance.Backgrounds != null) _backgrounds.AddRange(GameManager.Instance.Backgrounds);
            if (GameManager.Instance.Classes != null) _classes.AddRange(GameManager.Instance.Classes);
            if (GameManager.Instance.Skills != null) _skills.AddRange(GameManager.Instance.Skills);

            if (ancestryDropdown != null)
            {
                ancestryDropdown.ClearOptions();
                var opts = new List<string> { "(Select ancestry)" };
                foreach (var a in _ancestries) opts.Add(a.name ?? "?");
                ancestryDropdown.AddOptions(opts);
            }
            if (backgroundDropdown != null)
            {
                backgroundDropdown.ClearOptions();
                var opts = new List<string> { "(Select background)" };
                foreach (var b in _backgrounds) opts.Add(b.name ?? "?");
                backgroundDropdown.AddOptions(opts);
            }
            if (classDropdown != null)
            {
                classDropdown.ClearOptions();
                var opts = new List<string> { "(Select class)" };
                foreach (var c in _classes) opts.Add(c.name ?? "?");
                classDropdown.AddOptions(opts);
            }
            RefreshStatsDisplay();
        }

        private void RefreshStatsDisplay()
        {
            var anc = SelectedAncestry();
            var bg = SelectedBackground();
            var cls = SelectedClass();
            int speed = CharacterCreationStats.CalculateSpeed(anc, bg, cls);
            CharacterCreationStats.CalculateAttributes(anc, bg, cls, out int str, out int dex, out int con, out int intel, out int wis, out int cha);
            int hp = CharacterCreationStats.CalculateHP(anc, bg, cls);
            int mana = CharacterCreationStats.CalculateMana(anc, bg, cls);
            if (statsText != null)
                statsText.text = $"Speed: {speed}  HP: {hp}  Mana: {mana}\nSTR {str} DEX {dex} CON {con} INT {intel} WIS {wis} CHA {cha}";
        }

        private AncestryData SelectedAncestry()
        {
            int i = ancestryDropdown != null ? ancestryDropdown.value - 1 : -1;
            return i >= 0 && i < _ancestries.Count ? _ancestries[i] : null;
        }

        private BackgroundData SelectedBackground()
        {
            int i = backgroundDropdown != null ? backgroundDropdown.value - 1 : -1;
            return i >= 0 && i < _backgrounds.Count ? _backgrounds[i] : null;
        }

        private ClassData SelectedClass()
        {
            int i = classDropdown != null ? classDropdown.value - 1 : -1;
            return i >= 0 && i < _classes.Count ? _classes[i] : null;
        }

        private void SetStatus(string msg)
        {
            if (statusText != null) statusText.text = msg;
        }

        private void OnCreateClicked()
        {
            if (GameManager.Instance == null || _creating) return;

            var name = nameInput != null ? (nameInput.text ?? "").Trim() : "";
            if (string.IsNullOrEmpty(name))
            {
                SetStatus("Enter a name.");
                return;
            }

            var anc = SelectedAncestry();
            var bg = SelectedBackground();
            var cls = SelectedClass();
            if (anc == null || bg == null || cls == null)
            {
                SetStatus("Select ancestry, background, and class.");
                return;
            }

            int speed = CharacterCreationStats.CalculateSpeed(anc, bg, cls);
            CharacterCreationStats.CalculateAttributes(anc, bg, cls, out int str, out int dex, out int con, out int intel, out int wis, out int cha);
            int hp = CharacterCreationStats.CalculateHP(anc, bg, cls);
            int mana = CharacterCreationStats.CalculateMana(anc, bg, cls);
            string size = CharacterCreationStats.Size(anc);

            double lat = GameManager.Instance.LocationService != null ? GameManager.Instance.LocationService.Latitude : 0;
            double lng = GameManager.Instance.LocationService != null ? GameManager.Instance.LocationService.Longitude : 0;

            var dto = new CharacterPostDto
            {
                name = name,
                ancestry = anc.id,
                background = bg.id,
                class_id = cls.id,
                level = 1,
                gold = 0,
                speed = speed,
                size = size,
                experience = 0,
                health = hp,
                max_health = hp,
                mana = mana,
                max_mana = mana,
                longitude = lng,
                latitude = lat,
                armor_class = 0,
                strength = str,
                dexterity = dex,
                intelligence = intel,
                charisma = cha,
                wisdom = wis,
                constitution = con
            };

            _creating = true;
            SetStatus("Creating...");
            var api = GameManager.Instance.Api;

            api.PostCharacterFromDto(dto, created =>
            {
                PostSkillsOneByOne(api, created.id, 0, created);
            }, err =>
            {
                _creating = false;
                SetStatus("Error: " + err);
            });
        }

        private void PostSkillsOneByOne(ApiClient api, int characterId, int skillIndex, CharacterData created)
        {
            if (skillIndex >= _skills.Count)
            {
                _creating = false;
                SetStatus("");
                GameManager.Instance.SetPlayerCharacter(created);
                return;
            }

            var skill = _skills[skillIndex];
            var entry = new CharacterSkillPost
            {
                character_id = characterId,
                skill_id = skill.id,
                level = 1,
                experience = 0
            };

            api.PostCharacterSkill(entry, () =>
            {
                PostSkillsOneByOne(api, characterId, skillIndex + 1, created);
            }, err =>
            {
                _creating = false;
                SetStatus("Character created but skill error: " + err);
                GameManager.Instance.SetPlayerCharacter(created);
            });
        }
    }
}
