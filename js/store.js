// Estado de la aplicación y persistencia en localStorage.
// Capa aislada para poder cambiar el almacenamiento (p. ej. sincronización en la nube) más adelante.

import { uid } from './ui.js';
import { todayKey } from './dates.js';

const STORAGE_KEY = 'habit-tracker:data';
// v3: cada hábito puede llevar una hora fija del día (`time`, 'HH:MM' o '' si no tiene).
export const DATA_VERSION = 3;

export const DEFAULT_SECTIONS = [
  { id: 'fisico', name: 'Físico y salud', emoji: '💪' },
  { id: 'productividad', name: 'Productividad', emoji: '🧠' },
  { id: 'rutina', name: 'Rutina', emoji: '🌙' },
];

export const STATES = ['done', 'partial', 'na'];
export const STATE_LABEL = { done: 'Hecho', partial: 'A medias', na: 'No aplica' };

export const GOAL_STATUSES = ['pending', 'done', 'partial', 'fail'];
export const GOAL_LABEL = { pending: 'Pendiente', done: 'Sí', partial: 'Regular', fail: 'No' };

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

const defaultSections = () => DEFAULT_SECTIONS.map((s, i) => ({ ...s, order: i }));

export function defaultState() {
  return {
    version: DATA_VERSION,
    createdAt: new Date().toISOString(),
    sections: defaultSections(),
    habits: DEFAULT_HABITS.map(([name, emoji, section], i) => ({
      id: uid(), name, emoji, section, description: '', time: '', order: i, archived: false, createdAt: todayKey(),
    })),
    days: {},
    months: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const emptyDay = () => ({ mood: null, weight: null, sleep: null, memorable: '', habits: {}, tasks: [], events: [] });
export const emptyMonth = () => ({ goals: [], rating: null, improve: '' });

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanTime = (t) => (typeof t === 'string' && TIME_RE.test(t) ? t : '');

function migrate(data) {
  if (!data || typeof data !== 'object') throw new Error('Formato no válido');
  const out = { ...defaultState(), ...data };
  out.version = DATA_VERSION;

  out.sections = Array.isArray(data.sections) && data.sections.length
    ? data.sections.map((s, i) => ({ id: s.id || uid(), name: s.name || 'Sección', emoji: s.emoji || '📌', order: s.order ?? i }))
    : defaultSections();
  const firstSection = out.sections.slice().sort((a, b) => a.order - b.order)[0]?.id;

  out.habits = Array.isArray(data.habits) ? data.habits.map((h, i) => ({
    id: h.id || uid(),
    name: h.name || 'Hábito',
    emoji: h.emoji || '✅',
    section: out.sections.some((s) => s.id === h.section) ? h.section : firstSection,
    description: h.description || '',
    time: cleanTime(h.time),
    order: h.order ?? i,
    archived: !!h.archived,
    createdAt: h.createdAt || todayKey(),
  })) : out.habits;

  out.days = data.days && typeof data.days === 'object' ? data.days : {};
  for (const k of Object.keys(out.days)) {
    const d = { ...emptyDay(), ...out.days[k], habits: { ...(out.days[k].habits || {}) } };
    d.tasks = (Array.isArray(d.tasks) ? d.tasks : [])
      .map((t) => ({ id: t.id || uid(), text: String(t.text || '').trim(), done: !!t.done }))
      .filter((t) => t.text);
    d.events = (Array.isArray(d.events) ? d.events : [])
      .map((e) => ({ id: e.id || uid(), title: String(e.title || '').trim(), start: cleanTime(e.start), end: cleanTime(e.end) }))
      .filter((e) => e.title);
    out.days[k] = d;
  }

  out.months = data.months && typeof data.months === 'object' ? data.months : {};
  for (const k of Object.keys(out.months)) {
    const m = { ...emptyMonth(), ...out.months[k] };
    m.goals = (Array.isArray(m.goals) ? m.goals : []).map((g) => ({
      id: g.id || uid(),
      text: String(g.text || ''),
      status: GOAL_STATUSES.includes(g.status) ? g.status : 'pending',
      note: String(g.note || ''),
    }));
    out.months[k] = m;
  }

  out.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  delete out.exportedAt;
  return out;
}

// ---------- Carga y guardado ----------
// Red de seguridad: lo guardado no se pisa sin dejar copia.
// - Si los datos vienen de otra versión de la app, antes de adaptarlos se guarda una copia tal cual
//   (`:copia`), por si la actualización trajera algún fallo.
// - Si no se pueden leer, se apartan en `:rescate` y la app arranca en blanco; ahí se quedan hasta
//   que se descarguen o se descarten desde Ajustes. Si ni siquiera se pueden apartar, no se guarda
//   nada para no pisarlos.
const BACKUP_KEY = `${STORAGE_KEY}:copia`;
const RESCUE_KEY = `${STORAGE_KEY}:rescate`;
let readOnly = false;
export let rescuedOnLoad = false;

const stamp = (raw, version) => ({ savedAt: new Date().toISOString(), version, raw });

function readRescues() {
  try {
    const list = JSON.parse(localStorage.getItem(RESCUE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('No se pudo leer el almacenamiento', e);
    return defaultState();
  }
  if (!raw) return defaultState();

  let version = null;
  try {
    const data = JSON.parse(raw);
    version = Number(data?.version) || 1;
    if (version !== DATA_VERSION) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(stamp(raw, version)));
      } catch (e) {
        console.warn('No se pudo guardar la copia previa a la actualización', e);
      }
    }
    return migrate(data);
  } catch (e) {
    console.warn('No se pudieron leer los datos guardados; se apartan sin tocarlos', e);
    try {
      const rescues = readRescues();
      // Si ya estaban apartados (se ha recargado sin tocar nada), no se duplican.
      if (!rescues.some((r) => r.raw === raw)) {
        localStorage.setItem(RESCUE_KEY, JSON.stringify([...rescues, stamp(raw, version)]));
      }
      rescuedOnLoad = true;
    } catch {
      readOnly = true;
    }
    return defaultState();
  }
}

// Pide al navegador que no borre estos datos cuando ande justo de espacio (Safari, sobre todo).
try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch { /* sin soporte */ }

// Copias que guarda la red de seguridad, para descargarlas o descartarlas desde Ajustes.
export function safetyCopies() {
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch { /* ilegible */ }
  return { backup, rescues: readRescues(), readOnly };
}

export function discardSafetyCopy(kind) {
  try { localStorage.removeItem(kind === 'rescue' ? RESCUE_KEY : BACKUP_KEY); } catch { /* sin acceso */ }
}

let state = load();
const listeners = new Set();
let saveError = false;

function save() {
  if (readOnly) { saveError = true; return; }
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

// «Registro» del día: métricas, hábitos o momento memorable. Es lo que cuenta para estadísticas y rachas.
export function dayHasData(day) {
  if (!day) return false;
  return day.mood != null || day.weight != null || day.sleep != null
    || (day.memorable || '').trim() !== '' || Object.keys(day.habits || {}).length > 0;
}

// Un día se puede borrar del almacén cuando no tiene registro, ni tareas, ni eventos.
export function dayIsEmpty(day) {
  return !dayHasData(day) && !(day?.tasks || []).length && !(day?.events || []).length;
}

function tidyDay(st, key) {
  if (st.days[key] && dayIsEmpty(st.days[key])) delete st.days[key];
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

// ---------- Tareas del día ----------
export function addTask(key, text) {
  const t = (text || '').trim();
  if (!t) return;
  update((st) => { ensureDay(st, key).tasks.push({ id: uid(), text: t, done: false }); });
}

export function toggleTask(key, id) {
  update((st) => {
    const t = ensureDay(st, key).tasks.find((x) => x.id === id);
    if (t) t.done = !t.done;
  });
}

export function updateTask(key, id, text, opts) {
  update((st) => {
    const t = ensureDay(st, key).tasks.find((x) => x.id === id);
    if (t) t.text = text;
  }, opts);
}

export function removeTask(key, id) {
  update((st) => {
    const day = ensureDay(st, key);
    day.tasks = day.tasks.filter((t) => t.id !== id);
    tidyDay(st, key);
  });
}

// ---------- Eventos del día (calendario) ----------
export function addEvent(key, { title, start, end }) {
  const t = (title || '').trim();
  if (!t) return;
  update((st) => { ensureDay(st, key).events.push({ id: uid(), title: t, start: cleanTime(start), end: cleanTime(end) }); });
}

export function updateEvent(key, id, patch) {
  update((st) => {
    const e = ensureDay(st, key).events.find((x) => x.id === id);
    if (!e) return;
    if (patch.title != null) e.title = String(patch.title).trim() || e.title;
    if (patch.start !== undefined) e.start = cleanTime(patch.start);
    if (patch.end !== undefined) e.end = cleanTime(patch.end);
  });
}

export function removeEvent(key, id) {
  update((st) => {
    const day = ensureDay(st, key);
    day.events = day.events.filter((e) => e.id !== id);
    tidyDay(st, key);
  });
}

// ---------- Acciones de mes ----------
export function setMonthField(ym, field, value, opts) {
  update((st) => { ensureMonth(st, ym)[field] = value; }, opts);
}

export function addGoal(ym, text) {
  update((st) => { ensureMonth(st, ym).goals.push({ id: uid(), text, status: 'pending', note: '' }); });
}

export function updateGoal(ym, id, patch, opts) {
  update((st) => {
    const g = ensureMonth(st, ym).goals.find((x) => x.id === id);
    if (g) Object.assign(g, patch);
  }, opts);
}

// Marca Sí / Regular / No. Repetir la misma opción la desmarca (vuelve a pendiente).
export function setGoalStatus(ym, id, status) {
  const g = state.months[ym]?.goals.find((x) => x.id === id);
  if (!g) return;
  const next = g.status === status ? 'pending' : status;
  updateGoal(ym, id, { status: next, note: next === 'partial' ? g.note : '' });
}

export function removeGoal(ym, id) {
  update((st) => {
    const m = ensureMonth(st, ym);
    m.goals = m.goals.filter((g) => g.id !== id);
  });
}

// ---------- Secciones de hábitos ----------
export function addSection({ name, emoji }) {
  const id = uid();
  update((st) => {
    const order = Math.max(-1, ...st.sections.map((s) => s.order)) + 1;
    st.sections.push({ id, name: name.trim(), emoji: (emoji || '').trim() || '📌', order });
  });
  return id;
}

export function updateSection(id, patch) {
  update((st) => {
    const s = st.sections.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  });
}

export function moveSection(id, dir) {
  update((st) => {
    const list = st.sections.slice().sort((a, b) => a.order - b.order);
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((s, idx) => { s.order = idx; });
  });
}

// Elimina la sección y todos sus hábitos (con sus marcas de todos los días).
export function removeSection(id) {
  update((st) => {
    const ids = st.habits.filter((h) => h.section === id).map((h) => h.id);
    st.sections = st.sections.filter((s) => s.id !== id);
    st.habits = st.habits.filter((h) => h.section !== id);
    for (const k of Object.keys(st.days)) {
      for (const hid of ids) delete st.days[k].habits[hid];
      tidyDay(st, k);
    }
  });
}

// ---------- Acciones de hábitos ----------
export function addHabit({ name, emoji, section, description, time }) {
  update((st) => {
    const order = Math.max(-1, ...st.habits.filter((h) => h.section === section).map((h) => h.order)) + 1;
    st.habits.push({
      id: uid(), name, emoji: emoji || '✅', section, description: description || '', time: cleanTime(time), order, archived: false, createdAt: todayKey(),
    });
  });
}

export function updateHabit(id, patch) {
  update((st) => {
    const h = st.habits.find((x) => x.id === id);
    if (h) Object.assign(h, 'time' in patch ? { ...patch, time: cleanTime(patch.time) } : patch);
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
