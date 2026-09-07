// Cálculos: cumplimiento, rachas, medias y series para las gráficas.

import { SECTIONS, dayHasData } from './store.js';
import { monthDays, todayKey, addDays, weekdayIdx, rangeDays, yearOf, monthOf } from './dates.js';

export const SCORE = { done: 1, partial: 0.5 };

const sectionIdx = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]));

export function activeHabits(state) {
  return state.habits
    .filter((h) => !h.archived)
    .sort((a, b) => sectionIdx[a.section] - sectionIdx[b.section] || a.order - b.order);
}

export function habitsBySection(state, { includeArchived = false } = {}) {
  const list = includeArchived
    ? state.habits.slice().sort((a, b) => sectionIdx[a.section] - sectionIdx[b.section] || a.order - b.order)
    : activeHabits(state);
  return SECTIONS
    .map((section) => ({ section, habits: list.filter((h) => h.section === section.id) }))
    .filter((g) => g.habits.length);
}

export function loggedDays(state) {
  return Object.keys(state.days).filter((k) => dayHasData(state.days[k])).sort();
}

// Cumplimiento de un día. null si el día no tiene ningún registro.
export function dayCompletion(state, key, habits = activeHabits(state)) {
  const day = state.days[key];
  if (!dayHasData(day)) return null;
  let done = 0;
  let total = 0;
  for (const h of habits) {
    const s = day.habits[h.id];
    if (s === 'na') continue;
    total += 1;
    done += SCORE[s] || 0;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function aggregateCompletion(state, keys, habits = activeHabits(state)) {
  let done = 0;
  let total = 0;
  let days = 0;
  for (const k of keys) {
    const c = dayCompletion(state, k, habits);
    if (!c) continue;
    days += 1;
    done += c.done;
    total += c.total;
  }
  return { done, total, days, pct: total ? Math.round((done / total) * 100) : null };
}

export const monthCompletion = (state, ym) => aggregateCompletion(state, monthDays(ym));

export function habitCompletion(state, keys, habitId) {
  let done = 0;
  let total = 0;
  for (const k of keys) {
    const day = state.days[k];
    if (!dayHasData(day)) continue;
    const s = day.habits[habitId];
    if (s === 'na') continue;
    total += 1;
    done += SCORE[s] || 0;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : null };
}

export const metricSeries = (state, keys, field) => keys.map((k) => ({ key: k, value: state.days[k]?.[field] ?? null }));

export function average(values) {
  const v = values.filter((x) => x != null && !Number.isNaN(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export const metricAverage = (state, keys, field) => average(keys.map((k) => state.days[k]?.[field] ?? null));

export function weightSummary(state, keys) {
  const pts = keys.map((k) => ({ key: k, value: state.days[k]?.weight })).filter((p) => p.value != null);
  if (!pts.length) return { first: null, last: null, delta: null, count: 0 };
  const first = pts[0];
  const last = pts[pts.length - 1];
  return {
    first: first.value, last: last.value, firstKey: first.key, lastKey: last.key,
    delta: pts.length > 1 ? last.value - first.value : null, count: pts.length,
  };
}

export function latestWeight(state) {
  const keys = loggedDays(state).reverse();
  for (const k of keys) if (state.days[k].weight != null) return { key: k, value: state.days[k].weight };
  return null;
}

// Racha global: días consecutivos con cumplimiento >= umbral, terminando hoy (o ayer si hoy aún no se ha registrado).
export function currentStreak(state) {
  const th = state.settings.dayThreshold ?? 70;
  let k = todayKey();
  if (!dayCompletion(state, k)) k = addDays(k, -1);
  let n = 0;
  while (n < 5000) {
    const c = dayCompletion(state, k);
    if (!c || c.pct < th) break;
    n += 1;
    k = addDays(k, -1);
  }
  return n;
}

export function bestStreak(state) {
  const th = state.settings.dayThreshold ?? 70;
  const logged = loggedDays(state);
  if (!logged.length) return 0;
  let best = 0;
  let run = 0;
  for (const k of rangeDays(logged[0], todayKey())) {
    const c = dayCompletion(state, k);
    if (c && c.pct >= th) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

// Rachas por hábito: días consecutivos con 'done' ('na' no rompe ni suma; un día sin marca rompe).
export function habitStreaks(state, habitId) {
  const stateOf = (k) => state.days[k]?.habits?.[habitId];
  let k = todayKey();
  const todayState = stateOf(k);
  if (!todayState || todayState === 'na') k = addDays(k, -1);
  let current = 0;
  for (let i = 0; i < 5000; i += 1) {
    const s = stateOf(k);
    if (s === 'done') current += 1;
    else if (s !== 'na') break;
    k = addDays(k, -1);
  }
  const logged = loggedDays(state);
  let best = 0;
  let run = 0;
  if (logged.length) {
    for (const d of rangeDays(logged[0], todayKey())) {
      const s = stateOf(d);
      if (s === 'done') {
        run += 1;
        best = Math.max(best, run);
      } else if (s !== 'na') run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

export function completionByWeekday(state, keys) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const k of keys) {
    const c = dayCompletion(state, k);
    if (c) buckets[weekdayIdx(k)].push(c.pct);
  }
  return buckets.map(average);
}

export function metricByWeekday(state, keys, field) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const k of keys) {
    const v = state.days[k]?.[field];
    if (v != null) buckets[weekdayIdx(k)].push(v);
  }
  return buckets.map(average);
}

export function yearCompletion(state, year) {
  const out = {};
  for (const k of loggedDays(state)) {
    if (yearOf(k) !== year) continue;
    const c = dayCompletion(state, k);
    if (c) out[k] = c.pct;
  }
  return out;
}

export function yearsWithData(state) {
  const years = new Set(loggedDays(state).map(yearOf));
  years.add(yearOf(todayKey()));
  return [...years].sort();
}

export function monthsWithData(state) {
  const set = new Set(loggedDays(state).map(monthOf));
  for (const ym of Object.keys(state.months)) {
    const m = state.months[ym];
    if (m.goals.length || m.rating != null || (m.improve || '').trim()) set.add(ym);
  }
  return [...set].sort();
}
