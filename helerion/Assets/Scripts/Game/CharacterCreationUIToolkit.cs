using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Helerion.API;
using Helerion.API.Models;

namespace Helerion.Game
{
    /// <summary>
    /// Character creation using UI Toolkit (UIDocument). Shown when no character is loaded.
    /// Setup: Add a GameObject with UI Document (UI Toolkit → UI Document), assign CharacterCreation.uxml
    /// as Source Asset and a Panel Settings asset. Add this script to the same GameObject.
    /// </summary>
    [AddComponentMenu("Helerion/Character Creation UI Toolkit")]
    public class CharacterCreationUIToolkit : MonoBehaviour
    {
        [Header("UI Toolkit")]
        [Tooltip("If null, uses UIDocument on this GameObject.")]
        public UIDocument uiDocument;

        private VisualElement _root;
        private TextField _nameField;
        private DropdownField _ancestryDropdown;
        private DropdownField _backgroundDropdown;
        private DropdownField _classDropdown;
        private Label _statsLabel;
        private Label _statusLabel;
        private Button _createButton;

        private List<AncestryData> _ancestries = new List<AncestryData>();
        private List<BackgroundData> _backgrounds = new List<BackgroundData>();
        private List<ClassData> _classes = new List<ClassData>();
        private List<SkillData> _skills = new List<SkillData>();
        private bool _creating;
        private EventCallback<ChangeEvent<string>> _dropdownChanged;

        private void OnEnable()
        {
            _dropdownChanged = _ => RefreshStatsDisplay();

            var doc = uiDocument != null ? uiDocument : GetComponent<UIDocument>();
            if (doc == null || doc.rootVisualElement == null) return;

            // Make UI fill the screen on mobile (e.g. Galaxy S21): use current screen as reference so it's not tiny
            if (doc.panelSettings != null && Screen.width > 0 && Screen.height > 0)
            {
                doc.panelSettings.referenceResolution = new Vector2Int(Screen.width, Screen.height);
            }

            _root = doc.rootVisualElement.Q<VisualElement>("root");
            if (_root == null) _root = doc.rootVisualElement;

            _nameField = _root.Q<TextField>("name-field");
            _ancestryDropdown = _root.Q<DropdownField>("ancestry-dropdown");
            _backgroundDropdown = _root.Q<DropdownField>("background-dropdown");
            _classDropdown = _root.Q<DropdownField>("class-dropdown");
            _statsLabel = _root.Q<Label>("stats-label");
            _statusLabel = _root.Q<Label>("status-label");
            _createButton = _root.Q<Button>("create-button");

            if (_createButton != null)
                _createButton.clicked += OnCreateClicked;

            if (_ancestryDropdown != null) _ancestryDropdown.RegisterValueChangedCallback(_dropdownChanged);
            if (_backgroundDropdown != null) _backgroundDropdown.RegisterValueChangedCallback(_dropdownChanged);
            if (_classDropdown != null) _classDropdown.RegisterValueChangedCallback(_dropdownChanged);
        }

        private void OnDisable()
        {
            if (_createButton != null)
                _createButton.clicked -= OnCreateClicked;
            if (_ancestryDropdown != null) _ancestryDropdown.UnregisterValueChangedCallback(_dropdownChanged);
            if (_backgroundDropdown != null) _backgroundDropdown.UnregisterValueChangedCallback(_dropdownChanged);
            if (_classDropdown != null) _classDropdown.UnregisterValueChangedCallback(_dropdownChanged);
        }

        private void Update()
        {
            if (_root == null || GameManager.Instance == null) return;

            _root.style.display = GameManager.Instance.HasCharacter ? DisplayStyle.None : DisplayStyle.Flex;

            if (_root.style.display == DisplayStyle.Flex)
            {
                if (!string.IsNullOrEmpty(GameManager.Instance.RefDataLoadError))
                    SetStatus(GameManager.Instance.RefDataLoadError);
                else if (GameManager.Instance.IsReady && _ancestries.Count == 0)
                {
                    PopulateDropdowns();
                    if (_ancestries.Count == 0)
                        SetStatus("No data from server. Run: npm run seed (API_URL set to your backend, e.g. http://192.168.x.x:3000).");
                }
            }
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

            if (_ancestryDropdown != null)
            {
                var opts = new List<string> { "(Select ancestry)" };
                foreach (var a in _ancestries) opts.Add(a.name ?? "?");
                _ancestryDropdown.choices = opts;
                _ancestryDropdown.index = 0;
            }
            if (_backgroundDropdown != null)
            {
                var opts = new List<string> { "(Select background)" };
                foreach (var b in _backgrounds) opts.Add(b.name ?? "?");
                _backgroundDropdown.choices = opts;
                _backgroundDropdown.index = 0;
            }
            if (_classDropdown != null)
            {
                var opts = new List<string> { "(Select class)" };
                foreach (var c in _classes) opts.Add(c.name ?? "?");
                _classDropdown.choices = opts;
                _classDropdown.index = 0;
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
            if (_statsLabel != null)
                _statsLabel.text = $"Speed: {speed}  HP: {hp}  Mana: {mana}\nSTR {str} DEX {dex} CON {con} INT {intel} WIS {wis} CHA {cha}";
        }

        private AncestryData SelectedAncestry()
        {
            if (_ancestryDropdown == null) return null;
            int i = _ancestryDropdown.index - 1;
            return i >= 0 && i < _ancestries.Count ? _ancestries[i] : null;
        }

        private BackgroundData SelectedBackground()
        {
            if (_backgroundDropdown == null) return null;
            int i = _backgroundDropdown.index - 1;
            return i >= 0 && i < _backgrounds.Count ? _backgrounds[i] : null;
        }

        private ClassData SelectedClass()
        {
            if (_classDropdown == null) return null;
            int i = _classDropdown.index - 1;
            return i >= 0 && i < _classes.Count ? _classes[i] : null;
        }

        private void SetStatus(string msg)
        {
            if (_statusLabel != null) _statusLabel.text = msg ?? "";
        }

        private void OnCreateClicked()
        {
            if (GameManager.Instance == null || _creating) return;

            var name = _nameField != null ? (_nameField.value ?? "").Trim() : "";
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
