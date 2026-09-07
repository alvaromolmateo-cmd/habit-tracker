// Gestión de hábitos: crear, editar, ordenar, archivar y eliminar.

import { getState, SECTIONS, addHabit, updateHabit, moveHabit, removeHabit } from '../store.js';
import { habitStreaks } from '../stats.js';
import { esc, icon, openModal, closeModal, modalHeader, confirmDialog, toast } from '../ui.js';

function row(h, i, n, state) {
  const s = habitStreaks(state, h.id);
  return `
    <li class="habit-item">
      <span class="habit-emoji">${esc(h.emoji)}</span>
      <span class="habit-name">${esc(h.name)}${h.description ? `<small>${esc(h.description)}</small>` : ''}</span>
      <span class="habit-streak" title="Racha actual / mejor racha">${icon('flame')} ${s.current} <small>/ ${s.best}</small></span>
      <span class="habit-actions">
        <button type="button" class="icon-btn sm" data-move="-1" data-id="${h.id}" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir">${icon('arrow-up')}</button>
        <button type="button" class="icon-btn sm" data-move="1" data-id="${h.id}" ${i === n - 1 ? 'disabled' : ''} title="Bajar" aria-label="Bajar">${icon('arrow-down')}</button>
        <button type="button" class="icon-btn sm" data-edit="${h.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
        <button type="button" class="icon-btn sm" data-archive="${h.id}" title="Archivar (deja de aparecer, conserva el historial)" aria-label="Archivar">${icon('archive')}</button>
        <button type="button" class="icon-btn sm danger" data-del="${h.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
      </span>
    </li>`;
}

function archivedRow(h) {
  const section = SECTIONS.find((s) => s.id === h.section);
  return `
    <li class="habit-item is-archived">
      <span class="habit-emoji">${esc(h.emoji)}</span>
      <span class="habit-name">${esc(h.name)}<small>${section ? esc(section.name) : ''}</small></span>
      <span class="habit-actions">
        <button type="button" class="btn btn-ghost sm" data-unarchive="${h.id}">Restaurar</button>
        <button type="button" class="icon-btn sm danger" data-del="${h.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
      </span>
    </li>`;
}

export function render() {
  const state = getState();
  const archived = state.habits.filter((h) => h.archived);
  return `
    <header class="page-head">
      <h1>Hábitos</h1>
      <div class="page-actions"><button class="btn btn-primary" data-add>${icon('plus')} Nuevo hábito</button></div>
    </header>
    <p class="intro muted">Tres bloques, como en la libreta. El orden de aquí es el que verás en la cuadrícula y en el registro de cada día.</p>
    ${SECTIONS.map((s) => {
      const hs = state.habits.filter((h) => h.section === s.id && !h.archived).sort((a, b) => a.order - b.order);
      return `
        <div class="card">
          <div class="card-head"><h2>${s.emoji} ${esc(s.name)}</h2><span class="muted">${hs.length} hábito${hs.length === 1 ? '' : 's'}</span></div>
          ${hs.length ? `<ul class="habit-list">${hs.map((h, i) => row(h, i, hs.length, state)).join('')}</ul>` : '<p class="muted">Sin hábitos en esta sección.</p>'}
        </div>`;
    }).join('')}
    ${archived.length ? `
      <div class="card">
        <div class="card-head"><h2>${icon('archive')} Archivados</h2><span class="muted">Conservan su historial</span></div>
        <ul class="habit-list">${archived.map(archivedRow).join('')}</ul>
      </div>` : ''}`;
}

function openHabitForm(habit) {
  openModal({
    size: 'sm',
    render: () => `
      ${modalHeader(habit ? 'Editar hábito' : 'Nuevo hábito')}
      <form class="modal-body form" data-habit-form autocomplete="off">
        <div class="form-row">
          <label class="fld fld-emoji">Emoji<input class="input" name="emoji" value="${esc(habit?.emoji || '')}" maxlength="4" placeholder="✅"></label>
          <label class="fld grow">Nombre<input class="input" name="name" value="${esc(habit?.name || '')}" required maxlength="40" placeholder="p. ej. Leer 20 min"></label>
        </div>
        <label class="fld">Sección
          <select class="select" name="section">
            ${SECTIONS.map((s) => `<option value="${s.id}" ${(habit?.section || 'fisico') === s.id ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
          </select>
        </label>
        <label class="fld">Descripción (opcional)<input class="input" name="description" value="${esc(habit?.description || '')}" maxlength="80" placeholder="p. ej. mínimo 10.000 pasos"></label>
        <div class="modal-foot">
          <button type="button" class="btn" data-modal-close>Cancelar</button>
          <button class="btn btn-primary" type="submit">Guardar</button>
        </div>
      </form>`,
    mount: (panel) => {
      const form = panel.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          name: form.name.value.trim(),
          emoji: form.emoji.value.trim() || '✅',
          section: form.section.value,
          description: form.description.value.trim(),
        };
        if (!data.name) return;
        if (habit) updateHabit(habit.id, data); else addHabit(data);
        closeModal();
        toast(habit ? 'Hábito actualizado' : 'Hábito añadido');
      });
      form.name.focus();
    },
  });
}

export function mount(root) {
  root.querySelector('[data-add]')?.addEventListener('click', () => openHabitForm(null));
  root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const h = getState().habits.find((x) => x.id === b.dataset.edit);
    if (h) openHabitForm(h);
  }));
  root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => moveHabit(b.dataset.id, Number(b.dataset.move))));
  root.querySelectorAll('[data-archive]').forEach((b) => b.addEventListener('click', () => { updateHabit(b.dataset.archive, { archived: true }); toast('Hábito archivado'); }));
  root.querySelectorAll('[data-unarchive]').forEach((b) => b.addEventListener('click', () => updateHabit(b.dataset.unarchive, { archived: false })));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const h = getState().habits.find((x) => x.id === b.dataset.del);
    if (!h) return;
    const ok = await confirmDialog({
      title: `Eliminar «${h.name}»`,
      message: 'Se borrará el hábito y todas sus marcas de todos los días. Si solo quieres dejar de verlo, archívalo.',
    });
    if (ok) { removeHabit(h.id); toast('Hábito eliminado'); }
  }));
}
