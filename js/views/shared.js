// Tarjetas compartidas entre vistas: metas del mes y revisión mensual.

import { getState, emptyMonth, cycleGoal, addGoal, removeGoal, updateGoal, setMonthField } from '../store.js';
import { monthCompletion, metricAverage } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, progressBar } from '../ui.js';
import { monthDays } from '../dates.js';

export function goalsCard(state, ym, { editable = false } = {}) {
  const month = state.months[ym] || emptyMonth();
  const goals = month.goals;
  const done = goals.filter((g) => g.status === 'done').length;
  const pct = goals.length ? (done / goals.length) * 100 : 0;
  return `
    <div class="card card-goals">
      <div class="card-head">
        <h2>${icon('target')} Metas del mes</h2>
        <span class="muted">${goals.length ? `${done} de ${goals.length} completada${goals.length === 1 ? '' : 's'}` : 'Sin metas'}</span>
      </div>
      ${goals.length ? progressBar(pct) : ''}
      <ul class="goals">
        ${goals.map((g, i) => `
          <li class="goal is-${g.status}">
            <button type="button" class="goal-status" data-goal-cycle="${g.id}" title="Pendiente → Conseguida → No conseguida" aria-label="Cambiar estado de la meta">
              ${g.status === 'done' ? icon('check') : g.status === 'fail' ? icon('x') : ''}
            </button>
            ${editable
              ? `<input class="goal-input" data-goal-text="${g.id}" value="${esc(g.text)}" maxlength="120" aria-label="Texto de la meta">`
              : `<span class="goal-text">${i + 1}. ${esc(g.text)}</span>`}
            <button type="button" class="icon-btn sm goal-del" data-goal-del="${g.id}" title="Eliminar meta" aria-label="Eliminar meta">${icon('trash')}</button>
          </li>`).join('')}
      </ul>
      <form class="goal-add" data-goal-add autocomplete="off">
        <input class="input" name="text" placeholder="Nueva meta para este mes…" maxlength="120" required>
        <button class="btn btn-ghost" type="submit" title="Añadir meta">${icon('plus')}</button>
      </form>
    </div>`;
}

export function bindGoals(root, ym) {
  root.querySelectorAll('[data-goal-cycle]').forEach((b) => b.addEventListener('click', () => cycleGoal(ym, b.dataset.goalCycle)));
  root.querySelectorAll('[data-goal-del]').forEach((b) => b.addEventListener('click', () => removeGoal(ym, b.dataset.goalDel)));
  root.querySelectorAll('[data-goal-text]').forEach((inp) => inp.addEventListener('change', () => {
    const text = inp.value.trim();
    if (text) updateGoal(ym, inp.dataset.goalText, { text });
    else removeGoal(ym, inp.dataset.goalText);
  }));
  root.querySelectorAll('[data-goal-add]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    addGoal(ym, text);
    requestAnimationFrame(() => document.querySelector('[data-goal-add] input')?.focus());
  }));
}

export function reviewCard(state, ym) {
  const month = state.months[ym] || emptyMonth();
  const keys = monthDays(ym);
  const mc = monthCompletion(state, ym);
  const mood = metricAverage(state, keys, 'mood');
  const sleep = metricAverage(state, keys, 'sleep');
  return `
    <div class="card card-review">
      <div class="card-head"><h2>${icon('book')} Revisión mensual</h2></div>
      <div class="review-body">
        <div>
          <div class="review-stats">
            <span>Cumplimiento <b>${fmtPct(mc.pct)}</b></span>
            <span>Ánimo <b>${mood == null ? '—' : fmtNum(mood, 1)}</b></span>
            <span>Sueño <b>${sleep == null ? '—' : fmtNum(sleep, 1) + ' h'}</b></span>
            <span>Días <b>${mc.days}</b></span>
          </div>
          <label class="lbl">Calificación de este mes</label>
          <div class="rating" role="group" aria-label="Calificación del mes">
            ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button type="button" class="rate ${month.rating === n ? 'on' : ''}" data-rating="${n}" aria-pressed="${month.rating === n}">${n}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="lbl" for="improve-${ym}">¿Qué mejorar el siguiente mes?</label>
          <textarea id="improve-${ym}" class="input textarea" data-improve rows="4" placeholder="Entorno, obligaciones, descanso…">${esc(month.improve)}</textarea>
        </div>
      </div>
    </div>`;
}

export function bindReview(root, ym) {
  root.querySelectorAll('[data-rating]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.rating);
    const cur = getState().months[ym]?.rating;
    setMonthField(ym, 'rating', cur === n ? null : n);
  }));
  root.querySelectorAll('[data-improve]').forEach((t) => t.addEventListener('change', () => setMonthField(ym, 'improve', t.value)));
}
