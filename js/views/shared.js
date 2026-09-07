// Tarjetas compartidas: metas del mes y revisión mensual.

import { getState, emptyMonth, setGoalStatus, addGoal, removeGoal, updateGoal, setMonthField, GOAL_LABEL } from '../store.js';
import { monthCompletion, metricAverage } from '../stats.js';
import { esc, icon, fmtNum, fmtPct, progressBar } from '../ui.js';
import { monthDays } from '../dates.js';

export function goalSummary(goals) {
  const done = goals.filter((g) => g.status === 'done').length;
  const partial = goals.filter((g) => g.status === 'partial').length;
  const fail = goals.filter((g) => g.status === 'fail').length;
  const pct = goals.length ? ((done + partial * 0.5) / goals.length) * 100 : 0;
  return { done, partial, fail, pct, total: goals.length };
}

export function goalSummaryLabel(goals) {
  const s = goalSummary(goals);
  if (!s.total) return 'Sin metas';
  const parts = [];
  if (s.done) parts.push(`${s.done} sí`);
  if (s.partial) parts.push(`${s.partial} regular`);
  if (s.fail) parts.push(`${s.fail} no`);
  const pending = s.total - s.done - s.partial - s.fail;
  if (pending) parts.push(`${pending} pendiente${pending === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function goalsCard(state, ym) {
  const month = state.months[ym] || emptyMonth();
  const goals = month.goals;
  const s = goalSummary(goals);
  return `
    <div class="card card-goals">
      <div class="card-head">
        <h2>${icon('target')} Metas del mes</h2>
        <span class="muted">${goalSummaryLabel(goals)}</span>
      </div>
      ${goals.length ? progressBar(s.pct) : ''}
      <ul class="goals">
        ${goals.map((g, i) => `
          <li class="goal is-${g.status}">
            <span class="goal-num">${i + 1}.</span>
            <input class="goal-input" data-goal-text="${g.id}" value="${esc(g.text)}" maxlength="120" aria-label="Texto de la meta">
            <div class="seg sm goal-seg" role="group" aria-label="¿Conseguida?">
              ${['done', 'partial', 'fail'].map((st) => `<button type="button" class="seg-btn st-${st} ${g.status === st ? 'on' : ''}" data-goal-set="${g.id}" data-status="${st}" aria-pressed="${g.status === st}">${GOAL_LABEL[st]}</button>`).join('')}
            </div>
            <button type="button" class="icon-btn sm danger goal-del" data-goal-del="${g.id}" title="Eliminar meta" aria-label="Eliminar meta">${icon('trash')}</button>
            ${g.status === 'partial' ? `<input class="input goal-note" data-goal-note="${g.id}" value="${esc(g.note || '')}" maxlength="200" placeholder="¿Por qué regular? Explícalo en una línea…" aria-label="Explicación">` : ''}
          </li>`).join('')}
      </ul>
      <form class="goal-add" data-goal-add autocomplete="off">
        <input class="input" name="text" placeholder="Nueva meta para este mes…" maxlength="120" required aria-label="Nueva meta">
        <button class="btn btn-ghost" type="submit" title="Añadir meta" aria-label="Añadir meta">${icon('plus')}</button>
      </form>
      <p class="hint">Marca cada meta con Sí, Regular o No. Con «Regular» puedes explicar qué pasó.</p>
    </div>`;
}

export function bindGoals(root, ym) {
  root.querySelectorAll('[data-goal-set]').forEach((b) => b.addEventListener('click', () => {
    setGoalStatus(ym, b.dataset.goalSet, b.dataset.status);
    if (b.dataset.status === 'partial') {
      requestAnimationFrame(() => root.querySelector(`[data-goal-note="${b.dataset.goalSet}"]`)?.focus());
    }
  }));
  root.querySelectorAll('[data-goal-del]').forEach((b) => b.addEventListener('click', () => removeGoal(ym, b.dataset.goalDel)));
  root.querySelectorAll('[data-goal-text]').forEach((inp) => inp.addEventListener('change', () => {
    const text = inp.value.trim();
    if (text) updateGoal(ym, inp.dataset.goalText, { text }, { silent: true });
    else removeGoal(ym, inp.dataset.goalText);
  }));
  root.querySelectorAll('[data-goal-note]').forEach((inp) => {
    inp.addEventListener('change', () => updateGoal(ym, inp.dataset.goalNote, { note: inp.value.trim() }, { silent: true }));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });
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
            <span>Nota media <b>${mood == null ? '—' : fmtNum(mood, 1)}</b></span>
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
  root.querySelectorAll('[data-improve]').forEach((t) => t.addEventListener('change', () => setMonthField(ym, 'improve', t.value, { silent: true })));
}
