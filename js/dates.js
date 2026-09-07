// Utilidades de fechas. Las claves de día son 'YYYY-MM-DD' y las de mes 'YYYY-MM'.

export const pad = (n) => String(n).padStart(2, '0');

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
export const currentMonth = () => todayKey().slice(0, 7);

export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export const monthOf = (k) => k.slice(0, 7);
export const yearOf = (k) => Number(k.slice(0, 4));
export const dayNum = (k) => Number(k.slice(8, 10));

export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const monthDays = (ym) => Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`);

export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

// 0 = lunes … 6 = domingo
export const weekdayIdx = (k) => (parseKey(k).getDay() + 6) % 7;

export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${cap(MONTHS[m - 1])} ${y}`;
};

export const monthShort = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${cap(MONTHS[m - 1].slice(0, 3))} ${String(y).slice(2)}`;
};

export const dayLabel = (k) => {
  const d = parseKey(k);
  return `${cap(WEEKDAYS[weekdayIdx(k)])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

export const dayLabelShort = (k) => {
  const d = parseKey(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const isFuture = (k) => k > todayKey();
export const isToday = (k) => k === todayKey();

export const rangeDays = (from, to) => {
  const out = [];
  let k = from;
  while (k <= to) {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
};
