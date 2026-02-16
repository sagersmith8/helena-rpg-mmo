using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Helerion.API.Models;
using Helerion.Config;

namespace Helerion.API
{
    /// <summary>
    /// REST client for PostgREST / Supabase backend (same as Helena).
    /// </summary>
    public class ApiClient
    {
        private readonly string _baseUrl;

        public ApiClient()
        {
            _baseUrl = GameConfig.Instance != null ? GameConfig.Instance.apiBaseUrl : "http://localhost:3000";
        }

        public ApiClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
        }

        public void GetCharacters(string filter, Action<CharacterData[]> onSuccess, Action<string> onError)
        {
            GetMany("characters", filter, onSuccess, onError);
        }

        public void GetCharacter(int id, Action<CharacterData> onSuccess, Action<string> onError)
        {
            GetOne("characters", "id", "eq", id.ToString(), onSuccess, onError);
        }

        public void PostCharacter(CharacterData c, Action<CharacterData> onSuccess, Action<string> onError)
        {
            Post("characters", JsonUtility.ToJson(new Wrapper<CharacterData> { characters = c }), onSuccess, onError);
        }

        public void PatchCharacter(int id, CharacterData c, Action onSuccess, Action<string> onError)
        {
            Patch("characters", $"id=eq.{id}", null, null, JsonUtility.ToJson(c), onSuccess, onError);
        }

        /// <summary>
        /// PATCH only latitude/longitude so backends without armor_class etc. don't error.
        /// </summary>
        public void PatchCharacterPosition(int id, double latitude, double longitude, Action onSuccess, Action<string> onError)
        {
            var body = new CharacterPositionPatch { latitude = latitude, longitude = longitude };
            Patch("characters", $"id=eq.{id}", null, null, JsonUtility.ToJson(body), onSuccess, onError);
        }

        public void GetInventory(int characterId, Action<InventoryEntry[]> onSuccess, Action<string> onError)
        {
            GetMany("inventory", $"characterId=eq.{characterId}", onSuccess, onError);
        }

        public void PostInventory(InventoryEntry entry, Action onSuccess, Action<string> onError)
        {
            Post<InventoryEntry>("inventory", JsonUtility.ToJson(new Wrapper<InventoryEntry> { inventory = entry }), _ => onSuccess?.Invoke(), onError);
        }

        public void PatchInventory(int characterId, int itemId, InventoryEntry entry, Action onSuccess, Action<string> onError)
        {
            Patch("inventory", $"characterId=eq.{characterId}&itemId=eq.{itemId}", null, null, JsonUtility.ToJson(entry), onSuccess, onError);
        }

        public void GetItems(Action<ItemData[]> onSuccess, Action<string> onError)
        {
            GetMany("items", "", onSuccess, onError);
        }

        public void GetAbilities(Action<AbilityData[]> onSuccess, Action<string> onError)
        {
            GetMany("abilities", "", onSuccess, onError);
        }

        public void GetAncestries(Action<AncestryData[]> onSuccess, Action<string> onError)
        {
            GetMany("ancestries", "", onSuccess, onError);
        }

        public void GetBackgrounds(Action<BackgroundData[]> onSuccess, Action<string> onError)
        {
            GetMany("backgrounds", "", onSuccess, onError);
        }

        public void GetClasses(Action<ClassData[]> onSuccess, Action<string> onError)
        {
            GetMany("classes", "", onSuccess, onError);
        }

        public void GetSkills(Action<SkillData[]> onSuccess, Action<string> onError)
        {
            GetMany("skills", "", onSuccess, onError);
        }

        /// <summary>POST character (snake_case body for PostgREST). Returns created character.</summary>
        public void PostCharacterFromDto(CharacterPostDto dto, Action<CharacterData> onSuccess, Action<string> onError)
        {
            var json = JsonUtility.ToJson(dto);
            var req = new UnityWebRequest($"{_baseUrl}/characters", "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Prefer", "return=representation");
            Send(req, (CharacterResponseDto[] arr) =>
            {
                if (arr != null && arr.Length > 0)
                    onSuccess?.Invoke(ToCharacterData(arr[0]));
                else
                    onError?.Invoke("No character returned");
            }, onError);
        }

        public void PostCharacterSkill(CharacterSkillPost entry, Action onSuccess, Action<string> onError)
        {
            var json = JsonUtility.ToJson(entry);
            var req = new UnityWebRequest($"{_baseUrl}/character_skills", "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            Send<object>(req, _ => onSuccess?.Invoke(), onError);
        }

        private static CharacterData ToCharacterData(CharacterResponseDto dto)
        {
            return new CharacterData
            {
                id = dto.id,
                name = dto.name,
                ancestry = dto.ancestry,
                background = dto.background,
                classId = dto.class_id,
                level = dto.level,
                gold = dto.gold,
                speed = dto.speed,
                size = dto.size ?? "medium",
                experience = dto.experience,
                health = dto.health,
                maxHealth = dto.max_health,
                mana = dto.mana,
                maxMana = dto.max_mana,
                latitude = dto.latitude,
                longitude = dto.longitude,
                armorClass = dto.armor_class,
                strength = dto.strength,
                dexterity = dto.dexterity,
                intelligence = dto.intelligence,
                charisma = dto.charisma,
                wisdom = dto.wisdom,
                constitution = dto.constitution
            };
        }

        private void GetMany<T>(string table, string filter, Action<T[]> onSuccess, Action<string> onError)
        {
            var url = $"{_baseUrl}/{table}?limit=100";
            if (!string.IsNullOrEmpty(filter)) url += "&" + filter;
            Send(UnityWebRequest.Get(url), onSuccess, onError);
        }

        private void GetOne<T>(string table, string column, string op, string value, Action<T> onSuccess, Action<string> onError)
        {
            var url = $"{_baseUrl}/{table}?{column}={op}.{Uri.EscapeDataString(value)}&limit=1";
            Send(UnityWebRequest.Get(url), (T[] arr) =>
            {
                if (arr != null && arr.Length > 0) onSuccess?.Invoke(arr[0]);
                else onError?.Invoke("Not found");
            }, onError);
        }

        private void Post<T>(string table, string json, Action<T> onSuccess, Action<string> onError)
        {
            var req = new UnityWebRequest($"{_baseUrl}/{table}", "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Prefer", "return=representation");
            Send(req, (T[] arr) => { if (arr != null && arr.Length > 0) onSuccess?.Invoke(arr[0]); else onSuccess?.Invoke(default); }, onError);
        }

        private void Patch(string table, string filter, string col, string val, string json, Action onSuccess, Action<string> onError)
        {
            var url = $"{_baseUrl}/{table}?{filter}";
            var req = new UnityWebRequest(url, "PATCH");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            Send<object>(req, _ => onSuccess?.Invoke(), onError);
        }

        private void Send<T>(UnityWebRequest req, Action<T[]> onSuccess, Action<string> onError)
        {
            var op = req.SendWebRequest();
            op.completed += _ =>
            {
                if (req.result != UnityWebRequest.Result.Success)
                {
                    onError?.Invoke(req.error + " " + req.downloadHandler?.text);
                    req.Dispose();
                    return;
                }
                var json = req.downloadHandler?.text;
                req.Dispose();
                if (string.IsNullOrEmpty(json)) { onSuccess?.Invoke(null); return; }
                try
                {
                    var list = JsonHelper.ArrayFromJson<T>(json);
                    onSuccess?.Invoke(list);
                }
                catch (Exception e)
                {
                    onError?.Invoke(e.Message);
                }
            };
        }

        [Serializable] private class Wrapper<T> { public T characters; public T inventory; }

        [Serializable] private class CharacterPositionPatch { public double latitude; public double longitude; }
    }

    public static class JsonHelper
    {
        public static T[] ArrayFromJson<T>(string json)
        {
            var wrapper = JsonUtility.FromJson<WrapperArray<T>>("{\"items\":" + json + "}");
            return wrapper.items;
        }

        [Serializable] private class WrapperArray<T> { public T[] items; }
    }
}
