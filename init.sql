-- Enable UUIDs for IDs
CREATE ROLE anon NOLOGIN;

-- 🎯 Skills
create table skills (
  id serial primary key,
  name text unique not null,
  description text,
  base_power int default 1
);

-- 🪓 Items
create table items (
  id serial primary key,
  name text not null,
  description text,
  type text check (type in ('weapon','armor','consumable','resource')),
  weight float default 1.0, -- weight for inventory management
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
  required_skill int references skills(id),
  required_level int default 1,
  required_item int references items(id) null,
  required_quantity int default 0,
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
  bonus_skill int references skills(id)
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
  bonus_skill int references skills(id)
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
  bonus_skill int references skills(id)
);

-- 👹 Enemies
create table enemies (
  id serial primary key,
  name text not null,
  health int default 5,
  mana int default 0,
  experience_reward int default 10,
  latitude double precision,
  longitude double precision,
  path jsonb,
  step int default 0,
  image text
);

-- What enemies drop
create table enemy_drops (
  enemy_id int references enemies(id),
  item_id int references items(id),
  drop_chance float default 1.0,
  primary key(enemy_id, item_id)
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
  mana int default 5,
  longitude double precision,
  latitude double precision,
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

--
-- Seed data
--

-- Items
insert into items (name, description, type, image) values
  ('Rock', 'A simple rock. Can be thrown or used for bashing.', 'weapon',
   'rock-copy.png');

-- Skills
insert into skills (name, description) values
  ('Gather', 'Collect resources from the environment'),
  ('Melee', 'Close-range combat'),
  ('Magic', 'Use magical abilities'),
  ('Herbalism', 'Knowledge of plants and their uses'),
  ('Crafting', 'Create items from gathered resources'),
  ('Ranged Combat', 'Ranged fighting');

-- Abilities
insert into abilities (name, description, damage, range, cooldown, required_skill, required_level, required_item, required_quantity, image) values
  ('Dig', 'Dig up resources from the ground', 0, 1, 1, (select id from skills where name='Gather'), 1, null, 0, 'dig-dug.png'),
  ('Gather Herbs', 'Collect herbs and plants', 0, 1, 1, (select id from skills where name='Herbalism'), 1, null, 0, 'herbs-bundle.png'),
  ('Craft Item', 'Create a basic item from gathered resources', 0, 1, 1, (select id from skills where name='Crafting'), 1, null, 0, 'hammer-nails.png'),
  ('Punch', 'Basic unarmed strike', 1, 1, 1, (select id from skills  where name='Melee'), 1, null, 0, 'punch.png'),
  ('Kick', 'A powerful kick attack', 2, 1, 2, (select id from skills where name='Melee'), 3, null, 0, 'leg.png'),
  ('Throw Rock', 'Hurl a rock at an enemy', 3, 10, 2, (select id from skills where name='Ranged Combat'), 1, (select id from items where name='Rock'), 1, 'throwing-ball.png');

-- 🌱 Default ancestries
insert into ancestries
  (name, description, bonus_speed, bonus_health, bonus_mana, base_size,
   bonus_strength, bonus_dexterity, bonus_intelligence, bonus_charisma, bonus_wisdom, bonus_constitution, bonus_skill)
values
  ('Human', 'Adaptable and ambitious, humans are versatile.',
    2, 2, 0, 'medium',
    3, 1, 1, 3, 1, 2, (select id from skills where name='Gather')),
  ('Elf', 'Graceful and attuned to magic and nature.',
    5, 0, 2, 'medium',
    0, 2, 2, 1, 2, 0, (select id from skills where name='Gather'));

-- 🎭 Default backgrounds
insert into backgrounds (name, description, bonus_speed, bonus_health, bonus_mana,
                            bonus_strength, bonus_dexterity, bonus_intelligence, bonus_charisma, bonus_wisdom, bonus_constitution, bonus_skill) values
  ('Tinker', 'Inventors and improvised engineers, skilled at crafting and tools',
    0, 0, 0, 0, 0, 3, 0, 1, 0, (select id from skills where name='Crafting')),
  ('Herbalist', 'Students of nature and medicine, skilled with plants and remedies',
    0, 2, 1, 0, 0, 1, 0, 2, 0, (select id from skills where name='Herbalism'));

-- ⚔️ Default classes
insert into classes (name, description, bonus_speed, bonus_health, bonus_mana,
                     bonus_strength, bonus_dexterity, bonus_intelligence, bonus_charisma, bonus_wisdom, bonus_constitution, bonus_skill) values
  ('Bard', 'Weavers of song and story, inspiring allies and confusing foes.',
    0, 0, 2, 0, 1, 2, 3, 1, 0,
    (select id from skills where name='Melee')),
  ('Druid', 'Guardians of the wild, attuned to balance and nature’s fury.',
    0, 3, 0, 3, 2, 0, 1, 0, 1,
    (select id from skills where name='Magic'));

