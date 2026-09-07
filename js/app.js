// Arranque: enrutado por hash, render de vistas, tema, service worker e instalación PWA.

import { getState, subscribe } from './store.js';
import { refreshModal, toast } from './ui.js';
import { mountCharts } from './charts.js';
import { currentMonth, todayKey } from './dates.js';
import * as today from './views/today.js';
import * as calendar from './views/calendar.js';
import * as habits from './views/habits.js';
import * as monthly from './views/monthly.js';
import * as statistics from './views/statistics.js';
import * as settings from './views/settings.js';

const views = { hoy: today, calendario: calendar, habitos: habits, mensual: monthly, estadisticas: statistics, ajustes: settings };
const ALIASES = { reflexiones: 'mensual' };
const titles = { hoy: 'Hoy', calendario: 'Calendario', habitos: 'Hábitos', mensual: 'Mensual', estadisticas: 'Estadísticas', ajustes: 'Ajustes' };

const ctx = {
  month: currentMonth(),
  statsRange: '3m',
  statsYear: new Date().getFullYear(),
  installPrompt: null,
  get standalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  },
  setMonth(ym) { ctx.month = ym; render(); },
  set(key, value) { ctx[key] = value; render(); },
  applyTheme,
  refreshShell,
  async install() {
    if (!ctx.installPrompt) return;
    ctx.installPrompt.prompt();
    const { outcome } = await ctx.installPrompt.userChoice;
    if (outcome === 'accepted') ctx.installPrompt = null;
    render();
  },
};

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] || 'hoy';
  const name = ALIASES[raw] || raw;
  return views[name] ? name : 'hoy';
}

let lastRoute = null;
let lastDay = todayKey();

function render() {
  const route = currentRoute();
  const view = views[route];
  const root = document.getElementById('view');

  // Conserva el scroll interno de contenedores marcados (p. ej. la cuadrícula de hábitos)
  const scrolls = {};
  root.querySelectorAll('[data-scroll-key]').forEach((el) => { scrolls[el.dataset.scrollKey] = { l: el.scrollLeft, t: el.scrollTop }; });

  root.innerHTML = view.render(ctx);

  root.querySelectorAll('[data-scroll-key]').forEach((el) => {
    const s = scrolls[el.dataset.scrollKey];
    if (s) { el.scrollLeft = s.l; el.scrollTop = s.t; }
  });

  view.mount(root, ctx);
  mountCharts(root);

  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === route;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${titles[route]} · Habit Tracker`;
  refreshShell();

  if (route !== lastRoute) {
    window.scrollTo(0, 0);
    lastRoute = route;
  }
}

function refreshShell() {
  const s = getState().settings;
  document.querySelectorAll('[data-motto]').forEach((el) => { el.textContent = s.motto || ''; });
  document.querySelectorAll('[data-install-shell]').forEach((el) => { el.hidden = !ctx.installPrompt || ctx.standalone; });
}

function applyTheme() {
  const t = getState().settings.theme;
  const html = document.documentElement;
  if (t === 'auto') html.removeAttribute('data-theme'); else html.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#1c1717' : '#fcf9f8');
}

// ---------- eventos globales ----------
window.addEventListener('hashchange', render);
subscribe(() => { render(); refreshModal(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// Si la app queda abierta y cambia el día, vuelve a pintar para que «Hoy» sea el día correcto.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastDay) {
    lastDay = todayKey();
    ctx.month = currentMonth();
    render();
  }
});

// Instalación PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ctx.installPrompt = e;
  refreshShell();
  if (currentRoute() === 'ajustes') render();
});
window.addEventListener('appinstalled', () => {
  ctx.installPrompt = null;
  toast('Aplicación instalada');
  render();
});
document.querySelectorAll('[data-install-shell]').forEach((b) => b.addEventListener('click', () => ctx.install()));

// Service worker (solo funciona en https o localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker no registrado:', err));
  });
}

applyTheme();
render();
