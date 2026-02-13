import type { Characters } from "./api/index";

export type Enemy = Characters & {
  path: { lat: number; lng: number }[];
  step: number;
  inventory: number[];
  lastAttackTime?: number;
  microStep?: number;
};

export type FloatingText = {
  id: string;
  lat: number;
  lng: number;
  text: string;
  color: string;
  expiresAt: number;
};
