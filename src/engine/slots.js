// Multiple local save slots, automatic backup, migration of older saves, and safe import/export.
import { migrate, validate } from "./persist.js";
import { wrap } from "./enterprise.js";
const IDX = "fdna3:index", LEGACY = "factory-dna-save-v1", mem = {};
const get = (k) => { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch {} return mem[k] ?? null; };
const set = (k, v) => { mem[k] = v; try { localStorage.setItem(k, v); } catch {} };
const del = (k) => { delete mem[k]; try { localStorage.removeItem(k); } catch {} };
export function validateEnt(x) {
  try { return !!x && x.kind === "enterprise" && x.sites && Array.isArray(x.order) && x.order.length >= 1 && x.order.every((id) => validate(x.sites[id])) && Number.isFinite(x.corp.cash) && Array.isArray(x.transfers) && Number.isFinite(x.clock.lastTs) && Number.isFinite(x.clock.dayMs) && Number.isFinite(x.capex); } catch { return false; }
}
export function parseEnt(text) {
  try {
    const x = JSON.parse(text); if (x && x.kind === "enterprise") { x.order.forEach((id) => (x.sites[id] = migrate(x.sites[id]))); return validateEnt(x) ? { ok: true, ent: x } : { ok: false, reason: "That save is damaged or from a version this game can't read." }; }
    const s = migrate(x); return validate(s) ? { ok: true, ent: wrap(s, Date.now(), "Imported campaign") } : { ok: false, reason: "That doesn't look like a Factory DNA save." };
  } catch { return { ok: false, reason: "Could not read that text as JSON." }; }
}
export const exportEnt = (e) => JSON.stringify(e);
export const listSlots = () => { try { return JSON.parse(get(IDX) || "[]"); } catch { return []; } };
const writeIdx = (l) => set(IDX, JSON.stringify(l));
export const newSlotId = () => "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
export function saveSlot(id, ent) {
  const key = "fdna3:slot:" + id, prev = get(key); if (prev) set("fdna3:bak:" + id, prev); // one backup behind
  set(key, exportEnt(ent)); const l = listSlots().filter((x) => x.id !== id); const s = ent.sites.main;
  l.push({ id, name: ent.name, mode: ent.mode, day: s.day, chapter: s.chapter, updated: Date.now() }); writeIdx(l);
}
export function loadSlot(id) {
  for (const [key, backup] of [["fdna3:slot:" + id, false], ["fdna3:bak:" + id, true]]) { const t = get(key); if (!t) continue; const r = parseEnt(t); if (r.ok) return { ok: true, ent: r.ent, usedBackup: backup }; }
  return { ok: false, reason: "That slot is damaged and no backup could be read." };
}
export function deleteSlot(id) { del("fdna3:slot:" + id); del("fdna3:bak:" + id); writeIdx(listSlots().filter((x) => x.id !== id)); }
// Older single-save games are copied into a slot; the original is never deleted.
export function migrateLegacy() {
  if (listSlots().length) return null; const t = get(LEGACY); if (!t) return null; const r = parseEnt(t); if (!r.ok) return { ok: false, reason: "An older save was found but couldn't be migrated; it was left untouched." };
  r.ent.name = "Main campaign (migrated)"; const id = newSlotId(); saveSlot(id, r.ent); return { ok: true, id };
}
