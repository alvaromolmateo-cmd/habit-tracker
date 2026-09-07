// Utilidades de interfaz: escape de HTML, iconos, formato, modal y toasts.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const fmtNum = (v, d = 1) => (v == null || Number.isNaN(Number(v))
  ? '—'
  : Number(v).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d }));

export const fmtPct = (v) => (v == null ? '—' : `${Math.round(v)}%`);

export const fmtDelta = (v, unit = '', d = 1) => {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${fmtNum(Math.abs(v), d)}${unit ? ' ' + unit : ''}`;
};

// ---------- Modal ----------
let modal = null;
let ignoreNextScroll = false;

function panelEl() {
  return document.querySelector('#modal .modal-panel');
}

export function openModal(opts) {
  modal = opts;
  drawModal();
}

export function refreshModal() {
  if (modal) drawModal(true);
}

export function isModalOpen() {
  return !!modal;
}

export function closeModal() {
  if (!modal) return;
  const active = document.activeElement;
  if (active && document.getElementById('modal').contains(active)) active.blur();
  const onClose = modal.onClose;
  modal = null;
  document.getElementById('modal').innerHTML = '';
  document.body.classList.remove('modal-open');
  onClose?.();
}

function drawModal(keepScroll = false) {
  const host = document.getElementById('modal');
  const prev = keepScroll ? panelEl()?.querySelector('.modal-body')?.scrollTop : 0;
  host.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal-panel ${modal.size || ''}" role="dialog" aria-modal="true">${modal.render()}</div>`;
  document.body.classList.add('modal-open');
  host.querySelector('[data-close]').addEventListener('click', closeModal);
  host.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
  const panel = panelEl();
  modal.mount?.(panel);
  if (prev) {
    const body = panel.querySelector('.modal-body');
    if (body) body.scrollTop = prev;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal) closeModal();
});

export function modalHeader(title, sub = '', extra = '') {
  return `
    <div class="modal-head">
      <div class="modal-titles">
        <div class="modal-title">${title}</div>
        ${sub ? `<div class="modal-sub">${sub}</div>` : ''}
      </div>
      ${extra}
      <button class="icon-btn" data-modal-close aria-label="Cerrar">${icon('x')}</button>
    </div>`;
}

export function confirmDialog({ title, message, confirmText = 'Eliminar', danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    openModal({
      size: 'sm',
      render: () => `
        ${modalHeader(esc(title))}
        <div class="modal-body"><p class="muted">${message}</p></div>
        <div class="modal-foot">
          <button class="btn" data-modal-close>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
        </div>`,
      mount: (panel) => {
        panel.querySelector('[data-ok]').addEventListener('click', () => {
          done = true;
          closeModal();
          resolve(true);
        });
      },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ---------- Toast ----------
let toastTimer = null;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Pequeños helpers de plantilla ----------
export const monthNav = (label, extra = '') => `
  <div class="month-nav">
    <button class="icon-btn" data-month="-1" aria-label="Mes anterior">${icon('chevron-left')}</button>
    <h1 class="month-title">${esc(label)}</h1>
    <button class="icon-btn" data-month="1" aria-label="Mes siguiente">${icon('chevron-right')}</button>
    ${extra}
  </div>`;

export const progressBar = (pct, cls = '') => `
  <div class="progress ${cls}"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, pct || 0))}%"></div></div>`;
