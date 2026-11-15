// Vista Mensual: cuadrícula de hábitos del mes, cumplimiento, metas, momentos memorables, revisión y meses anteriores.

import { getState, setMetric, setMemorableLate, cycleHabit, toggleTarget, dayHasData, STATE_LABEL } from '../store.js';
import { activeHabits, habitsBySection, monthCompletion, habitCompletion, metricAverage, monthsWithData, targetOutcome, TARGET_LABEL } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, monthNav } from '../ui.js';
import { ring, barList } from '../charts.js';
import { openDayEditor, lateMemoLabel } from '../dayform.js';
import { monthDays, monthLabel, dayLabel, dayNum, isFuture, isToday, addMonths, weekdayIdx, WEEKDAYS_SHORT } from '../dates.js';
import { goalsCard, bindGoals, reviewCard, bindReview, goalSummaryLabel } from './shared.js';

// Qué hace tocar una casilla: 'log' cambia su estado (hecho, a medias…) y 'target' la marca o desmarca
// como objetivo de ese día, para planificar objetivos de días pasados o futuros. Se mantiene al redibujar.
let gridMode = 'log';

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
          const tgt = day?.targets?.[h.id] ? targetOutcome(state, k, h.id) : null;
          const cls = (s || (isFuture(k) ? 'future' : dayHasData(day) ? 'empty' : 'nolog')) + (tgt ? ` target t-${tgt}` : '');
          const label = `${h.name}, día ${dayNum(k)}: ${STATE_LABEL[s] || 'sin marcar'}${tgt ? ` · objetivo del día (${TARGET_LABEL[tgt].toLowerCase()})` : ''}`;
          return `<td class="${isToday(k) ? 'is-today' : ''}"><button type="button" class="cell ${cls}" data-cell data-key="${k}" data-habit="${h.id}" aria-label="${esc(label)}" ${tgt ? `title="Objetivo del día · ${TARGET_LABEL[tgt]}"` : ''}></button></td>`;
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

    <div class="card card-grid ${gridMode === 'target' ? 'is-target-mode' : ''}">
      <div class="card-head">
        <h2>${icon('grid')} Hábitos del mes</h2>
        <div class="seg sm grid-mode" role="group" aria-label="Al tocar una casilla">
          <button type="button" class="seg-btn ${gridMode === 'log' ? 'on' : ''}" data-grid-mode="log" aria-pressed="${gridMode === 'log'}">${icon('check', 'ic-inline')} Registrar</button>
          <button type="button" class="seg-btn ${gridMode === 'target' ? 'on' : ''}" data-grid-mode="target" aria-pressed="${gridMode === 'target'}">${icon('target', 'ic-inline')} Objetivos</button>
        </div>
        <div class="legend">
          <span><i class="cell done"></i> Hecho</span>
          <span><i class="cell partial"></i> A medias</span>
          <span><i class="cell na"></i> No aplica</span>
          <span><i class="cell empty"></i> No hecho</span>
          <span><i class="cell empty target"></i> Objetivo del día</span>
          <span><i class="cell empty target t-missed"></i> Objetivo no hecho</span>
        </div>
      </div>
      ${groups.length ? habitGrid(state, keys, groups) : '<p class="muted">No hay hábitos activos. Añádelos en la sección Hábitos.</p>'}
      <p class="hint hint-log">Toca una casilla para cambiar su estado. Las métricas se editan pulsando sobre el día. Para planificar objetivos, cambia a «Objetivos».</p>
      <p class="hint hint-target">Toca una casilla para marcarla o quitarla como objetivo de ese día, también en días futuros. Si el día pasa sin registrarlo, queda como «No hecho» hasta que lo anotes.</p>
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
      <div class="card-head"><h2>${icon('feather')} Momentos memorables</h2><span class="muted">Una línea por día · ${icon('clock', 'ic-inline')} escrito más tarde</span></div>
      <div class="memo-rows">
        ${keys.map((k) => {
          const fut = isFuture(k);
          const day = state.days[k];
          return `
            <div class="memo-row ${fut ? 'is-future' : ''}">
              <span class="memo-day"><b>${dayNum(k)}</b><small>${WEEKDAYS_SHORT[weekdayIdx(k)]}</small></span>
              <input class="memo-input" data-memo="${k}" value="${esc(day?.memorable || '')}" maxlength="200" placeholder="${fut ? '' : '…'}" ${fut ? 'disabled' : ''} aria-label="Momento memorable del día ${dayNum(k)}">
              ${memoLateBtn(k, day)}
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

function memoLateBtn(k, day) {
  const late = !!day?.memorableLate;
  const has = (day?.memorable || '').trim() !== '';
  return `<button type="button" class="memo-late ${late ? 'on' : ''}" data-memo-late="${k}" ${has ? '' : 'hidden'} title="${late ? esc(lateMemoLabel(day)) : 'Marcar como escrito más tarde'}" aria-label="Escrito más tarde (día ${dayNum(k)})" aria-pressed="${late}">${icon('clock')}</button>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { ctx.setMonth(b.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  root.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => {
    if (gridMode === 'target') toggleTarget(b.dataset.key, b.dataset.habit);
    else cycleHabit(b.dataset.key, b.dataset.habit);
  }));
  // Cambiar de modo no toca los datos: solo cambia el aspecto de la tarjeta y lo que hace tocar una casilla.
  root.querySelectorAll('[data-grid-mode]').forEach((b) => b.addEventListener('click', () => {
    gridMode = b.dataset.gridMode;
    root.querySelector('.card-grid')?.classList.toggle('is-target-mode', gridMode === 'target');
    root.querySelectorAll('[data-grid-mode]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  }));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDayEditor(b.dataset.open)));
  root.querySelectorAll('[data-memo]').forEach((inp) => {
    // Se guarda sin redibujar (para no perder el foco al pasar de un día a otro) y se actualiza solo su marca.
    inp.addEventListener('change', () => {
      const k = inp.dataset.memo;
      setMetric(k, 'memorable', inp.value.trim(), { silent: true });
      inp.parentElement.querySelector('[data-memo-late]').outerHTML = memoLateBtn(k, getState().days[k]);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = inp.closest('.memo-row')?.nextElementSibling?.querySelector('input:not([disabled])');
        next ? next.focus() : inp.blur();
      }
    });
  });
  root.querySelector('.memo-rows')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-memo-late]');
    if (!b) return;
    const k = b.dataset.memoLate;
    setMemorableLate(k, !getState().days[k]?.memorableLate);
  });
  bindGoals(root, ctx.month);
  bindReview(root, ctx.month);
}
