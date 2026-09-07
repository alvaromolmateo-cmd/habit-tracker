// Tareas del día: un listado de cosas por hacer ese día que se van tachando.
// Se usa en la vista Hoy y en el panel de día del calendario.

import { addTask, toggleTask, updateTask, removeTask } from './store.js';
import { esc, icon } from './ui.js';

export function taskSummary(state, key) {
  const tasks = state.days[key]?.tasks || [];
  return { total: tasks.length, done: tasks.filter((t) => t.done).length };
}

export function tasksHTML(state, key, { placeholder = 'Nueva tarea…', empty = 'Sin tareas. Añade lo que tengas que hacer hoy.' } = {}) {
  const tasks = state.days[key]?.tasks || [];
  return `
    <div class="tasks" data-tasks="${key}">
      ${tasks.length ? `<ul class="task-list">${tasks.map((t) => `
        <li class="task ${t.done ? 'is-done' : ''}">
          <button type="button" class="task-check" role="checkbox" aria-checked="${t.done}" data-task-toggle="${t.id}" aria-label="${esc(t.text)}">${t.done ? icon('check') : ''}</button>
          <input class="task-input" data-task-text="${t.id}" value="${esc(t.text)}" maxlength="120" aria-label="Texto de la tarea">
          <button type="button" class="icon-btn sm danger task-del" data-task-del="${t.id}" title="Eliminar tarea" aria-label="Eliminar tarea">${icon('trash')}</button>
        </li>`).join('')}</ul>` : `<p class="muted">${esc(empty)}</p>`}
      <form class="task-add" data-task-add autocomplete="off">
        <input class="input" name="text" placeholder="${esc(placeholder)}" maxlength="120" required aria-label="Nueva tarea">
        <button class="btn btn-ghost" type="submit" title="Añadir tarea" aria-label="Añadir tarea">${icon('plus')}</button>
      </form>
    </div>`;
}

export function bindTasks(root) {
  root.querySelectorAll('[data-tasks]').forEach((box) => {
    const key = box.dataset.tasks;
    box.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-task-toggle]');
      if (toggle) { toggleTask(key, toggle.dataset.taskToggle); return; }
      const del = e.target.closest('[data-task-del]');
      if (del) removeTask(key, del.dataset.taskDel);
    });
    box.querySelectorAll('[data-task-text]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const text = inp.value.trim();
        if (text) updateTask(key, inp.dataset.taskText, text, { silent: true });
        else removeTask(key, inp.dataset.taskText);
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    });
    box.querySelector('[data-task-add]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      addTask(key, text);
      requestAnimationFrame(() => document.querySelector(`[data-tasks="${key}"] [data-task-add] input`)?.focus());
    });
  });
}
