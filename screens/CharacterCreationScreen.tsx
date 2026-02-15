import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
} from "react-native";
import { config } from "../apiClient";
import { styles } from "../styles";
import {
  calculateSpeed,
  calculateAttributes,
  calculateHP,
  calculateMana,
} from "../utils/characterUtils";
import type {
  Abilities,
  AbilitiesRequiredItems,
  AbilitiesRequiredLevels,
  Ancestries,
  Backgrounds,
  Classes,
  Skills,
} from "../api/index";

export type CharacterCreationData = {
  name: string;
  ancestry: Ancestries | null;
  background: Backgrounds | null;
  characterClass: Classes | null;
  selectedAbility: Abilities | null;
};

type CharacterCreationScreenProps = {
  ancestries: Ancestries[];
  backgrounds: Backgrounds[];
  characterClasses: Classes[];
  skills: Skills[];
  abilitiesList: Abilities[];
  abilitiesRequiredLevels: AbilitiesRequiredLevels[];
  abilitiesRequiredItems: AbilitiesRequiredItems[];
  onCreateCharacter: (data: CharacterCreationData) => Promise<void>;
};

export function CharacterCreationScreen({
  ancestries,
  backgrounds,
  characterClasses,
  skills,
  abilitiesList,
  abilitiesRequiredLevels,
  abilitiesRequiredItems,
  onCreateCharacter,
}: CharacterCreationScreenProps) {
  const [name, setName] = useState("");
  const [ancestry, setAncestry] = useState<Ancestries | null>(null);
  const [background, setBackground] = useState<Backgrounds | null>(null);
  const [characterClass, setCharacterClass] = useState<Classes | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<Abilities | null>(null);
  const [isAncestryCollapsed, setAncestryCollapsed] = useState(true);
  const [isBackgroundCollapsed, setBackgroundCollapsed] = useState(true);
  const [isCharacterClassCollapsed, setCharacterClassCollapsed] = useState(true);

  const speed = calculateSpeed(ancestry, background, characterClass);
  const attrs = calculateAttributes(ancestry, background, characterClass);
  const hp = calculateHP(ancestry, background, characterClass);
  const mana = calculateMana(ancestry, background, characterClass);

  const startingAbilities = abilitiesList.filter((a) => {
    if (!a.active) return false;
    const requiredLevel = abilitiesRequiredLevels.find((arl) => arl.abilityId === a.id);
    if (requiredLevel?.requiredLevel !== 1) return false;
    const requiredItem = abilitiesRequiredItems.find((ai) => ai.abilityId === a.id);
    if (requiredItem) return false;
    return true;
  });

  const handleCreate = async () => {
    await onCreateCharacter({
      name,
      ancestry,
      background,
      characterClass,
      selectedAbility,
    });
  };

  return (
    <View style={[styles.characterCreationContainer, { height: "70%", padding: 20 }]}>
      <ScrollView>
        <Text style={styles.title}>Character Details</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter character name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#aaa"
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Character Ancestry</Text>
          <View>
            {ancestry && (
              <TouchableOpacity
                style={styles.selectedItemContainer}
                onPress={() => setAncestryCollapsed(!isAncestryCollapsed)}
              >
                <Text style={styles.selectedItemTitle}>{ancestry.name}</Text>
                <Image
                  source={{ uri: config.imageHost + ancestry.image }}
                  style={styles.selectedItemImage}
                />
                <Text style={styles.selectedItemDescription}>{ancestry.description}</Text>
                {!isAncestryCollapsed && (
                  <View>
                    <View style={styles.statBlock}>
                      <Text style={styles.statLabel}>Size</Text>
                      <Text style={styles.statValue}>{ancestry.baseSize}</Text>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Speed</Text>
                        <Text style={styles.statValue}>{ancestry.bonusSpeed}m</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>HP</Text>
                        <Text style={styles.statValue}>{ancestry.bonusHealth}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>MANA</Text>
                        <Text style={styles.statValue}>{ancestry.bonusMana}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>STR</Text>
                        <Text style={styles.statValue}>{ancestry.bonusStrength}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>DEX</Text>
                        <Text style={styles.statValue}>{ancestry.bonusDexterity}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CON</Text>
                        <Text style={styles.statValue}>{ancestry.bonusConstitution}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>INT</Text>
                        <Text style={styles.statValue}>{ancestry.bonusIntelligence}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>WIS</Text>
                        <Text style={styles.statValue}>{ancestry.bonusWisdom}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CHA</Text>
                        <Text style={styles.statValue}>{ancestry.bonusCharisma}</Text>
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
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.statBlock}
                  onPress={() => {
                    setAncestry(item);
                    setAncestryCollapsed(false);
                  }}
                >
                  <Image
                    source={{ uri: config.imageHost + item.image }}
                    style={styles.slotIcon}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Character Background</Text>
          <View>
            {background && (
              <TouchableOpacity
                style={styles.selectedItemContainer}
                onPress={() => setBackgroundCollapsed(!isBackgroundCollapsed)}
              >
                <Text style={styles.selectedItemTitle}>{background.name}</Text>
                <Image
                  source={{ uri: config.imageHost + background.image }}
                  style={styles.selectedItemImage}
                />
                <Text style={styles.selectedItemDescription}>{background.description}</Text>
                {!isBackgroundCollapsed && (
                  <View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Speed</Text>
                        <Text style={styles.statValue}>{background.bonusSpeed}m</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>HP</Text>
                        <Text style={styles.statValue}>{background.bonusHealth}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>MANA</Text>
                        <Text style={styles.statValue}>{background.bonusMana}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>STR</Text>
                        <Text style={styles.statValue}>{background.bonusStrength}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>DEX</Text>
                        <Text style={styles.statValue}>{background.bonusDexterity}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CON</Text>
                        <Text style={styles.statValue}>{background.bonusConstitution}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>INT</Text>
                        <Text style={styles.statValue}>{background.bonusIntelligence}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>WIS</Text>
                        <Text style={styles.statValue}>{background.bonusWisdom}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CHA</Text>
                        <Text style={styles.statValue}>{background.bonusCharisma}</Text>
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
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.statBlock}
                  onPress={() => {
                    setBackground(item);
                    setBackgroundCollapsed(false);
                  }}
                >
                  <Image
                    source={{ uri: config.imageHost + item.image }}
                    style={styles.slotIcon}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Character Class</Text>
          <View>
            {characterClass && (
              <TouchableOpacity
                style={styles.selectedItemContainer}
                onPress={() => setCharacterClassCollapsed(!isCharacterClassCollapsed)}
              >
                <Text style={styles.selectedItemTitle}>{characterClass.name}</Text>
                <Image
                  source={{ uri: config.imageHost + characterClass.image }}
                  style={styles.selectedItemImage}
                />
                <Text style={styles.selectedItemDescription}>{characterClass.description}</Text>
                {!isCharacterClassCollapsed && (
                  <View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>Speed</Text>
                        <Text style={styles.statValue}>{characterClass.bonusSpeed}m</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>HP</Text>
                        <Text style={styles.statValue}>{characterClass.bonusHealth}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>MANA</Text>
                        <Text style={styles.statValue}>{characterClass.bonusMana}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>STR</Text>
                        <Text style={styles.statValue}>{characterClass.bonusStrength}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>DEX</Text>
                        <Text style={styles.statValue}>{characterClass.bonusDexterity}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CON</Text>
                        <Text style={styles.statValue}>{characterClass.bonusConstitution}</Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>INT</Text>
                        <Text style={styles.statValue}>{characterClass.bonusIntelligence}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>WIS</Text>
                        <Text style={styles.statValue}>{characterClass.bonusWisdom}</Text>
                      </View>
                      <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CHA</Text>
                        <Text style={styles.statValue}>{characterClass.bonusCharisma}</Text>
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
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.statBlock}
                  onPress={() => {
                    setCharacterClass(item);
                    setCharacterClassCollapsed(false);
                  }}
                >
                  <Image
                    source={{ uri: config.imageHost + item.image }}
                    style={styles.slotIcon}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Calculated Stats</Text>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Size</Text>
            <Text style={styles.statValue}>{ancestry?.baseSize ?? "N/A"}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Speed</Text>
              <Text style={styles.statValue}>{speed}m</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statValue}>{hp}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Mana</Text>
              <Text style={styles.statValue}>{mana}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>STR</Text>
              <Text style={styles.statValue}>{attrs.STR}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>DEX</Text>
              <Text style={styles.statValue}>{attrs.DEX}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>CON</Text>
              <Text style={styles.statValue}>{attrs.CON}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>INT</Text>
              <Text style={styles.statValue}>{attrs.INT}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>WIS</Text>
              <Text style={styles.statValue}>{attrs.WIS}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>CHA</Text>
              <Text style={styles.statValue}>{attrs.CHA}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Starting Abilities</Text>
          <View>
            {selectedAbility && (
              <View style={styles.selectedItemContainer}>
                <Text style={styles.selectedItemTitle}>{selectedAbility.name}</Text>
                <Image
                  source={{ uri: config.imageHost + selectedAbility.image }}
                  style={styles.selectedItemImage}
                />
                <Text style={styles.selectedItemDescription}>{selectedAbility.description}</Text>
                <Text style={styles.selectedItemQuantity}>Range: {selectedAbility.range}m</Text>
                <Text style={styles.selectedItemQuantity}>Damage:{selectedAbility.damage}</Text>
                <Text style={styles.selectedItemQuantity}>
                  Hits: {selectedAbility.hits ?? 1}
                </Text>
              </View>
            )}
            <FlatList
              data={startingAbilities}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.statBlock}
                  onPress={() => setSelectedAbility(item)}
                >
                  <Image
                    source={{ uri: config.imageHost + item.image }}
                    style={styles.slotIcon}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: "#4CAF50" }]}
          onPress={handleCreate}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 18 }}>
            Create Character
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
