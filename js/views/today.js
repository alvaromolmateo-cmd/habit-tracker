// Vista principal: resumen del mes, registro de hoy, cuadrícula de hábitos y gráficas.

import { getState, cycleHabit, dayHasData, STATE_LABEL } from '../store.js';
import { activeHabits, habitsBySection, monthCompletion, habitCompletion, currentStreak, metricAverage, weightSummary } from '../stats.js';
import { esc, icon, fmtNum, fmtDelta, monthNav, progressBar } from '../ui.js';
import { chart, ring, barList } from '../charts.js';
import { dayFormHTML, bindDayForm, openDayEditor } from '../dayform.js';
import { monthDays, todayKey, monthOf, monthLabel, dayLabel, dayNum, weekdayIdx, WEEKDAYS_SHORT, isFuture, isToday, currentMonth, addMonths } from '../dates.js';
import { goalsCard, bindGoals, reviewCard, bindReview } from './shared.js';

const METRICS = {
  weight: { label: 'Peso (kg)', field: 'weight', unit: 'kg', decimals: 1 },
  sleep: { label: 'Sueño (h)', field: 'sleep', unit: 'h', decimals: 1 },
  mood: { label: 'Nota del día', field: 'mood', unit: '', decimals: 1, domain: [0, 10] },
};

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

function habitGrid(state, keys, groups) {
  const head = keys.map((k) => {
    const wd = weekdayIdx(k);
    return `<th class="${isToday(k) ? 'is-today' : ''} ${wd >= 5 ? 'is-we' : ''}"><span class="hg-dow">${WEEKDAYS_SHORT[wd]}</span><span class="hg-day">${dayNum(k)}</span></th>`;
  }).join('');

  const metricRow = (label, field) => `
    <tr class="hg-metric">
      <td class="hg-name">${label}</td>
      ${keys.map((k) => {
        const v = state.days[k]?.[field];
        return `<td class="${isToday(k) ? 'is-today' : ''}"><button type="button" class="mcell" data-open="${k}" title="${esc(dayLabel(k))}">${v == null ? '' : fmtNum(v, 1)}</button></td>`;
      }).join('')}
      <td class="hg-pct">${fmtNum(metricAverage(state, keys, field), 1)}</td>
    </tr>`;

  const habitRow = (h) => {
    const c = habitCompletion(state, keys, h.id);
    return `
      <tr>
        <td class="hg-name"><span class="hg-emoji">${esc(h.emoji)}</span>${esc(h.name)}</td>
        ${keys.map((k) => {
          const day = state.days[k];
          const s = day?.habits?.[h.id] || '';
          const cls = s || (isFuture(k) ? 'future' : dayHasData(day) ? 'empty' : 'nolog');
          return `<td class="${isToday(k) ? 'is-today' : ''}"><button type="button" class="cell ${cls}" data-cell data-key="${k}" data-habit="${h.id}" aria-label="${esc(h.name)}, día ${dayNum(k)}: ${STATE_LABEL[s] || 'sin marcar'}"></button></td>`;
        }).join('')}
        <td class="hg-pct">${c.pct == null ? '—' : `${c.pct}%`}</td>
      </tr>`;
  };

  const span = keys.length + 2;
  return `
    <div class="hgrid-wrap" data-scroll-key="hgrid">
      <table class="hgrid">
        <thead><tr><th class="hg-name">Hábito</th>${head}<th class="hg-pct">%</th></tr></thead>
        <tbody>
          <tr class="hg-section"><td colspan="${span}"><span>📈 Métricas</span></td></tr>
          ${metricRow('🙂 Nota del día', 'mood')}
          ${metricRow('⚖️ Peso (kg)', 'weight')}
          ${metricRow('😴 Sueño (h)', 'sleep')}
          ${groups.map((g) => `
            <tr class="hg-section"><td colspan="${span}"><span>${g.section.emoji} ${esc(g.section.name)}</span></td></tr>
            ${g.habits.map(habitRow).join('')}`).join('')}
        </tbody>
      </table>
    </div>`;
}

export function render(ctx) {
  const state = getState();
  const ym = ctx.month;
  const keys = monthDays(ym);
  const habits = activeHabits(state);
  const groups = habitsBySection(state);
  const tk = todayKey();
  const mc = monthCompletion(state, ym);
  const streak = currentStreak(state);
  const mood = metricAverage(state, keys, 'mood');
  const sleep = metricAverage(state, keys, 'sleep');
  const w = weightSummary(state, keys);
  const goal = state.settings.weightGoal;
  const name = (state.settings.name || '').trim();

  const m = METRICS[ctx.chartMetric] || METRICS.weight;
  const points = keys.map((k) => ({ label: String(dayNum(k)), full: dayLabel(k), value: state.days[k]?.[m.field] ?? null }));
  const goalValue = m.field === 'weight' ? state.settings.weightGoal : m.field === 'sleep' ? state.settings.sleepGoal : null;
  const spec = { points, unit: m.unit, decimals: m.decimals, goal: goalValue ?? null, goalLabel: 'Objetivo', domain: m.domain || null, title: m.label, height: 220, empty: `Sin datos de ${m.label.toLowerCase()} este mes` };

  const items = habits.map((h) => {
    const c = habitCompletion(state, keys, h.id);
    return { emoji: h.emoji, label: h.name, pct: c.pct, value: c.pct, title: c.total ? `${fmtNum(c.done, 1)} de ${c.total} días` : 'Sin registros' };
  });

  const memos = keys.filter((k) => (state.days[k]?.memorable || '').trim()).slice(-6).reverse();
  const weightSub = w.count
    ? `${fmtNum(w.first, 1)} → ${fmtNum(w.last, 1)} kg${goal ? ` · objetivo ${fmtNum(goal, 1)}` : ''}`
    : 'Sin pesajes este mes';
  const weightValue = w.delta != null ? fmtDelta(w.delta, 'kg') : w.last != null ? `${fmtNum(w.last, 1)} <small>kg</small>` : '—';

  return `
    <header class="page-head">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions">
        ${ctx.standalone ? `<span class="badge">${icon('check-circle')} PWA instalada</span>` : ''}
        <button class="btn btn-primary" data-today>${icon('plus')} Registrar hoy</button>
      </div>
    </header>

    <section class="tiles">
      ${tile('flame', 'Racha actual', `${streak} <small>${streak === 1 ? 'día' : 'días'}</small>`, streak >= 3 ? '¡Sigue así!' : 'Cada día cuenta', 'green')}
      ${tile('target', 'Cumplimiento', mc.pct == null ? '—' : `${mc.pct}%`, mc.total ? `${fmtNum(mc.done, 1)} de ${mc.total} hábitos${progressBar(mc.pct, 'sm')}` : 'Sin registros este mes', 'orange')}
      ${tile('smile', 'Ánimo medio', mood == null ? '—' : `${fmtNum(mood, 1)} <small>/ 10</small>`, mood == null ? 'Sin notas todavía' : (sleep == null ? 'Sin datos de sueño' : `Sueño medio ${fmtNum(sleep, 1)} h`), 'red')}
      ${tile('scale', 'Peso', weightValue, weightSub, 'blue')}
    </section>

    <section class="grid-main">
      <div class="card card-today" id="today-card">
        <div class="card-head">
          <h2>${icon('sun')} Hoy · ${esc(dayLabel(tk))}</h2>
          <span class="muted">${name ? `Hola, ${esc(name)}` : ''}</span>
        </div>
        ${dayFormHTML(state, tk)}
      </div>

      <div class="card card-chart">
        <div class="card-head">
          <h2>Evolución diaria</h2>
          <select class="select" data-chart-metric aria-label="Métrica de la gráfica">
            ${Object.entries(METRICS).map(([k, v]) => `<option value="${k}" ${k === ctx.chartMetric ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
        </div>
        ${chart('line', spec)}
      </div>

      <div class="card card-grid">
        <div class="card-head">
          <h2>Hábitos del mes</h2>
          <div class="legend">
            <span><i class="cell done"></i> Hecho</span>
            <span><i class="cell partial"></i> A medias</span>
            <span><i class="cell na"></i> No aplica</span>
            <span><i class="cell empty"></i> No hecho</span>
          </div>
        </div>
        ${habitGrid(state, keys, groups)}
        <p class="hint">Toca una casilla para cambiar su estado. Las métricas se editan pulsando sobre el día.</p>
      </div>

      <div class="card card-ring">
        <div class="card-head"><h2>Cumplimiento de hábitos</h2></div>
        <div class="ring-row">
          ${ring({ pct: mc.pct, sub: mc.total ? `${fmtNum(mc.done, 1)} de ${mc.total}` : 'sin datos' })}
          ${barList(items)}
        </div>
      </div>

      ${goalsCard(state, ym)}

      <div class="card card-memo">
        <div class="card-head">
          <h2>${icon('feather')} Momentos memorables</h2>
          <a class="link" href="#/reflexiones">Ver el mes</a>
        </div>
        ${memos.length ? `<ul class="memo-preview">${memos.map((k) => `
          <li><button type="button" data-open="${k}"><b>${dayNum(k)}</b><span>${esc(state.days[k].memorable)}</span></button></li>`).join('')}</ul>`
          : `<p class="muted">Todavía no has escrito ningún momento este mes. Una línea por día basta.</p>`}
      </div>

      ${reviewCard(state, ym)}
    </section>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelector('[data-today]')?.addEventListener('click', () => {
    if (ctx.month !== monthOf(todayKey())) ctx.setMonth(currentMonth());
    requestAnimationFrame(() => document.getElementById('today-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });
  root.querySelector('[data-chart-metric]')?.addEventListener('change', (e) => ctx.set('chartMetric', e.target.value));
  root.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => cycleHabit(b.dataset.key, b.dataset.habit)));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDayEditor(b.dataset.open)));
  bindDayForm(root);
  bindGoals(root, ctx.month);
  bindReview(root, ctx.month);
}
