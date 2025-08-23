class Character extends Entity {
  constructor(id: string, name: string, race: Race, alignment: Alignment, location: Location, image: any) {
    super(id, name, race, alignment, location, image);
  }

  addXp(amount: number) {
    this.stats.xp += amount;
    const xpForNextLevel = this.stats.level * 100;
    if (this.stats.xp >= xpForNextLevel) {
      this.stats.level++;
      this.stats.xp -= xpForNextLevel;
      this.levelUp();
    }
  }

  levelUp() {
    this.stats.maxHp += 20;
    this.stats.currentHp = this.stats.maxHp;
    this.stats.maxMana += 10;
    this.stats.currentMana = this.stats.maxMana;
  }

  useAbility(ability: Ability, target: Entity) {
    if (this.stats.currentMana < ability.manaCost) return false;
    this.stats.currentMana -= ability.manaCost;
    target.takeDamage(ability.damage);
    return true;
  }
}