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
        private GpsLocationService _locationService;
        private bool _originSet;

        public CharacterData PlayerCharacter { get; private set; }
        public List<InventoryEntry> Inventory { get; private set; } = new List<InventoryEntry>();
        public List<ItemData> Items { get; private set; } = new List<ItemData>();
        public List<AbilityData> Abilities { get; private set; } = new List<AbilityData>();
        public bool HasCharacter => PlayerCharacter != null;
        public bool IsReady { get; private set; }

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            if (gameConfig != null) Helerion.Config.GameConfig.Instance = gameConfig;
            _locationService = new GpsLocationService();
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

            // Wait for location (or use mock)
            float t = 0;
            while (!_locationService.IsRunning && t < 5f)
            {
                t += Time.deltaTime;
                yield return null;
            }

            if (!_originSet && (_locationService.IsRunning || true))
            {
                float lat = _locationService.Latitude;
                float lng = _locationService.Longitude;
                if (worldOrigin != null)
                {
                    worldOrigin.SetOrigin(lat, lng);
                    _originSet = true;
                }
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

            _api.GetItems(list => { if (list != null) Items.AddRange(list); }, _ => { });
            _api.GetAbilities(list => { if (list != null) Abilities.AddRange(list); }, _ => { });
            IsReady = true;
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

        public GpsLocationService LocationService => _locationService;

        public void UpdatePlayerPosition(double lat, double lng)
        {
            if (PlayerCharacter == null) return;
            PlayerCharacter.latitude = lat;
            PlayerCharacter.longitude = lng;
            _api.PatchCharacter(PlayerCharacter.id, PlayerCharacter, () => { }, err => Debug.LogWarning(err));
        }

        public ApiClient Api => _api;
        public int SavedCharacterId => _savedCharacterId;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }
    }
}
