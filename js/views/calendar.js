// Calendario mensual: cada día muestra su cumplimiento, sus eventos y sus tareas.
// Al pulsar un día se abre un panel (tipo agenda) con los eventos del día, las tareas y el registro de hábitos.

import { getState, emptyDay, addEvent, updateEvent, removeEvent } from '../store.js';
import { dayCompletion, monthCompletion } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, monthNav, openModal, refreshModal, modalHeader, toast } from '../ui.js';
import { openDayEditor } from '../dayform.js';
import { tasksHTML, bindTasks, taskSummary } from '../tasks.js';
import { sortedEvents, eventTimeLabel, eventDuration, timeToMin, minToTime } from '../events.js';
import { monthDays, monthLabel, dayLabel, dayNum, weekdayIdx, WEEKDAYS_SHORT, isFuture, isToday, addMonths, addDays, parseKey } from '../dates.js';

const MAX_CHIPS = 3;

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
    const events = sortedEvents(day);
    const tasks = taskSummary(state, k);
    const cls = [isToday(k) ? 'is-today' : '', isFuture(k) ? 'is-future' : '', c || events.length || tasks.total ? 'has-data' : ''].join(' ');
    const label = [dayLabel(k), c ? `${c.pct}% de hábitos` : '', events.length ? `${events.length} evento${events.length === 1 ? '' : 's'}` : '', tasks.total ? `${tasks.done} de ${tasks.total} tareas` : ''].filter(Boolean).join(', ');
    cells.push(`
      <button type="button" class="cal-day ${cls}" data-open="${k}" aria-label="${esc(label)}">
        <span class="cal-top">
          <span class="cal-num">${dayNum(k)}</span>
          ${c ? `<span class="cal-ring" style="--p:${c.pct}"><span>${c.pct}</span></span>` : ''}
        </span>
        ${events.length ? `
          <span class="cal-evs">
            ${events.slice(0, MAX_CHIPS).map((ev) => `<span class="cal-ev">${ev.start ? `<b>${ev.start}</b> ` : ''}${esc(ev.title)}</span>`).join('')}
            ${events.length > MAX_CHIPS ? `<span class="cal-more">+${events.length - MAX_CHIPS} más</span>` : ''}
          </span>
          <span class="cal-dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(events.length, 3))}</span>` : ''}
        <span class="cal-meta">
          ${tasks.total ? `<span>☑ ${tasks.done}/${tasks.total}</span>` : ''}
          ${day?.mood != null ? `<span>🙂 ${fmtNum(day.mood, 1)}</span>` : ''}
          ${day?.weight != null ? `<span>⚖️ ${fmtNum(day.weight, 1)}</span>` : ''}
          ${day?.sleep != null ? `<span>😴 ${fmtNum(day.sleep, 1)} h</span>` : ''}
        </span>
        ${day?.memorable ? `<span class="cal-memo">${esc(day.memorable)}</span>` : ''}
      </button>`);
  }

  const monthEvents = keys.flatMap((k) => sortedEvents(state.days[k]).map((ev) => ({ k, ev })));

  return `
    <header class="page-head">
      ${monthNav(monthLabel(ym))}
      <div class="page-actions"><span class="muted">${mc.days} día${mc.days === 1 ? '' : 's'} registrado${mc.days === 1 ? '' : 's'} · ${fmtPct(mc.pct)}</span></div>
    </header>

    <div class="card">
      <div class="cal-head">${WEEKDAYS_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <p class="hint">Pulsa un día para ver o añadir eventos con su horario, apuntar tareas y registrar los hábitos.</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('clock')} Eventos de ${esc(monthLabel(ym).toLowerCase())}</h2><span class="muted">${monthEvents.length ? `${monthEvents.length} evento${monthEvents.length === 1 ? '' : 's'}` : ''}</span></div>
      ${monthEvents.length
        ? `<ul class="ev-list">${monthEvents.map(({ k, ev }) => `
            <li class="ev ${isFuture(k) || isToday(k) ? '' : 'is-past'}">
              <button type="button" class="ev-main" data-open="${k}">
                <span class="ev-bar"></span>
                <span class="ev-day">${dayNum(k)} <small>${WEEKDAYS_SHORT[weekdayIdx(k)]}</small></span>
                <span class="ev-time">${esc(eventTimeLabel(ev))}</span>
                <span class="ev-title">${esc(ev.title)}</span>
              </button>
            </li>`).join('')}</ul>`
        : '<p class="muted">Todavía no hay eventos este mes. Pulsa un día del calendario para añadir uno.</p>'}
    </div>`;
}

// ---------- Panel de día (tipo agenda) ----------
export function openDayPanel(key) {
  let current = key;
  let editing = null; // id del evento que se está editando

  const render = () => {
    const state = getState();
    const day = state.days[current] || emptyDay();
    const events = sortedEvents(day);
    const c = dayCompletion(state, current);
    const ev = editing ? events.find((e) => e.id === editing) : null;
    if (editing && !ev) editing = null;
    const sub = isToday(current) ? 'Hoy' : isFuture(current) ? 'Próximamente' : String(parseKey(current).getFullYear());
    const nav = `<div class="modal-nav">
        <button class="icon-btn" data-day-nav="-1" aria-label="Día anterior">${icon('chevron-left')}</button>
        <button class="icon-btn" data-day-nav="1" aria-label="Día siguiente">${icon('chevron-right')}</button>
      </div>`;
    return `${modalHeader(esc(dayLabel(current)), sub, nav)}
      <div class="modal-body day-panel">
        <section class="dp-section">
          <h3 class="dp-title">${icon('clock')} Eventos ${events.length ? `<span class="muted">${events.length}</span>` : ''}</h3>
          ${events.length ? `<ul class="ev-list">${events.map((e) => `
            <li class="ev ${editing === e.id ? 'is-editing' : ''}">
              <button type="button" class="ev-main" data-ev-edit="${e.id}" title="Editar evento">
                <span class="ev-bar"></span>
                <span class="ev-time">${esc(eventTimeLabel(e))}${eventDuration(e) ? `<small>${esc(eventDuration(e))}</small>` : ''}</span>
                <span class="ev-title">${esc(e.title)}</span>
              </button>
              <button type="button" class="icon-btn sm danger" data-ev-del="${e.id}" title="Eliminar evento" aria-label="Eliminar evento">${icon('trash')}</button>
            </li>`).join('')}</ul>` : '<p class="muted">Sin eventos este día.</p>'}
          <form class="ev-form" data-ev-form autocomplete="off">
            <input class="input" name="title" placeholder="${ev ? 'Título del evento' : 'Nuevo evento… (p. ej. Dentista)'}" maxlength="80" required value="${esc(ev?.title || '')}" aria-label="Título del evento">
            <div class="ev-times">
              <label class="fld">Empieza<input class="input" type="time" name="start" value="${ev?.start || ''}"></label>
              <label class="fld">Termina<input class="input" type="time" name="end" value="${ev?.end || ''}"></label>
            </div>
            <div class="btn-row ev-actions">
              ${ev ? '<button type="button" class="btn" data-ev-cancel>Cancelar</button>' : ''}
              <button class="btn btn-primary" type="submit">${icon(ev ? 'check' : 'plus')} ${ev ? 'Guardar cambios' : 'Añadir evento'}</button>
            </div>
            <p class="hint">Sin horas cuenta como «todo el día». Pulsa un evento para editarlo.</p>
          </form>
        </section>

        <section class="dp-section">
          <h3 class="dp-title">${icon('list')} Tareas del día</h3>
          ${tasksHTML(state, current, { placeholder: 'Nueva tarea…', empty: 'Sin tareas este día.' })}
        </section>

        <section class="dp-section">
          <h3 class="dp-title">${icon('check-circle')} Registro del día</h3>
          ${c ? `
            <div class="review-stats">
              <span>Hábitos <b>${c.pct}%</b></span>
              <span>Nota <b>${day.mood == null ? '—' : fmtNum(day.mood, 1)}</b></span>
              <span>Peso <b>${day.weight == null ? '—' : fmtNum(day.weight, 1) + ' kg'}</b></span>
              <span>Sueño <b>${day.sleep == null ? '—' : fmtNum(day.sleep, 1) + ' h'}</b></span>
            </div>
            ${day.memorable ? `<p class="dp-memo hand">“${esc(day.memorable)}”</p>` : ''}` : `<p class="muted">${isFuture(current) ? 'Este día aún no ha llegado.' : 'Sin registro todavía.'}</p>`}
          <button type="button" class="btn" data-open-editor>${icon('edit')} ${c ? 'Editar registro' : 'Registrar hábitos, nota, peso y sueño'}</button>
        </section>
      </div>`;
  };

  openModal({
    render,
    mount: (panel) => {
      panel.querySelectorAll('[data-day-nav]').forEach((b) => b.addEventListener('click', () => {
        current = addDays(current, Number(b.dataset.dayNav));
        editing = null;
        refreshModal();
      }));
      panel.querySelectorAll('[data-ev-edit]').forEach((b) => b.addEventListener('click', () => {
        editing = editing === b.dataset.evEdit ? null : b.dataset.evEdit;
        refreshModal();
        if (editing) requestAnimationFrame(() => document.querySelector('[data-ev-form] [name="title"]')?.focus());
      }));
      panel.querySelectorAll('[data-ev-del]').forEach((b) => b.addEventListener('click', () => {
        if (editing === b.dataset.evDel) editing = null;
        removeEvent(current, b.dataset.evDel);
      }));
      panel.querySelector('[data-ev-cancel]')?.addEventListener('click', () => { editing = null; refreshModal(); });

      const form = panel.querySelector('[data-ev-form]');
      // Al fijar la hora de inicio, propone una hora de fin una hora después si no hay una válida.
      form.start.addEventListener('change', () => {
        const a = timeToMin(form.start.value);
        const b = timeToMin(form.end.value);
        if (a != null && (b == null || b <= a)) form.end.value = minToTime(a + 60);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = form.title.value.trim();
        const start = form.start.value;
        const end = form.end.value;
        if (!title) return;
        if (end && !start) { toast('Indica también la hora de inicio'); form.start.focus(); return; }
        if (start && end && timeToMin(end) <= timeToMin(start)) { toast('La hora de fin debe ser posterior a la de inicio'); form.end.focus(); return; }
        if (editing) { updateEvent(current, editing, { title, start, end }); editing = null; toast('Evento actualizado'); }
        else { addEvent(current, { title, start, end }); toast('Evento añadido'); }
      });

      bindTasks(panel);
      panel.querySelector('[data-open-editor]')?.addEventListener('click', () => {
        const back = current;
        openDayEditor(current, { onClose: () => openDayPanel(back) });
      });
    },
  });
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-month]').forEach((b) => b.addEventListener('click', () => ctx.setMonth(addMonths(ctx.month, Number(b.dataset.month)))));
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDayPanel(b.dataset.open)));
}
