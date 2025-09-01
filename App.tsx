import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, TextInput, FlatList, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from "react-native-maps";
import * as Location from "expo-location";
import * as SecureStore from 'expo-secure-store';

import { AbilitiesApi, AbilitiesRequiredLevelsApi, AbilitiesRequiredItemsApi, AncestriesApi, CharactersApi, CharacterSkillsApi, Configuration, ClassesApi, BackgroundsApi, InventoryApi, ItemsApi, SkillsApi} from './api/index';
import type { Abilities, AbilitiesRequiredLevels, AbilitiesRequiredItems, Ancestries, Characters, CharacterSkills, Classes, Backgrounds, Inventory, Items, Skills } from "./api/index";

type Enemy = Characters & {
  path: { lat: number; lng: number }[];
  step: number;
  inventory: number[];
  lastAttackTime?: number;
};

const generateCirclePoints = (lat: number, lng: number, radiusMeters: number, numPoints: number) => {
  const points = [];
  const R = 6378137; // Earth radius in meters
  const rad = radiusMeters / R;

  for (let i = 0; i < numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    const dLat = rad * Math.cos(theta);
    const dLng = rad * Math.sin(theta) / Math.cos((lat * Math.PI) / 180);

    points.push({
      lat: lat + (dLat * 180) / Math.PI,
      lng: lng + (dLng * 180) / Math.PI,
    });
  }

  return points;
};

export default function App() {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [isAncestryCollapsed, setAncestryCollapsed] = useState(true);
  const [isBackgroundCollapsed, setBackgroundCollapsed] = useState(true);
  const [isCharacterClassCollapsed, setCharacterClassCollapsed] = useState(true);
  let subscription: Location.LocationSubscription | null = null;
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [isEquipmentOpen, setEquipmentOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Items | null>(null);
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [character, setCharacter] = useState<Characters | null>(null);
  const [name, setName] = useState(null);
  const [ancestry, setAncestry] = useState<Ancestries | null>(null);
  const [background, setBackground] = useState<Backgrounds | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<Abilities | null>(null);
  const [characterClass, setCharacterClass] = useState<Classes | null>(null);
  const [abilities, setAbilities] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [feats, setFeats] = useState([]);
  const [detailsHudExpanded, setDetailsHudExpanded] = useState(false);
  const [headSlot, setHeadSlot] = useState<Items | null>(null);
  const [chestSlot, setChestSlot] = useState<Items | null>(null);
  const [legsSlot, setLegsSlot] = useState<Items | null>(null);
  const [feetSlot, setFeetSlot] = useState<Items | null>(null);
  const [handsSlot, setHandsSlot] = useState<Items | null>(null);
  const [offhandSlot, setOffhandSlot] = useState<Items | null>(null);
  const [mainhandSlot, setMainhandSlot] = useState<Items | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Items | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<
    { id: string; lat: number; lng: number; text: string; color: string, expiresAt: number }[]
  >([]);
  const [characterAbilities, setCharacterAbilities] = useState<Abilities[] | null>(null);

  const imageHost = "http://98.127.121.74:3001/";
  const config = new Configuration({basePath: 'http://98.127.121.74:3000'});
  const classesApi = new ClassesApi(config);
  const [characterClasses, setCharacterClasses] = useState<Classes[]>([]);

  const backgroundsApi = new BackgroundsApi(config);
  const [backgrounds, setBackgrounds] = useState<Backgrounds[]>([]);

  const ancestriesApi = new AncestriesApi(config);
  const [ancestries, setAncestries] = useState<Ancestries[]>([]);

  const skillsApi = new SkillsApi(config);
  const [skills, setSkills] = useState<Skills[]>([]);

  const charactersApi = new CharactersApi(config);

  const itemsApi = new ItemsApi(config);
  const [items, setItems] = useState<Items[]>([]);

  const abilitiesApi = new AbilitiesApi(config);
  const [abilitiesList, setAbilitiesList] = useState<Abilities[]>([]);

  const characterSkillsApi = new CharacterSkillsApi(config);
  const [characterSkills, setCharacterSkills] = useState<CharacterSkills[]>([]);

  const abilitiesRequiredLevelsApi = new AbilitiesRequiredLevelsApi(config);
  const [abilitiesRequiredLevels, setAbilitiesRequiredLevels] = useState<AbilitiesRequiredLevels[]>([]);

  const abilitiesRequiredItemsApi = new AbilitiesRequiredItemsApi(config);
  const [abilitiesRequiredItems, setAbilitiesRequiredItems] = useState<AbilitiesRequiredItems[]>([]);

  const inventoryApi = new InventoryApi(config);
  const [inventory, setInventory] = useState<Inventory[]>([]);

  const [targetedEnemy, setTargetedEnemy] = useState<number | null>(null);

  const [itemsOnMap, setItemsOnMap] = useState<{ id: number; lat: number; lng: number, itemId: number }[]>([]);

  useEffect(() => {
      if (location && character) {
        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

          const perception = character.intelligence + character.wisdom;
          // Higher perception → wider view
          const zoomFactor = Math.max(0.0003, 0.003 - perception * 0.00003);

        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: zoomFactor,
          longitudeDelta: zoomFactor,
        };

        setRegion(newRegion);

        // Animate camera so it feels smooth
        mapRef.current?.animateToRegion(newRegion, 500);
      }
    }, [location, character]);

    function spawnItemOnMap(itemId: number, lat: number, lng: number) {
        const id = Math.floor(Math.random() * 1000000);
        setItemsOnMap(prev => [...prev, {id, itemId, lat, lng }]);
    }

    function addToInventory(itemOnMapId: number) {
      const itemOnMap = itemsOnMap.find(i => i.id === itemOnMapId);
      if (!itemOnMap) return;

      const existingItem = inventory.find(i => i.itemId === itemOnMap.itemId);

      let newInventory: Inventory[];

      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;

        newInventory = inventory.map(i =>
          i.itemId === existingItem.itemId
            ? { ...i, quantity: newQuantity }
            : i
        );

        setInventory(newInventory);

        inventoryApi.inventoryPatch({
          characterId: `eq.${existingItem.characterId}`,
          itemId: `eq.${existingItem.itemId}`,
          inventory: { ...existingItem, quantity: newQuantity },
        }).catch(handleApiError);
      } else {
        const newItem: Inventory = {
          characterId: character?.id ?? 0,
          itemId: itemOnMap.itemId,
          quantity: 1,
        };

        newInventory = [...inventory, newItem];
        setInventory(newInventory);

        inventoryApi.inventoryPost({
          inventory: newItem,
        }).catch(handleApiError);
      }

      // ✅ update abilities against the new inventory
      calculateAbilities(characterSkills, newInventory);

      // remove from map
      setItemsOnMap(prev => prev.filter(i => i.id !== itemOnMapId));
    }

    function handleApiError(err: any) {
      console.error("Failed to update inventory:", err);
      if (err.response) {
        console.error("Status:", err.response.status);
        err.response.text().then(
          (body: string) => console.error("Body:", body),
          (parseErr: any) => console.error("Could not parse error body:", parseErr)
        );
      }
    }


    function calculateAbilities(newCharacterSkills: CharacterSkills[] = characterSkills, newInventory: Inventory[] = inventory, newAbilitiesList: Abilities[] = abilitiesList, newRequiredLevels: AbilitiesRequiredLevels[] = abilitiesRequiredLevels, newRequiredItems: AbilitiesRequiredItems[] = abilitiesRequiredItems) {
      const inventoryByTree = newInventory.reduce<Record<string, number>>((acc, inv) => {
        if (inv.equippedSlot != null) return acc;

        const foundItem = items.find((it) => it.id === inv.itemId);
        if (!foundItem) return acc;

        const tree = foundItem.tree;
        if (!tree) return acc;

        acc[tree] = (acc[tree] ?? 0) + (inv.quantity ?? 0);
        return acc;
      }, {});

      const ca = newAbilitiesList.filter((a) => {
        if (!a.active) return false
        // level requirement
        const requiredLevel = newRequiredLevels.find((al) => al.abilityId === a.id);
        if (requiredLevel) {
          const characterLevel = newCharacterSkills.find((cs) => cs.skillId === requiredLevel.skillId);
          const meetsLevelRequirement = (characterLevel?.level ?? 0) >= (requiredLevel.requiredLevel ?? 0);
          if (!meetsLevelRequirement) return false;
        }

        // item requirement
        const requiredItem = newRequiredItems.find((ai) => ai.abilityId === a.id);
        if (requiredItem) {
          const available = inventoryByTree[requiredItem.itemTree] ?? 0;
          if (available < (requiredItem.requiredQuantity ?? 0)) return false;
        }

        return true;
      });

      setCharacterAbilities(ca);
      return ca;
    }


    function equipItem(item: Items) {
        let slot: string = selectedSlot ?? "";

        // 1. Update local slot state
        switch (item.equipmentSlot) {
          case "head":
            setHeadSlot(item);
            slot = "head";
            break;
          case "chest":
            setChestSlot(item);
            slot = "chest";
            break;
          case "hands":
            setHandsSlot(item);
            slot = "hands";
            break;
          case "legs":
            setLegsSlot(item);
            slot = "legs";
            break;
          case "feet":
            setFeetSlot(item);
            slot = "feet";
            break;
          case "main_hand":
            setMainhandSlot(item);
            slot = "main_hand";
            break;
          case "offhand":
            setOffhandSlot(item);
            slot = "offhand";
            break;
          case "either_hand":
            if (selectedSlot === "offhand") {
              setOffhandSlot(item);
              slot = "offhand";
            } else {
              setMainhandSlot(item);
              slot = "main_hand";
            }
            break;
        }

        // 2. Build new inventory
        const newInventory = inventory.map((invItem) => {
          const invItemDef = items.find((it) => it.id === invItem.itemId);

          if (!invItemDef) return invItem;

          const isSameSlot = invItemDef.equipmentSlot === item.equipmentSlot;

          if (invItem.itemId === item.id) {
            return { ...invItem, equippedSlot: slot }; // equip selected
          }

          if (isSameSlot) {
            return { ...invItem, equippedSlot: undefined }; // unequip others
          }

          return invItem;
        });

        setInventory(newInventory);

        // 3. Persist selected item to backend
        const inventoryItem = newInventory.find((i) => i.itemId === item.id);
        if (!inventoryItem) return;

        inventoryApi
          .inventoryPatch({
            characterId: `eq.${inventoryItem.characterId}`,
            itemId: `eq.${inventoryItem.itemId}`,
            inventory: inventoryItem,
          })
          .catch(async (err: any) => {
            console.error("Failed to update inventory:", err);

            if (err.response) {
              console.error("Status:", err.response.status);
              try {
                const body = await err.response.text();
                console.error("Body:", body);
              } catch (parseErr) {
                console.error("Could not parse error body:", parseErr);
              }
            }
          });
      }


    // Save character ID
    async function saveCharacterId(id: number) {
      try {
        await SecureStore.setItemAsync('characterId', id.toString());
      } catch (e) {
        console.error('Failed to save character ID', e);
      }
    }

    // Load character ID
    async function loadCharacterId(): Promise<number | null> {
      try {
        return await SecureStore.getItemAsync('characterId');
      } catch (e) {
        console.error('Failed to load character ID', e);
        return null;
      }
    }


  function calculateAttributes() {
    return {
      STR: 10 + (ancestry?.bonusStrength ?? 0) + (backgrounds?.bonusStrength ?? 0) + (characterClass?.bonusStrength ?? 0),
      DEX: 10 + (ancestry?.bonusDexterity ?? 0) + (backgrounds?.bonusDexterity ?? 0) + (characterClass?.bonusDexterity ?? 0),
      CON: 10 + (ancestry?.bonusConstitution ?? 0) + (backgrounds?.bonusConstitution ?? 0) + (characterClass?.bonusConstitution ?? 0),
      INT: 10 + (ancestry?.bonusIntelligence ?? 0) + (backgrounds?.bonusIntelligence ?? 0) + (characterClass?.bonusIntelligence ?? 0),
      WIS: 10 + (ancestry?.bonusWisdom ?? 0) + (backgrounds?.bonusWisdom ?? 0) + (characterClass?.bonusWisdom ?? 0),
      CHA: 10 + (ancestry?.bonusCharisma ?? 0) + (backgrounds?.bonusCharisma ?? 0) + (characterClass?.bonusCharisma ?? 0),
    };
  }

  function getDistanceMeters(loc1: {lat: number, lon: number}, loc2: {lat: number, lon: number}) {
      const R = 6371000; // radius of Earth in meters
      const φ1 = loc1.lat * Math.PI / 180;
      const φ2 = loc2.lat * Math.PI / 180;
      const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
      const Δλ = (loc2.lon - loc1.lon) * Math.PI / 180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c;
  }

  function calculateSpeed() {
    return 30 + (ancestry?.bonusSpeed ?? 0) + (background?.bonusSpeed ?? 0) + (characterClass?.bonusSpeed ?? 0);
  }

  function calculateAC() {
    return (headSlot?.armorClass ?? 0) + 
          (chestSlot?.armorClass ?? 0) +
          (handsSlot?.armorClass ?? 0) +
          (legsSlot?.armorClass ?? 0) +
          (feetSlot?.armorClass ?? 0)
        ;
    }

    function calculateHP() {
        return 10 + (ancestry?.bonusConstitution ?? 0) + (background?.bonusConstitution ?? 0) + (characterClass?.bonusConstitution ?? 0);
    }

    function calculateMana() {
        return 10 + (ancestry?.bonusIntelligence ?? 0) + (background?.bonusIntelligence ?? 0) + (characterClass?.bonusIntelligence ?? 0);
    }

    function fibbonaci(n: number): number {
        let a = 0, b = 1, temp;
        for (let i = 2; i <= n + 4; i++) {
            temp = a + b;
            a = b;
            b = temp;
        }
        return b;
    }

    async function spawnEnemy(latitude: number, longitude: number) {
      try {
        console.log("Spawning enemy...");
        if (!latitude || !longitude) {
            console.warn("No location available to spawn enemy");
            return;
        }
        const radius = Math.floor(Math.random() * 50) + 50; // 50-100m
        const circlePoints = generateCirclePoints(
          latitude,
          longitude,
          radius,
          8
        );

        // Build OSRM request
        const waypointString = circlePoints
          .map(p => `${p.lng},${p.lat}`)
          .join(";");
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypointString}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          console.warn("Failed to fetch route");
          return;
        }

        const routeCoords = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({
            lat,
            lng,
          })
        );

        // Select a random item for enemy to carry
        const i = Math.floor(Math.random() * items.length);
        const item = items[i];

        const id = Math.floor(Math.random() * 1000000);
        const enemyAncestry = ancestries.find(a => a.name === "Goblin");
        const enemyBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        const enemyClass = characterClasses[Math.floor(Math.random() * characterClasses.length)];
        const enemyLevel = character ? Math.max(1, character.level + Math.floor(Math.random() * 5) - 1) : 1; // ±5 level from character, min 1
        // distribute stats 1 point per level above 1
        const extraStats = {
            strength: enemyLevel,
            dexterity: enemyLevel,
            constitution: enemyLevel,
            intelligence: enemyLevel,
            wisdom: enemyLevel,
            charisma: enemyLevel,
        }
        const enemyHealth = 10 + (enemyAncestry?.bonusConstitution ?? 0) + (enemyClass?.bonusConstitution ?? 0) + (enemyBackground?.bonusConstitution ?? 0) + enemyLevel + extraStats.constitution; // base 10 + con + level + extra

        const enemy = {
          id,
          name: "Goblin",
          latitude: routeCoords[0].lat,
          longitude: routeCoords[0].lng,
          path: routeCoords,
          step: 0, // start at the beginning of the path
          health: enemyHealth, // 5–15
          maxHealth: enemyHealth,
          mana: 0,
          maxMana: 0,
          experience: 10,
          level: enemyLevel, // ±5 level from character
          ancestry: enemyAncestry?.id,
          background: enemyAncestry?.id,
          class: enemyClass?.id,
          ac: Math.floor(Math.random() * 2) + 3, // 3–5
          speed: 30 + (enemyAncestry?.bonusSpeed ?? 0) + (enemyBackground?.bonusSpeed ?? 0) + (enemyClass?.bonusSpeed ?? 0) + enemyLevel,
          strength: 10 + (enemyAncestry?.bonusStrength ?? 0) + (enemyBackground?.bonusStrength ?? 0) + (enemyClass?.bonusStrength ?? 0) + extraStats.strength,
          dexterity: 10 + (enemyAncestry?.bonusDexterity ?? 0) + (enemyBackground?.bonusDexterity ?? 0) + (enemyClass?.bonusDexterity ?? 0) + extraStats.dexterity,
          constitution: 10 + (enemyAncestry?.bonusConstitution ?? 0) + (enemyBackground?.bonusConstitution ?? 0) + (enemyClass?.bonusConstitution ?? 0) + extraStats.constitution,
          intelligence: 10 + (enemyAncestry?.bonusIntelligence ?? 0) + (enemyBackground?.bonusIntelligence ?? 0) + (enemyClass?.bonusIntelligence ?? 0) + extraStats.intelligence,
          wisdom: 10 + (enemyAncestry?.bonusWisdom ?? 0) + (enemyBackground?.bonusWisdom ?? 0) + (enemyClass?.bonusWisdom ?? 0) + extraStats.wisdom,
          charisma: 10 + (enemyAncestry?.bonusCharisma ?? 0) + (enemyBackground?.bonusCharisma ?? 0) + (enemyClass?.bonusCharisma ?? 0) + extraStats.charisma,
          inventory: item ? [item.id] : [], // safe guard
        };

        setEnemies(prev => [...prev, enemy]);
      } catch (err) {
        console.error("Failed to spawn enemy:", err);
      }
    }

    function meleeAttack(attacker: Characters, ability: Abilities, defender: Characters, isCharacterAttack: boolean) {
      console.log("Performing melee attack:", ability);
      if (!defender) {
       setFloatingTexts(prev => [
          ...prev,
          {
            id: `${Date.now()}`,
            lat: attacker.latitude + (Math.random() - 0.5) * 0.0003,
            lng:  attacker.longitude + (Math.random() - 0.5) * 0.0003,
            text: "Miss!",
            color: "gray",
            expiresAt: Date.now() + 1000,
          },
        ]);
        console.warn("No enemy targeted for melee attack");
        return;
      }

      if (!defender) {
        setFloatingTexts(prev => [
                 ...prev,
                 {
                   id: `${Date.now()}`,
                   lat:  attacker.latitude + (Math.random() - 0.5) * 0.0003,
                   lng:  attacker.longitude + (Math.random() - 0.5) * 0.0003,
                   text: "Miss!",
                   color: "gray",
                   expiresAt: Date.now() + 1000,
                 },
               ]);
        console.warn("Targeted enemy not found");
        return;
      }

      // Distance (make sure getDistanceMeters returns meters!)
      const distance = getDistanceMeters(
        { lat:  attacker.latitude, lon:  attacker.longitude },
        { lat: defender.latitude, lon: defender.longitude }
      );

      // D&D style strength modifier
      const strengthModifier = Math.floor(((character.strength ?? 10) - 10) / 2);

      // Range check
      const range = (character.speed ?? 0) + (ability?.range ?? 0);
      const inRange = distance <= range;

      if (!inRange) {
         setFloatingTexts(prev => [
              ...prev,
              {
                id: `${Date.now()}`,
                lat:  attacker.latitude + (Math.random() - 0.5) * 0.0003,
                lng:  attacker.longitude + (Math.random() - 0.5) * 0.0003,
                text: "Miss!",
                color: "gray",
                expiresAt: Date.now() + 1000,
              },
            ]);
        console.warn(`Target is out of range. Distance: ${distance.toFixed(2)}m, Range: ${range}m`);
        return;
      }

      let damage = 0;
      let anyHit = false;

      console.log(
        `Attacking defender at ${distance.toFixed(2)}m with STR mod ${strengthModifier}, hits: ${ability?.hits ?? 1}`
      );

      const defenderAc = isCharacterAttack ? 1 : calculateAC();
      for (let i = 0; i < (ability?.hits ?? 1); i++) {
        const hitRoll = Math.floor(Math.random() * 20) + 1 + strengthModifier;
        if (hitRoll >= defenderAc) {
          const maxDamage = ability?.damage ?? 6;
          const damageRoll = Math.floor(Math.random() * maxDamage) + 1;
          console.log(`Hit! Rolled ${damageRoll} damage`);
          damage += damageRoll;
          anyHit = true;
          setFloatingTexts(prev => [
              ...prev,
              {
                id: `${defender.id}-${Date.now()}`, // unique
                lat:  attacker.latitude + (Math.random() - 0.5) * 0.0003, // slight random offset
                lng:  attacker.longitude + (Math.random() - 0.5) * 0.0003,
                text: `-${damageRoll}`,
                color: "red",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
        } else {
          console.log("Missed!");
           setFloatingTexts(prev => [
              ...prev,
              {
                id: `${defender.id}-${Date.now()}`,
              lat:  attacker.latitude + (Math.random() - 0.5) * 0.0003,
              lng:  attacker.longitude + (Math.random() - 0.5) * 0.0003,
                text: "Miss!",
                color: "gray",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
        }
      }

      if (damage >= (defender.health ?? 0)) {
        if (isCharacterAttack) {
            console.log("Enemy defeated!");
            setEnemies(prev => prev.filter(e => e.id !== defender.id));
            for (const itemId of defender.inventory) {
              spawnItemOnMap(
                itemId,
                defender.latitude + (Math.random() - 0.5) * 0.0003,
                defender.longitude + (Math.random() - 0.5) * 0.0003
              );
            }
            // Award experience increment level
            const expGain = defender.level ?? 0;
            const newExp = (character?.experience ?? 0) + expGain;
            // Fibbonacci-like level up requirement
            const nextLevelExp = fibbonaci((character?.level ?? 1));
            if (newExp >= nextLevelExp) {
                const newLevel = (character?.level ?? 1) + 1;
                const newMaxHealth = (character?.maxHealth ?? 0) + 1;
                const newMaxMana = (character?.maxMana ?? 0) + 1;
                const newStrength = (character?.strength ?? 0) + 1;
                const newDexterity = (character?.dexterity ?? 0) + 1;
                const newIntelligence = (character?.intelligence ?? 0) + 1;
                const newCharisma = (character?.charisma ?? 0) + 1;
                const newWisdom = (character?.wisdom ?? 0) + 1;
                const newConstitution = (character?.constitution ?? 0) + 1;
                // Alert with new values
                setFloatingTexts(prev => [
                    ...prev,
                    {
                        id: `${Date.now()}`,
                        lat: character.latitude + (Math.random() - 0.5) * 0.0003,
                        lng: character.longitude + (Math.random() - 0.5) * 0.0003,
                        text: `Level ${newLevel}`,
                        color: "gold",
                        expiresAt: Date.now() + 2000, // 2 seconds
                    },
                ]);
                const updatedChar = character
                  ? {
                      ...character,
                      level: newLevel,
                      experience: newExp,
                      maxHealth: newMaxHealth,
                      health: newMaxHealth,
                      maxMana: newMaxMana,
                      mana: newMaxMana,
                      strength: newStrength,
                      dexterity: newDexterity,
                      intelligence: newIntelligence,
                      charisma: newCharisma,
                      wisdom: newWisdom,
                      constitution: newConstitution
                    }
                  : character;

                setCharacter(updatedChar);

                charactersApi.charactersPatch({
                  id: `eq.${character.id}`,
                  characters: {
                    level: newLevel,
                    experience: newExp,
                    maxHealth: newMaxHealth,
                    health: newMaxHealth,
                    maxMana: newMaxMana,
                    mana: newMaxMana,
                    strength: newStrength,
                    dexterity: newDexterity,
                    intelligence: newIntelligence,
                    charisma: newCharisma,
                    wisdom: newWisdom,
                    constitution: newConstitution
                  },
                }).catch(async (err: any) => {
                   console.error("Failed to update character level:", err);

                   if (err.response) {
                     console.error("Status:", err.response.status);
                     try {
                       const body = await err.response.text();
                       console.error("Body:", body);
                     } catch (parseErr) {
                       console.error("Could not parse error body:", parseErr);
                     }
                   }
                 });
            } else {
                const updatedChar = character
                  ? {
                      ...character,
                      experience: newExp,
                    }
                  : character;

                setCharacter(updatedChar);

                charactersApi.charactersPatch({
                  id: `eq.${character.id}`,
                  characters: {
                    experience: newExp,
                  },
                }).catch(async (err: any) => {
                   console.error("Failed to update character level:", err);

                   if (err.response) {
                     console.error("Status:", err.response.status);
                     try {
                       const body = await err.response.text();
                       console.error("Body:", body);
                     } catch (parseErr) {
                       console.error("Could not parse error body:", parseErr);
                     }
                   }
                 });
            }
        } else {
            console.log("Character defeated!");
            // Handle character defeat (e.g., respawn, lose items, etc.)
            setCharacter(null);
            saveCharacterId(null);
            setEnemies([]);
            setInventory([]);
            setItemsOnMap([]);
        }
      } else {
        if (isCharacterAttack) {
            setEnemies(prev =>
              prev.map(e =>
                e.id === defender.id ? { ...e, health: e.health - damage } : e
              )
            );
        } else {
            setCharacter(prev => prev ? { ...prev, health: (prev.health ?? 10) - damage } : prev);
        }
      }

      console.log(anyHit ? `Total damage dealt: ${damage}` : "All attacks missed!");
    }

    useEffect(() => {
      const interval = setInterval(() => {
        setFloatingTexts(prev => prev.filter(ft => ft.expiresAt > Date.now()));
      }, 200); // check ~5x/sec
      return () => clearInterval(interval);
    }, []);

    const abilityFunctions = {
        "Search": () => {
            const coin = Math.random();
            const itemName = coin > 0.5 ? "Rock " : "Stick";
            const item = items.find(item => item.name === itemName);
            if (!item) {
                console.warn(`${itemName} item not found in database`);
                return;
            }
            spawnItemOnMap(item.id, location.coords.latitude + (Math.random() - 0.5) * 0.0005, location.coords.longitude + (Math.random() - 0.5) * 0.0005);
            setFloatingTexts(prev => [
              ...prev,
              {
                id: `${Date.now()}`,
              lat: location.coords.latitude + (Math.random() - 0.5) * 0.0003,
              lng: location.coords.longitude + (Math.random() - 0.5) * 0.0003,
                text: "Search!",
                color: "purple",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
        },
        "Gather": () => {
            console.log("Gather...");
            // items withing my speed range get added to my inventory
            const speed = character.speed
            if (!location || !character || !speed) {
                console.warn("No location or character speed available for gathering");
                return;
            }
            const nearbyItems = itemsOnMap.filter(i => {
                const dist = getDistanceMeters(
                    { lat: i.lat, lon: i.lng },
                    { lat: location.coords.latitude, lon: location.coords.longitude }
                );
                return dist <= speed;
            });
            if (nearbyItems.length === 0) {
                console.log("No items nearby to gather");
                setFloatingTexts(prev => [
                  ...prev,
                  {
                    id: `${Date.now()}`,
                  lat: location.coords.latitude + (Math.random() - 0.5) * 0.0003,
                  lng: location.coords.longitude + (Math.random() - 0.5) * 0.0003,
                    text: "Nothing found",
                    color: "gray",
                    expiresAt: Date.now() + 1000, // 1 second
                  },
                ]);
                return;
            }
            nearbyItems.forEach(i => addToInventory(i.id));
            setFloatingTexts(prev => [
              ...prev,
              {
                id: `${Date.now()}`,
              lat: location.coords.latitude + (Math.random() - 0.5) * 0.0003,
              lng: location.coords.longitude + (Math.random() - 0.5) * 0.0003,
                text: `+${nearbyItems.length} item`,
                color: "green",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
            setItemsOnMap(prev => prev.filter(i => !nearbyItems.some(ni => ni.id === i.id)));
        },
        "Craft Item": () => {
            console.log("Crafting Item...");
        }, // Placeholder
        "Punch": async () => {
            console.log("Attempting to punch...");
            const ability = abilitiesList.find(ab => ab.name === "Punch");
            if (!ability) {
                console.warn("Punch ability not found");
                return;
            }
            const enemy = enemies.find(e => e.id === targetedEnemy) ?? null;
            meleeAttack(character, ability, enemy, true);
        },
        "Throw Item": () => {
            console.log("Throwing Item...");
        }, // Placeholder
    };

  useEffect(() => {
      (async () => {
        const fetchClasses = async () => {
          try {
            const result = await classesApi.classesGet({}); // fully-typed GET request
            if (result) setCharacterClasses(result);
          } catch (err) {
            console.error('Failed to fetch classes:', err);
          }
        };

        fetchClasses();

        const fetchBackgrounds = async () => {
          try {
            const result = await backgroundsApi.backgroundsGet({}); // fully-typed GET request
            if (result) setBackgrounds(result);
          } catch (err) {
            console.error('Failed to fetch backgrounds:', err);
          }
        };
        fetchBackgrounds();

        const fetchAncestries = async () => {
          try {
            const result = await ancestriesApi.ancestriesGet({}); // fully-typed GET request
            if (result) setAncestries(result);
          } catch (err) {
            console.error('Failed to fetch ancestries:', err);
          }
        };
        fetchAncestries();

        const fetchSkills = async () => {
          try {
            const result = await skillsApi.skillsGet({}); // fully-typed GET request
            if (result) setSkills(result);
          } catch (err) {
            console.error('Failed to fetch skills:', err);
          }
        };
        fetchSkills();

        const fetchItems = async () => {
          try {
            const result = await itemsApi.itemsGet({}); // fully-typed GET request
            if (result) {
                setItems(result);
            }
          } catch (err) {
            console.error('Failed to fetch items:', err);
          }
        };
        fetchItems();

        const fetchAbilities = async () => {
          try {
            const result = await abilitiesApi.abilitiesGet({}); // fully-typed GET request
            if (result) setAbilitiesList(result);
          } catch (err) {
            console.error('Failed to fetch abilities:', err);
          }
        };
        fetchAbilities();

        const fetchAbilitiesRequiredItems = async () => {
          try {
            const result = await abilitiesRequiredItemsApi.abilitiesRequiredItemsGet({}); // fully-typed GET request
            if (result) setAbilitiesRequiredItems(result);
          } catch (err) {
            console.error('Failed to fetch abilities required items:', err);
          }
        };
        fetchAbilitiesRequiredItems();

        const fetchAbilitiesRequiredLevels = async () => {
          try {
            const result = await abilitiesRequiredLevelsApi.abilitiesRequiredLevelsGet({}); // fully-typed GET request
            if (result) setAbilitiesRequiredLevels(result);
          } catch (err) {
            console.error('Failed to fetch abilities required levels:', err);
          }
        };
        fetchAbilitiesRequiredLevels();

        const fetchCharacter = async () => {
          try {
            const id = await loadCharacterId();
            if (!id) {
              console.warn("No character ID found, creating new character");
              return;
            }
             const c = await charactersApi.charactersGet({
                id: `eq.${id}`, // PostgREST syntax
                limit: "1",     // just to be safe
              });

              const loadedCharacter = c[0] || null;
              setCharacter(loadedCharacter);
              if (loadedCharacter) {
                const loadedInventory = await inventoryApi.inventoryGet({
                    characterId: `eq.${loadedCharacter.id}`, // PostgREST syntax
                    limit: "100", // Adjust as needed
                });
                setInventory(loadedInventory || []);
                const loadedItems = items.length != 0 ? items : await itemsApi.itemsGet({});
                setItems(loadedItems);
                loadedInventory?.forEach((inv) => {
                  if (inv.equippedSlot) {
                    const it = loadedItems?.find((i) => i.id == inv.itemId);
                    if (it == null) return;
                    if (inv.equippedSlot === "head") {
                      setHeadSlot(it);
                    } else if (inv.equippedSlot === "chest") {
                      setChestSlot(it);
                    } else if (inv.equippedSlot === "hands") {
                      setHandsSlot(it);
                    } else if (inv.equippedSlot === "legs") {
                      setLegsSlot(it);
                    } else if (inv.equippedSlot === "feet") {
                      setFeetSlot(it);
                    } else if (inv.equippedSlot === "main_hand") {
                      setMainhandSlot(it);
                    } else if (inv.equippedSlot === "offhand") {
                      setOffhandSlot(it);
                    }
                  }
                });
                const loadedCharacterSkills = await characterSkillsApi.characterSkillsGet({
                    characterId: `eq.${loadedCharacter.id}`, // PostgREST syntax
                    limit: "100", // Adjust as needed
                });
                setCharacterSkills(loadedCharacterSkills || []);
                const loadedAbilities = await abilitiesApi.abilitiesGet({});
                setAbilitiesList(loadedAbilities || []);
                const loadedAbilityRequiredItems =  await abilitiesRequiredItemsApi.abilitiesRequiredItemsGet({});
                setAbilitiesRequiredItems(loadedAbilityRequiredItems || []);
                const loadedAbilityRequiredLevels =  await abilitiesRequiredLevelsApi.abilitiesRequiredLevelsGet({});
                setAbilitiesRequiredLevels(loadedAbilityRequiredLevels || []);
                calculateAbilities(
                  loadedCharacterSkills || [], loadedInventory || [], loadedAbilities || [], loadedAbilityRequiredLevels || [], loadedAbilityRequiredItems || []
                );
              }

          } catch (err) {
            console.error('Failed to fetch characters:', err);
          }
        };
        fetchCharacter();

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Permission to access location was denied");
          return;
        }

        const subscribeToLocation = async () => {
            // Ask for permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
              console.warn("Permission to access location was denied");
              return;
            }

            // Subscribe to updates
            subscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Highest,
                timeInterval: 1000,   // ms between updates
                distanceInterval: 1,  // meters moved before update
              },
              (loc) => {
                setLocation(loc);
                setCharacter(prev => {
                  if (!prev) return prev;
                  return { ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                });
              }
            );
          };
        await subscribeToLocation();
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        setCharacter(prev => {
          if (!prev) return prev;
          return { ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        });
      })();
    }, []);

    const canSeeCharacter = (enemy: Enemy, character: Character) => {
      if (!character?.latitude || !character?.longitude) return false;
      const dist = getDistanceMeters(
        { lat: enemy.latitude, lon: enemy.longitude },
        { lat: character.latitude, lon: character.longitude }
      );
      return dist <= (enemy.wisdom + enemy.intelligence);
    };

    function moveToward(enemy: Enemy, target: Character, stepSizeMeters: number): Enemy {
      const dLat = target.latitude - enemy.latitude;
      const dLng = target.longitude - enemy.longitude;

      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist < 1e-9) return enemy; // Already on top of character

      // normalize step vector
      const moveLat = (dLat / dist) * (stepSizeMeters / 111111); // meters to lat
      const moveLng = (dLng / dist) * (stepSizeMeters / (111111 * Math.cos(enemy.latitude * (Math.PI/180))));

      return {
        ...enemy,
        latitude: enemy.latitude + moveLat,
        longitude: enemy.longitude + moveLng,
      };
    }

    useEffect(() => {
      if (!location || items.length === 0) {
        console.log("Waiting for location and items to be available...");
        return;
      }

      if (enemies.length === 0) {
        console.log("Spawning initial enemies...");
        spawnEnemy(
            location.coords.latitude + (Math.random() - 0.5) * 0.0005,
            location.coords.longitude + (Math.random() - 0.5) * 0.0005);
      }

    // Spawn enemies every 5 minutes
    const enemySpawnTimer = setInterval(() => {
      console.log("Spawning enemy timer triggered");
      spawnEnemy(location.coords.latitude + (Math.random() - 0.5) * 0.001,
                             location.coords.longitude + (Math.random() - 0.5) * 0.001); // pass latest location directly
    }, 1 * 20 * 1000); // every 20 seconds for testing, change to 5*60*1000 (5 minutes) later

      const smoothStepInterval = 50; // ms per micro-step
      const microSteps = 100;

      // Animate enemies
      const enemyAnimTimer = setInterval(() => {
        setEnemies(prev =>
          prev.map(e => {
             // If character is in perception
              if (canSeeCharacter(e, character)) {
                const distance = getDistanceMeters(
                  { lat: e.latitude, lon: e.longitude },
                  { lat: character.latitude, lon: character.longitude }
                );

                const now = Date.now();

                // If in attack range → attack
                if (distance <= e.speed) {
                  if (!e.lastAttackTime || now - e.lastAttackTime >= 2000) {
                      const attack = abilitiesList.find(ab => ab.name === "Punch");
                      meleeAttack(e, attack, character, false);
                      return { ...e, lastAttackTime: now };
                    }
                  return e;
                }

                // Otherwise → move toward character
                return moveToward(e, character, 1); // move 1m per tick
              }

            if (!e.path || e.path.length < 2) return e;

            const current = e.path[e.step];
            const nextStep = (e.step + 1) % e.path.length;
            const next = e.path[nextStep];

            const interpolationFactor = (e.microStep ?? 0) / microSteps;

            const microLat =
              current.lat + (next.lat - current.lat) * interpolationFactor;
            const microLng =
              current.lng + (next.lng - current.lng) * interpolationFactor;

            const newMicroStep = (e.microStep ?? 0) + 1;
            const newStep = newMicroStep >= microSteps ? nextStep : e.step;

            return {
              ...e,
              latitude: microLat,
              longitude: microLng,
              step: newStep,
              microStep: newMicroStep % microSteps,
            };
          })
        );
      }, smoothStepInterval);

      // Spawn items every 2 minutes
      const itemTimer = setInterval(() => {
        console.log("Spawning item...");
        const item = items[Math.floor(Math.random() * items.length)];
        spawnItemOnMap(
          item.id,
          location.coords.latitude + (Math.random() - 0.5) * 0.001,
          location.coords.longitude + (Math.random() - 0.5) * 0.001
        );
      }, 1 * 20 * 1000); // every 20 seconds for testing, change to 2*60*1000 (2 minutes) later

      return () => {
        clearInterval(enemyAnimTimer);
        clearInterval(itemTimer);
        clearInterval(enemySpawnTimer);
      };
    }, [location, items]);

    if (!character) {
        return (
            <View style={[styles.characterCreationContainer, { height: '70%', padding: 20 }]}>
                <ScrollView>
                  <Text style={styles.title}>Character Details</Text>

                  {/* Character Name */}
                  <TextInput
                    style={styles.input}
                    placeholder="Enter character name"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor="#aaa"
                  />

                 {/* Choices (Ancestry, Background, Class) */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Character Ancestry</Text>
                  <View>
                      {ancestry && (
                          <TouchableOpacity style={styles.selectedItemContainer} onPress={() => setAncestryCollapsed(!isAncestryCollapsed)}>
                              <Text style={styles.selectedItemTitle}>{ancestry.name}</Text>
                              <Image source={{ uri: imageHost + ancestry.image }} style={styles.selectedItemImage} />
                              <Text style={styles.selectedItemDescription}>{ancestry.description}</Text>

                              { !isAncestryCollapsed && (
                                <View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>Size</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.baseSize}
                                    </Text>
                                  </View>
                                  <View style={styles.row}>
                                    <View style={styles.statBlock}>
                                      <Text style={styles.statLabel}>Speed</Text>
                                      <Text style={styles.statValue}>
                                        {ancestry.bonusSpeed}m
                                      </Text>
                                    </View>
                                     <View style={styles.statBlock}>
                                      <Text style={styles.statLabel}>HP</Text>
                                      <Text style={styles.statValue}>
                                        {ancestry.bonusHealth}
                                      </Text>
                                      </View>
                                     <View style={styles.statBlock}>
                                      <Text style={styles.statLabel}>MANA</Text>
                                      <Text style={styles.statValue}>
                                        {ancestry.bonusMana}
                                      </Text>
                                    </View>
                                   </View>
                                 <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>STR</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusStrength}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>DEX</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusDexterity}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CON</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusConstitution}
                                    </Text>
                                   </View>
                                  </View>
                                <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>INT</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusIntelligence}
                                    </Text>
                                  </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>WIS</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusWisdom}
                                    </Text>
                                </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CHA</Text>
                                    <Text style={styles.statValue}>
                                      {ancestry.bonusCharisma}
                                    </Text>
                                 </View>
                             </View>
                            </View>
                           )}
                          </TouchableOpacity>
                      )}
                      <FlatList
                          data={ancestries}
                          keyExtractor={(item) => item.id.toString()}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                          renderItem={({ item }) => (
                              <TouchableOpacity style={styles.statBlock} onPress={() => {setAncestry(item); setAncestryCollapsed(false);}}>
                                  <Image source={{ uri: imageHost + item.image }} style={styles.slotIcon} />
                              </TouchableOpacity>
                          )}
                      />
                    </View>
                </View>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Character Background</Text>
                    <View>
                        {background && (
                            <TouchableOpacity style={styles.selectedItemContainer} onPress={() => setBackgroundCollapsed(!isBackgroundCollapsed)}>
                                <Text style={styles.selectedItemTitle}>{background.name}</Text>
                                <Image source={{ uri: imageHost + background.image }} style={styles.selectedItemImage} />
                                <Text style={styles.selectedItemDescription}>{background.description}</Text>

                                { !isBackgroundCollapsed && (
                                  <View>
                                    <View style={styles.row}>
                                     <View style={styles.statBlock}>
                                        <Text style={styles.statLabel}>Speed</Text>
                                        <Text style={styles.statValue}>
                                          {background.bonusSpeed}m
                                        </Text>
                                      </View>
                                      <View style={styles.statBlock}>
                                        <Text style={styles.statLabel}>HP</Text>
                                        <Text style={styles.statValue}>
                                          {background.bonusHealth}
                                        </Text>
                                      </View>
                                     <View style={styles.statBlock}>
                                      <Text style={styles.statLabel}>MANA</Text>
                                      <Text style={styles.statValue}>
                                        {background.bonusMana}
                                      </Text>
                                    </View>
                                   </View>
                                 <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>STR</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusStrength}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>DEX</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusDexterity}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CON</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusConstitution}
                                    </Text>
                                   </View>
                                  </View>
                                <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>INT</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusIntelligence}
                                    </Text>
                                  </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>WIS</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusWisdom}
                                    </Text>
                                </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CHA</Text>
                                    <Text style={styles.statValue}>
                                      {background.bonusCharisma}
                                    </Text>
                                 </View>
                                </View>
                            </View>
                            )}
                            </TouchableOpacity>
                        )}
                        <FlatList
                            data={backgrounds}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.statBlock} onPress={() => {setBackground(item); setBackgroundCollapsed(false);}}>
                                    <Image source={{ uri: imageHost + item.image }} style={styles.slotIcon} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Character Class</Text>
                    <View>
                        {characterClass && (
                            <TouchableOpacity style={styles.selectedItemContainer} onPress={() => setCharacterClassCollapsed(!isCharacterClassCollapsed)}>
                                <Text style={styles.selectedItemTitle}>{characterClass.name}</Text>
                                <Image source={{ uri: imageHost + characterClass.image }} style={styles.selectedItemImage} />
                                <Text style={styles.selectedItemDescription}>{characterClass.description}</Text>

                                { !isCharacterClassCollapsed && (
                                  <View>
                                    <View style={styles.row}>
                                         <View style={styles.statBlock}>
                                          <Text style={styles.statLabel}>Speed</Text>
                                          <Text style={styles.statValue}>
                                            {characterClass.bonusSpeed}m
                                          </Text>
                                        </View>
                                      <View style={styles.statBlock}>
                                        <Text style={styles.statLabel}>HP</Text>
                                        <Text style={styles.statValue}>
                                          {characterClass.bonusHealth}
                                        </Text>
                                      </View>
                                     <View style={styles.statBlock}>
                                      <Text style={styles.statLabel}>MANA</Text>
                                      <Text style={styles.statValue}>
                                        {characterClass.bonusMana}
                                      </Text>
                                    </View>
                                   </View>
                                 <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>STR</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusStrength}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>DEX</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusDexterity}
                                    </Text>
                                  </View>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CON</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusConstitution}
                                    </Text>
                                   </View>
                                  </View>
                                <View style={styles.row}>
                                  <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>INT</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusIntelligence}
                                    </Text>
                                  </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>WIS</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusWisdom}
                                    </Text>
                                </View>
                                <View style={styles.statBlock}>
                                    <Text style={styles.statLabel}>CHA</Text>
                                    <Text style={styles.statValue}>
                                      {characterClass.bonusCharisma}
                                    </Text>
                                 </View>
                                </View>
                            </View>
                            )}
                            </TouchableOpacity>
                        )}
                        <FlatList
                            data={characterClasses}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.statBlock} onPress={() => {setCharacterClass(item); setCharacterClassCollapsed(false);}}>
                                    <Image source={{ uri: imageHost + item.image }} style={styles.slotIcon} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>



                  {/* Attributes */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Calculated Stats</Text>
                   <View style={styles.statBlock}><Text style={styles.statLabel}>Size</Text><Text style={styles.statValue}>{ancestry?.baseSize ?? "N/A"}</Text></View>
                  <View style={styles.row}>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>Speed</Text><Text style={styles.statValue}>{calculateSpeed()}m</Text></View>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>HP</Text><Text style={styles.statValue}>{calculateHP()}</Text></View>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>Mana</Text><Text style={styles.statValue}>{calculateMana()}</Text></View>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>STR</Text><Text style={styles.statValue}>{calculateAttributes().STR}</Text></View>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>DEX</Text><Text style={styles.statValue}>{calculateAttributes().DEX}</Text></View>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>CON</Text><Text style={styles.statValue}>{calculateAttributes().CON}</Text></View>
                   </View>
                   <View style={styles.row}>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>INT</Text><Text style={styles.statValue}>{calculateAttributes().INT}</Text></View>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>WIS</Text><Text style={styles.statValue}>{calculateAttributes().WIS}</Text></View>
                    <View style={styles.statBlock}><Text style={styles.statLabel}>CHA</Text><Text style={styles.statValue}>{calculateAttributes().CHA}</Text></View>
                   </View>
                  </View>

                    {/* Abilities */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Starting Abilities</Text>
                      <View>
                        {selectedAbility && (
                            <View style={styles.selectedItemContainer}>
                                <Text style={styles.selectedItemTitle}>{selectedAbility.name}</Text>
                                <Image source={{ uri: imageHost + selectedAbility.image}} style={styles.selectedItemImage} />
                                <Text style={styles.selectedItemDescription}>{selectedAbility.description}</Text>
                                <Text style={styles.selectedItemQuantity}>Range: {selectedAbility.range}m</Text>
                                <Text style={styles.selectedItemQuantity}>Damage:{selectedAbility.damage}</Text>
                                <Text style={styles.selectedItemQuantity}>Hits: {selectedAbility.hits ?? 1}</Text>
                            </View>
                        )}
                        <FlatList
                            data={abilitiesList.filter((a) => {
                              if (!a.active) return false;
                              const requiredLevel = abilitiesRequiredLevels.find((arl) => arl.abilityId === a.id);
                              if (requiredLevel?.requiredLevel !== 1) {
                                return false;
                              }

                              const requiredItem = abilitiesRequiredItems.find((ai) => ai.abilityId === a.id);
                              if (requiredItem) {
                                return false;
                              }
                              return true;
                            })}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.statBlock} onPress={() => setSelectedAbility(item)}>
                                    <Image source={{ uri: imageHost + item.image }} style={styles.slotIcon} />
                                </TouchableOpacity>
                                )}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.card, { backgroundColor: "#4CAF50" }]}
                      onPress={async () => {   // <-- make it async
                        const id = Math.floor(Math.random() * 1000000); // Temporary ID, replace with actual ID from API
                        const newCharacter: Characters = {
                          id: id, // Temporary ID, replace with actual ID from API
                          name: name,
                          ancestry: ancestry?.id ?? 0,
                          background: background?.id ?? 0,
                          classId: characterClass?.id ?? 0,
                          speed: calculateSpeed(),
                          size: ancestry?.baseSize ?? "medium", // safety
                          dexterity: calculateAttributes().DEX,
                          strength: calculateAttributes().STR,
                          intelligence: calculateAttributes().INT,
                          charisma: calculateAttributes().CHA,
                          wisdom: calculateAttributes().WIS,
                          constitution: calculateAttributes().CON,
                          level: 1,
                          gold: 0,
                          experience: 0,
                          health: calculateHP(),
                          maxHealth: calculateHP(),
                          mana: calculateMana(),
                          maxMana: calculateMana(),
                          longitude: location?.coords.longitude ?? 0,
                          latitude: location?.coords.latitude ?? 0,
                        };

                        // Post character to API
                        await charactersApi.charactersPost({
                          characters: newCharacter,
                        });

                        setCharacter(newCharacter);
                        saveCharacterId(id);

                        // Create initial skills
                        const characterSkills = skills.map((skill) => ({
                            characterId: id,
                            skillId: skill.id,
                            level: 1,
                            experience: 0,
                        }));

                        await characterSkills.forEach(skill => {
                            characterSkillsApi.characterSkillsPost({
                              characterSkills: skill,
                            });
                        });

                        setCharacterSkills(characterSkills);
                        calculateAbilities(characterSkills, inventory);
                      }}
                    >
                        <Text style={{ color: "#fff", textAlign: "center", fontSize: 18 }}>Create Character</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        )
    }


    if (!location) {
      return (
        <View style={styles.container}>
          <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Image source={{ uri: imageHost + "plain-dagger.png"}} width={100} height={100} />
          </View>
        </View>
      );
    }

  const { latitude, longitude } = location.coords;

  const currentXP = 120; // Example XP value
  const maxXP = 200;
  const currentMana = 20; // Example XP value
  const maxMana = 250;

  const hpPercentage = (character.health / character.maxHealth) * 100;
  const xpPercentage = (character.experience / fibbonaci(character.level ?? 1)) * 100;
  const manaPercentage = (character.mana / character.maxMana) * 100;


  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        initialRegion={region} // switch to region if we want to snap to users locations
        style={styles.map}
          customMapStyle={[
            {
              "elementType": "geometry",
              "stylers": [{ "color": "#d2b48c" }] // parchment background
            },
            {
              "elementType": "labels",
              "stylers": [{ "visibility": "on" }]
            },
            {
              "featureType": "water",
              "elementType": "geometry",
              "stylers": [{ "color": "#a3c1ad" }] // faded bluish-green rivers/lakes
            },
            {
              "featureType": "road",
              "elementType": "geometry",
              "stylers": [
                { "color": "#000000" }, // tan paths
                { "weight": 2 }
              ]
            },
            {
              "featureType": "landscape.natural",
              "elementType": "geometry",
              "stylers": [{ "color": "#c9c68d" }] // hills/mountains
            },
            {
              "featureType": "poi.park",
              "elementType": "geometry",
              "stylers": [{ "color": "#8cae68" }] // forests
            }
          ]}
        provider={PROVIDER_GOOGLE}
        scrollEnabled={true} // enable map scrolling
        zoomEnabled={true} // enable zoom
        rotateEnabled={true}
        showsUserLocation={false}
      >
          {floatingTexts.map(ft => (
            <Marker
              key={ft.id}
              coordinate={{ latitude: ft.lat, longitude: ft.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  padding: 2,
                }}
              >
                <Text style={{ color: ft.color, fontWeight: "bold", fontSize: 10 }}>
                  {ft.text}
                </Text>
              </View>
            </Marker>
          ))}
        <Marker
          coordinate={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        }}
          title={character.name}
          anchor={{ x: 0.3, y: 0.4 }}
          description={`Level: ${character.level}`}
          onPress={() => setTargetedEnemy(null)} // Deselect enemy on character marker press
        >
            <View style={{ width: 20, height: 20 }}>
                <Image source={{ uri: imageHost + characterClasses.find((c) => c.id == character.classId).image}} width={20} height={20}/>
            </View>
        </Marker>
        {itemsOnMap.map((item, index) => {
            const itemData = items.find(i => i.id === item.itemId);
            if (!itemData) return null;
            return (
                <Marker
                    key={`item-${index}`}
                    coordinate={{ latitude: item.lat, longitude: item.lng }}
                    title={itemData.name}
                    description={itemData.description}
                >
                    <View style={{ width: 20, height: 20 }}>
                        <Image source={{ uri: imageHost + itemData.image }} style={{ width: 20, height: 20 }} />
                    </View>
                </Marker>
            );
        })}
        {enemies.map(e => (
          <Marker
              key={e.id}
              title={e.name}
              anchor={{ x: 0.3, y: 0.4 }}
              description={`Level: ${e.level} | Health: ${e.health}/${e.maxHealth} | AC: ${e.ac}`}
              coordinate={{ latitude: e.latitude, longitude: e.longitude }}
              onPress={() => setTargetedEnemy(e.id)}
            >
              <View style={{ width: 20, height: 20 }}>
                <Image
                  source={{ uri: imageHost + ancestries.find(a => a.id === e.ancestry)?.image }} // assuming Goblin has id 1
                  width={20}
                  height={20}
                  style={{
                    transform: [{ scale: targetedEnemy === e.id ? 1.3 : 1 }],
                  }}
                />
              </View>
            </Marker>
        ))}
        {enemies.map(e => {
          if (!location) return null;

          const canPerceive = canSeeCharacter(e, character);

          return (
            <Circle
              key={e.id}
              center={{
                latitude: e.latitude,
                longitude: e.longitude,
              }}
              radius={canPerceive ? e.speed: (e.wisdom + e.intelligence)}
              strokeWidth={2}
              strokeColor={canPerceive ? "rgba(255,0,0,0.6)" : "rgba(0,0,255,0.6)"}
              fillColor={canPerceive ? "rgba(255,0,0,0.2)" : "rgba(0,0,255, 0.2)"}
            />
          );
        })}
        <Circle
          center={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }}
          radius={character.speed} // meters
          strokeWidth={2}
          strokeColor="rgba(255,0,255,0.6)"
          fillColor="rgba(255,0, 255, 0.2)"
        />
      </MapView>
      <View style={styles.statusHudContainer}>
           {/* HP Bar */}
                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View style={[styles.barFill, { width: `${hpPercentage}%`, backgroundColor: "red" }]} />
                  </View>
                  <Text>HP: {character.health}/{character.maxHealth}</Text>
                </View>

              {/* Mana Bar */}
              <View style={styles.barContainer}>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${manaPercentage}%`, backgroundColor: "blue" }]} />
                </View>
                <Text>Mana: {character.mana}/{character.maxMana}</Text>
              </View>

                {/* XP Bar */}
                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View style={[styles.barFill, { width: `${xpPercentage}%`, backgroundColor: "gold" }]} />
                  </View>
                    <Text>XP: {character.experience}/{fibbonaci((character?.level ?? 1))}</Text>
                </View>
        </View>
          <TouchableOpacity activeOpacity={0.8}
                  style={styles.detailsHudContainer}
                  onPress={() => setDetailsHudExpanded(!detailsHudExpanded)}>
            <Text style={styles.detailsHudTextName}>{character.name}</Text>
            <Text style={styles.detailsHudTextTitle}>Level {character.level}</Text>

            {detailsHudExpanded && (
                <View>
                    <View style={styles.detailsHudDivider} />
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                        <Image source={{ uri: imageHost + ancestries.find((c) => c.id == character.ancestry)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
                        <Text style={styles.detailsHudTextStat}>
                          {ancestries.find((c) => c.id == character.ancestry)?.name}
                        </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                        <Image source={{ uri: imageHost + backgrounds.find((c) => c.id == character.background)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
                        <Text style={styles.detailsHudTextStat}>
                      {backgrounds.find((c) => c.id == character.background)?.name}
                    </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                        <Image source={{ uri: imageHost + characterClasses.find((c) => c.id == character.classId)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
                        <Text style={styles.detailsHudTextStat}>
                          {characterClasses.find((c) => c.id == character.classId)?.name}
                        </Text>
                    </View>
                    <Text style={styles.detailsHudTextStat}>Gold: {character.gold}</Text>

                    <View style={styles.detailsHudDivider} />
                    <Text style={styles.detailsHudTextStat}>AC {calculateAC()}</Text>
                    <Text style={styles.detailsHudTextStat}>STR {character.strength}</Text>
                    <Text style={styles.detailsHudTextStat}>DEX {character.dexterity}</Text>
                    <Text style={styles.detailsHudTextStat}>CON {character.constitution}</Text>
                    <Text style={styles.detailsHudTextStat}>INT {character.intelligence}</Text>
                    <Text style={styles.detailsHudTextStat}>WIS {character.wisdom}</Text>
                    <Text style={styles.detailsHudTextStat}>CHA {character.charisma}</Text>
                   <TouchableOpacity style={styles.equipButton} onPress={() => setCharacter(null)}><Text>Suicide</Text></TouchableOpacity>
                </View>
            )}
          </TouchableOpacity>

        <View style={styles.equipmentContainer}>
          <TouchableOpacity style={styles.statBlock} onPress={() => setEquipmentOpen(true)}>
          <Image source={{ uri: imageHost + "abdominal-armor.png"}} style={styles.slotIcon} />
        </TouchableOpacity>
            <TouchableOpacity style={styles.statBlock} onPress={() => setInventoryOpen(true)}>
                <Image source={{ uri: imageHost + "knapsack.png"}} style={styles.slotIcon} />
            </TouchableOpacity>
        </View>

        {/* Equipment Modal */}
              <Modal visible={isEquipmentOpen} transparent={true} animationType="slide">
                <View style={styles.modalContainer}>
                  {/* Close Button */}
                  <TouchableOpacity onPress={() => setEquipmentOpen(false)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionTitle}>Equipped Items</Text>
                  <Text style={styles.selectedItemDescription}>Armor Class: {calculateAC()}</Text>
                  {/* Equipment Items */}
                      <ScrollView style={{height: "60%"}}>
                        <View>
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("main_hand");}} >
                                    <Image source={{ uri: imageHost + (mainhandSlot?.image ?? "plain-dagger.png")}} style={[styles.slotIcon, !mainhandSlot && { opacity: 0.4}]} />
                                    <Text style={styles.statLabel}>Main Hand</Text>
                                    <Text style={styles.statValue}>{mainhandSlot?.name || "None"}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("offhand");}}>
                                    <Image source={{ uri: imageHost + (offhandSlot?.image ?? "shield.png")}} style={[styles.slotIcon, !offhandSlot && { opacity: 0.4}]} />
                                    <Text style={styles.statLabel}>Off Hand</Text>
                                    <Text style={styles.statValue}>{offhandSlot?.name || "None"}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("head");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: imageHost + (headSlot?.image ?? "visored-helm.png")}} style={[styles.slotIcon, !headSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Head</Text>
                                <Text style={styles.statValue}>{headSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("chest");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: imageHost + (chestSlot?.image ?? "abdominal-armor.png")}} style={[styles.slotIcon, !chestSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Chest</Text>
                                <Text style={styles.statValue}>{chestSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("hands");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: imageHost + (handsSlot?.image ?? "gauntlet.png")}} style={[styles.slotIcon, !handsSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Hands</Text>
                                <Text style={styles.statValue}>{handsSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("legs");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: imageHost + (legsSlot?.image ?? "armored-pants.png")}} style={[styles.slotIcon, !legsSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Leg</Text>
                                <Text style={styles.statValue}>{legsSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                        <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("feet");}} >
                            {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                            <Image source={{ uri: imageHost + (feetSlot?.image ?? "leg-armor.png")}} style={[styles.slotIcon, !feetSlot && { opacity: 0.4}]} />
                            <Text style={styles.statLabel}>Feet</Text>
                            <Text style={styles.statValue}>{feetSlot?.name || "None"}</Text>
                        </TouchableOpacity>
                        </View>
                      </ScrollView>

                      <Text style={styles.sectionTitle}>Available Items</Text>

                {selectedEquipment && (() => {
                  const currentSlots = {
                    "head": headSlot,
                    "chest": chestSlot,
                    "legs": legsSlot,
                    "hands": handsSlot,
                    "feet": feetSlot,
                    "offhand": offhandSlot,
                    "main_hand": mainhandSlot,
                    "either_hand": mainhandSlot || offhandSlot
                  };

                  const currentlyEquipped: Items | undefined = currentSlots[selectedEquipment.equipmentSlot];

                  // Helper to render stats and diff
                  const renderStat = (label: string, current: number | undefined, candidate: number | undefined) => {
                    if (candidate == null && current == null) return null;

                    const diff = candidate !== undefined && current !== undefined ? candidate - current : null;
                    return (
                      <Text style={{ color: "#ddd" }}>
                        {label}: {candidate ?? "-"}{" "}
                        {diff !== null && diff !== 0 && (
                          <Text style={{ color: diff > 0 ? "limegreen" : "tomato" }}>
                            {diff > 0 ? `(+${diff} ↑)` : `(${diff} ↓)`}
                          </Text>
                        )}
                      </Text>
                    );
                  };


                  return (
                    <View style={styles.selectedItemContainer}>
                      <Text style={styles.sectionTitle}>Equipment Comparison</Text>

                      <View style={styles.itemComparisonRow}>
                        {/* Current Item */}
                        <View style={styles.itemBlock}>
                          <Text style={styles.blockTitle}>Current</Text>
                          <Image
                            source={{ uri: imageHost + (currentlyEquipped?.image ?? "placeholder.png") }}
                            style={styles.itemImage}
                          />
                          <Text style={styles.itemName}>{currentlyEquipped?.name ?? "None"}</Text>
                          {currentlyEquipped && (
                            <>
                              <Text>Slot: {currentlyEquipped.equipmentSlot}</Text>
                              <Text>Bonus Damage: {currentlyEquipped.bonusDamage ?? 0}</Text>
                              <Text>Armor Class: {currentlyEquipped.armorClass ?? 0}</Text>
                              <Text>Durability: {currentlyEquipped.durability ?? 0}</Text>
                              <Text>Repairable: {currentlyEquipped.repairable ? "Yes" : "No"}</Text>
                            </>
                          )}
                        </View>

                        {/* Candidate Item */}
                        <View style={styles.itemBlock}>
                          <Text style={styles.blockTitle}>Candidate</Text>
                          <Image source={{ uri: imageHost + selectedEquipment.image }} style={styles.itemImage} />
                          <Text style={styles.itemName}>{selectedEquipment.name}</Text>
                          {selectedEquipment && (
                            <>
                              {renderStat("Bonus Damage", currentlyEquipped?.bonusDamage, selectedEquipment.bonusDamage)}
                              {renderStat("Armor Class", currentlyEquipped?.armorClass, selectedEquipment.armorClass)}
                              {renderStat("Durability", currentlyEquipped?.durability, selectedEquipment.durability)}
                              <Text>Repairable: {selectedEquipment.repairable ? "Yes" : "No"}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      <Text style={{ marginTop: 8, color: "grey", fontStyle: "italic" }}>
                        Differences are highlighted in green (better) or red (worse)
                      </Text>
                      <View style={[styles.row, {justifyContent: "space-between"}]} >
                        <TouchableOpacity style={styles.equipButton} onPress={() => {
                            setSelectedEquipment(null);
                          }}>
                          <Text style={styles.equipButtonText}>Close</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.equipButton} onPress={() => {
                            equipItem(selectedEquipment);
                            setSelectedEquipment(null);
                          }}>
                          <Text style={styles.equipButtonText}>Equip</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}

                      {/* Scrollable Grid */}
                      <FlatList
                        data={inventory
                          .map((inv) => items.find((it) => it.id === inv.itemId))
                          .filter((it) => {
                            if (!it) return false; // skip if not found
                            if (it.type !== "armor" && it.type !== "weapon") return false;
                            if (selectedSlot == null) return true;
                            return it.equipmentSlot === selectedSlot || (it.equipmentSlot === "either_hand" && (selectedSlot === "main_hand" || selectedSlot === "offhand"));
                          })}
                        keyExtractor={(item) => item.id.toString()}
                        horizontal
                        renderItem={({ item }) => {
                          return (
                            <TouchableOpacity
                              style={styles.statBlock}
                              onPress={() => {
                                 setSelectedEquipment(item);
                                 console.log("Selected equipment", item)
                              }}
                            >
                              <Image source={{ uri: imageHost + item.image}} style={styles.slotIcon} />
                              <Text style={styles.statLabel}>{item.name}</Text>
                            </TouchableOpacity>
                          );
                        }}
                     />
                </View>
              </Modal>

        {/* Inventory Modal */}
        <Modal visible={isInventoryOpen} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            {/* Close Button */}
            <TouchableOpacity onPress={() => setInventoryOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            {selectedItem && (() => {
                const itemData = items.find(i => i.id === selectedItem.itemId);
                if (!itemData) return null;
                return (
                    <View style={styles.selectedItemContainer}>
                        <Text style={styles.selectedItemTitle}>{selectedItem.name}</Text>
                        <Image source={{ uri: imageHost + itemData.image}} style={styles.selectedItemImage} />
                        <Text style={styles.selectedItemTitle}>{itemData.name}</Text>
                        <Text style={styles.selectedItemDescription}>{itemData.description}</Text>
                        <Text style={styles.selectedItemQuantity}>Quantity: {selectedItem.quantity}</Text>
                        {itemData.type === "consumable" && (
                            <TouchableOpacity style={styles.useButton} onPress={() => {
                                // Use consumable
                                if (itemData.effect === "heal") {
                                    const healAmount = itemData.effectAmount || 0;
                                    setCharacter(prev => {
                                        if (!prev) return prev;
                                        const newHealth = Math.min(prev.health + healAmount, prev.maxHealth);
                                        return { ...prev, health: newHealth };
                                    });
                                    // Decrease quantity or remove from inventory
                                    if (selectedItem.quantity > 1) {
                                        selectedItem.quantity -= 1;
                                        setInventory([...inventory]);
                                    } else {
                                        setInventory(inventory.filter(i => i.itemId !== selectedItem.itemId));
                                        setSelectedItem(null);
                                    }
                                }
                            }}>
                                <Text style={styles.useButtonText}>Use</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })()}
            {/* Inventory Items */}
                <ScrollView contentContainerStyle={styles.gridContainer}>
                  {inventory.map((item, index) => {
                    const itemData = items.find((i) => i.id === item.itemId);
                    if (!itemData) return null;
                    return (
                      <TouchableOpacity style={styles.statBlock} key={item.itemId} onPress={() => setSelectedItem(item)}>
                        <Image source={{ uri: imageHost + itemData.image}} style={styles.slotIcon} />
                        <Text style={styles.statLabel}>{item.name}</Text>
                        <Text style={styles.statValue}>{item.quantity}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
          </View>
        </Modal>

      <View style={styles.weaponsHudContainerudContainer}>

        {/* Equipment/Skill Slots */}
        <View style={styles.slotsContainer}>
          <FlatList

           data={
             characterAbilities
            }
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
            renderItem={({ item: ability }) => (
              <TouchableOpacity key={ability.id} style={styles.statBlock} onPress={abilityFunctions[ability.name]}>
                <Image source={{ uri: imageHost + ability.image}} style={styles.slotIcon} />
              </TouchableOpacity>
            )}

          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  statusHudContainer: {
      position: "absolute",
      top: 30,
      width: '30%',
      height: '10%',
      backgroundColor: "rgba(0, 0, 0, 0)",
      padding: 10,
    },
    selectedItemContainer: {
        backgroundColor: "#3a3835",
        borderWidth: 2,
        borderColor: "#6b4c35", // bronze/gold border
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
        },
    selectedItemTitle: {
        fontSize: 20,
        fontFamily: "Cinzel-Bold",
        color: "#e6d3b3",
        marginBottom: 8,
      },
    selectedItemImage: {
        width: 100,
        height: 100,
        marginBottom: 8,
      },
    selectedItemDescription: {
        fontSize: 16,
        color: "#d7c4a3",
        marginBottom: 8,
        textAlign: 'center',
      },
    selectedItemQuantity: {
        fontSize: 14,
        color: "#aaa",
        marginBottom: 8,
      },
    useButton: {
        backgroundColor: "#4CAF50",
        padding: 10,
        borderRadius: 8,
      },
    useButtonText: {
        color: "#fff",
        fontSize: 16,
        textAlign: "center",
      },
detailsHudContainer: {
  position: "absolute",
  top: 20,
  right: 20,
  width: "40%",
  backgroundColor: "rgba(20, 20, 20, 0.85)", // deep dark overlay
  borderRadius: 12,
  borderWidth: 2,
  borderColor: "rgba(180, 160, 100, 0.8)", // antique gold/bronze
  padding: 16,
  shadowColor: "#000",
  shadowOpacity: 0.7,
  shadowOffset: { width: 4, height: 4 },
  shadowRadius: 6,
},
detailsHudTextName: {
  fontSize: 20,
  fontWeight: "700",
  color: "#e0d6b4", // parchment gold
  marginBottom: 8,
},
detailsHudTextTitle: {
  fontSize: 14,
  fontWeight: "600",
  color: "#d4c48f",
},
detailsHudTextStat: {
  fontSize: 13,
  color: "#c9c9c9", // muted silver
  marginVertical: 1,
},
detailsHudDivider: {
  height: 1,
  backgroundColor: "rgba(255,255,255,0.1)",
  marginVertical: 6,
},
  weaponsHudContainerudContainer: {
      position: "absolute",
      bottom: 0,
      width: "100%",
      height: '24%',
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      padding: 9,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    statText: {
      color: "#fff",
      fontSize: 16,
    },
      barContainer: {
        marginBottom: 10,
      },
      barLabel: {
        color: "#fff",
        fontSize: 14,
        marginBottom: 5,
      },
      barBackground: {
        width: "80%",
        height: 10,
        backgroundColor: "#777",
        borderRadius: 10,
        overflow: "hidden",
      },
      barFill: {
        height: "100%",
        borderRadius: 10,
      },
    slotsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    equipmentContainer: {
      position: "absolute",
      right: 10,
      bottom: '26%',
      flexDirection: "column",
      justifyContent: "space-around",
      gap: 10,
    },
    slotIcon: {
      width: 50,
      height: 50,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      padding: 20,
      justifyContent: "center",
    },
    row: {
      flexDirection: "row",
      justifyContent: "center",
    },
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 10,
        padding: 10,
    },
     section: { marginBottom: 20 },
      label: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
      input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, fontSize: 16 },
      picker: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10 },
      abilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
      abilityLabel: { fontSize: 16, flex: 1 },
      characterCreationContainer: {
       flex: 1,
       backgroundColor: "#2b2a28", // parchment-dark gray
     },
     title: {
       fontSize: 28,
       fontFamily: "Cinzel-Bold", // medieval serif font
       color: "#f0e6d2",
       textAlign: "center",
       marginBottom: 20,
     },
     card: {
       backgroundColor: "#3a3835",
       borderWidth: 2,
       borderColor: "#6b4c35", // bronze/gold border
       borderRadius: 12,
       padding: 12,
       marginBottom: 16,
     },
     closeButton: {
         alignSelf: "flex-end",
         backgroundColor: "#6b4c35",
         padding: 10,
         borderRadius: 8,
         marginBottom: 10,
      },
     sectionTitle: {
       fontSize: 20,
       fontFamily: "Cinzel-Bold",
       color: "#e6d3b3",
       marginBottom: 8,
     },
     row: {
       flexDirection: "row",
       flexWrap: "wrap",
       justifyContent: "space-between",
     },
     statBlock: {
       alignItems: "center",
       margin: 6,
       padding: 8,
       borderWidth: 1,
       borderColor: "#7a5e3a",
       borderRadius: 8,
       backgroundColor: "#2e2c29",
       minWidth: 60,
     },
     statLabel: {
       fontSize: 16,
       fontFamily: "Cinzel-Regular",
       color: "#d7c4a3",
     },
     statValue: {
       fontSize: 18,
       fontFamily: "Cinzel-Bold",
       color: "#fff",
     },
     skillTag: {
       paddingVertical: 6,
       paddingHorizontal: 12,
       margin: 4,
       backgroundColor: "#554531",
       borderRadius: 16,
       borderWidth: 1,
       borderColor: "#8a6e48",
     },
     skillText: {
       fontFamily: "Cinzel-Regular",
       fontSize: 16,
       color: "#f2e0c2",
     },
     dropdown: {
       flex: 1,
       marginHorizontal: 6,
     },
     dropdownLabel: {
       fontSize: 16,
       fontFamily: "Cinzel-Bold",
       color: "#d7c4a3",
     },
     dropdownValue: {
       fontSize: 16,
       fontFamily: "Cinzel-Regular",
       color: "#fff",
     },
     dropdownItem: {
       padding: 6,
       borderBottomWidth: 1,
       borderBottomColor: "#6b4c35",
     },
     dropdownText: {
       fontFamily: "Cinzel-Regular",
       fontSize: 16,
       color: "#f2e0c2",
     },
  itemComparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemBlock: {
    flex: 1,
    backgroundColor: "rgba(40, 40, 40, 0.9)",
    margin: 4,
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  blockTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "gold",
    marginBottom: 4,
  },
  itemImage: {
    width: 64,
    height: 64,
    marginBottom: 4,
  },
  itemName: {
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  equipButton: {
  backgroundColor: "#6b4c35",
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 6,
  marginTop: 10,
},
equipButtonText: {
  color: "#fff",
  fontWeight: "bold",
  textAlign: "center",
},


});
