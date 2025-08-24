import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, TextInput, FlatList, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from "react-native-maps";
import * as Location from "expo-location";
import Api from "Api.tsx"
import * as SecureStore from 'expo-secure-store';
import GoblinIcon from "./assets/icons/svg/goblin.svg";
import Knapsack from "./assets/icons/svg/knapsack.svg";
import AbdominalArmor from "./assets/icons/svg/abdominal-armor.svg";
import SwordInStone from "./assets/icons/svg/battle-gear.svg";
import Lyre from "./assets/icons/svg/lyre.svg";

import { AbilitiesApi, Abilities, AncestriesApi, Ancestries, CharactersApi, Characters, CharacterSkillsApi, CharacterSkills, Configuration, ClassesApi, Classes, BackgroundsApi, Backgrounds, InventoryApi, Inventory, ItemsApi, Items, SkillsApi, Skills} from './api/index';

type Goblin = {
  id: number;
  latitude: number;
  longitude: number;
  path: { lat: number; lng: number }[];
  step: number;
  health: number;
  ac: number;
  speed: number;
  perception: number;
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
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [goblins, setGoblins] = useState<Goblin[]>([]);
  const [isEquipmentOpen, setEquipmentOpen] = useState(false);
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [character, setCharacter] = useState<Characters | null>(null);
  const [name, setName] = useState(null);
  const [ancestry, setAncestry] = useState<Ancestries | null>(null);
  const [background, setBackground] = useState<Backgrounds | null>(null);
  const [characterClass, setCharacterClass] = useState<Classes | null>(null);
  const [abilities, setAbilities] = useState({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
  const [feats, setFeats] = useState([]);
  const [equipment, setEquipment] = useState([]);

  const imageHost = "http://10.46.235.105:4000/";
  //const config = new Configuration({basePath: 'https://postgrest.sageneilsmith.me'});
  const config = new Configuration({basePath: 'http://10.46.235.105:3000'});
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

  const [markers, setMarkers] = useState<{ lat: number; lng: number }[]>([]);

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

    const abilityFunctions = {
        "Dig": () => {
            const item = items.find(item => item.name === "Rock")
            const existingItem = inventory.find(i => i.itemId === item?.id);
            if (existingItem) {
                existingItem.quantity += 1;
                setInventory([...inventory]);
                inventoryApi.inventoryPatch({
                    inventory: existingItem,
                }).catch(err => console.error("Failed to update inventory:", err));
                return;
            } else {
                const newItem: Inventory = {
                    characterId: character?.id ?? 0, // Use character ID if available
                    itemId: item?.id ?? 0, // Use item ID if available
                    quantity: 1,
                };
                setInventory([...inventory, newItem]);
                inventoryApi.inventoryPost({
                    inventory: newItem,
                }).catch(err => console.error("Failed to add item to inventory:", err));
            }
            console.log("You dug up a rock!");
        },
        "Gather Herbs": () => null, // Placeholder
        "Craft Item": () => null, // Placeholder
        "Punch": async () => {
            if (targetedEnemy === null) {
                console.warn("No enemy targeted for Punch action");
                return;
            }

            const goblin = goblins.find(g => g.id === targetedEnemy);
            if (!goblin) {
                console.warn("Targeted goblin not found");
                return;
            }

            const punch = abilitiesList.find(a => a.name === "Punch");
            const location = await Location.getCurrentPositionAsync({});

            // Note: location.coords.latitude / longitude
            const distance = getDistanceMeters(
                { lat: location.coords.latitude, lon: location.coords.longitude },
                { lat: goblin.latitude, lon: goblin.longitude }
            ) * 0.3048; // feet → meters?

            const strengthModifier = Math.ceil((character.strength ?? 0) - 10) / 2; // Base damage calculation
            const inRange = distance - (character.speed + punch?.range) <= 0;
            if (!inRange) {
                console.warn("Target is out of range for Punch action");
                return;
            }
            var damage = 0;
            for (let i = 0; i < (punch?.hits ?? 1); i++) {
                const hitRoll = Math.floor(Math.random() * 20) + 1 + (strengthModifier ?? 0);
                if (hitRoll >= (goblin.ac ?? 0)) {
                    const damageRoll = Math.floor(Math.random() * punch?.damage) + 1; // Roll a d6 for damage
                    damage += damageRoll;
                }
            }

            if (damage >= (goblin.health ?? 0)) {
                setGoblins(prev => prev.filter(g => g.id !== goblin.id));
            } else {
                setGoblins(prev =>
                    prev.map(g => g.id === goblin.id ? { ...g, health: g.health - damage } : g)
                );
            }

            console.log(hit ? `Hit! Damage: ${damage}` : "Missed!");
        },
        "Kick": () => null, // Placeholder
        "Throw Rock": () => null, // Placeholder
    };

  useEffect(() => {
      let intervalId: NodeJS.Timer;

      (async () => {
        const fetchClasses = async () => {
          try {
            const result = await classesApi.classesGet({}); // fully-typed GET request
            if (result) setCharacterClasses(result);
            console.log("Fetched classes:", result);
          } catch (err) {
            console.error('Failed to fetch classes:', err);
          }
        };

        fetchClasses();

        const fetchBackgrounds = async () => {
          try {
            const result = await backgroundsApi.backgroundsGet({}); // fully-typed GET request
            if (result) setBackgrounds(result);
            console.log("Fetched backgrounds:", result);
          } catch (err) {
            console.error('Failed to fetch backgrounds:', err);
          }
        };
        fetchBackgrounds();

        const fetchAncestries = async () => {
          try {
            const result = await ancestriesApi.ancestriesGet({}); // fully-typed GET request
            if (result) setAncestries(result);
            console.log("Fetched ancestries:", result);
          } catch (err) {
            console.error('Failed to fetch ancestries:', err);
          }
        };
        fetchAncestries();

        const fetchSkills = async () => {
          try {
            const result = await skillsApi.skillsGet({}); // fully-typed GET request
            if (result) setSkills(result);
            console.log("Fetched skills:", result);
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
            console.log("Fetched items:", result);
          } catch (err) {
            console.error('Failed to fetch items:', err);
          }
        };
        fetchItems();

        const fetchAbilities = async () => {
          try {
            const result = await abilitiesApi.abilitiesGet({}); // fully-typed GET request
            if (result) setAbilitiesList(result);
            console.log("Fetched abilities:", result);
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

              if (c && c.length > 0) {
                console.log("Fetched character:", c[0]);
              }
              const loadedCharacter = c[0] || null;
              setCharacter(loadedCharacter);
              if (loadedCharacter) {
                const loadedInventory = await inventoryApi.inventoryGet({
                    characterId: `eq.${loadedCharacter.id}`, // PostgREST syntax
                    limit: "100", // Adjust as needed
                });
                console.log("Fetched inventory:", loadedInventory);
                setInventory(loadedInventory || []);
                const loadedCharacterSkills = await characterSkillsApi.characterSkillsGet({
                    characterId: `eq.${loadedCharacter.id}`, // PostgREST syntax
                    limit: "100", // Adjust as needed
                });
                console.log("Fetched character skills:", loadedCharacterSkills);
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

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);

        const radius = 100; //1609; // ~1 miles in meters
        const circlePoints = generateCirclePoints(loc.coords.latitude, loc.coords.longitude, radius, 8); // 8 waypoints

        // Build OSRM request
        const waypointString = circlePoints.map(p => `${p.lng},${p.lat}`).join(";");
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${waypointString}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          console.warn("Failed to fetch route");
          return;
        }

        const routeCoords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          lat,
          lng,
        }));

        // Spawn 3 goblins
        const goblinSpawns = [0, 1, 2].map(idx => ({
          id: idx,
          latitude: routeCoords[0].lat,
          longitude: routeCoords[0].lng,
          path: routeCoords,
          step: idx,
          health: Math.floor(Math.random() * 10) + 5, // Random health between 5 and 15
          ac: Math.floor(Math.random() * 2) + 3, // Random AC between 3 and 5
          speed: 30 + Math.floor(Math.random() * 10), // Random speed between 30 and 40
          perception: 50 + Math.floor(Math.random() * 50), // Random perception between 50 and 100
        }));

        setGoblins(goblinSpawns);

        const smoothStepInterval = 100; // ms per micro-step
        const microSteps = 20;          // number of interpolations per segment

        intervalId = setInterval(() => {
          setGoblins(prev =>
            prev.map(g => {
              const current = g.path[g.step];
              const nextStep = (g.step + 1) % g.path.length;
              const next = g.path[nextStep];

              // Use microStep to calculate the interpolation factor
              const interpolationFactor = (g.microStep ?? 0) / microSteps;

              // Interpolate latitude and longitude
              const microLat = current.lat + (next.lat - current.lat) * interpolationFactor;
              const microLng = current.lng + (next.lng - current.lng) * interpolationFactor;

              // Update microStep and step
              const newMicroStep = (g.microStep ?? 0) + 1;
              const newStep = newMicroStep >= microSteps ? nextStep : g.step;

              return {
                ...g,
                latitude: microLat,
                longitude: microLng,
                step: newStep,
                microStep: newMicroStep % microSteps,
              };
            })
          );
        }, smoothStepInterval);
      })();

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }, []);

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
                          <Text style={styles.dropdownValue}>{value?.name || "—"}</Text>
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
                                <Text style={styles.dropdownText}>{item.name}</Text>
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
                      <View style={styles.statBlock}><Text style={styles.statLabel}>Speed</Text><Text style={styles.statValue}>{calculateSpeed()}ft</Text></View>
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
                          mana: calculateMana(),
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

  const hpPercentage = (character.health / character.health) * 100;
  const xpPercentage = (character.experience / (character.experience + character.level)) * 100;
  const manaPercentage = (character.mana / character.mana) * 100;


  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        region={region}
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
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        showsUserLocation={true}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={character.name}
          description={`Level: ${character.level}`}
          onPress={() => setTargetedEnemy(null)} // Deselect goblin on character marker press
        >
            <View style={{ width: 20, height: 20 }}>
                <Lyre width={20} height={20}/>
            </View>
        </Marker>
        {goblins.map(g => (
          <Marker
              key={g.id}
              title={`Goblin`}
              description={`Level: 1 | Health: ${g.health} | AC: ${g.ac}`}
              coordinate={{ latitude: g.latitude, longitude: g.longitude }}
              onPress={() => setTargetedEnemy(g.id)}
            >
              <View style={{ width: 20, height: 20 }}>
                <GoblinIcon
                  width={20}
                  height={20}
                  fill={targetedEnemy === g.id ? "purple" : "black"}
                  style={{
                    transform: [{ scale: targetedEnemy === g.id ? 1.3 : 1 }],
                  }}
                />
              </View>
            </Marker>
        ))}
        {goblins.map(g => {
          if (!location) return null;

          // Quick haversine for distance in meters
          const toRad = (x: number) => (x * Math.PI) / 180;
          const R = 6371e3; // Earth radius in meters
          const dLat = toRad(location.coords.latitude - g.latitude);
          const dLon = toRad(location.coords.longitude - g.longitude);
          const lat1 = toRad(g.latitude);
          const lat2 = toRad(location.coords.latitude);

          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          const canPerceive = distance <= g.perception;

          return (
            <Circle
              key={g.id}
              center={{
                latitude: g.latitude,
                longitude: g.longitude,
              }}
              radius={canPerceive ? g.speed : g.perception}
              strokeWidth={2}
              strokeColor={canPerceive ? "rgba(255,0,0,0.6)" : "rgba(0,0,255,0.6)"}
              fillColor={canPerceive ? "rgba(255,0,0,0.2)" : "rgba(0,0,255,0.2)"}
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
          strokeColor="rgba(255,0,0,0.6)"
          fillColor="rgba(255,0,0,0.2)"
        />
      </MapView>
      <View style={styles.statusHudContainer}>
           {/* HP Bar */}
                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View style={[styles.barFill, { width: `${hpPercentage}%`, backgroundColor: "red" }]} />
                  </View>
                  <Text>HP: {character.health}/{character.health}</Text>
                </View>

              {/* Mana Bar */}
              <View style={styles.barContainer}>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${manaPercentage}%`, backgroundColor: "blue" }]} />
                </View>
                <Text>Mana: {character.mana}/{character.mana}</Text>
              </View>

                {/* XP Bar */}
                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View style={[styles.barFill, { width: `${xpPercentage}%`, backgroundColor: "gold" }]} />
                  </View>
                    <Text>XP: {character.experience}/{(character.experience + character.level)}</Text>
                </View>
        </View>

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
                        {Array.from({ length: 70 }, (item, index) => (
                          <TouchableOpacity key={index} style={styles.slotIcon}>
                          </TouchableOpacity>
                        ))}
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
