// Ajustes: perfil, objetivos, apariencia, instalación de la PWA y copia de seguridad de los datos.

import { getState, setSetting, exportJSON, importJSON, resetAll, storageInfo, hasSaveError } from '../store.js';
import { esc, icon, fmtNum, confirmDialog, toast } from '../ui.js';
import { todayKey } from '../dates.js';

export const APP_VERSION = '1.1.0';

export function render(ctx) {
  const s = getState().settings;
  const info = storageInfo();
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `
    <header class="page-head"><h1>Ajustes</h1></header>

    <section class="grid-2">
      <div class="col">
        <div class="card">
          <div class="card-head"><h2>${icon('smile')} Perfil</h2></div>
          <label class="fld">Nombre<input class="input" data-setting="name" value="${esc(s.name)}" maxlength="40" placeholder="Cómo quieres que te salude"></label>
          <label class="fld">Lema<input class="input" data-setting="motto" value="${esc(s.motto)}" maxlength="80" placeholder="Disciplina hoy, vida que agrada mañana."></label>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon('target')} Objetivos</h2></div>
          <div class="form-row">
            <label class="fld">Peso objetivo (kg)<input class="input" type="number" step="0.1" min="20" max="300" inputmode="decimal" data-setting="weightGoal" value="${s.weightGoal ?? ''}" placeholder="—"></label>
            <label class="fld">Sueño objetivo (h)<input class="input" type="number" step="0.5" min="0" max="24" inputmode="decimal" data-setting="sleepGoal" value="${s.sleepGoal ?? ''}" placeholder="8"></label>
          </div>
          <label class="fld"><span>Día cumplido a partir de <b data-threshold-label>${s.dayThreshold}%</b> de hábitos</span>
            <input class="range" type="range" min="0" max="100" step="5" data-setting="dayThreshold" value="${s.dayThreshold}">
          </label>
          <p class="hint">La racha cuenta los días seguidos que llegan a ese porcentaje. Los hábitos «a medias» valen la mitad y los «no aplica» no cuentan.</p>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon('moon')} Apariencia</h2></div>
          <div class="seg" role="group" aria-label="Tema">
            ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button type="button" class="seg-btn ${s.theme === v ? 'on' : ''}" data-theme-opt="${v}">${l}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="card-head"><h2>${icon('phone')} Aplicación</h2><span class="muted">v${APP_VERSION}</span></div>
          ${ctx.standalone
            ? `<p class="ok">${icon('check-circle')} Instalada como aplicación en este dispositivo.</p>`
            : ctx.installPrompt
              ? `<p class="muted">Instálala para abrirla como una app, a pantalla completa y sin conexión.</p><button class="btn btn-primary" data-install>${icon('download')} Instalar aplicación</button>`
              : isIOS
                ? `<p class="muted">En iPhone/iPad: pulsa <b>Compartir</b> en Safari y luego <b>Añadir a pantalla de inicio</b>.</p>`
                : `<p class="muted">Si el navegador lo permite, verás la opción <b>Instalar aplicación</b> en el menú del navegador (o en el icono de la barra de direcciones). En iPhone: Compartir → Añadir a pantalla de inicio.</p>`}
          <p class="hint">Funciona sin conexión. Los datos se guardan en este dispositivo; usa la copia de seguridad para pasarlos a otro.</p>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon('download')} Datos</h2><span class="muted">${info.days} día${info.days === 1 ? '' : 's'} · ${fmtNum(info.bytes / 1024, 1)} KB</span></div>
          ${hasSaveError() ? '<p class="warn">No se ha podido guardar en este navegador. Exporta una copia por si acaso.</p>' : ''}
          <div class="btn-row">
            <button class="btn" data-export>${icon('download')} Exportar copia (JSON)</button>
            <button class="btn" data-import>${icon('upload')} Importar copia</button>
            <input type="file" accept="application/json,.json" data-import-file hidden>
          </div>
          <p class="hint">Exporta desde el portátil e importa en el móvil (o al revés) para llevar los mismos datos. La importación sustituye todo lo que haya aquí.</p>
          <button class="btn btn-danger-ghost" data-reset>${icon('trash')} Borrar todos los datos</button>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon('info')} Acerca de</h2></div>
          <p class="muted">Habit Tracker es una aplicación personal para llevar el control de los hábitos del día a día y ver cómo evolucionan con el tiempo.</p>
          <p class="muted">Cada día marcas tus hábitos (hecho, a medias o no aplica), apuntas la nota del día, el peso, las horas de sueño, un momento memorable y las tareas que tengas que hacer. En <b>Mensual</b> revisas el cumplimiento del mes, fijas metas y calificas cómo ha ido; en <b>Calendario</b> añades eventos con su horario; en <b>Estadísticas</b> ves rachas, medias y gráficas por periodo. Los datos se guardan en este dispositivo y puedes exportarlos desde aquí.</p>
        </div>
      </div>
    </section>`;
}

function parseSetting(field, raw) {
  if (field === 'name' || field === 'motto') return raw.trim();
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function mount(root, ctx) {
  root.querySelectorAll('[data-setting]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const field = inp.dataset.setting;
      setSetting(field, parseSetting(field, inp.value), { silent: field === 'name' || field === 'motto' });
      if (field === 'motto') ctx.refreshShell();
    });
    if (inp.dataset.setting === 'dayThreshold') {
      inp.addEventListener('input', () => { root.querySelector('[data-threshold-label]').textContent = `${inp.value}%`; });
    }
  });
  root.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
    setSetting('theme', b.dataset.themeOpt);
    ctx.applyTheme();
  }));
  root.querySelector('[data-install]')?.addEventListener('click', () => ctx.install());
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habit-tracker-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Copia exportada');
  });
  const fileInput = root.querySelector('[data-import-file]');
  root.querySelector('[data-import]')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const text = await file.text();
    const ok = await confirmDialog({
      title: 'Importar copia',
      message: `Se sustituirán todos los datos actuales por los del archivo <b>${esc(file.name)}</b>. ¿Continuar?`,
      confirmText: 'Importar',
      danger: false,
    });
    if (!ok) { fileInput.value = ''; return; }
    try {
      importJSON(text);
      ctx.applyTheme();
      toast('Datos importados');
    } catch (e) {
      console.error(e);
      toast('El archivo no es una copia válida');
    }
    fileInput.value = '';
  });
  root.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Borrar todos los datos',
      message: 'Se eliminarán todos los registros, hábitos, tareas, eventos y metas de este dispositivo. Esta acción no se puede deshacer.',
      confirmText: 'Borrar todo',
    });
    if (ok) { resetAll(); ctx.applyTheme(); toast('Datos borrados'); }
  });
}
