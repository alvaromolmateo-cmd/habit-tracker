// Calendario mensual: cada día muestra su cumplimiento y abre el editor del día.

import { getState } from '../store.js';
import { dayCompletion, monthCompletion } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, monthNav } from '../ui.js';
import { openDayEditor } from '../dayform.js';
import { monthDays, monthLabel, dayLabel, dayNum, weekdayIdx, WEEKDAYS_SHORT, isFuture, isToday, addMonths } from '../dates.js';

export function render(ctx) {
  const state = getState();
  const ym = ctx.month;
  const keys = monthDays(ym);
  const offset = weekdayIdx(keys[0]);
  const mc = monthCompletion(state, ym);

  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push('<div class="cal-blank"></div>');
  for (const k of keys) {
    const day = state.days[k];
    const c = dayCompletion(state, k);
    const cls = [isToday(k) ? 'is-today' : '', isFuture(k) ? 'is-future' : '', c ? 'has-data' : ''].join(' ');
    cells.push(`
      <button type="button" class="cal-day ${cls}" data-open="${k}" aria-label="${esc(dayLabel(k))}${c ? `, ${c.pct}% de hábitos` : ''}">
        <span class="cal-top">
          <span class="cal-num">${dayNum(k)}</span>
          ${c ? `<span class="cal-ring" style="--p:${c.pct}"><span>${c.pct}</span></span>` : ''}
        </span>
        <span class="cal-meta">
          ${day?.mood != null ? `<span>🙂 ${fmtNum(day.mood, 1)}</span>` : ''}
          ${day?.weight != null ? `<span>⚖️ ${fmtNum(day.weight, 1)}</span>` : ''}
          ${day?.sleep != null ? `<span>😴 ${fmtNum(day.sleep, 1)} h</span>` : ''}
        </span>
        ${day?.memorable ? `<span class="cal-memo">${esc(day.memorable)}</span>` : ''}
      </button>`);
  }

  const memos = keys.filter((k) => (state.days[k]?.memorable || '').trim());

  return `
    <header class="page-head">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions"><span class="muted">${mc.days} día${mc.days === 1 ? '' : 's'} registrado${mc.days === 1 ? '' : 's'} · ${fmtPct(mc.pct)}</span></div>
    </header>

    <div class="card">
      <div class="cal-head">${WEEKDAYS_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <p class="hint">Pulsa un día para registrar o editar sus hábitos, nota, peso, sueño y momento memorable.</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('feather')} Momentos memorables de ${esc(monthLabel(ym).toLowerCase())}</h2></div>
      ${memos.length
        ? `<ol class="memo-list">${memos.map((k) => `<li><button type="button" data-open="${k}"><b>${dayNum(k)}</b><span>${esc(state.days[k].memorable)}</span></button></li>`).join('')}</ol>`
        : '<p class="muted">Todavía no hay momentos escritos este mes.</p>'}
    </div>`;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDayEditor(b.dataset.open)));
}
