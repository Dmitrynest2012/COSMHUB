import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const filePath = path.join(dataDir, 'inbox.json');
const MAX_PER_USER = 200;

let boxes = {};
let ready = load();

async function load() {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    boxes = JSON.parse(raw);
  } catch {
    boxes = {};
  }
}

async function persist() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(boxes), 'utf8');
}

export async function enqueue(to, envelope) {
  await ready;
  if (!to || !envelope) return;
  if (!boxes[to]) boxes[to] = [];
  boxes[to].push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    envelope
  });
  if (boxes[to].length > MAX_PER_USER) {
    boxes[to] = boxes[to].slice(-MAX_PER_USER);
  }
  await persist();
}

export async function pull(to) {
  await ready;
  const items = boxes[to] || [];
  boxes[to] = [];
  if (items.length) await persist();
  return items;
}
