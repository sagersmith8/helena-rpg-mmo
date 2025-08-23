export interface Alignment {
  id: string;
  name: string;
  statGrowth: Partial<Stats>; // how stats scale per level
  startingAbilities: Ability[];
  image: any;
}