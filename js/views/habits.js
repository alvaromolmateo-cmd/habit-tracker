// Gestión de hábitos y de sus secciones: crear, editar, ordenar, archivar y eliminar.

import { getState, addHabit, updateHabit, moveHabit, removeHabit, addSection, updateSection, moveSection, removeSection } from '../store.js';
import { habitStreaks, sortedSections } from '../stats.js';
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

function archivedRow(h, state) {
  const section = state.sections.find((s) => s.id === h.section);
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
  const sections = sortedSections(state);
  const archived = state.habits.filter((h) => h.archived);
  return `
    <header class="page-head">
      <h1>Hábitos</h1>
      <div class="page-actions">
        <button class="btn" data-add-section>${icon('plus')} Nueva sección</button>
        <button class="btn btn-primary" data-add ${sections.length ? '' : 'disabled'}>${icon('plus')} Nuevo hábito</button>
      </div>
    </header>
    ${sections.length ? sections.map((s, i) => {
      const hs = state.habits.filter((h) => h.section === s.id && !h.archived).sort((a, b) => a.order - b.order);
      return `
        <div class="card card-section">
          <div class="card-head">
            <h2>${esc(s.emoji)} ${esc(s.name)} <span class="muted">${hs.length} hábito${hs.length === 1 ? '' : 's'}</span></h2>
            <span class="section-actions">
              <button type="button" class="icon-btn sm" data-section-move="-1" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} title="Subir sección" aria-label="Subir sección">${icon('arrow-up')}</button>
              <button type="button" class="icon-btn sm" data-section-move="1" data-id="${s.id}" ${i === sections.length - 1 ? 'disabled' : ''} title="Bajar sección" aria-label="Bajar sección">${icon('arrow-down')}</button>
              <button type="button" class="icon-btn sm" data-section-edit="${s.id}" title="Editar sección" aria-label="Editar sección">${icon('edit')}</button>
              <button type="button" class="icon-btn sm danger" data-section-del="${s.id}" title="Eliminar sección" aria-label="Eliminar sección">${icon('trash')}</button>
            </span>
          </div>
          ${hs.length
            ? `<ul class="habit-list">${hs.map((h, j) => row(h, j, hs.length, state)).join('')}</ul>`
            : '<p class="muted">Sin hábitos en esta sección.</p>'}
          <button type="button" class="btn btn-ghost sm" data-add-to="${s.id}">${icon('plus')} Añadir hábito aquí</button>
        </div>`;
    }).join('') : `
      <div class="card">
        <p class="muted">No hay secciones. Crea una para empezar a añadir hábitos.</p>
      </div>`}
    ${archived.length ? `
      <div class="card">
        <div class="card-head"><h2>${icon('archive')} Archivados</h2><span class="muted">Conservan su historial</span></div>
        <ul class="habit-list">${archived.map((h) => archivedRow(h, state)).join('')}</ul>
      </div>` : ''}`;
}

function openHabitForm(habit, sectionId) {
  const sections = sortedSections(getState());
  const selected = habit?.section || sectionId || sections[0]?.id;
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
            ${sections.map((s) => `<option value="${s.id}" ${selected === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`).join('')}
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

function openSectionForm(section) {
  openModal({
    size: 'sm',
    render: () => `
      ${modalHeader(section ? 'Editar sección' : 'Nueva sección')}
      <form class="modal-body form" data-section-form autocomplete="off">
        <div class="form-row">
          <label class="fld fld-emoji">Emoji<input class="input" name="emoji" value="${esc(section?.emoji || '')}" maxlength="4" placeholder="📌"></label>
          <label class="fld grow">Nombre<input class="input" name="name" value="${esc(section?.name || '')}" required maxlength="30" placeholder="p. ej. Estudio"></label>
        </div>
        <p class="hint">Las secciones agrupan los hábitos en el registro diario y en la cuadrícula del mes.</p>
        <div class="modal-foot">
          <button type="button" class="btn" data-modal-close>Cancelar</button>
          <button class="btn btn-primary" type="submit">Guardar</button>
        </div>
      </form>`,
    mount: (panel) => {
      const form = panel.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        const emoji = form.emoji.value.trim() || '📌';
        if (!name) return;
        if (section) updateSection(section.id, { name, emoji }); else addSection({ name, emoji });
        closeModal();
        toast(section ? 'Sección actualizada' : 'Sección creada');
      });
      form.name.focus();
    },
  });
}

export function mount(root) {
  root.querySelector('[data-add]')?.addEventListener('click', () => openHabitForm(null));
  root.querySelectorAll('[data-add-to]').forEach((b) => b.addEventListener('click', () => openHabitForm(null, b.dataset.addTo)));
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

  // Secciones
  root.querySelector('[data-add-section]')?.addEventListener('click', () => openSectionForm(null));
  root.querySelectorAll('[data-section-edit]').forEach((b) => b.addEventListener('click', () => {
    const s = getState().sections.find((x) => x.id === b.dataset.sectionEdit);
    if (s) openSectionForm(s);
  }));
  root.querySelectorAll('[data-section-move]').forEach((b) => b.addEventListener('click', () => moveSection(b.dataset.id, Number(b.dataset.sectionMove))));
  root.querySelectorAll('[data-section-del]').forEach((b) => b.addEventListener('click', async () => {
    const state = getState();
    const s = state.sections.find((x) => x.id === b.dataset.sectionDel);
    if (!s) return;
    const n = state.habits.filter((h) => h.section === s.id).length;
    const ok = await confirmDialog({
      title: `Eliminar «${s.name}»`,
      message: n
        ? `Se borrará la sección y ${n === 1 ? 'su hábito' : `sus ${n} hábitos`} (incluidos los archivados) con todas sus marcas. Si quieres conservar alguno, muévelo antes a otra sección.`
        : 'La sección está vacía y se eliminará.',
    });
    if (ok) { removeSection(s.id); toast('Sección eliminada'); }
  }));
}
