// Gráficas SVG sin dependencias. Cada gráfica se declara como placeholder con su especificación
// y se dibuja al montar la vista, midiendo el ancho real del contenedor (y se redibuja al cambiar de tamaño).

import { esc, fmtNum } from './ui.js';

export function chart(type, spec, cls = '') {
  return `<div class="chart ${cls}" data-chart="${type}" data-spec="${encodeURIComponent(JSON.stringify(spec))}"></div>`;
}

const observer = new ResizeObserver((entries) => {
  for (const e of entries) {
    const el = e.target;
    const w = Math.round(e.contentRect.width);
    if (w && el._w !== w) {
      el._w = w;
      draw(el, w);
    }
  }
});

export function mountCharts(root) {
  root.querySelectorAll('[data-chart]').forEach((el) => {
    el._spec = JSON.parse(decodeURIComponent(el.dataset.spec));
    el._w = Math.round(el.getBoundingClientRect().width);
    draw(el, el._w);
    observer.observe(el);
  });
}

function draw(el, width) {
  const spec = el._spec;
  if (!spec) return;
  const W = Math.max(200, width || 320);
  switch (el.dataset.chart) {
    case 'line': renderLine(el, spec, W); break;
    case 'bars': renderBars(el, spec, W); break;
    case 'heatmap': renderHeatmap(el, spec); break;
    default: break;
  }
}

// ---------- helpers ----------
function niceStep(range, ticks = 4) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

function scaleY(values, domain) {
  if (domain) return { min: domain[0], max: domain[1], step: niceStep(domain[1] - domain[0]) };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  const step = niceStep(max - min + pad * 2);
  return { min: Math.floor((min - pad) / step) * step, max: Math.ceil((max + pad) / step) * step, step };
}

function ticksOf(min, max, step) {
  const out = [];
  for (let v = min; v <= max + step / 2; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function tipHTML() {
  return '<div class="chart-tip" hidden></div>';
}

function showTip(el, html, x, y) {
  const tip = el.querySelector('.chart-tip');
  tip.innerHTML = html;
  tip.hidden = false;
  const w = el.clientWidth;
  const tw = tip.offsetWidth;
  let left = x + 12;
  if (left + tw > w - 4) left = x - tw - 12;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
}

function hideTip(el) {
  const tip = el.querySelector('.chart-tip');
  if (tip) tip.hidden = true;
}

// ---------- Línea ----------
// spec: { points:[{label, value, full}], unit, decimals, goal, goalLabel, domain, height, color }
function renderLine(el, spec, W) {
  const H = spec.height || 220;
  const padL = 40; const padR = 18; const padT = 18; const padB = 28;
  const pts = spec.points || [];
  const present = pts.map((p, i) => ({ ...p, i })).filter((p) => p.value != null);
  if (!present.length) {
    el.innerHTML = `<div class="chart-empty" style="height:${H}px">${esc(spec.empty || 'Sin datos todavía')}</div>`;
    return;
  }
  const vals = present.map((p) => p.value).concat(spec.goal != null ? [spec.goal] : []);
  const { min, max, step } = scaleY(vals, spec.domain);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = pts.length;
  const x = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;
  const color = spec.color || 'var(--series-1)';
  const dec = spec.decimals ?? 1;

  let ticks = ticksOf(min, max, step);
  if (ticks.length > 7) ticks = ticks.filter((_, i) => i % 2 === 0);

  const linePath = present.map((p, i) => `${i ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(present[present.length - 1].i).toFixed(1)} ${(padT + plotH).toFixed(1)} L${x(present[0].i).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const every = Math.max(1, Math.ceil(n / Math.floor(plotW / 44)));
  const xLabels = pts.map((p, i) => ((i % every === 0) || i === n - 1) && !(i === n - 1 && (n - 1) % every !== 0 && (n - 1) % every < every / 2)
    ? `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : '').join('');

  const showMarkers = n <= 62;
  const last = present[present.length - 1];
  const markers = showMarkers ? present.map((p) => `<circle class="pt" cx="${x(p.i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`).join('') : '';
  const labelAnchor = x(last.i) > W - 60 ? 'end' : 'start';
  const labelDx = labelAnchor === 'end' ? -8 : 8;

  el.innerHTML = `
    <svg class="line-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.title || '')}">
      ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
        <text class="ax" x="${padL - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${fmtNum(t, 2)}</text>`).join('')}
      ${xLabels}
      <path class="area" d="${areaPath}" fill="${color}"/>
      <path class="line" d="${linePath}" stroke="${color}"/>
      ${spec.goal != null ? `<line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(spec.goal).toFixed(1)}" y2="${y(spec.goal).toFixed(1)}"/>
        <text class="goal-label" x="${W - padR}" y="${(y(spec.goal) - 5).toFixed(1)}" text-anchor="end">${esc(spec.goalLabel || 'Objetivo')} ${fmtNum(spec.goal, dec)}${spec.unit ? ' ' + esc(spec.unit) : ''}</text>` : ''}
      ${markers}
      <text class="pt-label" x="${(x(last.i) + labelDx).toFixed(1)}" y="${(y(last.value) - 9).toFixed(1)}" text-anchor="${labelAnchor}">${fmtNum(last.value, dec)}${spec.unit ? ' ' + esc(spec.unit) : ''}</text>
      <line class="hover-line" x1="0" x2="0" y1="${padT}" y2="${padT + plotH}" hidden/>
      <circle class="hover-dot" r="5" fill="${color}" stroke="var(--surface)" stroke-width="2" hidden/>
      <rect class="hover-area" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"/>
    </svg>${tipHTML()}`;

  const svg = el.querySelector('svg');
  const hoverLine = svg.querySelector('.hover-line');
  const hoverDot = svg.querySelector('.hover-dot');
  const area = svg.querySelector('.hover-area');
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    let best = null;
    for (const p of present) {
      const d = Math.abs(x(p.i) - px);
      if (!best || d < best.d) best = { p, d };
    }
    if (!best) return;
    const cx = x(best.p.i); const cy = y(best.p.value);
    hoverLine.setAttribute('x1', cx); hoverLine.setAttribute('x2', cx); hoverLine.hidden = false;
    hoverDot.setAttribute('cx', cx); hoverDot.setAttribute('cy', cy); hoverDot.hidden = false;
    showTip(el, `<b>${fmtNum(best.p.value, dec)}${spec.unit ? ' ' + esc(spec.unit) : ''}</b><span>${esc(best.p.full || best.p.label)}</span>`, cx, cy);
  };
  const leave = () => { hoverLine.hidden = true; hoverDot.hidden = true; hideTip(el); };
  area.addEventListener('pointermove', move);
  area.addEventListener('pointerdown', move);
  area.addEventListener('pointerleave', leave);
}

// ---------- Barras verticales ----------
// spec: { items:[{label, value, full}], unit, decimals, max, height, color, showValues }
function renderBars(el, spec, W) {
  const H = spec.height || 180;
  const padL = 36; const padR = 10; const padT = 22; const padB = 26;
  const items = spec.items || [];
  const present = items.filter((it) => it.value != null);
  if (!present.length) {
    el.innerHTML = `<div class="chart-empty" style="height:${H}px">${esc(spec.empty || 'Sin datos todavía')}</div>`;
    return;
  }
  // Las barras siempre parten de 0: el eje nunca baja de la línea base.
  const maxV = spec.max ?? Math.max(...present.map((it) => it.value), 0);
  const step = niceStep(spec.max != null ? spec.max : Math.max(maxV * 1.15, 1));
  const min = 0;
  const max = spec.max != null ? spec.max : Math.max(step, Math.ceil((maxV * 1.15) / step) * step);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / items.length;
  const bw = Math.max(6, Math.min(44, slot - 8));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;
  const color = spec.color || 'var(--series-1)';
  const dec = spec.decimals ?? 1;
  const ticks = ticksOf(min, max, step);

  el.innerHTML = `
    <svg class="bar-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.title || '')}">
      ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
        <text class="ax" x="${padL - 8}" y="${(y(t) + 3.5).toFixed(1)}" text-anchor="end">${fmtNum(t, 1)}${spec.unit === '%' ? '%' : ''}</text>`).join('')}
      ${items.map((it, i) => {
        const cx = padL + slot * i + slot / 2;
        const label = `<text class="ax" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(it.label)}</text>`;
        if (it.value == null) return label;
        const top = y(it.value);
        const h = Math.max(0, padT + plotH - top);
        return `${label}
          <rect class="bar" data-i="${i}" x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}"/>
          ${spec.showValues ? `<text class="val" x="${cx.toFixed(1)}" y="${(top - 6).toFixed(1)}" text-anchor="middle">${fmtNum(it.value, dec)}${spec.unit === '%' ? '%' : ''}</text>` : ''}`;
      }).join('')}
      <line class="grid baseline" x1="${padL}" x2="${W - padR}" y1="${(padT + plotH).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}"/>
    </svg>${tipHTML()}`;

  el.querySelectorAll('.bar').forEach((bar) => {
    const it = items[Number(bar.dataset.i)];
    const show = () => {
      const r = bar.getBoundingClientRect(); const er = el.getBoundingClientRect();
      showTip(el, `<b>${fmtNum(it.value, dec)}${spec.unit ? (spec.unit === '%' ? '%' : ' ' + esc(spec.unit)) : ''}</b><span>${esc(it.full || it.label)}</span>`, r.left - er.left + r.width / 2, r.top - er.top);
    };
    bar.addEventListener('pointerenter', show);
    bar.addEventListener('pointerdown', show);
    bar.addEventListener('pointerleave', () => hideTip(el));
  });
}

// ---------- Mapa de calor anual ----------
// spec: { year, data:{ 'YYYY-MM-DD': pct } }
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function renderHeatmap(el, spec) {
  const cell = 12; const gap = 3; const padL = 26; const padT = 18;
  const year = spec.year;
  const first = new Date(year, 0, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, 0, 1 - startOffset);
  const end = new Date(year, 11, 31);
  const weeks = Math.ceil(((end - start) / 86400000 + 1) / 7);
  const W = padL + weeks * (cell + gap);
  const H = padT + 7 * (cell + gap);
  const pad2 = (n) => String(n).padStart(2, '0');
  let rects = '';
  let monthLabels = '';
  let lastMonth = -1;
  for (let w = 0; w < weeks; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      if (date.getFullYear() !== year) continue;
      const key = `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      if (d === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        monthLabels += `<text class="ax" x="${padL + w * (cell + gap)}" y="${padT - 6}">${MONTH_ABBR[lastMonth]}</text>`;
      }
      const pct = spec.data[key];
      const level = pct == null ? 0 : pct >= 85 ? 4 : pct >= 60 ? 3 : pct >= 35 ? 2 : 1;
      rects += `<rect class="heat h${level}" x="${padL + w * (cell + gap)}" y="${padT + d * (cell + gap)}" width="${cell}" height="${cell}" rx="2" data-key="${key}" data-pct="${pct ?? ''}"/>`;
    }
  }
  const dow = ['L', '', 'X', '', 'V', '', 'D'].map((t, i) => (t ? `<text class="ax" x="${padL - 8}" y="${padT + i * (cell + gap) + cell - 2}" text-anchor="end">${t}</text>` : '')).join('');
  el.innerHTML = `<div class="heat-scroll"><svg class="heatmap" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumplimiento diario ${year}">${monthLabels}${dow}${rects}</svg></div>${tipHTML()}`;
  const scroll = el.querySelector('.heat-scroll');
  el.querySelectorAll('.heat').forEach((r) => {
    const show = () => {
      const rr = r.getBoundingClientRect(); const er = el.getBoundingClientRect();
      const [y, m, d] = r.dataset.key.split('-').map(Number);
      const pct = r.dataset.pct;
      showTip(el, `<b>${pct === '' ? 'Sin registro' : pct + '%'}</b><span>${d} ${MONTH_ABBR[m - 1]} ${y}</span>`, rr.left - er.left + cell / 2, rr.top - er.top);
    };
    r.addEventListener('pointerenter', show);
    r.addEventListener('pointerdown', show);
    r.addEventListener('pointerleave', () => hideTip(el));
  });
  scroll.addEventListener('scroll', () => hideTip(el));
  // Desplaza hasta la semana actual si el año es el actual
  const now = new Date();
  if (now.getFullYear() === year) scroll.scrollLeft = Math.max(0, ((now - start) / 86400000 / 7) * (cell + gap) - scroll.clientWidth * 0.6);
}

// ---------- Anillo de progreso (HTML + SVG, no necesita medir) ----------
export function ring({ pct, size = 140, stroke = 12, label, sub, color = 'var(--series-1)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return `
    <div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
        <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke="${color}"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>
      <div class="ring-center"><div class="ring-value">${label ?? (pct == null ? '—' : Math.round(pct) + '%')}</div>${sub ? `<div class="ring-sub">${sub}</div>` : ''}</div>
    </div>`;
}

// ---------- Lista de barras horizontales (HTML) ----------
export function barList(items, { unit = '%', decimals = 0 } = {}) {
  if (!items.length) return '<div class="chart-empty">Sin datos todavía</div>';
  return `<div class="bar-list">${items.map((it) => `
    <div class="bar-row" title="${esc(it.title || '')}">
      <span class="bar-label"><span class="bar-emoji">${esc(it.emoji || '')}</span><span class="bar-name">${esc(it.label)}</span></span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(0, Math.min(100, it.pct ?? 0))}%"></span></span>
      <span class="bar-val">${it.value == null ? '—' : fmtNum(it.value, decimals) + (unit === '%' ? '%' : ' ' + unit)}</span>
    </div>`).join('')}</div>`;
}

// Tabla de datos equivalente a una serie (accesibilidad / vista tabla)
export function dataTable(rows, headers) {
  if (!rows.length) return '';
  return `<details class="chart-data"><summary>Ver datos</summary><div class="tbl-wrap"><table class="tbl">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
