import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, TextInput, FlatList, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from "react-native-maps";
import * as Location from "expo-location";
import Api from "Api.tsx"
import * as SecureStore from 'expo-secure-store';
import Knapsack from "./assets/icons/svg/knapsack.svg";
import AbdominalArmor from "./assets/icons/svg/abdominal-armor.svg";
import SwordInStone from "./assets/icons/svg/battle-gear.svg";

import { AbilitiesApi, Abilities, AncestriesApi, Ancestries, CharactersApi, Characters, CharacterSkillsApi, CharacterSkills, Configuration, ClassesApi, Classes, BackgroundsApi, Backgrounds, InventoryApi, Inventory, ItemsApi, Items, SkillsApi, Skills} from './api/index';

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
  const [isClassCollapsed, setClassCollapsed] = useState(true);
  let subscription: Location.LocationSubscription | null = null;
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [isEquipmentOpen, setEquipmentOpen] = useState(false);
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [character, setCharacter] = useState<Characters | null>(null);
  const [name, setName] = useState(null);
  const [ancestry, setAncestry] = useState<Ancestries | null>(null);
  const [background, setBackground] = useState<Backgrounds | null>(null);
  const [characterClass, setCharacterClass] = useState<Classes | null>(null);
  const [abilities, setAbilities] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [feats, setFeats] = useState([]);
  const [detailsHudExpanded, setDetailsHudExpanded] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<Items | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<
    { id: string; lat: number; lng: number; text: string; color: string, expiresAt: number }[]
  >([]);


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
          const zoomFactor = Math.max(0.0003, 0.003 - perception * 0.0003);

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
        const existingItem = inventory.find(i => i.itemId === itemOnMap?.itemId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + 1;

            // update state
            setInventory(inventory.map(i =>
                i.itemId === existingItem.itemId
                    ? { ...i, quantity: newQuantity }
                    : i
            ));

            inventoryApi.inventoryPatch({
               characterId: `eq.${existingItem.characterId}`,
               itemId: `eq.${existingItem.itemId}`,
               inventory: { ...existingItem, quantity: newQuantity },
             }).catch(async (err: any) => {
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
         else {
            const newItem: Inventory = {
                characterId: character?.id ?? 0, // Use character ID if available
                itemId: itemOnMap.itemId,
                quantity: 1,
            };
            setInventory([...inventory, newItem]);
            inventoryApi.inventoryPost({
                inventory: newItem,
            }).catch(err => console.error("Failed to add item to inventory:", err));
        }
        setItemsOnMap(prev => prev.filter(i => i.id !== itemOnMapId));
    }

    function calculateSkills() {
      const bonusSkillIds = [
        ancestry?.bonusSkill,
        background?.bonusSkill,
        characterClass?.bonusSkill,
      ].filter((id): id is number => !!id); // remove null/undefined

      return skills.filter(skill => bonusSkillIds.includes(skill.id));
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
      STR: (ancestry?.bonusStrength ?? 0) + (backgrounds?.bonusStrength ?? 0) + (characterClass?.bonusStrength ?? 0),
      DEX: (ancestry?.bonusDexterity ?? 0) + (backgrounds?.bonusDexterity ?? 0) + (characterClass?.bonusDexterity ?? 0),
      CON: (ancestry?.bonusConstitution ?? 0) + (backgrounds?.bonusConstitution ?? 0) + (characterClass?.bonusConstitution ?? 0),
      INT: (ancestry?.bonusIntelligence ?? 0) + (backgrounds?.bonusIntelligence ?? 0) + (characterClass?.bonusIntelligence ?? 0),
      WIS: (ancestry?.bonusWisdom ?? 0) + (backgrounds?.bonusWisdom ?? 0) + (characterClass?.bonusWisdom ?? 0),
      CHA: (ancestry?.bonusCharisma ?? 0) + (backgrounds?.bonusCharisma ?? 0) + (characterClass?.bonusCharisma ?? 0),
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
        return 10 + (ancestry?.bonusDexterity ?? 0) + (background?.bonusDexterity ?? 0) + (characterClass?.bonusDexterity ?? 0);
    }

    function calculateHP() {
        return 10 + (ancestry?.bonusConstitution ?? 0) + (background?.bonusConstitution ?? 0) + (characterClass?.bonusConstitution ?? 0);
    }

    function calculateMana() {
        return 10 + (ancestry?.bonusIntelligence ?? 0) + (background?.bonusIntelligence ?? 0) + (characterClass?.bonusIntelligence ?? 0);
    }

    function fibbonaci(n: number): number {
        if (n <= 1) return n;
        let a = 0, b = 1, temp;
        for (let i = 2; i <= n; i++) {
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
        const enemyHealth = 10 + (enemyAncestry?.bonusConstitution ?? 0);

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
          level: 1,
          ancestry: enemyAncestry?.id,
          ac: Math.floor(Math.random() * 2) + 3, // 3–5
          speed: 30 + enemyAncestry?.bonusSpeed,
          strength: 10 + enemyAncestry?.bonusStrength,
          dexterity: 10 + enemyAncestry?.bonusDexterity,
          constitution: 10 + enemyAncestry?.bonusConstitution,
          intelligence: 20 + enemyAncestry?.bonusIntelligence,
          wisdom: 20 + enemyAncestry?.bonusWisdom,
          charisma: 10 + enemyAncestry?.bonusCharisma,
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

      for (let i = 0; i < (ability?.hits ?? 1); i++) {
        const hitRoll = Math.floor(Math.random() * 20) + 1 + strengthModifier;
        if (hitRoll >= (defender.ac ?? 10)) {
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
            const newExp = (character.experience ?? 0) + expGain;
            // Fibbonacci-like level up requirement
            const nextLevelExp = fibbonaci((character.level ?? 1) + 1);
            if (newExp >= nextLevelExp) {
                const newLevel = (character.level ?? 1) + 1;
                const newMaxHealth = calculateHP() + 1;
                const newMaxMana = calculateMana() + 1;
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
        "Dig": () => {
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
                text: "Dig!",
                color: "purple",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
        },
        "Craft Item": () => {
            console.log("Crafting item...");
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
        "Gather Herbs": () => {
            console.log("Gathering herbs...");
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
        "Kick": () => null, // Placeholder
        "Throw Rock": () => null, // Placeholder
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
                const loadedCharacterSkills = await characterSkillsApi.characterSkillsGet({
                    characterId: `eq.${loadedCharacter.id}`, // PostgREST syntax
                    limit: "100", // Adjust as needed
                });
                setCharacterSkills(loadedCharacterSkills || []);
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
    }, 2 * 60 * 1000);

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
      }, 2 * 60 * 1000);

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
                  <Text style={styles.sectionTitle}>Character Options</Text>
                  <View style={styles.row}>
                    {[
                      { label: "Ancestry", value: ancestry, toggle: () => setAncestryCollapsed(!isAncestryCollapsed), list: ancestries, setter: setAncestry },
                      { label: "Background", value: background, toggle: () => setBackgroundCollapsed(!isBackgroundCollapsed), list: backgrounds, setter: setBackground },
                      { label: "Class", value: characterClass, toggle: () => setClassCollapsed(!isClassCollapsed), list: characterClasses, setter: setCharacterClass },
                    ].map(({ label, value, toggle, list, setter }) => (
                      <View key={label} style={styles.dropdown}>
                        <TouchableOpacity onPress={toggle}>
                          <Text style={styles.dropdownLabel}>{label}</Text>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                              <Image source={{ uri: imageHost + value?.image }} style={{ width: 20, height: 20}} />
                              <Text style={styles.dropdownValue}>{value?.name || "—"}</Text>
                          </View>
                        </TouchableOpacity>

                        {(
                          (!isAncestryCollapsed && label === "Ancestry") ||
                          (!isBackgroundCollapsed && label === "Background") ||
                          (!isClassCollapsed && label === "Class")
                        ) && (
                          <View>
                            {list.map((item) => (
                              <TouchableOpacity
                                key={item.id}
                                onPress={() => {setter(item); toggle()}}
                                style={styles.dropdownItem}
                              >
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <Image source={{ uri: imageHost + item.image }} style={{width: 20, height: 20}} />
                                    <Text style={styles.dropdownText}>{item.name}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                  {/* Attributes */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Attributes</Text>
                  <View style={styles.row}>
                    {Object.entries(calculateAttributes()).map(
                      ([attr, value]) => (
                        <View key={attr} style={styles.statBlock}>
                          <Text style={styles.statLabel}>{attr}</Text>
                          <Text style={styles.statValue}>
                            {value > 0 ? `+${value}` : value}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>

                  {/* Secondary Stats */}
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Defenses</Text>
                    <View style={styles.row}>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>Size</Text><Text style={styles.statValue}>{ancestry?.baseSize ?? "N/A"}</Text></View>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>Speed</Text><Text style={styles.statValue}>{calculateSpeed()}m</Text></View>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>AC</Text><Text style={styles.statValue}>{calculateAC()}</Text></View>
                      <View style={styles.statBlock}><Text style={styles.statLabel}>HP</Text><Text style={styles.statValue}>{calculateHP()}</Text></View>
                        <View style={styles.statBlock}><Text style={styles.statLabel}>Mana</Text><Text style={styles.statValue}>{calculateMana()}</Text></View>
                    </View>
                  </View>

                    {/* Skills */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Skills</Text>
                      <View style={{ flexDirection: "row" }}>
                        {calculateSkills().map((skill) => (
                          <TouchableOpacity key={skill.id} style={styles.skillTag}>
                            <Text style={styles.skillText}>{skill.name}</Text>
                          </TouchableOpacity>
                        ))}
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
                          equipment: equipment,
                        };

                        // Post character to API
                        await charactersApi.charactersPost({
                          characters: newCharacter,
                        });

                        setCharacter(newCharacter);
                        saveCharacterId(id);

                        // Create initial skills
                        const characterSkills = calculateSkills().map(skill => ({
                          characterId: id,
                          skillId: skill.id,
                          level: 1,
                          experience: 0,
                        }));
                        console.log("Character Skills:", characterSkills);

                        await characterSkills.forEach(skill => {
                            characterSkillsApi.characterSkillsPost({
                              characterSkills: skill,
                            });
                        });

                        setCharacterSkills(characterSkills);
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
            <SwordInStone width={100} height={100} />
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
  const xpPercentage = (character.experience / fibbonaci(character.level +1)) * 100;
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
                    <Text>XP: {character.experience}/{fibbonaci(character.level +1)}</Text>
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
                    <Text style={styles.detailsHudTextStat}>AC {character.ac ?? 10}</Text>
                    <Text style={styles.detailsHudTextStat}>STR {character.strength}</Text>
                    <Text style={styles.detailsHudTextStat}>DEX {character.dexterity}</Text>
                    <Text style={styles.detailsHudTextStat}>CON {character.constitution}</Text>
                    <Text style={styles.detailsHudTextStat}>INT {character.intelligence}</Text>
                    <Text style={styles.detailsHudTextStat}>WIS {character.wisdom}</Text>
                    <Text style={styles.detailsHudTextStat}>CHA {character.charisma}</Text>
                </View>
            )}
          </TouchableOpacity>

        <View style={styles.equipmentContainer}>
          <TouchableOpacity style={styles.statBlock} onPress={() => setEquipmentOpen(true)}>
          <AbdominalArmor style={styles.slotIcon} />
        </TouchableOpacity>
            <TouchableOpacity style={styles.statBlock} onPress={() => setInventoryOpen(true)}>
                <Knapsack style={styles.slotIcon} />
            </TouchableOpacity>
        </View>

        {/* Equipment Modal */}
              <Modal visible={isEquipmentOpen} transparent={true} animationType="slide">
                <View style={styles.modalContainer}>
                  {/* Close Button */}
                  <TouchableOpacity onPress={() => setEquipmentOpen(false)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                  {/* Equipment Items */}
                      <View style={styles.humanContainer}>
                        <View style={styles.row}>
                        </View>
                        <View style={styles.row}>

                        </View>
                        <View style={styles.row}>

                        </View>
                        <View style={styles.row}>

                        </View>
                      </View>

                      {/* Scrollable Grid */}
                      <ScrollView contentContainerStyle={styles.gridContainer}>
                        {inventory.filter(i => {
                          const itemData = items.find(it => it.id === i.itemId);
                          return itemData && (itemData.type === "weapon" || itemData.type === "armor");
                        }).map((item, index) => {
                          const itemData = items.find((i) => i.id === item.itemId);
                          if (!itemData) return null;
                          return (
                            <TouchableOpacity style={styles.statBlock} key={item.itemId} onPress={() => {item.equipped = !item.equipped
                                                                                                         setInventory([...inventory]);}}>
                              <Image source={{ uri: imageHost + itemData.image}} style={styles.slotIcon} />
                              <Text style={styles.statLabel}>{item.name}</Text>
                              <Text style={styles.statValue}>{item.quantity}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                </View>
              </Modal>

        {/* Equipment Modal */}
        <Modal visible={isInventoryOpen} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            {/* Close Button */}
            <TouchableOpacity onPress={() => setInventoryOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            {/* Scrollable Grid */}
            <ScrollView contentContainerStyle={styles.gridContainer}>
              {inventory.map((item, index) => {
                const itemData = items.find((i) => i.id === item.itemId);
                if (!itemData) return null;
                return (
                  <TouchableOpacity style={styles.statBlock} key={item.itemId} onPress={() => {item.equipped = !item.equipped
                                                                                               setInventory([...inventory]);}}>
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
          {
            abilitiesList
                .filter((a) => {
                    if (!a.requiredSkill) return true; // no requirement → always available

                    const cs = characterSkills.find((cs) => cs.skillId === a.requiredSkill);
                    if (!cs) return false; // skill not found → can't unlock

                    return cs.level >= (a.requiredLevel ?? 1); // default level requirement 1
                  })
                  .filter((a) => {
                    if (!a.requiredItem) return true; // no requirement → always available
                    const ci = inventory.find((i) => i.itemId === a.requiredItem);
                    if (!ci) return false; // item not found → can't unlock

                    return ci.quantity >= (a.requiredQuantity ?? 0); // default quantity requirement 0
                  })
                .map((ability) => {
                  return (
                    <TouchableOpacity key={ability.id} style={styles.statBlock} onPress={abilityFunctions[ability.name]}>
                      <Image source={{ uri: imageHost + ability.image}} style={styles.slotIcon} />
                    </TouchableOpacity>
                  );
                })
          }
        </View>
        {/* Equipment/Skill Slots */}
        <View style={[{ marginTop: 10 }, styles.slotsContainer]}>
          {inventory.map((item) => {
            if (!item.equipped) return null;
            const itemData = items.find((i) => i.id === item.itemId);
            if (!itemData) return null;
            // if item.type is "weapon", "armor" skip
            if (itemData.type === "weapon" || itemData.type === "armor") return null;

            return (
              <TouchableOpacity key={item.itemId} style={styles.statBlock} >
                <Image source={{ uri: imageHost + itemData.image}} style={styles.slotIcon} />
              </TouchableOpacity>
            );
          })}
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

});
