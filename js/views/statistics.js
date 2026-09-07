// Estadísticas: cumplimiento por hábito, rachas, evolución de peso / sueño / ánimo, medias por día de la semana y mapa anual.

import { getState } from '../store.js';
import { activeHabits, aggregateCompletion, habitCompletion, habitStreaks, currentStreak, bestStreak, metricAverage, weightSummary, latestWeight, completionByWeekday, metricByWeekday, yearCompletion, yearsWithData, loggedDays } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, fmtDelta } from '../ui.js';
import { chart, barList, dataTable } from '../charts.js';
import { todayKey, currentMonth, monthDays, addDays, rangeDays, dayLabel, dayLabelShort, dayNum, WEEKDAYS_SHORT, WEEKDAYS, cap } from '../dates.js';

const RANGES = [['mes', 'Este mes'], ['3m', '3 meses'], ['6m', '6 meses'], ['year', '12 meses'], ['all', 'Todo']];

function rangeKeys(state, range) {
  const tk = todayKey();
  if (range === 'mes') return monthDays(currentMonth()).filter((k) => k <= tk);
  const days = { '3m': 90, '6m': 180, year: 365 }[range];
  if (days) return rangeDays(addDays(tk, -(days - 1)), tk);
  const logged = loggedDays(state);
  return rangeDays(logged[0] || tk, tk);
}

function stat(label, value, sub = '') {
  return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
}

function lineCard(title, ic, state, keys, field, unit, goal, domain) {
  const long = keys.length > 31;
  const points = keys.map((k) => ({ label: long ? dayLabelShort(k) : String(dayNum(k)), full: dayLabel(k), value: state.days[k]?.[field] ?? null }));
  const present = points.filter((p) => p.value != null);
  const avg = metricAverage(state, keys, field);
  return `
    <div class="card">
      <div class="card-head"><h2>${icon(ic)} ${title}</h2><span class="muted">${present.length ? `media ${fmtNum(avg, 1)}${unit ? ' ' + unit : ''} · ${present.length} registros` : ''}</span></div>
      ${chart('line', { points, unit, decimals: 1, goal: goal ?? null, goalLabel: 'Objetivo', domain: domain || null, title, height: 200, empty: `Sin datos de ${title.toLowerCase()} en este periodo` })}
      ${dataTable(present.map((p) => [p.full, `${fmtNum(p.value, 1)}${unit ? ' ' + unit : ''}`]), ['Día', title])}
    </div>`;
}

export function render(ctx) {
  const state = getState();
  const keys = rangeKeys(state, ctx.statsRange);
  const habits = activeHabits(state);
  const agg = aggregateCompletion(state, keys);
  const streak = currentStreak(state);
  const best = bestStreak(state);
  const mood = metricAverage(state, keys, 'mood');
  const sleep = metricAverage(state, keys, 'sleep');
  const w = weightSummary(state, keys);
  const lw = latestWeight(state);
  const goal = state.settings.weightGoal;

  const items = habits
    .map((h) => { const c = habitCompletion(state, keys, h.id); return { emoji: h.emoji, label: h.name, pct: c.pct, value: c.pct, title: c.total ? `${fmtNum(c.done, 1)} de ${c.total} días` : 'Sin registros' }; })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  const streaks = habits.map((h) => ({ h, s: habitStreaks(state, h.id) })).sort((a, b) => b.s.current - a.s.current || b.s.best - a.s.best);

  const byWd = completionByWeekday(state, keys);
  const sleepWd = metricByWeekday(state, keys, 'sleep');
  const moodWd = metricByWeekday(state, keys, 'mood');
  const wdItems = (vals) => vals.map((v, i) => ({ label: WEEKDAYS_SHORT[i], full: cap(WEEKDAYS[i]), value: v == null ? null : Math.round(v * 10) / 10 }));

  const years = yearsWithData(state);
  const year = years.includes(ctx.statsYear) ? ctx.statsYear : years[years.length - 1];
  const heat = yearCompletion(state, year);

  return `
    <header class="page-head">
      <h1>Estadísticas</h1>
      <div class="seg" role="group" aria-label="Periodo">
        ${RANGES.map(([v, l]) => `<button type="button" class="seg-btn ${ctx.statsRange === v ? 'on' : ''}" data-range="${v}">${l}</button>`).join('')}
      </div>
    </header>

    <section class="stats-row">
      ${stat('Cumplimiento medio', fmtPct(agg.pct), agg.total ? `${fmtNum(agg.done, 1)} de ${agg.total} hábitos` : 'Sin registros')}
      ${stat('Días registrados', String(agg.days), `de ${keys.length} en el periodo`)}
      ${stat('Racha actual', `${streak} <small>${streak === 1 ? 'día' : 'días'}</small>`, `mejor racha: ${best}`)}
      ${stat('Ánimo medio', mood == null ? '—' : `${fmtNum(mood, 1)} <small>/ 10</small>`)}
      ${stat('Sueño medio', sleep == null ? '—' : `${fmtNum(sleep, 1)} <small>h</small>`, state.settings.sleepGoal ? `objetivo ${fmtNum(state.settings.sleepGoal, 1)} h` : '')}
      ${stat('Peso', lw ? `${fmtNum(lw.value, 1)} <small>kg</small>` : '—', w.delta != null ? `${fmtDelta(w.delta, 'kg')} en el periodo${goal ? ` · objetivo ${fmtNum(goal, 1)}` : ''}` : (goal ? `objetivo ${fmtNum(goal, 1)} kg` : ''))}
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head"><h2>${icon('check-circle')} Cumplimiento por hábito</h2></div>
        ${barList(items)}
      </div>
      <div class="card">
        <div class="card-head"><h2>${icon('flame')} Rachas</h2><span class="muted">días seguidos hechos</span></div>
        ${streaks.length ? `
          <div class="tbl-wrap"><table class="tbl streaks">
            <thead><tr><th>Hábito</th><th>Actual</th><th>Mejor</th></tr></thead>
            <tbody>${streaks.map(({ h, s }) => `<tr><td>${esc(h.emoji)} ${esc(h.name)}</td><td>${s.current}</td><td>${s.best}</td></tr>`).join('')}</tbody>
          </table></div>` : '<p class="muted">Sin hábitos activos.</p>'}
      </div>
    </section>

    <section class="grid-2">
      ${lineCard('Peso', 'scale', state, keys, 'weight', 'kg', goal)}
      ${lineCard('Sueño', 'moon', state, keys, 'sleep', 'h', state.settings.sleepGoal)}
    </section>
    <section class="grid-2">
      ${lineCard('Nota del día', 'smile', state, keys, 'mood', '', null, [0, 10])}
      <div class="card">
        <div class="card-head"><h2>${icon('calendar')} Por día de la semana</h2></div>
        <h3 class="sub-h">Cumplimiento</h3>
        ${chart('bars', { items: wdItems(byWd), unit: '%', decimals: 0, max: 100, height: 150, showValues: true, title: 'Cumplimiento por día de la semana' })}
        <h3 class="sub-h">Sueño (h)</h3>
        ${chart('bars', { items: wdItems(sleepWd), unit: 'h', decimals: 1, height: 150, showValues: true, color: 'var(--series-2)', title: 'Sueño por día de la semana' })}
        <h3 class="sub-h">Nota del día</h3>
        ${chart('bars', { items: wdItems(moodWd), unit: '', decimals: 1, max: 10, height: 150, showValues: true, color: 'var(--series-3)', title: 'Nota por día de la semana' })}
      </div>
    </section>

    <div class="card">
      <div class="card-head">
        <h2>${icon('chart')} Mapa del año</h2>
        <div class="seg sm" role="group" aria-label="Año">
          ${years.map((y) => `<button type="button" class="seg-btn ${y === year ? 'on' : ''}" data-year="${y}">${y}</button>`).join('')}
        </div>
      </div>
      ${chart('heatmap', { year, data: heat })}
      <div class="heat-legend"><span>Menos</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>Más</span><span class="muted">· cumplimiento diario</span></div>
    </div>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => ctx.set('statsRange', b.dataset.range)));
  root.querySelectorAll('[data-year]').forEach((b) => b.addEventListener('click', () => ctx.set('statsYear', Number(b.dataset.year))));
}
