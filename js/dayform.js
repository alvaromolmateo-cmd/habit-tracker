// Formulario de un día (métricas + hábitos con sus objetivos + momento memorable). Se usa en la vista Hoy y en el editor modal.

import { getState, setHabit, setMetric, setMemorableLate, toggleTarget, emptyDay } from './store.js';
import { habitsBySection, dayCompletion, targetOutcome, targetSummary, targetSummaryLabel, TARGET_LABEL } from './stats.js';
import { esc, fmtNum, openModal, refreshModal, modalHeader, icon } from './ui.js';
import { dayLabel, dayLabelShort, addDays, isToday, isFuture, parseKey, todayKey } from './dates.js';

// `withTime`: si algún hábito tiene hora, todas las filas reservan su hueco para que queden alineadas.
// `outcome`: si el hábito es objetivo del día, cómo ha acabado (ver targetOutcome); null si no lo es.
function habitRow(h, s, withTime, outcome) {
  const btn = (state, label, glyph) => `<button type="button" class="st st-${state} ${s === state ? 'on' : ''}" data-habit="${h.id}" data-state="${state}" title="${label}" aria-label="${esc(h.name)}: ${label}" aria-pressed="${s === state}">${glyph}</button>`;
  const tgt = !!outcome;
  return `
    <div class="hrow ${s ? 'is-' + s : ''} ${tgt ? 'is-target' : ''}">
      ${withTime ? (h.time ? `<time class="hrow-time" datetime="${esc(h.time)}">${esc(h.time)}</time>` : '<span class="hrow-time"></span>') : ''}
      <span class="hrow-emoji">${esc(h.emoji)}</span>
      <span class="hrow-name">${esc(h.name)}${h.description ? `<small>${esc(h.description)}</small>` : ''}${tgt ? `<span class="tgt-tag tgt-${outcome}">Objetivo · ${TARGET_LABEL[outcome]}</span>` : ''}</span>
      <button type="button" class="tgt ${tgt ? 'on' : ''}" data-target="${h.id}" title="${tgt ? 'Quitar como objetivo del día' : 'Marcar como objetivo del día'}" aria-label="${esc(h.name)}: objetivo del día" aria-pressed="${tgt}">${icon('target')}</button>
      <div class="hstate" role="group" aria-label="${esc(h.name)}">
        ${btn('done', 'Hecho', icon('check'))}${btn('partial', 'A medias', '½')}${btn('na', 'No aplica', '—')}
      </div>
    </div>`;
}

// Aviso de «escrito más tarde» del momento memorable (vacío si no lo es).
export function lateMemoLabel(day) {
  if (!day?.memorableLate) return '';
  return day.memorableWrittenOn ? `Escrito más tarde, el ${dayLabelShort(day.memorableWrittenOn)}` : 'Escrito más tarde';
}

export function dayFormHTML(state, key) {
  const day = state.days[key] || emptyDay();
  const groups = habitsBySection(state);
  const withTime = groups.some((g) => g.habits.some((h) => h.time));
  const comp = dayCompletion(state, key);
  const targets = targetSummary(state, key);
  const hasMemo = (day.memorable || '').trim() !== '';
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
          ${g.habits.map((h) => habitRow(h, day.habits[h.id], withTime, day.targets?.[h.id] ? targetOutcome(state, key, h.id) : null)).join('')}
        </div>`).join('') : '<p class="muted">No hay hábitos activos. Añádelos en la sección Hábitos.</p>'}
      <div class="metric">
        <div class="metric-head">
          <label for="m-${key}">Momento memorable del día</label>
          ${hasMemo ? `<button type="button" class="late-chip ${day.memorableLate ? 'on' : ''}" data-late title="Señala que este momento no se escribió el mismo día" aria-pressed="${!!day.memorableLate}">${icon('clock')}<span>${day.memorableLate ? esc(lateMemoLabel(day)) : 'Escrito más tarde'}</span></button>` : ''}
        </div>
        <textarea id="m-${key}" class="input textarea" data-field="memorable" rows="2" placeholder="Una línea que resuma el día…">${esc(day.memorable)}</textarea>
      </div>
      <div class="dayform-foot">
        <span>${comp ? `${fmtNum(comp.done, 1)} de ${comp.total} hábitos · <b>${comp.pct}%</b>` : 'Sin registros todavía'}</span>
        ${targets.total ? `<span class="tgt-foot">${icon('target')} Objetivos: ${esc(targetSummaryLabel(targets))}</span>` : ''}
      </div>
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
      const tgt = e.target.closest('[data-target]');
      if (tgt) { toggleTarget(key, tgt.dataset.target); return; }
      if (e.target.closest('[data-late]')) {
        setMemorableLate(key, !getState().days[key]?.memorableLate);
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
