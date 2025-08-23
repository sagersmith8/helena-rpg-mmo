export interface Item {
  id: string;
  name: string;
  type: "weapon" | "armor" | "accessory" | "consumable" | "material";
  stats?: Partial<{ attack: number; defense: number; healing: number; range: number }>;
  image: any; // imported SVG or image
}
