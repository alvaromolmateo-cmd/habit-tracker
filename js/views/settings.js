// Ajustes: perfil, objetivos, apariencia, instalación de la PWA y copia de seguridad de los datos.

import { getState, setSetting, exportJSON, importJSON, resetAll, storageInfo, hasSaveError, safetyCopies, discardSafetyCopy } from '../store.js';
import { esc, icon, fmtNum, confirmDialog, toast } from '../ui.js';
import { todayKey } from '../dates.js';

export const APP_VERSION = '1.3.0';

// Descarga un texto como archivo .json.
function download(text, name) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileDate = (iso) => (iso || new Date().toISOString()).slice(0, 10);
const longDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// Copias automáticas de la red de seguridad del almacenamiento (ver store.js).
function safetyBlock() {
  const { backup, rescues, readOnly } = safetyCopies();
  if (!backup && !rescues.length && !readOnly) return '';
  return `
    ${readOnly ? '<p class="warn">Los datos guardados no se pudieron abrir y no hay sitio para apartarlos, así que la app no guarda nada para no pisarlos. Libera espacio antes de seguir.</p>' : ''}
    ${rescues.length ? `
      <p class="warn">Hay datos antiguos que la app no pudo abrir. No se han borrado: están apartados aquí. Descárgalos y guárdalos; se podrán importar cuando se corrija el fallo.</p>
      <div class="btn-row">
        <button class="btn" data-rescue-get>${icon('download')} Descargar datos apartados</button>
        <button class="btn btn-danger-ghost" data-rescue-drop>${icon('trash')} Descartar</button>
      </div>` : ''}
    ${backup ? `
      <p class="hint">Copia automática de antes de la última actualización de la app (${esc(longDate(backup.savedAt))}). Solo hace falta si algo se ve raro tras actualizar.</p>
      <div class="btn-row">
        <button class="btn" data-backup-get>${icon('download')} Descargar copia automática</button>
      </div>` : ''}`;
}

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
          ${safetyBlock()}
          <button class="btn btn-danger-ghost" data-reset>${icon('trash')} Borrar todos los datos</button>
        </div>

        <div class="card">
          <div class="card-head"><h2>${icon('info')} Acerca de</h2></div>
          <p class="muted">HabitTracker es una aplicación personal para llevar el control de los hábitos del día a día y ver cómo evolucionan con el tiempo.</p>
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
    download(exportJSON(), `habit-tracker-${todayKey()}.json`);
    toast('Copia exportada');
  });
  root.querySelector('[data-backup-get]')?.addEventListener('click', () => {
    const { backup } = safetyCopies();
    if (backup) download(backup.raw, `habit-tracker-copia-${fileDate(backup.savedAt)}.json`);
  });
  root.querySelector('[data-rescue-get]')?.addEventListener('click', () => {
    safetyCopies().rescues.forEach((r, i) => download(r.raw, `habit-tracker-apartados-${fileDate(r.savedAt)}-${i + 1}.json`));
  });
  root.querySelector('[data-rescue-drop]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Descartar datos apartados',
      message: 'Se borran para siempre los datos que la app no pudo abrir. Descárgalos antes si hay algo que quieras conservar.',
      confirmText: 'Descartar',
    });
    if (ok) { discardSafetyCopy('rescue'); ctx.rerender(); toast('Datos apartados descartados'); }
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
