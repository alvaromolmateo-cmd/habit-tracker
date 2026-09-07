// Eventos de un día (calendario): título y, opcionalmente, hora de inicio y fin.

import { esc, icon } from './ui.js';

// Minutos desde medianoche de una hora 'HH:MM' (o null si no hay hora)
export const timeToMin = (t) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

export const minToTime = (m) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

// Eventos ordenados por hora; los de «todo el día» primero.
export function sortedEvents(day) {
  return (day?.events || []).slice().sort((a, b) => (timeToMin(a.start) ?? -1) - (timeToMin(b.start) ?? -1) || a.title.localeCompare(b.title, 'es'));
}

export function eventTimeLabel(ev) {
  if (!ev.start) return 'Todo el día';
  return ev.end ? `${ev.start} – ${ev.end}` : ev.start;
}

export function eventDuration(ev) {
  const a = timeToMin(ev.start);
  const b = timeToMin(ev.end);
  if (a == null || b == null || b <= a) return '';
  const d = b - a;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

// Lista de solo lectura (vista Hoy)
export function eventsListHTML(state, key) {
  const events = sortedEvents(state.days[key]);
  if (!events.length) return '';
  return `
    <ul class="ev-list ev-list-compact">
      ${events.map((ev) => `
        <li class="ev">
          <span class="ev-main">
            <span class="ev-bar"></span>
            <span class="ev-time">${esc(eventTimeLabel(ev))}</span>
            <span class="ev-title">${esc(ev.title)}</span>
          </span>
        </li>`).join('')}
    </ul>`;
}

export const eventIcon = () => icon('clock');
