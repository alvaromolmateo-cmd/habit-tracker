// Vista Mensual: cuadrícula de hábitos del mes, cumplimiento, metas, momentos memorables, revisión y meses anteriores.

import { getState, setMetric, cycleHabit, dayHasData, STATE_LABEL } from '../store.js';
import { activeHabits, habitsBySection, monthCompletion, habitCompletion, metricAverage, monthsWithData } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, monthNav } from '../ui.js';
import { ring, barList } from '../charts.js';
import { openDayEditor } from '../dayform.js';
import { monthDays, monthLabel, dayLabel, dayNum, isFuture, isToday, addMonths, weekdayIdx, WEEKDAYS_SHORT } from '../dates.js';
import { goalsCard, bindGoals, reviewCard, bindReview, goalSummaryLabel } from './shared.js';

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
            <tr class="hg-section"><td colspan="${span}"><span>${esc(g.section.emoji)} ${esc(g.section.name)}</span></td></tr>
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
  const mc = monthCompletion(state, ym);
  const history = monthsWithData(state).filter((m) => m !== ym).reverse();

  const items = habits.map((h) => {
    const c = habitCompletion(state, keys, h.id);
    return { emoji: h.emoji, label: h.name, pct: c.pct, value: c.pct, title: c.total ? `${fmtNum(c.done, 1)} de ${c.total} días` : 'Sin registros' };
  });

  return `
    <header class="page-head">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions"><span class="muted">${mc.days} día${mc.days === 1 ? '' : 's'} registrado${mc.days === 1 ? '' : 's'} · ${fmtPct(mc.pct)}</span></div>
    </header>

    <div class="card card-grid">
      <div class="card-head">
        <h2>${icon('grid')} Hábitos del mes</h2>
        <div class="legend">
          <span><i class="cell done"></i> Hecho</span>
          <span><i class="cell partial"></i> A medias</span>
          <span><i class="cell na"></i> No aplica</span>
          <span><i class="cell empty"></i> No hecho</span>
        </div>
      </div>
      ${groups.length ? habitGrid(state, keys, groups) : '<p class="muted">No hay hábitos activos. Añádelos en la sección Hábitos.</p>'}
      <p class="hint">Toca una casilla para cambiar su estado. Las métricas se editan pulsando sobre el día.</p>
    </div>

    <section class="grid-2">
      <div class="card card-ring">
        <div class="card-head"><h2>${icon('check-circle')} Cumplimiento de hábitos</h2></div>
        <div class="ring-row">
          ${ring({ pct: mc.pct, sub: mc.total ? `${fmtNum(mc.done, 1)} de ${mc.total}` : 'sin datos' })}
          ${barList(items)}
        </div>
      </div>
      <div class="col">
        ${goalsCard(state, ym)}
        ${reviewCard(state, ym)}
      </div>
    </section>

    <div class="card card-memos">
      <div class="card-head"><h2>${icon('feather')} Momentos memorables</h2><span class="muted">Una línea por día</span></div>
      <div class="memo-rows">
        ${keys.map((k) => {
          const fut = isFuture(k);
          return `
            <div class="memo-row ${fut ? 'is-future' : ''}">
              <span class="memo-day"><b>${dayNum(k)}</b><small>${WEEKDAYS_SHORT[weekdayIdx(k)]}</small></span>
              <input class="memo-input" data-memo="${k}" value="${esc(state.days[k]?.memorable || '')}" maxlength="200" placeholder="${fut ? '' : '…'}" ${fut ? 'disabled' : ''} aria-label="Momento memorable del día ${dayNum(k)}">
            </div>`;
        }).join('')}
      </div>
    </div>

    ${history.length ? `
      <div class="card">
        <div class="card-head"><h2>${icon('book')} Meses anteriores</h2></div>
        <div class="history">
          ${history.map((m) => {
            const hmc = monthCompletion(state, m);
            const mood = metricAverage(state, monthDays(m), 'mood');
            const info = state.months[m] || {};
            return `
              <button type="button" class="history-item" data-goto="${m}">
                <span class="history-month">${esc(monthLabel(m))}</span>
                <span class="history-stats">
                  <span>Calificación <b>${info.rating != null ? `${info.rating}/10` : '—'}</b></span>
                  <span>Cumplimiento <b>${fmtPct(hmc.pct)}</b></span>
                  <span>Nota media <b>${mood == null ? '—' : fmtNum(mood, 1)}</b></span>
                </span>
                <span class="history-stats"><span>Metas: ${esc(goalSummaryLabel(info.goals || []))}</span></span>
                ${info.improve ? `<span class="history-improve">${esc(info.improve)}</span>` : ''}
              </button>`;
          }).join('')}
        </div>
      </div>` : ''}`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { ctx.setMonth(b.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  root.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => cycleHabit(b.dataset.key, b.dataset.habit)));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDayEditor(b.dataset.open)));
  root.querySelectorAll('[data-memo]').forEach((inp) => {
    inp.addEventListener('change', () => setMetric(inp.dataset.memo, 'memorable', inp.value.trim(), { silent: true }));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = inp.closest('.memo-row')?.nextElementSibling?.querySelector('input:not([disabled])');
        next ? next.focus() : inp.blur();
      }
    });
  });
  bindGoals(root, ctx.month);
  bindReview(root, ctx.month);
}
