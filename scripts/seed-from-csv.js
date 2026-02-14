#!/usr/bin/env node
/**
 * Load CSV files into the PostgREST API when tables are empty.
 * Usage: API_URL=http://localhost:3000 node scripts/seed-from-csv.js
 * Or:   npm run seed
 */

const fs = require('fs');
const path = require('path');

const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const CSV_DIR = path.join(__dirname, '..', 'csv');

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\r' && !inQuotes)) {
      out.push(cur.trim());
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(content) {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => {
      let v = values[j];
      if (v === undefined) v = '';
      if (v === '' || v === 'null') row[h] = null;
      else if (v === 'TRUE' || v === 'true') row[h] = true;
      else if (v === 'FALSE' || v === 'false') row[h] = false;
      else if (h.toLowerCase().includes('value') || h === 'weight' || h === 'durability' || h === 'armor_class' || h === 'armor_slots') row[h] = Number(v) || 0;
      else if (['bonus_damage', 'bonus_damage_chance', 'bonus_damage_change', 'damage', 'range', 'mana_cost', 'cooldown', 'mana', 'gold_value', 'bonus_speed', 'bonus_health', 'bonus_mana', 'bonus_strength', 'bonus_dexterity', 'bonus_intelligence', 'bonus_charisma', 'bonus_wisdom', 'bonus_constitution'].some((k) => h === k)) row[h] = Number(v) || 0;
      else row[h] = v;
    });
    rows.push(row);
  }
  return { headers, rows };
}

function mapRow(row, columnMap, dropKeys) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (!k || (dropKeys && dropKeys.includes(k))) continue; // skip empty column names and dropped keys
    const key = columnMap[k] ?? k;
    if (key && v !== undefined && v !== '') out[key] = v;
  }
  return out;
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function tableIsEmpty(table) {
  const data = await fetchJSON(`${API_URL}/${table}?limit=1`);
  return Array.isArray(data) ? data.length === 0 : true;
}

async function insertRow(table, row) {
  const res = await fetch(`${API_URL}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`${res.status} ${table}: ${await res.text()}`);
}

const CONFIGS = {
  skills: {
    file: 'skills.csv',
    table: 'skills',
    drop: ['updated', 'notes'],
    map: {},
  },
  abilities: {
    file: 'abilities.csv',
    table: 'abilities',
    drop: ['category', 'hits', 'effects', 'chance', 'notes'],
    map: {},
  },
  items: {
    file: 'items.csv',
    table: 'items',
    drop: ['notes'],
    map: { bonus_damage_chance: 'bonus_damage_change' },
  },
  ancestries: {
    file: 'ancestries.csv',
    table: 'ancestries',
    drop: [],
    map: { bonus_charima: 'bonus_charisma', bonus_wisom: 'bonus_wisdom' },
  },
  backgrounds: {
    file: 'backgrounds.csv',
    table: 'backgrounds',
    drop: [],
    map: {},
  },
  classes: {
    file: 'classes.csv',
    table: 'classes',
    drop: [],
    map: {},
  },
};

async function main() {
  console.log('API_URL:', API_URL);
  console.log('CSV dir:', CSV_DIR);

  for (const [name, config] of Object.entries(CONFIGS)) {
    const filePath = path.join(CSV_DIR, config.file);
    if (!fs.existsSync(filePath)) {
      console.log(`Skip ${name}: ${config.file} not found`);
      continue;
    }
    const isEmpty = await tableIsEmpty(config.table);
    if (!isEmpty) {
      console.log(`Skip ${name}: ${config.table} already has data`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const { rows } = parseCSV(content);
    if (rows.length === 0) {
      console.log(`Skip ${name}: no rows in CSV`);
      continue;
    }
    console.log(`Loading ${rows.length} rows into ${config.table}...`);
    for (const row of rows) {
      const mapped = mapRow(row, config.map, config.drop);
      await insertRow(config.table, mapped);
    }
    console.log(`  Done ${config.table}.`);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
