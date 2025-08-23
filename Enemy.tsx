class Enemy extends Entity {
  constructor(id: string, name: string, pos: Point, image: any) {
    super(id, name, pos, image);
  }

  dropLoot(): Item[] {
    return this.inventory.length ? [this.inventory.pop()!] : [];
  }
}