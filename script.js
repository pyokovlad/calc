'use strict';

const STORAGE = 'atlant-earnings-v5';

const DEFAULT_TARIFFS = {
  city: {
    minWeekday: 4400,
    minWeekend: 4500,
    pointWeekday: 150,
    pointWeekend: 155,
    order: 5,
    lot: 27,
    multi4Weekday: 150,
    multi4Weekend: 155,
    multi5Weekday: 42,
    multi5Weekend: 42
  },
  country: {
    minWeekday: 3950,
    minWeekend: 4050,
    pointWeekday: 140,
    pointWeekend: 150,
    order: 4,
    lot: 48,
    multi4Weekday: 140,
    multi4Weekend: 150,
    multi5Weekday: 38,
    multi5Weekend: 38
  },
  car: {
    '4_20': 2000,
    '21_50': 2100,
    '51_80': 2200,
    '81_100': 2300,
    '101_120': 2400,
    '121_plus': 2500
  }
};

const TARIFF_LABELS = {
  city: {
    minWeekday: 'Минимум — будни',
    minWeekend: 'Минимум — выходные',
    pointWeekday: 'Точка — будни',
    pointWeekend: 'Точка — выходные',
    order: 'Обычный заказ',
    lot: 'ЛОТ',
    multi4Weekday: 'Мульти ≤4 — будни',
    multi4Weekend: 'Мульти ≤4 — выходные',
    multi5Weekday: 'Мульти 5+ — будни',
    multi5Weekend: 'Мульти 5+ — выходные'
  },
  country: {
    minWeekday: 'Минимум — будни',
    minWeekend: 'Минимум — выходные',
    pointWeekday: 'Точка — будни',
    pointWeekend: 'Точка — выходные',
    order: 'Обычный заказ',
    lot: 'ЛОТ',
    multi4Weekday: 'Мульти ≤4 — будни',
    multi4Weekend: 'Мульти ≤4 — выходные',
    multi5Weekday: 'Мульти 5+ — будни',
    multi5Weekend: 'Мульти 5+ — выходные'
  },
  car: {
    '4_20': '4–20 км',
    '21_50': '21–50 км',
    '51_80': '51–80 км',
    '81_100': '81–100 км',
    '101_120': '101–120 км',
    '121_plus': '121+ км'
  }
};

const state = {
  data: {
    days: [],
    cars: [],
    extras: []
  },
  tariffs: clone(DEFAULT_TARIFFS)
};

let selectedMonth = currentMonth();
let dayStep = 1;
let actualQueue = [];
let actualIndex = 0;
let toastTimer = null;

const $ = id => document.getElementById(id);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0))} ₽`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function today() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function monthOf(date) {
  return date ? String(date).slice(0, 7) : '';
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthName(month, withYear = true) {
  const d = new Date(`${month}-01T12:00:00`);
  return d.toLocaleDateString('ru-RU', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {})
  });
}

function fmtDate(date) {
  if (!date) return '—';
  return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));
}

function numberValue(id) {
  const input = $(id);
  const n = Number(input?.value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function hasActual(item) {
  return item && item.actual !== null && item.actual !== undefined && item.actual !== '';
}

function isWeekend(date) {
  if (!date) return false;
  const d = new Date(`${date}T12:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.data.days = Array.isArray(saved?.data?.days) ? saved.data.days : [];
    state.data.cars = Array.isArray(saved?.data?.cars) ? saved.data.cars : [];
    state.data.extras = Array.isArray(saved?.data?.extras) ? saved.data.extras : [];
    state.tariffs = mergeTariffs(DEFAULT_TARIFFS, saved.tariffs || {});
  } catch (error) {
    console.error(error);
    toast('Не удалось загрузить сохранённые данные');
  }
}

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
}

function mergeTariffs(defaults, saved) {
  return {
    city: { ...defaults.city, ...(saved.city || {}) },
    country: { ...defaults.country, ...(saved.country || {}) },
    car: { ...defaults.car, ...(saved.car || {}) }
  };
}

function calcCar(km) {
  const n = Number(km) || 0;
  if (n >= 4 && n <= 20) return Number(state.tariffs.car['4_20']) || 0;
  if (n >= 21 && n <= 50) return Number(state.tariffs.car['21_50']) || 0;
  if (n >= 51 && n <= 80) return Number(state.tariffs.car['51_80']) || 0;
  if (n >= 81 && n <= 100) return Number(state.tariffs.car['81_100']) || 0;
  if (n >= 101 && n <= 120) return Number(state.tariffs.car['101_120']) || 0;
  if (n >= 121) return Number(state.tariffs.car['121_plus']) || 0;
  return 0;
}

function calcDay(day) {
  const tariff = day.tariff === 'country' ? state.tariffs.country : state.tariffs.city;
  const weekend = isWeekend(day.date);
  const point = weekend ? tariff.pointWeekend : tariff.pointWeekday;
  const minimum = weekend ? tariff.minWeekend : tariff.minWeekday;
  const multi4 = weekend ? tariff.multi4Weekend : tariff.multi4Weekday;
  const multi5 = weekend ? tariff.multi5Weekend : tariff.multi5Weekday;

  const base =
    (Number(day.points) || 0) * (Number(point) || 0) +
    (Number(day.orders) || 0) * (Number(tariff.order) || 0) +
    (Number(day.lots) || 0) * (Number(tariff.lot) || 0) +
    (Number(day.multi4) || 0) * (Number(multi4) || 0) +
    (Number(day.multi5) || 0) * (Number(multi5) || 0);

  const beforeExtra = Math.max(Number(minimum) || 0, base);
  const extra = Number(day.extraAmount) || 0;

  return { base, minimum, beforeExtra, extra, calculated: beforeExtra + extra, weekend };
}

function monthData(month) {
  return {
    days: state.data.days.filter(x => monthOf(x.date) === month),
    cars: state.data.cars.filter(x => monthOf(x.date) === month),
    extras: state.data.extras.filter(x => monthOf(x.date) === month)
  };
}

function carAmount(car) {
  return car.amount !== '' && car.amount !== null && car.amount !== undefined
    ? Number(car.amount) || 0
    : calcCar(car.km);
}

function totals(month) {
  const { days, cars, extras } = monthData(month);
  let calculated = 0;
  let received = 0;
  let expected = 0;

  days.forEach(day => {
    const amount = calcDay(day).calculated;
    calculated += amount;
    if (hasActual(day)) received += Number(day.actual) || 0;
    else expected += amount;
  });

  extras.forEach(extra => {
    const amount = Number(extra.amount) || 0;
    calculated += amount;
    if (hasActual(extra)) received += Number(extra.actual) || 0;
    else expected += amount;
  });

  cars.forEach(car => {
    const amount = carAmount(car);
    calculated += amount;
    if (hasActual(car)) received += Number(car.actual) || 0;
    else expected += amount;
  });

  return { calculated, received, expected };
}

function paymentGroups(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const next = shiftMonth(month, 1);

  const periods = [
    {
      label: '1–15',
      from: `${month}-01`,
      to: `${month}-15`,
      window: `выплата 25–30 ${monthName(month, false)}`
    },
    {
      label: '16–конец',
      from: `${month}-16`,
      to: `${month}-${String(daysInMonth).padStart(2, '0')}`,
      window: `выплата 15–20 ${monthName(next, false)}`
    }
  ];

  return periods.map(period => {
    const days = state.data.days.filter(x => x.date >= period.from && x.date <= period.to);
    const cars = state.data.cars.filter(x => x.date >= period.from && x.date <= period.to);
    const extras = state.data.extras.filter(x => x.date >= period.from && x.date <= period.to);
    let received = 0;
    let expected = 0;

    days.forEach(day => hasActual(day) ? received += Number(day.actual) || 0 : expected += calcDay(day).calculated);
    cars.forEach(car => hasActual(car) ? received += Number(car.actual) || 0 : expected += carAmount(car));
    extras.forEach(extra => hasActual(extra) ? received += Number(extra.actual) || 0 : expected += Number(extra.amount) || 0);

    return { ...period, days, cars, extras, received, expected };
  });
}

function showPage(pageId) {
  const page = $(pageId);
  if (!page) return;

  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === pageId));
  document.querySelectorAll('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === pageId));

  if (pageId === 'homePage') renderDashboard();
  if (pageId === 'daysPage') renderDays();
  if (pageId === 'tariffsPage') renderTariffs();
  if (pageId === 'paymentsPage') renderPayments();
}

function renderDashboard() {
  const { days, cars } = monthData(selectedMonth);
  const t = totals(selectedMonth);
  $('monthLabel').textContent = monthName(selectedMonth);
  $('dashboardTotal').textContent = money(t.calculated);
  $('dashboardReceived').textContent = money(t.received);
  $('dashboardExpected').textContent = money(t.expected);
  $('dashboardDaysCount').textContent = `${days.length} ${plural(days.length, 'смена', 'смены', 'смен')}`;
  $('dashboardCarCount').textContent = `${cars.length} ${plural(cars.length, 'перегон', 'перегона', 'перегонов')}`;

  const groups = paymentGroups(selectedMonth);
  $('dashboardPeriods').innerHTML = groups.map(group => `
    <div class="period-mini">
      <div><b>${group.label}</b><small>${escapeHtml(group.window)}</small></div>
      <strong>${money(group.received + group.expected)}</strong>
    </div>
  `).join('');
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function renderDays() {
  $('daysMonthPicker').value = selectedMonth;
  renderDailyChart();
  const { days, cars, extras } = monthData(selectedMonth);
  const t = totals(selectedMonth);

  $('daysSummary').innerHTML = `
    <span class="summary-chip">Расчёт: <b>${money(t.calculated)}</b></span>
    <span class="summary-chip">Получено: <b>${money(t.received)}</b></span>
    <span class="summary-chip">Ожидаем: <b>${money(t.expected)}</b></span>
  `;

  const items = [];
  days.forEach(day => items.push({ date: day.date, type: 'day', data: day }));
  cars.forEach(car => items.push({ date: car.date, type: 'car', data: car }));
  extras.filter(extra => !extra.dayId).forEach(extra => items.push({ date: extra.date, type: 'extra', data: extra }));
  items.sort((a, b) => a.date.localeCompare(b.date));

  if (!items.length) {
    $('daysList').innerHTML = '<div class="empty">В этом месяце пока нет записей.<br><br>Нажми «＋ День», чтобы добавить первую смену.</div>';
    return;
  }

  $('daysList').innerHTML = items.map(item => {
    if (item.type === 'day') return renderDayCard(item.data);
    if (item.type === 'car') return renderCarCard(item.data);
    return renderExtraCard(item.data);
  }).join('');
}

function renderDailyChart() {
  const chart = $('dailyChart');
  const totalEl = $('daysChartTotal');
  if (!chart) return;

  const { days, cars, extras } = monthData(selectedMonth);
  const entries = [];

  // Каждый день показывается отдельной точкой/столбцом.
  // Если фактическая выплата уже внесена — используем её,
  // иначе показываем расчётную сумму.
  days.forEach(day => {
    entries.push({
      date: day.date,
      amount: hasActual(day) ? Number(day.actual) || 0 : calcDay(day).calculated,
      actual: hasActual(day)
    });
  });

  // Отдельные доплаты и перегоны без смены также являются заработком дня.
  extras.filter(extra => !extra.dayId).forEach(extra => {
    const entry = entries.find(x => x.date === extra.date);
    const amount = hasActual(extra) ? Number(extra.actual) || 0 : Number(extra.amount) || 0;
    if (entry) {
      entry.amount += amount;
      entry.actual = entry.actual && hasActual(extra);
    } else {
      entries.push({ date: extra.date, amount, actual: hasActual(extra) });
    }
  });

  cars.forEach(car => {
    const entry = entries.find(x => x.date === car.date);
    const amount = hasActual(car) ? Number(car.actual) || 0 : carAmount(car);
    if (entry) {
      entry.amount += amount;
      entry.actual = entry.actual && hasActual(car);
    } else {
      entries.push({ date: car.date, amount, actual: hasActual(car) });
    }
  });

  entries.sort((a, b) => a.date.localeCompare(b.date));

  if (!entries.length) {
    chart.className = 'daily-chart empty';
    chart.innerHTML = 'В этом месяце пока нет заработка';
    if (totalEl) totalEl.textContent = money(0);
    return;
  }

  chart.className = 'daily-chart';
  const max = Math.max(...entries.map(x => x.amount), 1);
  const total = entries.reduce((sum, x) => sum + x.amount, 0);
  if (totalEl) totalEl.textContent = money(total);

  const ticks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const axis = ticks.map(value => `<span>${formatShortMoney(value)}</span>`).join('');

  const columns = entries.map(entry => {
    const height = entry.amount > 0 ? Math.max(3, (entry.amount / max) * 100) : 0;
    const label = new Date(`${entry.date}T12:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const barClass = entry.actual ? 'chart-bar actual' : 'chart-bar';
    const dateClass = entry.actual ? 'chart-date actual-date' : 'chart-date';
    return `
      <div class="chart-column" title="${escapeHtml(label)} — ${escapeHtml(money(entry.amount))}${entry.actual ? ' · фактически' : ' · расчёт'}">
        <div class="chart-bar-wrap">
          <div class="${barClass}" style="height:${height}%;"></div>
          <div class="chart-value" style="--bar-height:${height}%">${escapeHtml(money(entry.amount))}</div>
        </div>
        <div class="${dateClass}">${escapeHtml(label)}</div>
      </div>
    `;
  }).join('');

  chart.innerHTML = `
    <div class="chart-inner">
      <div class="chart-y-axis">${axis}</div>
      <div class="chart-plot"><div class="chart-columns">${columns}</div></div>
    </div>
  `;
}

function formatShortMoney(value) {
  const n = Math.round(Number(value) || 0);
  if (n >= 1000) return `${Math.round(n / 1000)}к`;
  return String(n);
}

function renderDayCard(day) {
  const calc = calcDay(day);
  const attachedExtras = state.data.extras.filter(x => x.dayId === day.id);
  return `
    <article class="data-card">
      <div class="data-card-top">
        <div><strong>${escapeHtml(fmtDate(day.date))}</strong><small>${day.tariff === 'city' ? 'Город' : 'Загород'}${calc.weekend ? ' · выходной тариф' : ' · будний тариф'}</small></div>
        <strong class="amount">${money(calc.calculated)}</strong>
      </div>
      <div class="data-stats">
        <span>${Number(day.points) || 0} точек</span>
        <span>${Number(day.orders) || 0} заказов</span>
        <span>${Number(day.lots) || 0} ЛОТов</span>
        ${Number(day.mgt) ? `<span>${Number(day.mgt)} МГТ</span>` : ''}
        ${Number(day.multi4) ? `<span>${Number(day.multi4)} мульти ≤4</span>` : ''}
        ${Number(day.multi5) ? `<span>${Number(day.multi5)} мульти 5+</span>` : ''}
      </div>
      ${day.note ? `<div class="data-extra">${escapeHtml(day.note)}</div>` : ''}
      ${day.extraAmount ? `<div class="data-extra">+${money(day.extraAmount)}${day.extraReason ? ` · ${escapeHtml(day.extraReason)}` : ''}</div>` : ''}
      ${attachedExtras.length ? attachedExtras.map(x => `<div class="data-extra">+${money(x.amount)} · ${escapeHtml(x.reason)}</div>`).join('') : ''}
      <div class="data-card-bottom">
        ${hasActual(day) ? `<span class="actual-badge">Факт ${money(day.actual)}</span>` : '<span class="actual-badge" style="color:#a1afbb;background:#121e29;border-color:#263746">Факт не внесён</span>'}
        <div class="card-actions"><button class="mini-btn" data-edit-day="${day.id}" type="button">Изменить</button><button class="mini-btn danger" data-delete-day="${day.id}" type="button">Удалить</button></div>
      </div>
    </article>
  `;
}

function renderCarCard(car) {
  return `
    <article class="data-card">
      <div class="data-card-top"><div><strong>${escapeHtml(fmtDate(car.date))}</strong><small>Перегон автомобиля · ${Number(car.km) || 0} км</small></div><strong class="amount">${money(carAmount(car))}</strong></div>
      ${car.note ? `<div class="data-extra">${escapeHtml(car.note)}</div>` : ''}
      <div class="data-card-bottom">${hasActual(car) ? `<span class="actual-badge">Факт ${money(car.actual)}</span>` : '<span class="actual-badge" style="color:#a1afbb;background:#121e29;border-color:#263746">Факт не внесён</span>'}<div class="card-actions"><button class="mini-btn" data-edit-car="${car.id}" type="button">Изменить</button><button class="mini-btn danger" data-delete-car="${car.id}" type="button">Удалить</button></div></div>
    </article>
  `;
}

function renderExtraCard(extra) {
  return `
    <article class="data-card">
      <div class="data-card-top"><div><strong>${escapeHtml(fmtDate(extra.date))}</strong><small>Отдельная доплата</small></div><strong class="amount">${money(extra.amount)}</strong></div>
      <div class="data-extra">${escapeHtml(extra.reason)}</div>
      ${hasActual(extra) ? `<div class="actual-badge">Факт ${money(extra.actual)}</div>` : '<span class="actual-badge" style="color:#a1afbb;background:#121e29;border-color:#263746">Факт не внесён</span>'}
      <div class="card-actions" style="margin-top:12px"><button class="mini-btn" data-edit-extra="${extra.id}" type="button">Изменить</button><button class="mini-btn danger" data-delete-extra="${extra.id}" type="button">Удалить</button></div>
    </article>
  `;
}

function renderPayments() {
  const groups = paymentGroups(selectedMonth);
  $('paymentsList').innerHTML = groups.map(group => {
    const total = group.received + group.expected;
    const entries = [
      ...group.days.map(x => ({ date: x.date, text: `Смена · ${x.tariff === 'city' ? 'город' : 'загород'}`, amount: hasActual(x) ? Number(x.actual) || 0 : calcDay(x).calculated, actual: hasActual(x) })),
      ...group.extras.map(x => ({ date: x.date, text: `Доплата · ${x.reason}`, amount: hasActual(x) ? Number(x.actual) || 0 : Number(x.amount) || 0, actual: hasActual(x) })),
      ...group.cars.map(x => ({ date: x.date, text: `Перегон · ${Number(x.km) || 0} км`, amount: hasActual(x) ? Number(x.actual) || 0 : carAmount(x), actual: hasActual(x) }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    return `
      <section class="payment-period">
        <div class="payment-period-head"><div><strong>${group.label}</strong><small>${escapeHtml(group.window)}</small></div><strong class="payment-total">${money(total)}</strong></div>
        <div class="payment-body">
          <div class="payment-row"><span>Получено</span><b>${money(group.received)}</b></div>
          <div class="payment-row"><span>Ожидается</span><b>${money(group.expected)}</b></div>
          ${entries.length ? `<div style="margin-top:10px;padding-top:5px;border-top:1px solid #1d2a35">${entries.map(e => `<div class="payment-row"><span>${escapeHtml(fmtDate(e.date))} · ${escapeHtml(e.text)} ${e.actual ? '✓' : ''}</span><b>${money(e.amount)}</b></div>`).join('')}</div>` : '<div class="empty" style="margin-top:12px">В этом периоде нет начислений.</div>'}
        </div>
      </section>
    `;
  }).join('');
}

function renderTariffs() {
  renderTariffGroup('city', 'cityFields');
  renderTariffGroup('country', 'countryFields');
  renderTariffGroup('car', 'carFields');
}

function renderTariffGroup(group, containerId) {
  const container = $(containerId);
  container.innerHTML = Object.entries(state.tariffs[group]).map(([key, value]) => `
    <label class="tariff-row"><span>${escapeHtml(TARIFF_LABELS[group][key])}</span><input type="number" min="0" step="1" data-tariff="${group}.${key}" value="${Number(value) || 0}"></label>
  `).join('');
}

function openModal(id) {
  $(id)?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal(id) {
  $(id)?.classList.add('hidden');
  if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
}

function resetDayForm(day = null) {
  dayStep = 1;
  const form = $('dayForm');
  form.dataset.id = day?.id || '';
  $('wizardLabel').textContent = day ? 'РЕДАКТИРОВАНИЕ СМЕНЫ' : 'НОВАЯ СМЕНА';
  $('dayModalTitle').textContent = day ? 'Изменить день' : 'Добавить день';
  $('dayDate').value = day?.date || today();
  $('dayTariff').value = day?.tariff || 'city';
  $('dayNote').value = day?.note || '';
  $('dayPoints').value = day?.points ?? '';
  $('dayOrders').value = day?.orders ?? '';
  $('dayLots').value = day?.lots ?? '';
  $('dayMgt').value = day?.mgt ?? '';
  $('dayMulti4').value = day?.multi4 ?? '';
  $('dayMulti5').value = day?.multi5 ?? '';
  $('dayExtraAdd').value = day?.extraAmount ?? '';
  $('dayExtraReason').value = day?.extraReason || '';
  updateDayWizard();
}

function updateDayWizard() {
  document.querySelectorAll('#dayForm .step').forEach(step => step.classList.toggle('active', Number(step.dataset.step) === dayStep));
  document.querySelectorAll('#dayProgress i').forEach((el, index) => el.classList.toggle('active', index < dayStep));
  $('wizardBack').disabled = dayStep === 1;
  $('wizardNext').textContent = dayStep === 5 ? 'Сохранить день' : 'Далее';
  updateCalendarRule();
  updateDayPreview();
}

function updateCalendarRule() {
  const date = $('dayDate').value;
  $('calendarRule').textContent = date
    ? (isWeekend(date) ? 'Выходной по календарю → применяется выходной тариф.' : 'Будний день → применяется будний тариф.')
    : 'Выбери дату.';
}

function updateDayPreview() {
  if (!$('dayPreview')) return;
  const day = {
    date: $('dayDate').value,
    tariff: $('dayTariff').value,
    points: numberValue('dayPoints'),
    orders: numberValue('dayOrders'),
    lots: numberValue('dayLots'),
    mgt: numberValue('dayMgt'),
    multi4: numberValue('dayMulti4'),
    multi5: numberValue('dayMulti5'),
    extraAmount: numberValue('dayExtraAdd')
  };
  const c = calcDay(day);
  $('dayPreview').innerHTML = `
    <div class="preview-row"><span>База</span><strong>${money(c.base)}</strong></div>
    <div class="preview-row"><span>Минимум</span><strong>${money(c.minimum)}</strong></div>
    <div class="preview-row"><span>Применится</span><strong>${money(c.beforeExtra)}</strong></div>
    <div class="preview-row"><span>Доплата</span><strong>${money(c.extra)}</strong></div>
    <div class="preview-total"><span>ИТОГО</span><strong>${money(c.calculated)}</strong></div>
  `;
}

function saveDay(event) {
  event.preventDefault();
  const form = $('dayForm');
  const id = form.dataset.id || '';
  const date = $('dayDate').value;
  if (!date) return toast('Укажи дату');

  const existing = state.data.days.find(x => x.id === id);
  const day = {
    id: id || uid('day'),
    date,
    tariff: $('dayTariff').value,
    points: numberValue('dayPoints'),
    orders: numberValue('dayOrders'),
    lots: numberValue('dayLots'),
    mgt: numberValue('dayMgt'),
    multi4: numberValue('dayMulti4'),
    multi5: numberValue('dayMulti5'),
    extraAmount: numberValue('dayExtraAdd'),
    extraReason: $('dayExtraReason').value.trim(),
    note: $('dayNote').value.trim(),
    actual: existing?.actual ?? null
  };

  if (id) {
    const index = state.data.days.findIndex(x => x.id === id);
    if (index !== -1) state.data.days[index] = day;
  } else state.data.days.push(day);

  selectedMonth = monthOf(date);
  save();
  closeModal('dayModal');
  renderAll();
  toast(id ? 'Смена изменена' : 'Смена добавлена');
}

function fillExtraDayOptions(selected = '') {
  const date = $('extraDate').value;
  const days = state.data.days.filter(x => !date || x.date === date).sort((a, b) => a.date.localeCompare(b.date));
  $('extraDayId').innerHTML = `<option value="">Отдельно от смены</option>${days.map(day => `<option value="${day.id}" ${day.id === selected ? 'selected' : ''}>${escapeHtml(fmtDate(day.date))} · ${day.tariff === 'city' ? 'Город' : 'Загород'}</option>`).join('')}`;
}

function openExtra(extra = null) {
  const form = $('extraForm');
  form.dataset.id = extra?.id || '';
  $('extraModalTitle').textContent = extra ? 'Изменить доплату' : 'Добавить доплату';
  $('extraDate').value = extra?.date || today();
  $('extraAmount').value = extra?.amount ?? '';
  $('extraReason').value = extra?.reason || '';
  $('extraActual').value = extra?.actual ?? '';
  fillExtraDayOptions(extra?.dayId || '');
  openModal('extraModal');
}

function saveExtra(event) {
  event.preventDefault();
  const form = $('extraForm');
  const id = form.dataset.id || '';
  const date = $('extraDate').value;
  const amount = Number($('extraAmount').value);
  const reason = $('extraReason').value.trim();
  if (!date) return toast('Укажи дату');
  if (!Number.isFinite(amount) || amount < 0) return toast('Укажи корректную сумму');
  if (!reason) return toast('Укажи причину доплаты');

  const actualText = $('extraActual').value.trim();
  const actual = actualText === '' ? null : Number(actualText);
  if (actual !== null && (!Number.isFinite(actual) || actual < 0)) return toast('Некорректная фактическая сумма');

  const extra = { id: id || uid('extra'), date, amount, reason, dayId: $('extraDayId').value || '', actual };
  if (id) {
    const index = state.data.extras.findIndex(x => x.id === id);
    if (index !== -1) state.data.extras[index] = extra;
  } else state.data.extras.push(extra);

  selectedMonth = monthOf(date);
  save();
  closeModal('extraModal');
  renderAll();
  toast(id ? 'Доплата изменена' : 'Доплата добавлена');
}

function openCar(id = '') {
  const car = state.data.cars.find(x => x.id === id);
  const form = $('carForm');
  form.dataset.id = car?.id || '';
  $('carModalTitle').textContent = car ? 'Изменить перегон' : 'Добавить перегон';
  $('carDate').value = car?.date || today();
  $('carKm').value = car?.km ?? '';
  $('carAmount').value = car?.amount ?? '';
  $('carNote').value = car?.note || '';
  $('carActual').value = car?.actual ?? '';
  updateCarPreview();
  openModal('carModal');
}

function updateCarPreview() {
  const manual = $('carAmount').value.trim();
  const amount = manual === '' ? calcCar($('carKm').value) : Number(manual) || 0;
  $('carPreview').textContent = money(amount);
}

function saveCar(event) {
  event.preventDefault();
  const form = $('carForm');
  const id = form.dataset.id || '';
  const date = $('carDate').value;
  const km = Number($('carKm').value);
  if (!date) return toast('Укажи дату');
  if (!Number.isFinite(km) || km < 0) return toast('Укажи корректный километраж');

  const amountText = $('carAmount').value.trim();
  const amount = amountText === '' ? '' : Number(amountText);
  if (amount !== '' && (!Number.isFinite(amount) || amount < 0)) return toast('Некорректная сумма');

  const actualText = $('carActual').value.trim();
  const actual = actualText === '' ? null : Number(actualText);
  if (actual !== null && (!Number.isFinite(actual) || actual < 0)) return toast('Некорректная фактическая сумма');

  const existing = state.data.cars.find(x => x.id === id);
  const car = { id: id || uid('car'), date, km, amount, note: $('carNote').value.trim(), actual: actual ?? existing?.actual ?? null };
  if (id) {
    const index = state.data.cars.findIndex(x => x.id === id);
    if (index !== -1) state.data.cars[index] = car;
  } else state.data.cars.push(car);

  selectedMonth = monthOf(date);
  save();
  closeModal('carModal');
  renderAll();
  toast(id ? 'Перегон изменён' : 'Перегон добавлен');
}

function openActuals() {
  actualQueue = state.data.days.filter(x => monthOf(x.date) === selectedMonth).sort((a, b) => a.date.localeCompare(b.date));
  if (!actualQueue.length) return toast('В выбранном месяце нет смен');
  actualIndex = 0;
  openModal('actualModal');
  renderActual();
}

function renderActual() {
  const day = actualQueue[actualIndex];
  if (!day) return;
  $('actualCounter').textContent = `${actualIndex + 1} / ${actualQueue.length}`;
  $('actualBar').style.width = `${((actualIndex + 1) / actualQueue.length) * 100}%`;
  $('actualTitle').textContent = `${fmtDate(day.date)} · ${day.tariff === 'city' ? 'Город' : 'Загород'}`;
  $('actualDateText').textContent = `${Number(day.points) || 0} точек · ${Number(day.orders) || 0} заказов · ${Number(day.lots) || 0} ЛОТов`;
  $('actualCalc').innerHTML = `Расчётная сумма<strong>${money(calcDay(day).calculated)}</strong>`;
  $('actualAmount').value = hasActual(day) ? day.actual : '';
  $('actualBack').disabled = actualIndex === 0;
  $('actualNext').textContent = actualIndex === actualQueue.length - 1 ? 'Готово' : 'Далее';
}

function saveActualAndNext() {
  const day = actualQueue[actualIndex];
  const text = $('actualAmount').value.trim();
  if (text === '') day.actual = null;
  else {
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) return toast('Введи корректную сумму');
    day.actual = amount;
  }
  save();
  if (actualIndex < actualQueue.length - 1) {
    actualIndex++;
    renderActual();
  } else {
    closeModal('actualModal');
    renderAll();
    toast('Фактические суммы сохранены');
  }
}

function renderAll() {
  renderDashboard();
  renderDays();
  renderPayments();
  renderTariffs();
}

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atlant-zarabotok-${selectedMonth}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Файл экспортирован');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported?.data) throw new Error('Неверный формат');
      state.data.days = Array.isArray(imported.data.days) ? imported.data.days : [];
      state.data.cars = Array.isArray(imported.data.cars) ? imported.data.cars : [];
      state.data.extras = Array.isArray(imported.data.extras) ? imported.data.extras : [];
      state.tariffs = mergeTariffs(DEFAULT_TARIFFS, imported.tariffs || {});
      save();
      renderAll();
      toast('Данные импортированы');
    } catch (error) {
      console.error(error);
      toast('Файл не распознан');
    }
  };
  reader.readAsText(file);
}

function initNumericInputs() {
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('focus', () => {
      if (input.value === '0') input.select();
    });
  });
}

function setupEvents() {
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-page]');
    if (nav) return showPage(nav.dataset.page);

    const go = event.target.closest('[data-go]');
    if (go) return showPage(go.dataset.go);

    const close = event.target.closest('[data-close]');
    if (close) return closeModal(close.dataset.close);

    const numberButton = event.target.closest('[data-number]');
    if (numberButton) {
      const input = $(numberButton.dataset.number);
      if (!input) return;
      let value = Number(input.value) || 0;
      value = Math.max(0, value + (Number(numberButton.dataset.delta) || 0));
      input.value = value || '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const editDay = event.target.closest('[data-edit-day]');
    if (editDay) {
      const day = state.data.days.find(x => x.id === editDay.dataset.editDay);
      if (day) { resetDayForm(day); openModal('dayModal'); }
      return;
    }

    const deleteDay = event.target.closest('[data-delete-day]');
    if (deleteDay) {
      if (!confirm('Удалить эту смену?')) return;
      const id = deleteDay.dataset.deleteDay;
      state.data.days = state.data.days.filter(x => x.id !== id);
      state.data.extras.forEach(x => { if (x.dayId === id) x.dayId = ''; });
      save(); renderAll(); toast('Смена удалена'); return;
    }

    const editCar = event.target.closest('[data-edit-car]');
    if (editCar) return openCar(editCar.dataset.editCar);

    const deleteCar = event.target.closest('[data-delete-car]');
    if (deleteCar) {
      if (!confirm('Удалить перегон?')) return;
      state.data.cars = state.data.cars.filter(x => x.id !== deleteCar.dataset.deleteCar);
      save(); renderAll(); toast('Перегон удалён'); return;
    }

    const editExtra = event.target.closest('[data-edit-extra]');
    if (editExtra) {
      const extra = state.data.extras.find(x => x.id === editExtra.dataset.editExtra);
      if (extra) openExtra(extra);
      return;
    }

    const deleteExtra = event.target.closest('[data-delete-extra]');
    if (deleteExtra) {
      if (!confirm('Удалить доплату?')) return;
      state.data.extras = state.data.extras.filter(x => x.id !== deleteExtra.dataset.deleteExtra);
      save(); renderAll(); toast('Доплата удалена');
    }
  });

  $('prevMonth').onclick = () => { selectedMonth = shiftMonth(selectedMonth, -1); renderAll(); };
  $('nextMonth').onclick = () => { selectedMonth = shiftMonth(selectedMonth, 1); renderAll(); };
  $('daysPrevMonth').onclick = () => { selectedMonth = shiftMonth(selectedMonth, -1); renderAll(); };
  $('daysNextMonth').onclick = () => { selectedMonth = shiftMonth(selectedMonth, 1); renderAll(); };
  $('daysMonthPicker').onchange = e => { selectedMonth = e.target.value || currentMonth(); renderAll(); };

  $('addDayBtn').onclick = () => { resetDayForm(); openModal('dayModal'); };
  $('quickAddDay').onclick = () => $('addDayBtn').click();
  $('bottomAdd').onclick = () => $('addDayBtn').click();
  $('quickExtra').onclick = () => openExtra();
  $('quickCar').onclick = () => openCar();
  $('addCarBtn').onclick = () => openCar();
  $('addExtraBtn').onclick = () => openExtra();
  $('editActualsBtn').onclick = openActuals;

  $('dayForm').onsubmit = saveDay;
  $('extraForm').onsubmit = saveExtra;
  $('carForm').onsubmit = saveCar;

  $('wizardNext').onclick = () => {
    if (dayStep < 5) { dayStep++; updateDayWizard(); }
    else $('dayForm').requestSubmit();
  };
  $('wizardBack').onclick = () => { if (dayStep > 1) { dayStep--; updateDayWizard(); } };

  ['dayDate','dayTariff','dayPoints','dayOrders','dayLots','dayMgt','dayMulti4','dayMulti5','dayExtraAdd','dayExtraReason','dayNote'].forEach(id => {
    $(id).addEventListener('input', () => { updateCalendarRule(); updateDayPreview(); });
    $(id).addEventListener('change', () => { updateCalendarRule(); updateDayPreview(); });
  });

  $('extraDate').addEventListener('change', () => fillExtraDayOptions($('extraDayId').value));
  $('carKm').addEventListener('input', updateCarPreview);
  $('carAmount').addEventListener('input', updateCarPreview);

  $('actualNext').onclick = saveActualAndNext;
  $('actualBack').onclick = () => { if (actualIndex > 0) { actualIndex--; renderActual(); } };

  $('resetTariffs').onclick = () => {
    if (!confirm('Сбросить тарифы к исходным значениям?')) return;
    state.tariffs = clone(DEFAULT_TARIFFS);
    save(); renderAll(); toast('Тарифы сброшены');
  };

  document.addEventListener('change', event => {
    const key = event.target.dataset.tariff;
    if (!key) return;
    const [group, field] = key.split('.');
    if (!state.tariffs[group] || !(field in state.tariffs[group])) return;
    state.tariffs[group][field] = Math.max(0, Number(event.target.value) || 0);
    save();
    renderDashboard(); renderDays(); renderPayments();
  });

  $('exportBtn').onclick = exportData;
  $('exportBtnProfile').onclick = exportData;
  $('importFile').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
  $('importFileProfile').onchange = e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };

  $('resetAllBtn').onclick = () => {
    if (!confirm('Удалить ВСЕ смены, доплаты, перегоны и настройки тарифов?')) return;
    localStorage.removeItem(STORAGE);
    location.reload();
  };

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
}

function checkSalaryNotification() {
  const now = new Date();
  const day = now.getDate();
  const active = (day >= 25 && day <= 30) || (day >= 15 && day <= 20);
  if (!active) return;
  const period = day >= 25 ? '1–15' : '16–конец';
  const key = `salary-note-${now.getFullYear()}-${now.getMonth() + 1}-${period}`;
  if (localStorage.getItem(key) === 'closed') return;
  $('notificationText').textContent = `Сейчас период выплаты за ${period}. Если деньги уже пришли, внеси фактическую сумму по сменам.`;
  $('salaryNotification').classList.remove('hidden');
  $('notificationGo').onclick = () => { localStorage.setItem(key, 'closed'); $('salaryNotification').classList.add('hidden'); showPage('daysPage'); openActuals(); };
  $('closeNotification').onclick = () => { localStorage.setItem(key, 'closed'); $('salaryNotification').classList.add('hidden'); };
}

function init() {
  load();
  setupEvents();
  $('daysMonthPicker').value = selectedMonth;
  initNumericInputs();
  renderAll();
  checkSalaryNotification();
}

init();
