const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

let activeMonth = 'next';
let activeType = 'new';
const cache = {};

function initLabels() {
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const nxt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  document.getElementById('label-current').textContent =
    `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`;
  document.getElementById('label-next').textContent =
    `${MONTH_NAMES[nxt.getMonth()]} ${nxt.getFullYear()}`;
}

function setMonth(which) {
  activeMonth = which;
  document.getElementById('btn-current').classList.toggle('month-toggle__btn--active', which === 'current');
  document.getElementById('btn-next').classList.toggle('month-toggle__btn--active', which === 'next');
  document.getElementById('btn-current').setAttribute('aria-selected', which === 'current');
  document.getElementById('btn-next').setAttribute('aria-selected', which === 'next');
  load();
}

function setType(which) {
  activeType = which;
  document.getElementById('btn-new').classList.toggle('month-toggle__btn--active', which === 'new');
  document.getElementById('btn-existing').classList.toggle('month-toggle__btn--active', which === 'existing');
  document.getElementById('btn-new').setAttribute('aria-selected', which === 'new');
  document.getElementById('btn-existing').setAttribute('aria-selected', which === 'existing');
  load();
}

async function load() {
  const key = `${activeType}:${activeMonth}`;

  if (cache[key]) {
    render(cache[key]);
    return;
  }

  showLoading();

  try {
    const res = await fetch(`/api/availability?month=${activeMonth}&type=${activeType}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Unknown error');

    cache[key] = data;
    render(data);
  } catch (err) {
    showError(err.message);
  }
}

function render(data) {
  const { monthLabel, year, month, dates } = data;
  const availSet = new Set(dates);

  document.getElementById('loading').hidden = true;
  document.getElementById('error').hidden = true;
  const wrap = document.getElementById('calendar-wrap');
  wrap.hidden = false;

  document.getElementById('month-title').textContent = monthLabel;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  WEEKDAYS.forEach((d) => {
    const hdr = document.createElement('div');
    hdr.className = 'calendar-grid__header';
    hdr.textContent = d;
    grid.appendChild(hdr);
  });

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-grid__day calendar-grid__day--outside';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'calendar-grid__day';
    cell.textContent = d;

    if (availSet.has(dateStr)) cell.classList.add('calendar-grid__day--available');
    if (dateStr === todayStr) cell.classList.add('calendar-grid__day--today');

    cell.setAttribute('aria-label', `${MONTH_NAMES[month]} ${d}${availSet.has(dateStr) ? ', available' : ', unavailable'}`);
    grid.appendChild(cell);
  }

  const typeLabel = activeType === 'new' ? 'new patients' : 'existing patients';
  const summary = document.getElementById('summary');
  if (dates.length > 0) {
    summary.innerHTML = `<strong>Available for ${typeLabel} on:</strong> ${dates.join(', ')}`;
  } else {
    summary.innerHTML = `No availability for ${typeLabel} this month.`;
  }
}

function showLoading() {
  document.getElementById('loading').hidden = false;
  document.getElementById('error').hidden = true;
  document.getElementById('calendar-wrap').hidden = true;
}

function showError(msg) {
  document.getElementById('loading').hidden = true;
  document.getElementById('error').hidden = false;
  document.getElementById('error-msg').textContent = msg;
  document.getElementById('calendar-wrap').hidden = true;
}

function retry() {
  const key = `${activeType}:${activeMonth}`;
  delete cache[key];
  load();
}

document.addEventListener('DOMContentLoaded', () => {
  initLabels();
  load();
});
