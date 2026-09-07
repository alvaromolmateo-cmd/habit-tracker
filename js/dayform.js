// Formulario de un día (métricas + hábitos + momento memorable). Se usa en la vista Hoy y en el editor modal.

import { getState, setHabit, setMetric, emptyDay } from './store.js';
import { habitsBySection, dayCompletion } from './stats.js';
import { esc, fmtNum, openModal, refreshModal, modalHeader, icon } from './ui.js';
import { dayLabel, addDays, isToday, isFuture, parseKey, todayKey } from './dates.js';

function habitRow(h, s) {
  const btn = (state, label, glyph) => `<button type="button" class="st st-${state} ${s === state ? 'on' : ''}" data-habit="${h.id}" data-state="${state}" title="${label}" aria-label="${esc(h.name)}: ${label}" aria-pressed="${s === state}">${glyph}</button>`;
  return `
    <div class="hrow ${s ? 'is-' + s : ''}">
      <span class="hrow-emoji">${esc(h.emoji)}</span>
      <span class="hrow-name">${esc(h.name)}${h.description ? `<small>${esc(h.description)}</small>` : ''}</span>
      <div class="hstate" role="group" aria-label="${esc(h.name)}">
        ${btn('done', 'Hecho', icon('check'))}${btn('partial', 'A medias', '½')}${btn('na', 'No aplica', '—')}
      </div>
    </div>`;
}

export function dayFormHTML(state, key) {
  const day = state.days[key] || emptyDay();
  const groups = habitsBySection(state);
  const comp = dayCompletion(state, key);
  const mood = day.mood;
  return `
    <div class="dayform" data-key="${key}">
      <div class="metrics">
        <div class="metric metric-mood">
          <div class="metric-head"><label>Nota del día</label><span class="metric-value">${mood == null ? '—' : fmtNum(mood, 1)}<small>/10</small></span></div>
          <div class="mood-row">
            <input type="range" min="1" max="10" step="0.5" value="${mood ?? 5}" class="range ${mood == null ? 'unset' : ''}" data-field="mood" aria-label="Nota del día">
            <button type="button" class="icon-btn sm" data-clear="mood" title="Borrar nota" ${mood == null ? 'disabled' : ''}>${icon('x')}</button>
          </div>
        </div>
        <div class="metric-row">
          <div class="metric">
            <label for="w-${key}">Peso (kg)</label>
            <input id="w-${key}" type="number" step="0.1" min="20" max="300" inputmode="decimal" class="input" data-field="weight" value="${day.weight ?? ''}" placeholder="—">
          </div>
          <div class="metric">
            <label for="s-${key}">Sueño (h)</label>
            <input id="s-${key}" type="number" step="0.5" min="0" max="24" inputmode="decimal" class="input" data-field="sleep" value="${day.sleep ?? ''}" placeholder="—">
          </div>
        </div>
      </div>
      ${groups.length ? groups.map((g) => `
        <div class="hsection">
          <div class="hsection-title">${g.section.emoji} ${esc(g.section.name)}</div>
          ${g.habits.map((h) => habitRow(h, day.habits[h.id])).join('')}
        </div>`).join('') : '<p class="muted">No hay hábitos activos. Añádelos en la sección Hábitos.</p>'}
      <div class="metric">
        <label for="m-${key}">Momento memorable del día</label>
        <textarea id="m-${key}" class="input textarea" data-field="memorable" rows="2" placeholder="Una línea que resuma el día…">${esc(day.memorable)}</textarea>
      </div>
      <div class="dayform-foot">${comp ? `${fmtNum(comp.done, 1)} de ${comp.total} hábitos · <b>${comp.pct}%</b>` : 'Sin registros todavía'}</div>
    </div>`;
}

export function bindDayForm(root) {
  root.querySelectorAll('.dayform').forEach((form) => {
    const key = form.dataset.key;
    form.addEventListener('click', (e) => {
      const st = e.target.closest('[data-state]');
      if (st) {
        const cur = getState().days[key]?.habits?.[st.dataset.habit];
        setHabit(key, st.dataset.habit, cur === st.dataset.state ? null : st.dataset.state);
        return;
      }
      const clear = e.target.closest('[data-clear]');
      if (clear) setMetric(key, clear.dataset.clear, null);
    });
    form.addEventListener('change', (e) => {
      const f = e.target.dataset.field;
      if (!f) return;
      setMetric(key, f, e.target.value);
    });
    // La nota se guarda al soltar el deslizador; mientras se arrastra solo se actualiza el número.
    const range = form.querySelector('[data-field="mood"]');
    const valueEl = form.querySelector('.metric-mood .metric-value');
    range?.addEventListener('input', () => {
      range.classList.remove('unset');
      valueEl.innerHTML = `${fmtNum(Number(range.value), 1)}<small>/10</small>`;
    });
  });
}

// Editor modal para cualquier fecha, con navegación día anterior / siguiente.
export function openDayEditor(key, { onClose } = {}) {
  let current = key;
  openModal({
    onClose,
    render: () => {
      const sub = isToday(current) ? 'Hoy' : isFuture(current) ? 'Día futuro' : `${parseKey(current).getFullYear()}`;
      const nav = `<div class="modal-nav">
          <button class="icon-btn" data-day-nav="-1" aria-label="Día anterior">${icon('chevron-left')}</button>
          <button class="icon-btn" data-day-nav="1" aria-label="Día siguiente" ${current >= todayKey() ? 'disabled' : ''}>${icon('chevron-right')}</button>
        </div>`;
      return `${modalHeader(esc(dayLabel(current)), sub, nav)}
        <div class="modal-body">${dayFormHTML(getState(), current)}</div>`;
    },
    mount: (panel) => {
      bindDayForm(panel);
      panel.querySelectorAll('[data-day-nav]').forEach((b) => b.addEventListener('click', () => {
        current = addDays(current, Number(b.dataset.dayNav));
        refreshModal();
      }));
    },
  });
}
