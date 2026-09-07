// Estado de la aplicación y persistencia en localStorage.
// Capa aislada para poder cambiar el almacenamiento (p. ej. sincronización en la nube) más adelante.

import { uid } from './ui.js';
import { todayKey } from './dates.js';

const STORAGE_KEY = 'habit-tracker:data';
export const DATA_VERSION = 1;

export const SECTIONS = [
  { id: 'fisico', name: 'Físico y salud', emoji: '💪' },
  { id: 'productividad', name: 'Productividad', emoji: '🧠' },
  { id: 'rutina', name: 'Rutina', emoji: '🌙' },
];

export const STATES = ['done', 'partial', 'na'];
export const STATE_LABEL = { done: 'Hecho', partial: 'A medias', na: 'No aplica' };

const DEFAULT_HABITS = [
  ['Gym', '🏋️', 'fisico'],
  ['Dieta', '🥗', 'fisico'],
  ['Pasos (+10 mil)', '👟', 'fisico'],
  ['Hipopresivos', '🫁', 'fisico'],
  ['Tests coche', '🚗', 'productividad'],
  ['Diario', '📓', 'productividad'],
  ['Agradecer', '🙏', 'productividad'],
  ['Móvil (máx. 3-4 h)', '📵', 'productividad'],
  ['Misión secundaria', '🎯', 'productividad'],
  ['Hacer la cama', '🛏️', 'rutina'],
  ['Suplementación', '💊', 'rutina'],
  ['Skincare', '🧴', 'rutina'],
  ['Tomar el sol', '☀️', 'rutina'],
];

export const DEFAULT_SETTINGS = {
  name: '',
  motto: 'Disciplina hoy, vida que agrada mañana.',
  weightGoal: null,
  sleepGoal: 8,
  dayThreshold: 70,
  theme: 'auto',
};

export function defaultState() {
  return {
    version: DATA_VERSION,
    createdAt: new Date().toISOString(),
    habits: DEFAULT_HABITS.map(([name, emoji, section], i) => ({
      id: uid(), name, emoji, section, description: '', order: i, archived: false, createdAt: todayKey(),
    })),
    days: {},
    months: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const emptyDay = () => ({ mood: null, weight: null, sleep: null, memorable: '', habits: {} });
export const emptyMonth = () => ({ goals: [], rating: null, improve: '' });

function migrate(data) {
  if (!data || typeof data !== 'object') throw new Error('Formato no válido');
  const out = { ...defaultState(), ...data };
  out.version = DATA_VERSION;
  out.habits = Array.isArray(data.habits) ? data.habits.map((h, i) => ({
    id: h.id || uid(),
    name: h.name || 'Hábito',
    emoji: h.emoji || '✅',
    section: SECTIONS.some((s) => s.id === h.section) ? h.section : 'rutina',
    description: h.description || '',
    order: h.order ?? i,
    archived: !!h.archived,
    createdAt: h.createdAt || todayKey(),
  })) : out.habits;
  out.days = data.days && typeof data.days === 'object' ? data.days : {};
  for (const k of Object.keys(out.days)) {
    out.days[k] = { ...emptyDay(), ...out.days[k], habits: { ...(out.days[k].habits || {}) } };
  }
  out.months = data.months && typeof data.months === 'object' ? data.months : {};
  for (const k of Object.keys(out.months)) {
    out.months[k] = { ...emptyMonth(), ...out.months[k], goals: Array.isArray(out.months[k].goals) ? out.months[k].goals : [] };
  }
  out.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  delete out.exportedAt;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudo leer el estado guardado, se empieza de cero', e);
  }
  return defaultState();
}

let state = load();
const listeners = new Set();
let saveError = false;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveError = false;
  } catch (e) {
    saveError = true;
    console.error('No se pudo guardar', e);
  }
}

function emit() {
  for (const fn of listeners) fn(state);
}

export const getState = () => state;
export const hasSaveError = () => saveError;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Aplica una mutación, guarda y notifica (salvo silent).
export function update(mutator, { silent = false } = {}) {
  mutator(state);
  save();
  if (!silent) emit();
}

export function ensureDay(st, key) {
  if (!st.days[key]) st.days[key] = emptyDay();
  return st.days[key];
}

export function ensureMonth(st, ym) {
  if (!st.months[ym]) st.months[ym] = emptyMonth();
  return st.months[ym];
}

export function dayHasData(day) {
  if (!day) return false;
  return day.mood != null || day.weight != null || day.sleep != null
    || (day.memorable || '').trim() !== '' || Object.keys(day.habits || {}).length > 0;
}

function tidyDay(st, key) {
  if (st.days[key] && !dayHasData(st.days[key])) delete st.days[key];
}

// ---------- Acciones de día ----------
export function setHabit(key, habitId, value) {
  update((st) => {
    const day = ensureDay(st, key);
    if (value) day.habits[habitId] = value; else delete day.habits[habitId];
    tidyDay(st, key);
  });
}

export function cycleHabit(key, habitId) {
  const cur = state.days[key]?.habits?.[habitId] || null;
  const order = [null, 'done', 'partial', 'na'];
  const next = order[(order.indexOf(cur) + 1) % order.length];
  setHabit(key, habitId, next);
}

export function setMetric(key, field, value, opts) {
  update((st) => {
    const day = ensureDay(st, key);
    if (field === 'memorable') day.memorable = value || '';
    else day[field] = value === '' || value == null || Number.isNaN(Number(value)) ? null : Number(value);
    tidyDay(st, key);
  }, opts);
}

// ---------- Acciones de mes ----------
export function setMonthField(ym, field, value, opts) {
  update((st) => { ensureMonth(st, ym)[field] = value; }, opts);
}

export function addGoal(ym, text) {
  update((st) => { ensureMonth(st, ym).goals.push({ id: uid(), text, status: 'pending' }); });
}

export function updateGoal(ym, id, patch, opts) {
  update((st) => {
    const g = ensureMonth(st, ym).goals.find((x) => x.id === id);
    if (g) Object.assign(g, patch);
  }, opts);
}

export function cycleGoal(ym, id) {
  const g = state.months[ym]?.goals.find((x) => x.id === id);
  if (!g) return;
  const order = ['pending', 'done', 'fail'];
  updateGoal(ym, id, { status: order[(order.indexOf(g.status) + 1) % order.length] });
}

export function removeGoal(ym, id) {
  update((st) => {
    const m = ensureMonth(st, ym);
    m.goals = m.goals.filter((g) => g.id !== id);
  });
}

// ---------- Acciones de hábitos ----------
export function addHabit({ name, emoji, section, description }) {
  update((st) => {
    const order = Math.max(-1, ...st.habits.filter((h) => h.section === section).map((h) => h.order)) + 1;
    st.habits.push({
      id: uid(), name, emoji: emoji || '✅', section, description: description || '', order, archived: false, createdAt: todayKey(),
    });
  });
}

export function updateHabit(id, patch) {
  update((st) => {
    const h = st.habits.find((x) => x.id === id);
    if (h) Object.assign(h, patch);
  });
}

export function moveHabit(id, dir) {
  update((st) => {
    const h = st.habits.find((x) => x.id === id);
    if (!h) return;
    const siblings = st.habits
      .filter((x) => x.section === h.section && x.archived === h.archived)
      .sort((a, b) => a.order - b.order);
    const i = siblings.indexOf(h);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    siblings.forEach((x, idx) => { x.order = idx; });
  });
}

export function removeHabit(id) {
  update((st) => {
    st.habits = st.habits.filter((h) => h.id !== id);
    for (const k of Object.keys(st.days)) {
      delete st.days[k].habits[id];
      tidyDay(st, k);
    }
  });
}

// ---------- Ajustes ----------
export function setSetting(field, value, opts) {
  update((st) => { st.settings[field] = value; }, opts);
}

// ---------- Importar / exportar ----------
export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const data = migrate(JSON.parse(text));
  state = data;
  save();
  emit();
}

export function resetAll() {
  state = defaultState();
  save();
  emit();
}

export function storageInfo() {
  let bytes = 0;
  try { bytes = (localStorage.getItem(STORAGE_KEY) || '').length; } catch { /* sin acceso */ }
  return { bytes, days: Object.keys(state.days).length };
}
