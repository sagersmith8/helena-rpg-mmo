export interface Race {
  id: string;
  name: string;
  baseStats: Partial<Stats>;
  abilities?: Ability[]; // optional racial passives or actives
  image: any; // SVG import
}