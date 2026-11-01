// ==UserScript==
// @name         VIP-менеджеры: график
// @namespace    billy.vip-schedule
// @version      1.3
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/vip-schedule.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/vip-schedule.user.js
// @description  Время по Киеву и Москве и работают ли сейчас VIP-менеджеры на каждом проекте
// @match        https://sparkmoth.com/app/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ===== ГРАФІК (час по Києву). Щоб щось змінити — правиш тільки тут =====
  // weekday = понеділок–пʼятниця, weekend = субота–неділя
  const PROJECTS = [
    { name: 'Reactivation', weekday: ['10:00', '18:00'], weekend: ['10:00', '18:00'] },
    { name: 'CAT',      weekday: ['08:00', '18:00'], weekend: ['08:00', '17:00'] },
    { name: 'GAMA',     weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'DADDY',    weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'KENT',     weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'R7',       weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'KOMETA',   weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'ARKADA',   weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
  ];
  // За скільки хвилин до кінця зміни показувати «скоро кінець»
  const SOON_MINUTES = 30;
  // =====================================================================

  const KYIV_TZ = (() => {
    try { new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' }); return 'Europe/Kyiv'; }
    catch (e) { return 'Europe/Kiev'; }
  })();
  const MSK_TZ = 'Europe/Moscow';
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const I18N = {
    uk: {
      days: ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'],
      months: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
      h: 'год', m: 'хв', lessMin: 'менше хвилини',
      kyiv: 'Київ', moscow: 'Москва', sameAsKyiv: 'як у Києві', fromKyiv: 'год від Києва', weekend: 'вихідний',
      until: 'до', left: 'ще', tomorrow: 'завтра', from: 'з', in: 'через', at: 'о',
      can: 'можна', soon: 'скоро кінець', cant: 'не можна',
      allOpen: 'Можна переводити на всіх проєктах', onPlace: 'Менеджери на місці', of: 'з',
      someOpen: 'Можна переводити', closedList: 'Зараз не працюють',
      noneOpen: 'Зараз переводити нікуди', nearest: 'Найближче',
      titleOpen: 'Менеджери працюють', titleNone: 'Менеджерів зараз немає',
      hint: 'Плашку можна перетягнути',
    },
    ru: {
      days: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
      months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      h: 'ч', m: 'мин', lessMin: 'меньше минуты',
      kyiv: 'Киев', moscow: 'Москва', sameAsKyiv: 'как в Киеве', fromKyiv: 'ч от Киева', weekend: 'выходной',
      until: 'до', left: 'ещё', tomorrow: 'завтра', from: 'с', in: 'через', at: 'в',
      can: 'можно', soon: 'скоро конец', cant: 'нельзя',
      allOpen: 'Можно переводить на всех проектах', onPlace: 'Менеджеры на месте', of: 'из',
      someOpen: 'Можно переводить', closedList: 'Сейчас не работают',
      noneOpen: 'Сейчас переводить некуда', nearest: 'Ближайший',
      titleOpen: 'Менеджеры работают', titleNone: 'Менеджеров сейчас нет',
      hint: 'Плашку можно перетащить',
    },
  };
  const LANG_KEY = 'vipLang';
  let lang = GM_getValue(LANG_KEY, 'ru');   // за замовчуванням — російська
  if (!I18N[lang]) lang = 'ru';
  const T = () => I18N[lang];

  const fmtCache = {};
  function zoneParts(date, tz) {
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour12: false, weekday: 'short', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    const p = {};
    for (const x of f.formatToParts(date)) p[x.type] = x.value;
    let h = +p.hour; if (h === 24) h = 0;
    return { dow: DOW[p.weekday], h, m: +p.minute, s: +p.second, day: +p.day, month: +p.month };
  }
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const windowFor = (p, dow) => { const r = (dow === 0 || dow === 6) ? p.weekend : p.weekday; return [toMin(r[0]), toMin(r[1])]; };

  function statusOf(p, kp) {
    const now = kp.h * 60 + kp.m + kp.s / 60;
    const w = windowFor(p, kp.dow);
    if (now >= w[0] && now < w[1]) return { state: 'open', soon: w[1] - now <= SOON_MINUTES, window: w, minsLeft: w[1] - now };
    if (now < w[0]) return { state: 'closed', window: w, opensAt: w[0], minsUntil: w[0] - now, tomorrow: false };
    const nw = windowFor(p, (kp.dow + 1) % 7);
    return { state: 'closed', window: w, opensAt: nw[0], minsUntil: 1440 - now + nw[0], tomorrow: true };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.floor(min % 60))}`;
  function dur(mins) {
    const t = Math.ceil(mins);
    const L = T();
    if (t < 1) return L.lessMin;
    const h = Math.floor(t / 60), m = t % 60;
    if (!h) return `${m} ${L.m}`;
    return m ? `${h} ${L.h} ${m} ${L.m}` : `${h} ${L.h}`;
  }

  // ---------- UI ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483000;left:0;top:0;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host { all: initial; }
  .wrap {
    --bg:#1F232C; --surface:#272C37; --ink:#ECEFF4; --muted:#9AA2B1; --line:#363C49;
    --track:#323846; --open:#3CC487; --open-soft:#1E4636; --soon:#E8A93A; --soon-soft:#4A3917;
    --closed:#EF6B63; --closed-soft:#482523; --now:#7C9BFF;
    position: relative;
    font: 13px/1.4 "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-variant-numeric: tabular-nums; color: var(--ink);
  }
  @media (prefers-color-scheme: light) {
    .wrap {
      --bg:#F3F5F8; --surface:#FFFFFF; --ink:#1A1F2B; --muted:#6A7180; --line:#E1E5EB;
      --track:#E8EBF0; --open:#1F9D63; --open-soft:#CDEBDC; --soon:#C98106; --soon-soft:#F6E3BF;
      --closed:#C2413A; --closed-soft:#F3D6D4; --now:#2F55D4;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .pill {
    display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; touch-action: none;
    background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 999px;
    padding: 6px 12px 6px 10px; font: inherit; font-size: 13px; white-space: nowrap;
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
  }
  .pill:focus-visible { outline: 2px solid var(--now); outline-offset: 2px; }
  .pill.dragging { cursor: grabbing; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--open); flex: none; }
  .dot.soon { background: var(--soon); }
  .dot.bad { background: var(--closed); }
  .pill b { font-weight: 650; }
  .ptime { font-variant-numeric: tabular-nums; }   /* цифри однакової ширини — плашка не «дриґається» щосекунди */
  .pill .cnt { color: var(--muted); }

  .panel {
    position: absolute; width: 400px; background: var(--bg); border: 1px solid var(--line);
    border-radius: 14px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
  }
  .panel[hidden] { display: none; }
  .panel.up { bottom: calc(100% + 8px); } .panel.down { top: calc(100% + 8px); }
  .panel.r { right: 0; } .panel.l { left: 0; }

  .hero { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; }
  .time { font-size: 42px; font-weight: 650; letter-spacing: -1.5px; line-height: 1; }
  .sec { font-size: 20px; font-weight: 500; color: var(--muted); letter-spacing: 0; margin-left: 2px; }
  .date { margin-top: 6px; font-size: 13px; color: var(--muted); }
  .date b { color: var(--ink); font-weight: 600; }
  .msk { text-align: right; padding: 7px 10px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }
  .msk-label, .msk-diff { font-size: 11px; color: var(--muted); }
  .msk-time { font-size: 19px; font-weight: 600; line-height: 1.2; }

  .summary { padding: 9px 12px; border-radius: 10px; font-weight: 600; font-size: 13.5px; margin-bottom: 10px; }
  .summary.ok { background: var(--open-soft); color: var(--open); }
  .summary.bad { background: var(--closed-soft); color: var(--closed); }
  .summary small { display: block; font-weight: 400; font-size: 12px; color: var(--ink); opacity: .75; margin-top: 2px; }

  .axis, .row { display: grid; grid-template-columns: 108px 1fr 86px; gap: 10px; align-items: center; }
  .axis { padding: 0 10px 4px; }
  .scale { position: relative; height: 12px; }
  .scale i { position: absolute; transform: translateX(-50%); font-style: normal; font-size: 10px; color: var(--muted); }
  .list { list-style: none; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .row { padding: 8px 10px; border-top: 1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .name { font-weight: 650; font-size: 13px; }
  .sub { font-size: 11px; color: var(--muted); white-space: nowrap; }
  .bar { position: relative; height: 12px; border-radius: 4px; background: var(--track); }
  .work { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: var(--closed-soft); }
  .row.open .work { background: var(--open); } .row.soon .work { background: var(--soon); }
  .nowline { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--now); border-radius: 1px; }
  .tag { justify-self: end; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
  .row.open .tag { background: var(--open-soft); color: var(--open); }
  .row.soon .tag { background: var(--soon-soft); color: var(--soon); }
  .row.closed .tag { background: var(--closed-soft); color: var(--closed); }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
  .hint { font-size: 11px; color: var(--muted); }
  .lang { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
  .lang button {
    font: inherit; font-size: 11.5px; font-weight: 600; color: var(--muted); background: none; border: 0;
    padding: 3px 10px; border-radius: 6px; cursor: pointer;
  }
  .lang button.on { background: var(--now); color: #fff; }
  .lang button:focus-visible { outline: 2px solid var(--now); outline-offset: 1px; }
</style>
<div class="wrap">
  <div class="panel up r" hidden>
    <div class="hero">
      <div><div class="time"></div><div class="date"></div></div>
      <div class="msk"><div class="msk-label"></div><div class="msk-time"></div><div class="msk-diff"></div></div>
    </div>
    <div class="summary"></div>
    <div class="axis"><span></span><div class="scale"><i style="left:0">0</i><i style="left:25%">6</i><i style="left:50%">12</i><i style="left:75%">18</i><i style="left:100%">24</i></div><span></span></div>
    <ul class="list"></ul>
    <div class="foot"><span class="hint"></span>
      <div class="lang"><button data-lang="uk">UA</button><button data-lang="ru">RU</button></div></div>
  </div>
  <button class="pill" title="VIP менеджери: графік"><span class="dot"></span><span><b class="ptime"></b> <span class="pcity"></span></span><span class="cnt"></span></button>
</div>`;
  document.body.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const pill = $('.pill'), panel = $('.panel');

  function render() {
    const now = new Date();
    const kp = zoneParts(now, KYIV_TZ), mp = zoneParts(now, MSK_TZ);
    const rows = PROJECTS.map((p) => ({ p, st: statusOf(p, kp) }));
    const open = rows.filter((r) => r.st.state === 'open');
    const total = rows.length;
    const L = T();

    // плашка
    $('.ptime').textContent = `${pad(kp.h)}:${pad(kp.m)}:${pad(kp.s)}`;
    $('.pcity').textContent = L.kyiv;
    $('.cnt').textContent = `${open.length}/${total}`;
    const dot = $('.dot');
    dot.className = 'dot' + (open.length === 0 ? ' bad' : open.every((r) => r.st.soon) ? ' soon' : '');
    pill.title = open.length ? `${L.titleOpen}: ${open.length} ${L.of} ${total}` : L.titleNone;

    if (panel.hidden) return;

    $('.time').innerHTML = `${pad(kp.h)}:${pad(kp.m)}<span class="sec">${pad(kp.s)}</span>`;
    const weekend = kp.dow === 0 || kp.dow === 6;
    $('.date').innerHTML = `${L.kyiv}, <b>${L.days[kp.dow]}</b> ${kp.day} ${L.months[kp.month - 1]}${weekend ? ` (${L.weekend})` : ''}`;
    $('.msk-label').textContent = L.moscow;
    root.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    $('.msk-time').textContent = `${pad(mp.h)}:${pad(mp.m)}`;
    let diff = (mp.h * 60 + mp.m) - (kp.h * 60 + kp.m);
    if (diff > 720) diff -= 1440; if (diff < -720) diff += 1440;
    const dh = Math.round(diff / 60);
    $('.msk-diff').textContent = dh === 0 ? L.sameAsKyiv : `${dh > 0 ? '+' : '−'}${Math.abs(dh)} ${L.fromKyiv}`;

    const summary = $('.summary');
    if (open.length) {
      summary.className = 'summary ok';
      const closed = rows.filter((r) => r.st.state !== 'open').map((r) => r.p.name);
      summary.innerHTML = open.length === total
        ? `${L.allOpen}<small>${L.onPlace}: ${total} ${L.of} ${total}</small>`
        : `${L.someOpen}: ${open.length} ${L.of} ${total}<small>${L.closedList}: ${closed.join(', ')}</small>`;
    } else {
      const next = rows.slice().sort((a, b) => a.st.minsUntil - b.st.minsUntil)[0];
      summary.className = 'summary bad';
      summary.innerHTML = `${L.noneOpen}<small>${L.nearest}: ${next.p.name} ${next.st.tomorrow ? L.tomorrow + ' ' : ''}${L.at} ${hhmm(next.st.opensAt)}, ${L.in} ${dur(next.st.minsUntil)}</small>`;
    }

    const nowPos = (kp.h * 60 + kp.m + kp.s / 60) / 14.4;
    $('.list').innerHTML = rows.map(({ p, st }) => {
      let cls, sub, tag;
      if (st.state === 'open') {
        cls = st.soon ? 'open soon' : 'open';
        sub = `${L.until} ${hhmm(st.window[1])}, ${L.left} ${dur(st.minsLeft)}`;
        tag = st.soon ? L.soon : L.can;
      } else {
        cls = 'closed';
        sub = `${st.tomorrow ? L.tomorrow + ' ' : ''}${L.from} ${hhmm(st.opensAt)}, ${L.in} ${dur(st.minsUntil)}`;
        tag = L.cant;
      }
      const w = st.window;
      return `<li class="row ${cls}">
        <div><div class="name">${p.name}</div><div class="sub">${sub}</div></div>
        <div class="bar"><div class="work" style="left:${w[0] / 14.4}%;width:${(w[1] - w[0]) / 14.4}%"></div><div class="nowline" style="left:${nowPos}%"></div></div>
        <span class="tag">${tag}</span></li>`;
    }).join('');
  }

  // ---------- позиція + перетягування ----------
  const POS_KEY = 'vipPillPos';
  let pos = GM_getValue(POS_KEY, null);
  let custom = !!pos;   // false — плашка стоїть на місці за замовчуванням (і тримається його при зміні розміру вікна)
  // за замовчуванням — справа зверху, у шапці панелі «Контакт» (лівіше від хрестика)
  const DEF_RIGHT = 64, DEF_TOP = 8;

  function clampAndApply() {
    const w = pill.offsetWidth, h = pill.offsetHeight;
    if (!custom) pos = { x: window.innerWidth - w - DEF_RIGHT, y: DEF_TOP };
    pos.x = Math.max(4, Math.min(window.innerWidth - w - 4, pos.x));
    pos.y = Math.max(4, Math.min(window.innerHeight - h - 4, pos.y));
    host.style.left = pos.x + 'px';
    host.style.top = pos.y + 'px';
    placePanel();
  }

  function placePanel() {
    const rect = pill.getBoundingClientRect();
    const up = rect.top > window.innerHeight / 2;
    const right = rect.left + rect.width / 2 > window.innerWidth / 2;
    panel.className = `panel ${up ? 'up' : 'down'} ${right ? 'r' : 'l'}`;
  }

  let drag = null;
  pill.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    pill.setPointerCapture(e.pointerId);
  });
  pill.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    pill.classList.add('dragging');
    pos = { x: drag.ox + dx, y: drag.oy + dy };
    clampAndApply();
  });
  pill.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    pill.classList.remove('dragging');
    if (moved) { custom = true; GM_setValue(POS_KEY, pos); }
    else toggle();
  });

  function toggle(force) {
    panel.hidden = force === undefined ? !panel.hidden : !force;
    placePanel();
    render();
  }

  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !e.composedPath().includes(host)) toggle(false);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
  window.addEventListener('resize', clampAndApply);

  root.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    GM_setValue(LANG_KEY, lang);
    render();
    clampAndApply();
  }));

  GM_registerMenuCommand('Сбросить позицию плашки', () => { pos = null; custom = false; GM_setValue(POS_KEY, null); clampAndApply(); });

  render();
  clampAndApply();
  setInterval(render, 1000);
})();
