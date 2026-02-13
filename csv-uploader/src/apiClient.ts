import { Configuration } from "../../api";
import {
  AbilitiesApi,
  AbilitiesRequiredItemsApi,
  AbilitiesRequiredLevelsApi,
  AncestriesApi,
  BackgroundsApi,
  CharacterSkillsApi,
  CharactersApi,
  ClassesApi,
  InventoryApi,
  ItemsApi,
  SkillsApi,
} from "../../api";
import type {
  Abilities,
  AbilitiesRequiredItems,
  AbilitiesRequiredLevels,
  Ancestries,
  Backgrounds,
  CharacterSkills,
  Characters,
  Classes,
  Inventory,
  Items,
  Skills,
} from "../../api";
import { config } from "./config";

const configuration = new Configuration({ basePath: config.apiUrl });

export const API = {
  abilities: new AbilitiesApi(configuration),
  ancestries: new AncestriesApi(configuration),
  backgrounds: new BackgroundsApi(configuration),
  characters: new CharactersApi(configuration),
  characterSkills: new CharacterSkillsApi(configuration),
  classes: new ClassesApi(configuration),
  items: new ItemsApi(configuration),
  skills: new SkillsApi(configuration),
  inventory: new InventoryApi(configuration),
  abilitiesRequiredLevels: new AbilitiesRequiredLevelsApi(configuration),
  abilitiesRequiredItems: new AbilitiesRequiredItemsApi(configuration),
};

export const API_TYPES = {
  abilities: {} as Abilities,
  ancestries: {} as Ancestries,
  backgrounds: {} as Backgrounds,
  characters: {} as Characters,
  characterSkills: {} as CharacterSkills,
  classes: {} as Classes,
  items: {} as Items,
  skills: {} as Skills,
  inventory: {} as Inventory,
  abilitiesRequiredLevels: {} as AbilitiesRequiredLevels,
  abilitiesRequiredItems: {} as AbilitiesRequiredItems,
};
