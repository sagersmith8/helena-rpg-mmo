import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, FlatList, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from "react-native-maps";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { api, config } from "./apiClient";
import type { Abilities, AbilitiesRequiredLevels, AbilitiesRequiredItems, Ancestries, Characters, CharacterSkills, Classes, Backgrounds, Inventory, Items, Skills } from "./api/index";
import { type Enemy, type FloatingText } from "./types";
import { generateCirclePoints, getDistanceMeters } from "./utils/mapUtils";
import { calculateXpToNextLevel, calculateSpeed as calcSpeed, calculateAttributes as calcAttrs, calculateHP as calcHP, calculateMana as calcMana } from "./utils/characterUtils";
import { useReferenceData } from "./hooks/useReferenceData";
import { CharacterCreationScreen, type CharacterCreationData } from "./screens/CharacterCreationScreen";
import { styles } from "./styles";

export default function App() {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  let subscription: Location.LocationSubscription | null = null;
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [isEquipmentOpen, setEquipmentOpen] = useState(false);
  const [isSkillTreeOpen, setSkillTreeOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<CharacterSkills | null>(null);
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [character, setCharacter] = useState<Characters | null>(null);
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
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [characterAbilities, setCharacterAbilities] = useState<Abilities[] | null>(null);

  const {
    characterClasses,
    backgrounds,
    ancestries,
    skills,
    items,
    abilitiesList,
    abilitiesRequiredLevels,
    abilitiesRequiredItems,
  } = useReferenceData();

  const [characterSkills, setCharacterSkills] = useState<CharacterSkills[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);

  const ancestry = character ? ancestries.find((a) => a.id === character.ancestry) ?? null : null;
  const background = character ? backgrounds.find((b) => b.id === character.background) ?? null : null;
  const characterClass = character ? characterClasses.find((c) => c.id === character.classId) ?? null : null;

  const [targetedEnemy, setTargetedEnemy] = useState<number | null>(null);

  const [itemsOnMap, setItemsOnMap] = useState<{ id: number; lat: number; lng: number, itemId: number }[]>([]);
  const [characterRange, setCharacterRange] = useState<number | null>(null);
  const locationRef = useRef<Location.LocationObject | null>(null);

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

    function consumeItemInInventory(inventoryItem: Inventory) {
      const itemData = items.find((it) => inventoryItem.itemId === it.id);
      if (!itemData) {
        console.warn("Item not found for inventoryItem", inventoryItem);
        return;
      }

      // heal or damage
      let healAmount = (itemData.goldValue ?? 0) / 10;
      if (itemData.image === "poison-bottle.png") {
        healAmount *= -1;
      }

      // ✅ update character health locally
      setCharacter((prev) => {
        if (!prev) return prev;
        const newHealth = Math.min(
          (prev.health ?? 0) + healAmount,
          prev.maxHealth ?? 10
        );
        return { ...prev, health: newHealth };
      });

      // ✅ decrease quantity or remove from inventory
      let newInventory: Inventory[];
      if (inventoryItem.quantity > 1) {
        const updatedItem = { ...inventoryItem, quantity: inventoryItem.quantity - 1 };
        newInventory = inventory.map((i) =>
          i.itemId === inventoryItem.itemId ? updatedItem : i
        );
        setInventory(newInventory);

        // PATCH the updated inventory item
        api.inventory
          .inventoryPatch({
            characterId: `eq.${updatedItem.characterId}`,
            itemId: `eq.${updatedItem.itemId}`,
            inventory: updatedItem,
          })
          .catch(handleApiError);
      } else {
        newInventory = inventory.filter((i) => i.itemId !== inventoryItem.itemId);
        setInventory(newInventory);
        setSelectedItem(null);

        // DELETE the item since quantity is 0
        api.inventory
          .inventoryDelete({
            characterId: `eq.${inventoryItem.characterId}`,
            itemId: `eq.${inventoryItem.itemId}`,
          })
          .catch(handleApiError);
      }

      // ✅ PATCH character health to backend
      if (character) {
        api.characters
          .charactersPatch({
            id: `eq.${character.id}`,
            characters: {
              ... character,
              health: Math.min(
                (character.health ?? 0) + healAmount,
                character.maxHealth ?? 10
              ),
            },
          })
          .catch(handleApiError);
      }

      // ✅ recalc abilities with updated inventory
      calculateAbilities(characterSkills, newInventory);
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

        api.inventory.inventoryPatch({
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

        api.inventory.inventoryPost({
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


    function calculateAbilities(newCharacterSkills: CharacterSkills[] = characterSkills, newInventory: Inventory[] = inventory, newAbilitiesList: Abilities[] = abilitiesList, newRequiredLevels: AbilitiesRequiredLevels[] = abilitiesRequiredLevels, newRequiredItems: AbilitiesRequiredItems[] = abilitiesRequiredItems, newItems: Items[] = items) {
      const inventoryByTree = newInventory.reduce<Record<string, number>>((acc, inv) => {
        if (inv.equippedSlot != null) return acc;

        const foundItem = newItems.find((it) => it.id === inv.itemId);
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
        calculateCharacterRange(newInventory);

        // 3. Persist selected item to backend
        const inventoryItem = newInventory.find((i) => i.itemId === item.id);
        if (!inventoryItem) return;

        api.inventory
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


    // Save character ID (pass null to clear)
    async function saveCharacterId(id: number | null) {
      try {
        if (id == null) {
          await SecureStore.deleteItemAsync("characterId");
        } else {
          await SecureStore.setItemAsync("characterId", id.toString());
        }
      } catch (e) {
        console.error("Failed to save character ID", e);
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

  function calculateCharacterRange(newInventory: Inventory[] = inventory, newCharacter: Characters = character) {
      let weight = 0;
      newInventory.forEach((inv) => {
        if (inv.equippedSlot != null) {
          const item = items.find((it) => it.id === inv.itemId);
          weight += item?.weight ?? 0;
        }
      });
      const calculatedRange = (newCharacter?.speed ?? 0) - ((
          weight
        ) / ((character?.strength ?? 1) * 5));
      setCharacterRange(Math.max(calculatedRange, 0));
  }

  function getEquippedItemsForMelee() {
    const equipped: Items[] = [];

    if (mainhandSlot) {
      const mainReq = abilitiesRequiredItems.find((ari) => ari.itemTree === mainhandSlot.tree);
      if (mainReq) equipped.push(mainhandSlot);
    }

    if (offhandSlot) {
      const offReq = abilitiesRequiredItems.find((ari) => ari.itemTree === offhandSlot.tree);
      if (offReq) equipped.push(offhandSlot);
    }

    return equipped;
  }

  function useMeleeAbility(abilityName: string) {
    const ability = abilitiesList.find((ab) => ab.name === abilityName);
    if (!ability) {
      console.warn(`${abilityName} ability not found`);
      return;
    }

    // Check if this ability requires melee skill
    const reqLevel = abilitiesRequiredLevels.find((arl) => arl.abilityId === ability.id);
    const meleeSkill = skills.find((s) => s.name === "Melee");
    const hasMelee = meleeSkill && reqLevel && reqLevel.skillId === meleeSkill.id;

    if (!hasMelee) {
      console.warn(`${abilityName} does not require Melee or requirements not met`);
      return;
    }

    // Target enemy
    const enemy = enemies.find((e) => e.id === targetedEnemy) ?? null;

    // Equipped items
    const equippedItems = getEquippedItemsForMelee();

    meleeAttack(character, ability, enemy, true, equippedItems);
  }



  function calculateAC() {
    return (headSlot?.armorClass ?? 0) + 
          (chestSlot?.armorClass ?? 0) +
          (handsSlot?.armorClass ?? 0) +
          (legsSlot?.armorClass ?? 0) +
          (feetSlot?.armorClass ?? 0)
        ;
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

    function meleeAttack(attacker: Characters, ability: Abilities, defender: Characters, isCharacterAttack: boolean, items: Items[] = []) {
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
      const range = (characterRange?? 0) + (ability?.range ?? 0);
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
      var totalHits = 0;
      for (let i = 0; i < (ability?.hits ?? 1); i++) {
        const hitRoll = Math.floor(Math.random() * 20) + 1 + strengthModifier;
        if (hitRoll >= defenderAc) {
          totalHits++;
          const maxDamage = ability?.damage ?? 6;
          const baseDamage = Math.floor(Math.random() * maxDamage) + 1;

          // --- apply item bonus damage ---
          let bonusDamage = 0;
          if (items && items.length > 0) {
            for (const item of items) {
              bonusDamage += item?.bonusDamage ?? 0;
            }
          }

          const damageRoll = baseDamage + bonusDamage;

          console.log(
            `Hit! Rolled ${baseDamage} base + ${bonusDamage} bonus = ${damageRoll} damage`
          );

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

      if (isCharacterAttack && totalHits > 0) {
        const meleeSkill = skills.find((s) => s.name === "Melee");
        const characterMeleeSkill = characterSkills.find((cs) => cs.skillId === meleeSkill?.id);
        if (!meleeSkill || !characterMeleeSkill) return;

        const newExp = (characterMeleeSkill.experience ?? 0) + 1;
        const nextLevelExp = calculateXpToNextLevel(characterMeleeSkill.level ?? 1);

        let newCharacterMeleeSkill: CharacterSkills;

        if (newExp >= nextLevelExp) {
          const newLevel = (characterMeleeSkill.level ?? 1) + 1;
          newCharacterMeleeSkill = {
            ...characterMeleeSkill,
            level: newLevel,
            experience: newExp - nextLevelExp,
          };
        } else {
          newCharacterMeleeSkill = {
            ...characterMeleeSkill,
            experience: newExp,
          };
        }

        // Build the new skills array
        const newCharacterSkills = characterSkills.map((cs) =>
          cs.skillId === meleeSkill.id ? newCharacterMeleeSkill : cs
        );

        // Update state
        setCharacterSkills(newCharacterSkills);

        // Recalculate abilities based on new skills
        calculateAbilities(newCharacterSkills);

        // Persist change
        api.characterSkills.characterSkillsPatch({
          characterId: `eq.${character?.id}`,
          skillId: `eq.${meleeSkill.id}`,
          characterSkills: newCharacterMeleeSkill,
        }).catch(async (err: any) => {
          console.error("Failed to update skills:", err);

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
            const nextLevelExp = calculateXpToNextLevel((character?.level ?? 1));
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
                const newSpeed = (character?.speed ?? 0) + 1;
                setCharacterRange((characterRange ?? 0) + 1);
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
                      experience: newExp - nextLevelExp,
                      maxHealth: newMaxHealth,
                      health: newMaxHealth,
                      maxMana: newMaxMana,
                      mana: newMaxMana,
                      strength: newStrength,
                      dexterity: newDexterity,
                      intelligence: newIntelligence,
                      charisma: newCharisma,
                      wisdom: newWisdom,
                      constitution: newConstitution,
                      speed: newSpeed,
                    }
                  : character;

                setCharacter(updatedChar);

                api.characters.charactersPatch({
                  id: `eq.${character.id}`,
                  characters: {
                    level: newLevel,
                    experience: newExp - nextLevelExp,
                    maxHealth: newMaxHealth,
                    health: newMaxHealth,
                    maxMana: newMaxMana,
                    mana: newMaxMana,
                    strength: newStrength,
                    dexterity: newDexterity,
                    intelligence: newIntelligence,
                    charisma: newCharisma,
                    wisdom: newWisdom,
                    constitution: newConstitution,
                    speed: newSpeed
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

                api.characters.charactersPatch({
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
            api.characters.charactersPatch({
                id: `eq.${character.id}`,
                characters: {
                  health: (character?.health ?? 0) - damage
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
            const speed = characterRange
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
        "Throw Item": () => {
            console.log("Throwing Item...");
             setFloatingTexts(prev => [
              ...prev,
              {
                id: `${Date.now()}`,
              lat: location.coords.latitude + (Math.random() - 0.5) * 0.0003,
              lng: location.coords.longitude + (Math.random() - 0.5) * 0.0003,
                text: "Throw!",
                color: "purple",
                expiresAt: Date.now() + 1000, // 1 second
              },
            ]);
            const rock = items.find((it) => it.name === "Rock");
            const rockInInventory = inventory.find((inv) => inv.itemId === rock?.id);
            if (rockInInventory) {
              const throwAbility = abilitiesList.find(a => a.name === "Throw Item");
              meleeAttack(character, throwAbility, targetedEnemy, true);
                if (Math.random() < 0.7) {
                  spawnItemOnMap(
                    rock.id,
                    location.coords.latitude + (Math.random() - 0.5) * 0.0005,
                    location.coords.longitude + (Math.random() - 0.5) * 0.0005
                  );
                }
              
               let newInventory: Inventory[];
                if (rockInInventory.quantity > 1) {
                  const updatedItem = { ...rockInInventory, quantity: rockInInventory.quantity - 1 };
                  newInventory = inventory.map((i) =>
                    i.itemId === rockInInventory.itemId ? updatedItem : i
                  );
                  setInventory(newInventory);

                  // PATCH the updated inventory item
                  api.inventory
                    .inventoryPatch({
                      characterId: `eq.${updatedItem.characterId}`,
                      itemId: `eq.${updatedItem.itemId}`,
                      inventory: updatedItem,
                    })
                    .catch(handleApiError);
                } else {
                  newInventory = inventory.filter((i) => i.itemId !== rockInInventory.itemId);
                  setInventory(newInventory);
                  setSelectedItem(null);

                  // DELETE the item since quantity is 0
                  api.inventory
                    .inventoryDelete({
                      characterId: `eq.${rockInInventory.characterId}`,
                      itemId: `eq.${rockInInventory.itemId}`,
                    })
                    .catch(handleApiError);
                }
                calculateAbilities(characterSkills, newInventory);
            }
        }, // Placeholder
    };

  useEffect(() => {
      (async () => {
        const fetchCharacter = async () => {
          try {
            const id = await loadCharacterId();
            if (!id) {
              console.warn("No character ID found, creating new character");
              return;
            }
            const c = await api.characters.charactersGet({
              id: `eq.${id}`,
              limit: "1",
            });
            const loadedCharacter = c[0] || null;
            setCharacter(loadedCharacter);
            if (loadedCharacter) {
              const loadedInventory = await api.inventory.inventoryGet({
                characterId: `eq.${loadedCharacter.id}`,
                limit: "100",
              });
              setInventory(loadedInventory || []);
              const loadedItems = items.length !== 0 ? items : (await api.items.itemsGet({}) ?? []);
              loadedInventory?.forEach((inv) => {
                if (inv.equippedSlot) {
                  const it = loadedItems?.find((i) => i.id == inv.itemId);
                  if (it == null) return;
                  if (inv.equippedSlot === "head") setHeadSlot(it);
                  else if (inv.equippedSlot === "chest") setChestSlot(it);
                  else if (inv.equippedSlot === "hands") setHandsSlot(it);
                  else if (inv.equippedSlot === "legs") setLegsSlot(it);
                  else if (inv.equippedSlot === "feet") setFeetSlot(it);
                  else if (inv.equippedSlot === "main_hand") setMainhandSlot(it);
                  else if (inv.equippedSlot === "offhand") setOffhandSlot(it);
                }
              });
              calculateCharacterRange(loadedInventory ?? [], loadedCharacter);
              const loadedCharacterSkills = await api.characterSkills.characterSkillsGet({
                characterId: `eq.${loadedCharacter.id}`,
                limit: "100",
              });
              setCharacterSkills(loadedCharacterSkills || []);
              const loadedAbilities = abilitiesList.length > 0 ? abilitiesList : (await api.abilities.abilitiesGet({}) ?? []);
              const loadedReqItems = abilitiesRequiredItems.length > 0 ? abilitiesRequiredItems : (await api.abilitiesRequiredItems.abilitiesRequiredItemsGet({}) ?? []);
              const loadedReqLevels = abilitiesRequiredLevels.length > 0 ? abilitiesRequiredLevels : (await api.abilitiesRequiredLevels.abilitiesRequiredLevelsGet({}) ?? []);
              calculateAbilities(
                loadedCharacterSkills || [],
                loadedInventory || [],
                loadedAbilities,
                loadedReqLevels,
                loadedReqItems,
                loadedItems || []
              );
            }
          } catch (err) {
            console.error("Failed to fetch characters:", err);
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

    const canSeeCharacter = (enemy: Enemy, char: Characters) => {
      if (!char?.latitude || !char?.longitude) return false;
      const dist = getDistanceMeters(
        { lat: enemy.latitude, lon: enemy.longitude },
        { lat: char.latitude, lon: char.longitude }
      );
      return dist <= (enemy.wisdom + enemy.intelligence);
    };

    function moveToward(enemy: Enemy, target: Characters, stepSizeMeters: number): Enemy {
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
      if (location) {
        locationRef.current = location;
      }
    }, [location]);

    useEffect(() => {
      if (items.length === 0) return;

      // Initial bootstrap: spawn one enemy near you
      if (locationRef.current) {
        spawnEnemy(
          locationRef.current.coords.latitude + (Math.random() - 0.5) * 0.0005,
          locationRef.current.coords.longitude + (Math.random() - 0.5) * 0.0005
        );
      }

      // Enemy spawn timer
      const enemySpawnTimer = setInterval(() => {
        const loc = locationRef.current;
        if (!loc) return;
        spawnEnemy(
          loc.coords.latitude + (Math.random() - 0.5) * 0.001,
          loc.coords.longitude + (Math.random() - 0.5) * 0.001
        );
      }, 20_000);

      // Item spawn timer
      const itemTimer = setInterval(() => {
        const loc = locationRef.current;
        if (!loc) return;
        const item = items[Math.floor(Math.random() * items.length)];
        spawnItemOnMap(
          item.id,
          loc.coords.latitude + (Math.random() - 0.5) * 0.001,
          loc.coords.longitude + (Math.random() - 0.5) * 0.001
        );
      }, 20_000);

      // Enemy movement/AI loop
      const smoothStepInterval = 50;
      const microSteps = 100;
      const enemyAnimTimer = setInterval(() => {
        setEnemies(prev => prev.map(e => {
          const loc = locationRef.current;
          if (!loc) return e;

          // Perception/attack/movement logic…
          if (canSeeCharacter(e, character!)) {
            const distance = getDistanceMeters(
              { lat: e.latitude, lon: e.longitude },
              { lat: character!.latitude, lon: character!.longitude }
            );
            const now = Date.now();
            if (distance <= e.speed) {
              if (!e.lastAttackTime || now - e.lastAttackTime >= 2000) {
                const attack = abilitiesList.find(ab => ab.name === "Punch");
                meleeAttack(e, attack, character, false);
                return { ...e, lastAttackTime: now };
              }
              return e;
            }
            return moveToward(e, character!, 1);
          }

          // Path interpolation fallback
          if (!e.path || e.path.length < 2) return e;
          const current = e.path[e.step];
          const nextStep = (e.step + 1) % e.path.length;
          const next = e.path[nextStep];

          const interpolationFactor = (e.microStep ?? 0) / microSteps;
          const microLat = current.lat + (next.lat - current.lat) * interpolationFactor;
          const microLng = current.lng + (next.lng - current.lng) * interpolationFactor;

          const newMicroStep = (e.microStep ?? 0) + 1;
          const newStep = newMicroStep >= microSteps ? nextStep : e.step;

          return {
            ...e,
            latitude: microLat,
            longitude: microLng,
            step: newStep,
            microStep: newMicroStep % microSteps,
          };
        }));
      }, smoothStepInterval);

      return () => {
        clearInterval(enemySpawnTimer);
        clearInterval(itemTimer);
        clearInterval(enemyAnimTimer);
      };
    }, [items]);

    async function handleCreateCharacter(data: CharacterCreationData) {
      const { name: charName, ancestry: anc, background: bg, characterClass: cls } = data;
      if (!location) return;
      const id = Math.floor(Math.random() * 1000000);
      const speed = calcSpeed(anc, bg, cls);
      const attrs = calcAttrs(anc, bg, cls);
      const hp = calcHP(anc, bg, cls);
      const mana = calcMana(anc, bg, cls);
      const newCharacter: Characters = {
        id,
        name: charName,
        ancestry: anc?.id ?? 0,
        background: bg?.id ?? 0,
        classId: cls?.id ?? 0,
        speed,
        size: anc?.baseSize ?? "medium",
        dexterity: attrs.DEX,
        strength: attrs.STR,
        intelligence: attrs.INT,
        charisma: attrs.CHA,
        wisdom: attrs.WIS,
        constitution: attrs.CON,
        level: 1,
        gold: 0,
        experience: 0,
        health: hp,
        maxHealth: hp,
        mana,
        maxMana: mana,
        longitude: location.coords.longitude ?? 0,
        latitude: location.coords.latitude ?? 0,
      };
      await api.characters.charactersPost({ characters: newCharacter });
      setCharacter(newCharacter);
      await saveCharacterId(id);
      const newCharacterSkills = skills.map((skill) => ({
        characterId: id,
        skillId: skill.id,
        level: 1,
        experience: 0,
      }));
      for (const skill of newCharacterSkills) {
        await api.characterSkills.characterSkillsPost({ characterSkills: skill });
      }
      setCharacterSkills(newCharacterSkills);
      setCharacterRange(speed);
      calculateAbilities(newCharacterSkills, []);
    }

    if (!character) {
      return (
        <CharacterCreationScreen
          ancestries={ancestries}
          backgrounds={backgrounds}
          characterClasses={characterClasses}
          skills={skills}
          abilitiesList={abilitiesList}
          abilitiesRequiredLevels={abilitiesRequiredLevels}
          abilitiesRequiredItems={abilitiesRequiredItems}
          onCreateCharacter={handleCreateCharacter}
        />
      );
    }

    if (!location) {
      return (
        <View style={styles.container}>
          <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Image source={{ uri: config.imageHost + "plain-dagger.png"}} width={100} height={100} />
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
  const xpPercentage = (character.experience / calculateXpToNextLevel(character.level ?? 1)) * 100;
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
                <Image source={{ uri: config.imageHost + characterClasses.find((c) => c.id == character.classId).image}} width={20} height={20}/>
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
                        <Image source={{ uri: config.imageHost + itemData.image }} style={{ width: 20, height: 20 }} />
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
                  source={{ uri: config.imageHost + ancestries.find(a => a.id === e.ancestry)?.image }} // assuming Goblin has id 1
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
          radius={characterRange} // meters
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
                    <Text>XP: {character.experience}/{calculateXpToNextLevel((character?.level ?? 1))}</Text>
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
                        <Image source={{ uri: config.imageHost + ancestries.find((c) => c.id == character.ancestry)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
                        <Text style={styles.detailsHudTextStat}>
                          {ancestries.find((c) => c.id == character.ancestry)?.name}
                        </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                        <Image source={{ uri: config.imageHost + backgrounds.find((c) => c.id == character.background)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
                        <Text style={styles.detailsHudTextStat}>
                      {backgrounds.find((c) => c.id == character.background)?.name}
                    </Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                        <Image source={{ uri: config.imageHost + characterClasses.find((c) => c.id == character.classId)?.image}} style={{ width: 20, height: 20, marginRight: 5}} />
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
          <Image source={{ uri: config.imageHost + "abdominal-armor.png"}} style={styles.slotIcon} />
          </TouchableOpacity>
            <TouchableOpacity style={styles.statBlock} onPress={() => setInventoryOpen(true)}>
                <Image source={{ uri: config.imageHost + "knapsack.png"}} style={styles.slotIcon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.statBlock} onPress={() => setSkillTreeOpen(true)}>
                <Image source={{ uri: config.imageHost + "skills.png"}} style={styles.slotIcon} />
            </TouchableOpacity>
        </View>
        {/* Skill Model */}
        <Modal visible={isSkillTreeOpen} transparent={true} animationType="slide">
            <View style={styles.modalContainer}>
              {/* Close Button */}
              <TouchableOpacity onPress={() => setSkillTreeOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>

              {selectedSkill && (() => {
                const skillData = skills.find(s => s.id === selectedSkill.skillId);
                if (!skillData) return null;
                const skillLevelXPPercentage = ((selectedSkill.experience ?? 0) / calculateXpToNextLevel(selectedSkill?.level ?? 1)) * 100;
                return (
                    <View style={styles.selectedItemContainer}>
                        <Text style={styles.selectedItemTitle}>{skillData.name}</Text>
                        <Image source={{ uri: config.imageHost + skillData.image}} style={styles.selectedItemImage} />
                        <Text style={styles.selectedItemTitle}>{skillData.name}</Text>
                        <Text style={styles.selectedItemDescription}>{skillData.description}</Text>
                        <View style={styles.barContainer}>
                        <View style={styles.barBackground}>
                          <View style={[styles.barFill, { width: `${skillLevelXPPercentage}%`, backgroundColor: "gold" }]} />
                        </View>
                          <Text>XP: {selectedSkill.experience}/{calculateXpToNextLevel((selectedSkill?.level ?? 1))}</Text>
                         </View>
                    </View>
                );
            })()}
            {/* Skills */}
                <ScrollView contentContainerStyle={styles.gridContainer}>
                  {characterSkills.map((item, index) => {
                    const skillData = skills.find((i) => i.id === item.skillId);
                    if (!skillData) return null;
                    return (
                      <TouchableOpacity style={styles.statBlock} key={item.skillId} onPress={() => setSelectedSkill(item)}>
                        <Image source={{ uri: config.imageHost + skillData.image}} style={styles.slotIcon} />
                        <Text style={styles.statLabel}>{skillData.name}</Text>
                        <Text style={styles.statValue}>Lvl: {item.level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

            </View>
         </Modal>  


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
                                    <Image source={{ uri: config.imageHost + (mainhandSlot?.image ?? "plain-dagger.png")}} style={[styles.slotIcon, !mainhandSlot && { opacity: 0.4}]} />
                                    <Text style={styles.statLabel}>Main Hand</Text>
                                    <Text style={styles.statValue}>{mainhandSlot?.name || "None"}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("offhand");}}>
                                    <Image source={{ uri: config.imageHost + (offhandSlot?.image ?? "shield.png")}} style={[styles.slotIcon, !offhandSlot && { opacity: 0.4}]} />
                                    <Text style={styles.statLabel}>Off Hand</Text>
                                    <Text style={styles.statValue}>{offhandSlot?.name || "None"}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("head");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: config.imageHost + (headSlot?.image ?? "visored-helm.png")}} style={[styles.slotIcon, !headSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Head</Text>
                                <Text style={styles.statValue}>{headSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("chest");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: config.imageHost + (chestSlot?.image ?? "abdominal-armor.png")}} style={[styles.slotIcon, !chestSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Chest</Text>
                                <Text style={styles.statValue}>{chestSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("hands");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: config.imageHost + (handsSlot?.image ?? "gauntlet.png")}} style={[styles.slotIcon, !handsSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Hands</Text>
                                <Text style={styles.statValue}>{handsSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("legs");}} >
                                {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                                <Image source={{ uri: config.imageHost + (legsSlot?.image ?? "armored-pants.png")}} style={[styles.slotIcon, !legsSlot && { opacity: 0.4}]} />
                                <Text style={styles.statLabel}>Leg</Text>
                                <Text style={styles.statValue}>{legsSlot?.name || "None"}</Text>
                            </TouchableOpacity>
                        <TouchableOpacity style={styles.statBlock} onPress={() => { setSelectedSlot("feet");}} >
                            {/* Filter the inventory for equipped items, filter quipped items for equipmentSlot = head */}
                            <Image source={{ uri: config.imageHost + (feetSlot?.image ?? "leg-armor.png")}} style={[styles.slotIcon, !feetSlot && { opacity: 0.4}]} />
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
                            source={{ uri: config.imageHost + (currentlyEquipped?.image ?? "placeholder.png") }}
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
                          <Image source={{ uri: config.imageHost + selectedEquipment.image }} style={styles.itemImage} />
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
                              <Image source={{ uri: config.imageHost + item.image}} style={styles.slotIcon} />
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
                        <Image source={{ uri: config.imageHost + itemData.image}} style={styles.selectedItemImage} />
                        <Text style={styles.selectedItemTitle}>{itemData.name}</Text>
                        <Text style={styles.selectedItemDescription}>{itemData.description}</Text>
                        <Text style={styles.selectedItemQuantity}>Quantity: {selectedItem.quantity}</Text>
                        {itemData.type === "consumable" && (
                            <TouchableOpacity style={styles.useButton} onPress={() => {
                               consumeItemInInventory(selectedItem);
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
                        <Image source={{ uri: config.imageHost + itemData.image}} style={styles.slotIcon} />
                        <Text style={styles.statLabel}>{item.name}</Text>
                        <Text style={styles.statValue}>{item.quantity}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
          </View>
        </Modal>

      <View style={styles.weaponsHudContainer}>

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
              <TouchableOpacity
                key={ability.id}
                style={styles.statBlock}
                onPress={() => {
                  const requiredSkill = abilitiesRequiredLevels.find(
                    (arl) => arl.abilityId === ability.id
                  );
                  const meleeSkill = skills.find((s) => s.name === "Melee");

                  if (meleeSkill && requiredSkill?.skillId === meleeSkill.id) {
                    useMeleeAbility(ability.name);
                  } else {
                    const fn = abilityFunctions[ability.name];
                    if (fn) {
                      fn(); // actually invoke the handler
                    } else {
                      console.warn(`No function defined for ability: ${ability.name}`);
                    }
                  }
                }}
              >
                <Image
                  source={{ uri: config.imageHost + ability.image }}
                  style={styles.slotIcon}
                />
              </TouchableOpacity>
            )}

          />
        </View>
      </View>
    </View>
  );
}
