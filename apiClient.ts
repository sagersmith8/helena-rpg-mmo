import { Configuration } from "./api";
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
} from "./api";
import { config } from "./config";

const configuration = new Configuration({ basePath: config.apiUrl });

export const api = {
  abilities: new AbilitiesApi(configuration),
  abilitiesRequiredItems: new AbilitiesRequiredItemsApi(configuration),
  abilitiesRequiredLevels: new AbilitiesRequiredLevelsApi(configuration),
  ancestries: new AncestriesApi(configuration),
  backgrounds: new BackgroundsApi(configuration),
  characterSkills: new CharacterSkillsApi(configuration),
  characters: new CharactersApi(configuration),
  classes: new ClassesApi(configuration),
  inventory: new InventoryApi(configuration),
  items: new ItemsApi(configuration),
  skills: new SkillsApi(configuration),
};

export { config };
