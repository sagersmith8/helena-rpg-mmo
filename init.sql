-- Enable UUIDs for IDs
CREATE ROLE anon NOLOGIN;

-- 🎯 Skills
create table skills (
  id serial primary key,
  name text unique not null,
  description text,
  type text check (type in ('athletic', 'combat','crafting','magic','stealth','social', 'survival')) null,
  image text -- path to asset
);

-- 🪓 Items
create table items (
  id serial primary key,
  name text not null,
  description text,
  type text check (type in ('weapon','armor','consumable','magic', 'resource', 'quest')),
  mana int default 0, -- mana provided if consumable
  equipment_slot text check (equipment_slot in ('', 'head','chest','legs','feet','hands','either_hand', 'main_hand','offhand','ring','amulet')) null,
  bonus_damage int default 0, -- for weapons
  bonus_damage_change int default 0, -- is a percentage chance
  repairable boolean default false,
  durability int default 0, -- max durability if repairable
  armor_class int default 0, -- for armor
  armor_slots int default 0, -- how many augmentation slots the armor has
  weight float default 1.0, -- weight for inventory management
  gold_value bigint default 0, -- base value in gold
  image text -- path to asset
);

-- 🔮 Abilities (attacks, resource gathering, etc.)
create table abilities (
  id serial primary key,
  name text not null,
  description text,
  damage int default 0,
  range int default 1,
  mana_cost int default 0,
  cooldown int default 1,
  active boolean default true,
  image text
);

-- 🌱 Ancestries
create table ancestries (
  id serial primary key,
  name text unique not null,
  description text,
  bonus_speed int default 0,
  bonus_health int default 0,
  bonus_mana int default 0,
  base_size text check (base_size in ('small','medium','large','huge')) default 'small',
  bonus_strength int default 0,
  bonus_dexterity int default 0,
  bonus_intelligence int default 0,
  bonus_charisma int default 0,
  bonus_wisdom int default 0,
  bonus_constitution int default 0,
  image text -- path to asset
);

-- 🎭 Backgrounds
create table backgrounds (
  id serial primary key,
  name text unique not null,
  description text,
  bonus_speed int default 0,
  bonus_health int default 0,
  bonus_mana int default 0,
  bonus_strength int default 0,
  bonus_dexterity int default 0,
  bonus_intelligence int default 0,
  bonus_charisma int default 0,
  bonus_wisdom int default 0,
  bonus_constitution int default 0,
  image text -- path to asset
);

-- ⚔️ Classes
create table classes (
  id serial primary key,
  name text unique not null,
  description text,
  bonus_speed int default 0,
  bonus_health int default 0,
  bonus_mana int default 0,
  bonus_strength int default 0,
  bonus_dexterity int default 0,
  bonus_intelligence int default 0,
  bonus_charisma int default 0,
  bonus_wisdom int default 0,
  bonus_constitution int default 0,
  image text -- path to asset
);

-- 🧑 Characters
create table characters (
  id serial primary key,
  name text not null,
  ancestry int references ancestries(id),
  background int references backgrounds(id),
  class_id int references classes(id),
  level int default 1,
  gold bigint default 0,
  speed int default 30, -- base movement speed in feet
  size text check (size in ('small','medium','large','huge')) default 'small',
  experience int default 0,
  health int default 10,
  max_health int default 10,
  mana int default 5,
  max_mana int default 5,
  longitude double precision,
  latitude double precision,
  armor_class int default 0,
  strength int default 10,
  dexterity int default 10,
  intelligence int default 10,
  charisma int default 10,
  wisdom int default 10,
  constitution int default 10,
  created_at timestamptz default now()
);

-- Which skills a character knows + progression
create table character_skills (
  character_id int references characters(id) on delete cascade,
  skill_id int references skills(id),
  level int default 1,
  experience int default 0,
  primary key(character_id, skill_id)
);

-- What a character owns
create table inventory (
  character_id int references characters(id) on delete cascade,
  item_id int references items(id),
  equipped boolean default false,
  quantity int default 1,
  primary key(character_id, item_id)
);

-- allow anon to use the schema
GRANT USAGE ON SCHEMA public TO anon;
-- allow anon to read/write/delete all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
-- optional: allow anon to use sequences (for serial/auto-increment IDs)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;
