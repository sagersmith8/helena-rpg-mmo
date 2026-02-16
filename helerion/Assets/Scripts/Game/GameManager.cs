using System;
using System.Collections.Generic;
using UnityEngine;
using Helerion.API;
using Helerion.API.Models;
using Helerion.Services;
using Helerion.World;

namespace Helerion.Game
{
    /// <summary>
    /// Central game state: loads/saves character from backend, drives location and world origin.
    /// Hook up UI and spawners to this.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Dependencies")]
        public WorldOrigin worldOrigin;
        [Tooltip("Assign a GameConfig asset so API/OSRM URLs are used. Create via Right-click → Create → Helerion → Game Config.")]
        public Helerion.Config.GameConfig gameConfig;

        [Header("State")]
        [SerializeField] private int _savedCharacterId; // persist via PlayerPrefs or your backend

        private ApiClient _api;
        private Helerion.Services.GpsLocationService _locationService;
        private bool _originSet;
        private float _lastPositionPatchTime;

        public CharacterData PlayerCharacter { get; private set; }
        public List<InventoryEntry> Inventory { get; private set; } = new List<InventoryEntry>();
        public List<ItemData> Items { get; private set; } = new List<ItemData>();
        public List<AbilityData> Abilities { get; private set; } = new List<AbilityData>();
        public List<AncestryData> Ancestries { get; private set; } = new List<AncestryData>();
        public List<BackgroundData> Backgrounds { get; private set; } = new List<BackgroundData>();
        public List<ClassData> Classes { get; private set; } = new List<ClassData>();
        public List<SkillData> Skills { get; private set; } = new List<SkillData>();
        public bool HasCharacter => PlayerCharacter != null;
        public bool IsReady { get; private set; }
        /// <summary>Set when ref data fetch fails (e.g. can't connect). Show in character creation UI.</summary>
        public string RefDataLoadError { get; private set; }

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            if (gameConfig != null) gameConfig.SetAsInstance();
            _locationService = new Helerion.Services.GpsLocationService();
            _api = new ApiClient();
            _savedCharacterId = PlayerPrefs.GetInt("helerion_character_id", 0);
        }

        private void Start()
        {
            if (worldOrigin == null) worldOrigin = WorldOrigin.Instance;
            StartCoroutine(InitRoutine());
        }

        private System.Collections.IEnumerator InitRoutine()
        {
            _locationService.Start(null, err => Debug.LogWarning("Location: " + err));

            // Wait for location (or use mock). In Editor, location never runs so set mock immediately so map/decorator get a center.
#if UNITY_EDITOR
            if (!_locationService.IsRunning)
            {
                float lat = _locationService.Latitude;
                float lng = _locationService.Longitude;
                if (worldOrigin != null) { worldOrigin.SetOrigin(lat, lng); _originSet = true; }
                GameplayStatus.OriginSetByGame = true;
                GameplayStatus.WorldOriginStatus = $"Origin: {lat:F4}, {lng:F4} (mock)";
            }
#endif
            float t = 0;
            while (!_locationService.IsRunning && t < 5f)
            {
                t += Time.deltaTime;
                yield return null;
            }

            if (!_originSet)
            {
                float lat = _locationService.Latitude;
                float lng = _locationService.Longitude;
                if (worldOrigin != null)
                {
                    worldOrigin.SetOrigin(lat, lng);
                    _originSet = true;
                }
                GameplayStatus.OriginSetByGame = true;
                GameplayStatus.WorldOriginStatus = $"Origin: {lat:F4}, {lng:F4}";
            }

            if (_savedCharacterId > 0)
            {
                bool done = false;
                _api.GetCharacter(_savedCharacterId, c =>
                {
                    PlayerCharacter = c;
                    LoadInventoryAndRefs(() => done = true);
                }, err =>
                {
                    Debug.LogWarning("Load character failed: " + err);
                    _savedCharacterId = 0;
                    done = true;
                });
                while (!done) yield return null;
            }

            // If no character: character creation UI will be shown; do not create a demo character.

            RefDataLoadError = null;
            int pending = 6;
            Action onDone = () => { pending--; if (pending <= 0) IsReady = true; };
            Action<string> onErr = (err) =>
            {
                if (string.IsNullOrEmpty(RefDataLoadError))
                    RefDataLoadError = "Can't reach server. Check Wi‑Fi and API URL (e.g. http://192.168.x.x:3000). " + (err ?? "");
                onDone();
            };

            _api.GetItems(list => { if (list != null) Items.AddRange(list); onDone(); }, onErr);
            _api.GetAbilities(list => { if (list != null) Abilities.AddRange(list); onDone(); }, onErr);
            _api.GetAncestries(list => { if (list != null) Ancestries.AddRange(list); onDone(); }, onErr);
            _api.GetBackgrounds(list => { if (list != null) Backgrounds.AddRange(list); onDone(); }, onErr);
            _api.GetClasses(list => { if (list != null) Classes.AddRange(list); onDone(); }, onErr);
            _api.GetSkills(list => { if (list != null) Skills.AddRange(list); onDone(); }, onErr);

            // If requests hang (e.g. phone can't reach server), show error after timeout
            float timeout = 12f;
            while (timeout > 0 && !IsReady)
            {
                timeout -= Time.deltaTime;
                yield return null;
            }
            if (!IsReady)
            {
                RefDataLoadError = "Connection timed out. Check Wi‑Fi and that the server is running at your API URL (e.g. http://192.168.x.x:3000).";
                IsReady = true;
            }
        }

        private void LoadInventoryAndRefs(Action onDone)
        {
            if (PlayerCharacter == null) { onDone?.Invoke(); return; }
            _api.GetInventory(PlayerCharacter.id, list =>
            {
                Inventory.Clear();
                if (list != null) Inventory.AddRange(list);
                onDone?.Invoke();
            }, _ => onDone?.Invoke());
        }

        public void SaveCharacterId(int id)
        {
            _savedCharacterId = id;
            PlayerPrefs.SetInt("helerion_character_id", id);
        }

        public void ClearCharacterId()
        {
            _savedCharacterId = 0;
            PlayerPrefs.DeleteKey("helerion_character_id");
            PlayerCharacter = null;
            Inventory.Clear();
        }

        public void SetPlayerCharacter(CharacterData c)
        {
            PlayerCharacter = c;
            SaveCharacterId(c.id);
        }

        public Helerion.Services.GpsLocationService LocationService => _locationService;

        public void UpdatePlayerPosition(double lat, double lng)
        {
            if (PlayerCharacter == null) return;
            PlayerCharacter.latitude = lat;
            PlayerCharacter.longitude = lng;
            if (PlayerCharacter.id > 0 && Time.time - _lastPositionPatchTime >= 2f)
            {
                _lastPositionPatchTime = Time.time;
                _api.PatchCharacterPosition(PlayerCharacter.id, lat, lng, () => { }, err => Debug.LogWarning(err));
            }
        }

        public ApiClient Api => _api;
        public int SavedCharacterId => _savedCharacterId;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }
    }
}
