// Reflexiones: metas del mes, un momento memorable por día, calificación y qué mejorar. Como la página izquierda de la libreta.

import { getState, setMetric } from '../store.js';
import { monthCompletion, metricAverage, monthsWithData } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, monthNav } from '../ui.js';
import { monthDays, monthLabel, dayNum, isFuture, addMonths, weekdayIdx, WEEKDAYS_SHORT } from '../dates.js';
import { goalsCard, bindGoals, reviewCard, bindReview } from './shared.js';

export function render(ctx) {
  const state = getState();
  const ym = ctx.month;
  const keys = monthDays(ym);
  const history = monthsWithData(state).filter((m) => m !== ym).reverse();

  return `
    <header class="page-head">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions"><span class="muted hand">${esc(state.settings.motto || '')}</span></div>
    </header>

    <section class="grid-2">
      <div class="col">
        ${goalsCard(state, ym, { editable: true })}
        ${reviewCard(state, ym)}
      </div>
      <div class="card card-memos">
        <div class="card-head"><h2>${icon('feather')} Momento memorable del día</h2><span class="muted">Una línea por día</span></div>
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
    </section>

    ${history.length ? `
      <div class="card">
        <div class="card-head"><h2>${icon('book')} Meses anteriores</h2></div>
        <div class="history">
          ${history.map((m) => {
            const mc = monthCompletion(state, m);
            const mood = metricAverage(state, monthDays(m), 'mood');
            const info = state.months[m] || {};
            return `
              <button type="button" class="history-item" data-goto="${m}">
                <span class="history-month">${esc(monthLabel(m))}</span>
                <span class="history-stats">
                  <span>Nota <b>${info.rating != null ? `${info.rating}/10` : '—'}</b></span>
                  <span>Cumplimiento <b>${fmtPct(mc.pct)}</b></span>
                  <span>Ánimo <b>${mood == null ? '—' : fmtNum(mood, 1)}</b></span>
                  <span>Metas <b>${(info.goals || []).filter((g) => g.status === 'done').length}/${(info.goals || []).length}</b></span>
                </span>
                ${info.improve ? `<span class="history-improve">${esc(info.improve)}</span>` : ''}
              </button>`;
          }).join('')}
        </div>
      </div>` : ''}`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { ctx.setMonth(b.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
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
