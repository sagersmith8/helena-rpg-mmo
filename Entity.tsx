abstract class Entity {
  id: string;
  name: string;
  location: Location;
  race: Race;
  alignment: Alignment;
  stats: Stats;
  inventory: Item[];
  equipment: Equipment;
  abilities: Ability[];
  image: any; // imported SVG or image

  constructor(id: string, name: string, race: Race, alignment: Alignment, loc: Location, image: any) {
    this.id = id;
    this.name = name;
    this.location = loc;
    this.alignment = alignment;
    this.race = race;
    this.image = image;
    this.stats = {
      maxHp: 100,
      currentHp: 100,
      maxMana: 50,
      currentMana: 50,
      xp: 0,
      level: 1,
    };
    this.inventory = [];
    this.equipment = {};
    this.abilities = [];
  }

  takeDamage(amount: number) {
    this.stats.currentHp = Math.max(0, this.stats.currentHp - amount);
  }

  heal(amount: number) {
    this.stats.currentHp = Math.min(this.stats.maxHp, this.stats.currentHp + amount);
  }

  // Utility: Distance in meters
  getDistance(entity: Entity): number {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(entity.location.latitude - this.location.latitude);
    const dLon = toRad(entity.location.longitude - this.location.longitude);
    const lat1 = toRad(this.location.latitude);
    const lat2 = toRad(entity.location.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
}
