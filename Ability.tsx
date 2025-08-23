export interface Ability {
  name: string;
  description: string;
  type: "passive" | "active";  // core distinction
  damage?: number;             // optional – only relevant for attacks
  range?: number;              // meters, only if targeting something
  manaCost?: number;           // only for active abilities
  cooldown?: number;           // seconds, only for actives
  image: any;                  // imported SVG or image
}
