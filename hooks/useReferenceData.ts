import { useState, useEffect } from "react";
import { api } from "../apiClient";
import type {
  Abilities,
  AbilitiesRequiredItems,
  AbilitiesRequiredLevels,
  Ancestries,
  Backgrounds,
  Classes,
  Items,
  Skills,
} from "../api/index";

export function useReferenceData() {
  const [characterClasses, setCharacterClasses] = useState<Classes[]>([]);
  const [backgrounds, setBackgrounds] = useState<Backgrounds[]>([]);
  const [ancestries, setAncestries] = useState<Ancestries[]>([]);
  const [skills, setSkills] = useState<Skills[]>([]);
  const [items, setItems] = useState<Items[]>([]);
  const [abilitiesList, setAbilitiesList] = useState<Abilities[]>([]);
  const [abilitiesRequiredLevels, setAbilitiesRequiredLevels] = useState<
    AbilitiesRequiredLevels[]
  >([]);
  const [abilitiesRequiredItems, setAbilitiesRequiredItems] = useState<
    AbilitiesRequiredItems[]
  >([]);

  useEffect(() => {
    const fetchClasses = () =>
      api.classes.classesGet({}).then((r) => r && setCharacterClasses(r));
    const fetchBackgrounds = () =>
      api.backgrounds.backgroundsGet({}).then((r) => r && setBackgrounds(r));
    const fetchAncestries = () =>
      api.ancestries.ancestriesGet({}).then((r) => r && setAncestries(r));
    const fetchSkills = () =>
      api.skills.skillsGet({}).then((r) => r && setSkills(r));
    const fetchItems = () =>
      api.items.itemsGet({}).then((r) => r && setItems(r));
    const fetchAbilities = () =>
      api.abilities.abilitiesGet({}).then((r) => r && setAbilitiesList(r));
    const fetchAbilitiesRequiredItems = () =>
      api.abilitiesRequiredItems
        .abilitiesRequiredItemsGet({})
        .then((r) => r && setAbilitiesRequiredItems(r));
    const fetchAbilitiesRequiredLevels = () =>
      api.abilitiesRequiredLevels
        .abilitiesRequiredLevelsGet({})
        .then((r) => r && setAbilitiesRequiredLevels(r));

    fetchClasses();
    fetchBackgrounds();
    fetchAncestries();
    fetchSkills();
    fetchItems();
    fetchAbilities();
    fetchAbilitiesRequiredItems();
    fetchAbilitiesRequiredLevels();
  }, []);

  return {
    characterClasses,
    backgrounds,
    ancestries,
    skills,
    items,
    abilitiesList,
    abilitiesRequiredLevels,
    abilitiesRequiredItems,
  };
}
