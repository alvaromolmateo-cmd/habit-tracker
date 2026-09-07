// Vista Hoy: resumen, registro del día, tareas del día y gráficas del mes (peso, sueño y nota).

import { getState, emptyDay } from '../store.js';
import { monthCompletion, currentStreak, weightSummary, metricAverage } from '../stats.js';
import { esc, icon, fmtNum, fmtDelta, monthNav, progressBar } from '../ui.js';
import { chart, dataTable } from '../charts.js';
import { dayFormHTML, bindDayForm } from '../dayform.js';
import { tasksHTML, bindTasks, taskSummary } from '../tasks.js';
import { eventsListHTML } from '../events.js';
import { monthDays, todayKey, monthOf, monthLabel, dayLabel, dayNum, currentMonth, addMonths } from '../dates.js';

function tile(ic, label, value, sub, tone) {
  return `
    <div class="tile tone-${tone}">
      <div class="tile-ic">${icon(ic)}</div>
      <div class="tile-body">
        <div class="tile-label">${label}</div>
        <div class="tile-value">${value}</div>
        <div class="tile-sub">${sub}</div>
      </div>
    </div>`;
}

function chartCard(state, keys, { title, ic, field, unit, goal, domain, color }) {
  const points = keys.map((k) => ({ label: String(dayNum(k)), full: dayLabel(k), value: state.days[k]?.[field] ?? null }));
  const present = points.filter((p) => p.value != null);
  const avg = metricAverage(state, keys, field);
  return `
    <div class="card card-chart">
      <div class="card-head">
        <h2>${icon(ic)} ${title}</h2>
        <span class="muted">${present.length ? `media ${fmtNum(avg, 1)}${unit ? ' ' + unit : ''}` : ''}</span>
      </div>
      ${chart('line', { points, unit, decimals: 1, goal: goal ?? null, goalLabel: 'Objetivo', domain: domain || null, title, height: 190, color, empty: `Sin datos de ${title.toLowerCase()} este mes` })}
      ${dataTable(present.map((p) => [p.full, `${fmtNum(p.value, 1)}${unit ? ' ' + unit : ''}`]), ['Día', title])}
    </div>`;
}

export function render(ctx) {
  const state = getState();
  const ym = ctx.month;
  const keys = monthDays(ym);
  const tk = todayKey();
  const today = state.days[tk] || emptyDay();
  const mc = monthCompletion(state, ym);
  const streak = currentStreak(state);
  const w = weightSummary(state, keys);
  const goal = state.settings.weightGoal;
  const sleepGoal = state.settings.sleepGoal;
  const name = (state.settings.name || '').trim();
  const tasks = taskSummary(state, tk);

  const weightSub = w.count
    ? `${fmtNum(w.first, 1)} → ${fmtNum(w.last, 1)} kg${goal ? ` · objetivo ${fmtNum(goal, 1)}` : ''}`
    : 'Sin pesajes este mes';
  const weightValue = w.delta ? fmtDelta(w.delta, 'kg') : w.last != null ? `${fmtNum(w.last, 1)} <small>kg</small>` : '—';

  const sleepValue = today.sleep == null ? '—' : `${fmtNum(today.sleep, 1)} <small>h</small>`;
  let sleepSub = 'Sin registrar hoy';
  if (today.sleep != null) {
    if (sleepGoal) sleepSub = today.sleep >= sleepGoal ? `Objetivo de ${fmtNum(sleepGoal, 1)} h cumplido` : `${fmtDelta(today.sleep - sleepGoal, 'h')} respecto al objetivo`;
    else sleepSub = 'Horas dormidas anoche';
  }

  return `
    <header class="page-head page-head-compact">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions">
        ${ctx.standalone ? `<span class="badge badge-pwa">${icon('check-circle')} PWA instalada</span>` : ''}
        <button class="btn btn-primary" data-today>${icon('plus')}<span>Registrar<span class="btn-more"> hoy</span></span></button>
      </div>
    </header>

    <section class="tiles">
      ${tile('flame', 'Racha actual', `${streak} <small>${streak === 1 ? 'día' : 'días'}</small>`, streak >= 3 ? '¡Sigue así!' : 'Cada día cuenta', 'accent')}
      ${tile('target', 'Cumplimiento', mc.pct == null ? '—' : `${mc.pct}%`, mc.total ? `${fmtNum(mc.done, 1)} de ${mc.total} hábitos${progressBar(mc.pct, 'sm')}` : 'Sin registros este mes', 'primary')}
      ${tile('moon', 'Sueño de hoy', sleepValue, sleepSub, 'blue')}
      ${tile('scale', 'Peso', weightValue, weightSub, 'primary')}
    </section>

    <section class="grid-today">
      <div class="col">
        <div class="card card-today" id="today-card">
          <div class="card-head">
            <h2>${icon('sun')} Hoy · ${esc(dayLabel(tk))}</h2>
            <span class="muted">${name ? `Hola, ${esc(name)}` : ''}</span>
          </div>
          ${dayFormHTML(state, tk)}
        </div>
      </div>

      <div class="col">
        <div class="card card-tasks">
          <div class="card-head">
            <h2>${icon('list')} Tareas del día</h2>
            <span class="muted">${tasks.total ? `${tasks.done} de ${tasks.total} hecha${tasks.total === 1 ? '' : 's'}` : ''}</span>
          </div>
          ${tasks.total ? progressBar((tasks.done / tasks.total) * 100) : ''}
          ${tasksHTML(state, tk, { placeholder: 'Nueva tarea para hoy…', empty: 'Nada apuntado para hoy. Añade las tareas que quieras tachar.' })}
          ${eventsListHTML(state, tk) ? `
            <h3 class="sub-h">${icon('clock')} Eventos de hoy <a class="link" href="#/calendario">Calendario</a></h3>
            ${eventsListHTML(state, tk)}` : ''}
        </div>

        ${chartCard(state, keys, { title: 'Peso', ic: 'scale', field: 'weight', unit: 'kg', goal, color: 'var(--series-1)' })}
        ${chartCard(state, keys, { title: 'Sueño', ic: 'moon', field: 'sleep', unit: 'h', goal: sleepGoal, color: 'var(--series-2)' })}
        ${chartCard(state, keys, { title: 'Nota del día', ic: 'smile', field: 'mood', unit: '', domain: [0, 10], color: 'var(--series-3)' })}
      </div>
    </section>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelector('[data-today]')?.addEventListener('click', () => {
    if (ctx.month !== monthOf(todayKey())) ctx.setMonth(currentMonth());
    requestAnimationFrame(() => document.getElementById('today-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
  bindDayForm(root);
  bindTasks(root);
}
