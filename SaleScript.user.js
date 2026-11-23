// ==UserScript==
// @name         Продажа в один клик
// @namespace    support.sale-script
// @author       Lex
// @version      1.16
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SaleScript.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SaleScript.user.js
// @description  Кнопка «Продажа» в чате: выбираешь бокс (АП / PreVIP / VIP) — отправляет твой текст под этот бокс с паузами, ставит метку в чате и тег бокса в Fundist. Видно, какие теги уже стоят у клиента. Тексты: ПКМ по кнопке
// @match        https://sparkmoth.com/app/*
// @match        https://*.boadmin.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @connect      boadmin.org
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ===================== НАЛАШТУВАННЯ =====================
  let LABEL = '';          // мітка, яка ставиться після продажі
  let DELAY_MIN = 5000;               // пауза між повідомленнями, мс (від)
  let DELAY_MAX = 6000;               // пауза між повідомленнями, мс (до)
  const ALLOW_EMPTY = true;           // true — можна лишити проєкт без повідомлень (share-версія)
  const SHOW_TYPING = true;           // показувати клієнту «печатает» під час паузи
  let NAME_STEP = 0;                  // стандартно: в якому повідомленні звертатись по імені (0 = ніде); у ⚙ — галочкою на кожному повідомленні

  // Тег у Fundist після продажі — тег обраного боксу (однаковий для всіх проєктів)
  const FUNDIST_TAG = true;           // false — не ставити тег у Fundist
  // піддомен Fundist за проєктом (якщо в чаті немає посилання userId)
  const PROJECT_SUBDOMAIN = { cat: 'cc', gama: 'gm', kometa: 'kt', daddy: 'dy', kent: 'kn', r7: 'rs', arkada: 'ak' };
  const FUNDIST_COMMENT = '+';
  const FUNDIST_TIMEOUT = 60;         // сек, скільки чекати Fundist

  // ---- бокси: група (АП / PreVIP / VIP), назва, до скількох FS і ₽, мінімальний депозит, тег у Fundist ----
  const GROUPS = [
    { id: 'ap', title: 'АП (обычные)' },
    { id: 'previp', title: 'PreVIP' },
    { id: 'vip', title: 'VIP' },
  ];
  // набори боксів по проєктах (з таблиці «Bonuses For Support»). set — у яких проєктах діє набір
  const SETS = [
    { id: 'supp', title: 'CAT/GAMA/KOMETA', projects: ['cat', 'gama', 'kometa'], subs: ['cc', 'gm', 'kt'] },
    { id: 'rd', title: 'R7/DADDY', projects: ['r7', 'daddy'], subs: ['rs', 'dy'] },
    { id: 'kent', title: 'KENT', projects: ['kent'], subs: ['kn'] },
    { id: 'arkada', title: 'ARKADA', projects: ['arkada'], subs: ['ak'] },
  ];
  const BOXES = [
    { id: 'o1', set: 'supp', group: 'ap', name: 'Стартовый бокс', fs: 85, rub: 5000, dep: 420, tag: 'Sales_SUPP_Other_1' },
    { id: 'o2', set: 'supp', group: 'ap', name: 'Бокс удачи', fs: 155, rub: 10000, dep: 840, tag: 'Sales_SUPP_Other_2' },
    { id: 'o3', set: 'supp', group: 'ap', name: 'Мега-бокс', fs: 330, rub: 20000, dep: 1800, tag: 'Sales_SUPP_Other_3' },
    { id: 'p1', set: 'supp', group: 'previp', name: 'PreVIP Silver Box', fs: 180, rub: 10000, dep: 2200, tag: 'Sales_SUPP_Previp_1' },
    { id: 'p2', set: 'supp', group: 'previp', name: 'PreVIP Gold Box', fs: 230, rub: 15000, dep: 3400, tag: 'Sales_SUPP_Previp_2' },
    { id: 'p3', set: 'supp', group: 'previp', name: 'PreVIP Diamond Box', fs: 500, rub: 30000, dep: 4800, tag: 'Sales_SUPP_Previp_3' },
    { id: 'v1', set: 'supp', group: 'vip', name: 'VIP Gold Box', fs: 260, rub: 15000, dep: 2800, tag: 'Sales_SUPP_VIP_1' },
    { id: 'v2', set: 'supp', group: 'vip', name: 'VIP Platinum Box', fs: 340, rub: 25000, dep: 4600, tag: 'Sales_SUPP_VIP_2' },
    { id: 'v3', set: 'supp', group: 'vip', name: 'VIP Diamond Box', fs: 680, rub: 50000, dep: 6400, tag: 'Sales_SUPP_VIP_3' },
    { id: 'rd1', set: 'rd', group: 'ap', name: 'Народный Лутбокс', fs: 250, rub: 500, dep: 500, tag: 'Sales_Support_Other' },
    { id: 'rd2', set: 'rd', group: 'previp', name: 'Мега Лутбокс', fs: 400, rub: 1250, dep: 1300, tag: 'Sales_Support_Previp' },
    { id: 'rd3', set: 'rd', group: 'vip', name: 'Супер Лутбокс', fs: 500, rub: 4000, dep: 4000, tag: 'Sales_Support_VIP' },
    { id: 'kn1', set: 'kent', group: 'ap', name: 'Лутбокс удачи', fs: 2000, rub: 200000, dep: 500, tag: 'Sales_Support_Other' },
    { id: 'kn2', set: 'kent', group: 'previp', name: 'Крупный куш', fs: 2000, rub: 300000, dep: 1000, tag: 'Sales_Support_Previp' },
    { id: 'kn3', set: 'kent', group: 'vip', name: 'Сорви банк', fs: 1000, rub: 400000, dep: 2000, tag: 'Sales_Support_VIP' },
    { id: 'ak1', set: 'arkada', group: 'ap', name: 'Лутбокс до 100 000 ₽', fs: 1000, rub: 100000, dep: 500, tag: 'Sales_Support_Other' },
    { id: 'ak2', set: 'arkada', group: 'previp', name: 'Лутбокс до 200 000 ₽', fs: 1000, rub: 200000, dep: 1000, tag: 'Sales_Support_Previp' },
    { id: 'ak3', set: 'arkada', group: 'vip', name: 'Лутбокс на удачу', fs: 500, rub: 300000, dep: 2000, tag: 'Sales_Support_VIP' },
  ];
  const setOfProject = (p) => (SETS.find((x) => x.projects.includes(p)) || {}).id || null;
  const setOfSub = (sub) => (SETS.find((x) => x.subs.includes(sub)) || {}).id || null;
  const fmtN = (n) => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
  // стандартні тексти для кожного боксу (оператор змінює їх у ⚙). {бокс} {фс} {руб} {деп} {имя} — підставляються самі
  // Для R7/DADDY — тільки ФС, без RUB. Ім'я клієнта не підставляється — оператор пише сам, якщо треба
  const defMsgs = (bx) => [bx.set === 'rd'
    ? 'Успешно начислили вам бонус — {бокс}: до {фс} ФС! Чтобы его активировать, подпишитесь на бонус в разделе «Бонусы» и внесите депозит от {деп} RUB. Хорошо?🙏'
    : 'Успешно начислили вам бонус — {бокс}: до {фс} ФС и {руб} RUB! Чтобы его активировать, подпишитесь на бонус в разделе «Бонусы» и внесите депозит от {деп} RUB. Хорошо?🙏',
  ];
  // SCRIPTS — тексти по боксах (так їх бачать решта частин скрипта)
  const SCRIPTS = BOXES.map((bx) => ({ id: bx.id, title: bx.name, box: bx, messages: defMsgs(bx) }));
  const boxText = (text, bx) => String(text)
    .replace(/\{(бокс|box)\}/gi, bx.name).replace(/\{(фс|fs)\}/gi, fmtN(bx.fs))
    .replace(/\{(руб|rub)\}/gi, fmtN(bx.rub)).replace(/\{(деп|dep)\}/gi, fmtN(bx.dep));
  // =========================================================

  // ---------- власні налаштування (вікно ⚙): перекривають стандартні тексти й паузи ----------
  // ssConfig2 — тексти по боксах (стара ssConfig — по проєктах; з неї беремо лише мітку й паузи)
  const DEFAULTS = JSON.parse(JSON.stringify({ LABEL, DELAY_MIN, DELAY_MAX, NAME_STEP, msgs: Object.fromEntries(SCRIPTS.map((s) => [s.id, s.messages])) }));
  function applyConfig(cfg) {
    const c = cfg || {};
    LABEL = (c.LABEL || DEFAULTS.LABEL).trim();
    DELAY_MIN = Number.isFinite(c.DELAY_MIN) ? c.DELAY_MIN : DEFAULTS.DELAY_MIN;
    DELAY_MAX = Number.isFinite(c.DELAY_MAX) ? Math.max(c.DELAY_MAX, DELAY_MIN) : Math.max(DEFAULTS.DELAY_MAX, DELAY_MIN);
    NAME_STEP = Number.isFinite(c.NAME_STEP) ? c.NAME_STEP : DEFAULTS.NAME_STEP;
    SCRIPTS.forEach((s) => {
      const own = c.msgs && c.msgs[s.id];
      s.messages = Array.isArray(own) && (own.filter((m) => m.trim()).length || ALLOW_EMPTY) ? own.filter((m) => m.trim()) : DEFAULTS.msgs[s.id].slice();
    });
  }
  (function loadConfig() {
    let c = GM_getValue('ssConfig2', null);
    if (!c) {
      const old = GM_getValue('ssConfig', null) || {};
      c = { LABEL: old.LABEL, DELAY_MIN: old.DELAY_MIN, DELAY_MAX: old.DELAY_MAX };
    }
    applyConfig(c);
  })();

  // =================== ЧАСТИНА ДЛЯ FUNDIST ===================
  if (/(^|\.)boadmin\.org$/.test(location.hostname)) {
    const m = location.hash.match(/sales-tag=([\w-]+)/);
    if (!m) return;
    const jobKey = `ft_job_${m[1]}`, resKey = `ft_res_${m[1]}`;
    const fjob = GM_getValue(jobKey, null);
    if (!fjob) return;
    const finish = (ok, msg) => { GM_setValue(resKey, { ok, msg, at: Date.now() }); GM_deleteValue(jobKey); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const findOption = () => [...document.querySelectorAll('select option')]
      .find((o) => o.textContent.trim().toLowerCase() === fjob.tag.toLowerCase());
    (async () => {
      try {
        if (/login|account\/log/i.test(location.pathname) || document.querySelector('input[type="password"]')) {
          finish(false, 'login'); return;
        }
        let opt = null;
        for (let i = 0; i < 40 && !opt; i++) { opt = findOption(); if (!opt) await wait(500); }
        if (!opt) {
          // відкрити віконце «Добавить тег» плюсиком, щоб підвантажився список тегів
          const hist = [...document.querySelectorAll('a,button,span')].find((e) => /История изменения тегов/i.test(e.textContent || ''));
          const area = hist && (hist.closest('div') || document.body);
          const plus = area && [...area.querySelectorAll('a,button,span,i')].find((e) =>
            e.matches('.fa-plus,.glyphicon-plus') || e.querySelector('.fa-plus,.glyphicon-plus') || (e.textContent || '').trim() === '+');
          if (plus) (plus.closest('a,button') || plus).click();
          for (let i = 0; i < 20 && !opt; i++) { opt = findOption(); if (!opt) await wait(500); }
        }
        if (!opt) { finish(false, 'notag'); return; }
        GM_setValue(`ft_cat_${location.hostname}_${fjob.tag.toLowerCase()}`, opt.value);   // далі — напряму, без вкладки
        const data = {
          IDUser: fjob.userId, IDCategory: opt.value, TagExpireType: '1',
          ExpireDate: fjob.expire, Comment: fjob.comment,
        };
        const tokenMatch = document.documentElement.innerHTML.match(/[0-9a-f]{32}:[0-9a-f]{64}/i);
        const $ = unsafeWindow.jQuery || unsafeWindow.$;
        let text;
        if ($ && $.ajax) {
          text = await new Promise((resolve, reject) => {
            $.ajax({
              url: '/ru/Users/Tags/Create', type: 'POST', data, dataType: 'text',
              headers: tokenMatch ? { 'x-csrf-token': tokenMatch[0] } : {},
              success: (t) => resolve(String(t)), error: (x) => reject(new Error(`HTTP ${x.status} ${String(x.responseText || '').slice(0, 120)}`)),
            });
          });
        } else {
          const r = await fetch('/ru/Users/Tags/Create', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', ...(tokenMatch ? { 'x-csrf-token': tokenMatch[0] } : {}) },
            body: new URLSearchParams(data).toString(),
          });
          text = await r.text();
          if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0, 120)}`);
        }
        const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (/успешно|уже применен/i.test(clean)) finish(true, clean);
        else finish(false, clean.slice(0, 200) || 'empty');
      } catch (e) { finish(false, e.message || String(e)); }
    })();
    return;
  }
  // ===================== ЧАСТИНА ДЛЯ ЧАТУ =====================

  const I18N = {
    uk: {
      btn: '💸 Продажа', prep: '⏳ Секунду…', cancel: (i, n) => `⏹ Скасувати ${i}/${n}`, other: (i, n, who) => `⏹ ${who} ${i}/${n}`,
      labeling: '⏳ Ставлю мітку…', fundist: '⏳ Тег у Fundist…', done: '✓ Продано', stopped: '⏹ Зупинено', again: '⚠ Вже продавали. Ще раз?',
      pick: 'Не впізнав проєкт. Який скрипт надіслати?', close: 'Закрити',
      labelFail: () => `Повідомлення надіслані, але мітку ${LABEL} поставити не вийшло. Постав її вручну.`,
      emptyScript: (t) => `Для боксу «${t}» ще немає повідомлень. Відкриваю налаштування — додай тексти.`,
      fNoLink: 'Тег у Fundist не поставив: у чаті немає посилання userId і не зрозумів проєкт. Постав тег вручну.',
      fLogin: (s) => `Тег у Fundist не поставив: ти не залогінений у ${s}.boadmin.org. Залогінься і натисни «Поставити тег ще раз».`,
      fRetry: '🔁 Поставити тег ще раз', fRetrying: '⏳ Ставлю тег у Fundist…', fRetryOk: '✓ Тег у Fundist поставлено',
      fNoTag: (t) => `Тег у Fundist не поставив: не знайшов тег ${t} у списку. Постав вручну.`,
      fTimeout: 'Fundist не відповів вчасно. Перевір тег у клієнта вручну.',
      fFail: (m) => `Тег у Fundist не поставився: ${m}`,
      openClient: 'Відкрити клієнта у Fundist',
      stoppedMsg: (i) => `Зупинено. Надіслано повідомлень: ${i}. Мітку не ставив.`,
      errAuth: 'Не вийшло авторизуватись у чаті. Онови сторінку і спробуй ще раз.',
      noLabel: 'Мітку в чаті не поставив — не обрана твоя мітка. Обери її в ⚙ (ПКМ по кнопці «Продаж»).',
      errSend: (i) => `Повідомлення ${i} не надіслалось. Перевір чат і, якщо треба, допиши вручну.`,
      errGen: (m) => `Помилка: ${m}`, noChat: 'Спочатку відкрий чат з клієнтом.',
      leave: 'Продажа ще надсилається. Точно закрити?', menuLang: 'Мова: українська → русский',
    },
    ru: {
      btn: '💸 Продажа', prep: '⏳ Секунду…', cancel: (i, n) => `⏹ Отменить ${i}/${n}`, other: (i, n, who) => `⏹ ${who} ${i}/${n}`,
      labeling: '⏳ Ставлю метку…', fundist: '⏳ Тег в Fundist…', done: '✓ Продано', stopped: '⏹ Остановлено', again: '⚠ Уже продавали. Ещё раз?',
      pick: 'Не распознал проект. Какой скрипт отправить?', close: 'Закрыть',
      labelFail: () => `Сообщения отправлены, но метку ${LABEL} поставить не получилось. Поставь её вручную.`,
      emptyScript: (t) => `Для бокса «${t}» ещё нет сообщений. Открываю настройки — добавь тексты.`,
      fNoLink: 'Тег в Fundist не поставил: в чате нет ссылки userId и не понял проект. Поставь тег вручную.',
      fLogin: (s) => `Тег в Fundist не поставил: ты не залогинен в ${s}.boadmin.org. Залогинься и нажми «Поставить тег ещё раз».`,
      fRetry: '🔁 Поставить тег ещё раз', fRetrying: '⏳ Ставлю тег в Fundist…', fRetryOk: '✓ Тег в Fundist поставлен',
      fNoTag: (t) => `Тег в Fundist не поставил: не нашёл тег ${t} в списке. Поставь вручную.`,
      fTimeout: 'Fundist не ответил вовремя. Проверь тег у клиента вручную.',
      fFail: (m) => `Тег в Fundist не поставился: ${m}`,
      openClient: 'Открыть клиента в Fundist',
      stoppedMsg: (i) => `Остановлено. Отправлено сообщений: ${i}. Метку не ставил.`,
      errAuth: 'Не получилось авторизоваться в чате. Обнови страницу и попробуй ещё раз.',
      noLabel: 'Метку в чате не поставил — не выбрана твоя метка. Выбери её в ⚙ (ПКМ по кнопке «Продажа»).',
      errSend: (i) => `Сообщение ${i} не отправилось. Проверь чат и при необходимости допиши вручную.`,
      errGen: (m) => `Ошибка: ${m}`, noChat: 'Сначала открой чат с клиентом.',
      leave: 'Продажа ещё отправляется. Точно закрыть?', menuLang: 'Язык: русский → українська',
    },
  };
  let lang = GM_getValue('ssLang2', 'ru');   // за замовчуванням російська
  if (!I18N[lang]) lang = 'uk';
  const T = () => I18N[lang];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Chatwoot API ----------
  function routeIds() {
    const m = location.pathname.match(/\/accounts\/(\d+)\/.*conversations\/(\d+)/);
    return m ? { acc: m[1], conv: m[2] } : null;
  }
  function session() {
    const m = document.cookie.match(/(?:^|;\s*)cw_d_session_info=([^;]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }
  class AuthError extends Error {}
  async function api(acc, path, opts = {}) {
    const s = session();
    if (!s) throw new AuthError('no session');
    const r = await fetch(`/api/v1/accounts/${acc}${path}`, {
      ...opts,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'access-token': s['access-token'], 'token-type': s['token-type'] || 'Bearer',
        client: s.client, expiry: s.expiry, uid: s.uid,
      },
    });
    if (r.status === 401) throw new AuthError('401');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }
  const inboxCache = {};
  async function inboxName(acc, inboxId) {
    if (!inboxCache[acc]) {
      const res = await api(acc, '/inboxes');
      inboxCache[acc] = {};
      for (const ib of (res && (res.payload || res)) || []) inboxCache[acc][ib.id] = ib.name;
    }
    return inboxCache[acc][inboxId] || '';
  }
  // запасний спосіб: проєкт за посиланням на клієнта у Fundist (cc.boadmin.org → CAT, kn → KENT…)
  function scriptBySub(c) {
    const s = (c && c.meta && c.meta.sender) || {};
    const url = String((s.custom_attributes && s.custom_attributes.userId) || '');
    const m = url.match(/https?:\/\/([a-z]{2})\.boadmin\.org/i);
    if (!m) return null;
    const proj = Object.keys(PROJECT_SUBDOMAIN).find((p) => PROJECT_SUBDOMAIN[p] === m[1].toLowerCase());
    return proj ? SCRIPTS.find((x) => x.projects.includes(proj)) : null;
  }
  function scriptFor(name) {
    const n = String(name || '').toLowerCase();
    const p = Object.keys(PROJECT_SUBDOMAIN).find((x) => new RegExp(`(^|[^a-z0-9])${x}([^a-z0-9]|$)`).test(n));
    return p ? { set: setOfProject(p), project: p } : null;
  }


  // ---------- ім'я клієнта ----------
  const NOT_NAMES = ['client', 'клиент', 'клієнт', 'user', 'пользователь', 'guest', 'гость', 'visitor', 'посетитель', 'unknown', 'customer', 'player', 'игрок'];
  function cleanName(raw) {
    const first = String(raw || '').trim().split(/\s+/)[0] || '';
    if (!/^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'-]{2,20}$/.test(first)) return '';
    if (NOT_NAMES.includes(first.toLowerCase())) return '';
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  // ---------- повні імена замість зменшувальних (Лёха → Алексей, Vova → Владимир) ----------
  // [чоловіче, жіноче]; якщо ім'я буває і таким, і таким — стать вгадуємо за прізвищем
  const FULL_NAMES = (() => {
    const m = {};
    const add = (full, list) => list.split(' ').forEach((k) => { m[k] = full; });
    add(['Александр', 'Александра'], 'саша саня санёк санек сашка сашенька сашуля шура шурик alex sasha sanya shura alexandr aleksandr alexander');
    add(['Алексей'], 'лёша леша лёха леха алёша алеша лёшка лешка алексей alexey aleksey alexei lesha lyosha leha lekha');
    add(['Владимир'], 'вова вовка вован вовчик володя вова vova volodya vladimir vovan');
    add(['Дмитрий'], 'дима димка димон митя дмитрий dima dimon dmitriy dmitry dmitrii');
    add(['Михаил'], 'миша мишка мишаня misha mikhail mihail');
    add(['Николай'], 'коля колька колян kolya nikolay nikolai');
    add(['Сергей'], 'серёжа сережа серёга серега серж серый sergey sergei serega serezha');
    add(['Андрей'], 'андрюша андрюха дрон andrey andrei andryusha');
    add(['Иван'], 'ваня ванька ванёк ванек vanya ivan');
    add(['Евгений', 'Евгения'], 'женя женька жека zhenya evgeniy evgeny yevgeny');
    add(['Валентин', 'Валентина'], 'валя valya');
    add(['Виктор'], 'витя витёк витек vitya viktor victor');
    add(['Василий'], 'вася васька васёк васек vasya vasiliy vasily');
    add(['Павел'], 'паша пашка паха pasha pavel');
    add(['Константин'], 'костя костян kostya konstantin');
    add(['Анатолий'], 'толя толик tolya anatoliy');
    add(['Вячеслав'], 'слава славик славка slava vyacheslav');
    add(['Станислав'], 'стас стасик stas stanislav');
    add(['Владислав'], 'влад владик vlad vladislav');
    add(['Григорий'], 'гриша гриня grisha grigoriy');
    add(['Максим'], 'макс максик max maks maxim maksim');
    add(['Артём'], 'тёма тема артемка artem artyom tema');
    add(['Никита'], 'никитос nikita');
    add(['Роман'], 'рома ромка ромчик roma roman');
    add(['Денис'], 'дэн дениска den denis');
    add(['Илья'], 'илюша илюха ilya');
    add(['Олег'], 'олежка oleg');
    add(['Игорь'], 'игорёк игорек игоряша igor');
    add(['Юрий'], 'юра юрка yura yuriy yuri');
    add(['Пётр'], 'петя петька petya petr pyotr');
    add(['Фёдор'], 'федя федька fedya fedor fyodor');
    add(['Геннадий'], 'гена генка gena gennadiy');
    add(['Леонид'], 'лёня леня lenya leonid');
    add(['Тимофей'], 'тима тимоха tima timofey');
    add(['Кирилл'], 'кирюша кирюха kirill');
    add(['Егор'], 'егорка egor yegor');
    add(['Антон'], 'антоха тоха anton');
    add(['Ярослав'], 'ярик яра yarik yaroslav');
    add(['Руслан'], 'руся руслик ruslan');
    add(['Эдуард'], 'эдик edik eduard');
    add(['Ростислав'], 'ростик rostik rostislav');
    add(['Наталья'], 'наташа наташка ната натали натусик natasha natalya natalia');
    add(['Татьяна'], 'таня танька танюша tanya tatyana tatiana');
    add(['Екатерина'], 'катя катька катюша kate katya ekaterina');
    add(['Елена'], 'лена ленка леночка lena elena');
    add(['Ольга'], 'оля олька оленька olya olga');
    add(['Ирина'], 'ира ирка ириша ira irina');
    add(['Светлана'], 'света светка светик sveta svetlana');
    add(['Анастасия'], 'настя настька настюша nastya anastasia anastasiya');
    add(['Мария'], 'маша машка машенька masha maria mariya');
    add(['Анна'], 'аня анька анечка anya anna');
    add(['Юлия'], 'юля юлька юлечка yulia yulya julia');
    add(['Людмила'], 'люда людка lyuda lyudmila');
    add(['Галина'], 'галя галька galya galina');
    add(['Надежда'], 'надя надька nadya nadezhda');
    add(['Любовь'], 'люба любаша lyuba');
    add(['Вера'], 'верочка vera');
    add(['Ксения'], 'ксюша ксюха ksyusha ksenia kseniya');
    add(['Дарья'], 'даша дашка dasha darya daria');
    add(['Виктория'], 'вика вики vika viktoria victoria');
    add(['Валерия'], 'лера лерка lera valeria');
    add(['Маргарита'], 'рита ритка rita margarita');
    add(['Алина'], 'алинка alina');
    add(['Кристина'], 'кристи kristina');
    add(['Полина'], 'поля полинка polya polina');
    add(['Софья'], 'соня сонька sonya sofia sofya');
    add(['Елизавета'], 'лиза лизка liza elizaveta');
    add(['Оксана'], 'ксана oksana');
    add(['Марина'], 'маринка marina');
    add(['Евгения'], 'evgenia evgeniya');
    return m;
  })();
  function fullName(first, surname) {
    const v = FULL_NAMES[first.toLowerCase()];
    if (!v) return first;
    if (v.length === 1) return v[0];
    // унісекс (Саша, Женя, Валя): жіноче, якщо прізвище жіноче (-ова, -ева, -ина, -ая, -ская…)
    const fem = /(ова|ева|ёва|ина|ына|ая|ская|цкая|ova|eva|ina|aya|skaya)$/i.test(surname || '');
    return fem ? v[1] : v[0];
  }
  function clientName(conv) {
    const s = (conv.meta && conv.meta.sender) || {};
    const ca = s.custom_attributes || {};
    const first = cleanName(ca._name) || cleanName(s.name);
    if (!first) return '';
    const parts = String(s.name || '').trim().split(/\s+/);
    const surname = ca.surname || (parts.length > 1 ? parts[parts.length - 1] : '');
    return fullName(first, surname);
  }
  function personalize(text, name) {
    // {имя} у тексті — підставити ім'я туди (без імені — прибрати разом із комою)
    if (/\{(имя|ім'я|name)\}/i.test(text)) {
      return name ? text.replace(/\{(имя|ім'я|name)\}/gi, name) : text.replace(/\{(имя|ім'я|name)\}\s*,?\s*/gi, '').replace(/^\s*\S/, (c) => c.toUpperCase());
    }
    if (!name) return text;
    return `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`.replace('это Лутбокс', 'это лутбокс');
  }

  // ---------- стан ----------
  // кілька продаж одночасно: окрема «робота» на кожен чат
  const jobs = new Map();   // conv -> { phase, sent, total, stop, who }
  let again = null;         // { conv, until, prep } — підтвердження повторної продажі
  let cancelAsk = null;     // { conv, until } — підтвердження скасування
  const RU = () => lang !== 'uk';

  // ---------- кнопка (напис не змінюється — прогрес видно на картці чату) ----------
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.ssBtn = '1';

  function paintBtn() {
    const text = T().btn;
    if (btn.textContent !== text) btn.textContent = text;
  }
  setInterval(paintBtn, 1000);

  function findTransferBtn() {
    for (const b of document.querySelectorAll('button')) {
      if (b === btn) continue;
      const t = b.textContent.trim();
      if (t === 'Перевод чата' || t === 'Переведення чату' || t === 'Transfer chat') return b;
    }
    return null;
  }
  function scan() {
    const ref = findTransferBtn();
    if (!ref) { if (btn.isConnected) btn.remove(); return; }
    if (btn.nextElementSibling !== ref) {
      btn.className = ref.className;
      btn.style.marginRight = '8px';
      ref.before(btn);
    }
    paintBtn();
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const here = routeIds();
    if (!here) { toast(T().noChat); return; }
    const conv = String(here.conv);
    const j = jobs.get(conv);
    if (j) {
      // у цьому чаті продажа вже йде: друге натискання за 4 сек — скасувати
      if (j.phase === 'sending' && cancelAsk && cancelAsk.conv === conv && Date.now() < cancelAsk.until) {
        cancelAsk = null; j.stop = true; return;
      }
      if (j.phase === 'sending') {
        cancelAsk = { conv, until: Date.now() + 4000 };
        toast(RU() ? `Продажа здесь уже идёт (${j.sent}/${j.total}). Нажми «Продажа» ещё раз, чтобы отменить.` : `Продаж тут уже йде (${j.sent}/${j.total}). Натисни «Продажа» ще раз, щоб скасувати.`);
      }
      return;
    }
    if (again && Date.now() < again.until && again.conv === conv) {
      const p = again.prep; again = null; hideToast(); run(p); return;
    }
    start(here);
  });

  async function start(ids) {
    const conv = String(ids.conv);
    jobs.set(conv, { phase: 'prep', sent: 0, total: 0 });
    let prep;
    try {
      const c = await api(ids.acc, `/conversations/${ids.conv}`);
      const name = await inboxName(ids.acc, c.inbox_id);
      prep = {
        acc: ids.acc, conv: ids.conv, script: null,
        name: clientName(c), who: cleanName(c.meta && c.meta.sender && c.meta.sender.name),
        hasLabel: !!LABEL && (c.labels || []).includes(LABEL),
        cardName: ((c.meta && c.meta.sender && c.meta.sender.name) || '').trim(),
        fundist: fundistTarget(c, name),
      };
      { const sc = scriptFor(name); prep.set = (sc && sc.set) || (prep.fundist && setOfSub(prep.fundist.sub)) || null;
        // конкретний проєкт (для заголовка): з джерела чату, інакше з піддомену Fundist
        prep.project = (sc && sc.project) || (prep.fundist && Object.keys(PROJECT_SUBDOMAIN).find((k) => PROJECT_SUBDOMAIN[k] === prep.fundist.sub)) || null; }
    } catch (e) {
      jobs.delete(conv);
      toast(e instanceof AuthError ? T().errAuth : T().errGen(e.message));
      return;
    }
    jobs.delete(conv);
    pickBox(prep);   // вікно вибору боксу; далі — run(prep) з обраним боксом
  }

  async function run(prep) {
    const { acc, script, name } = prep;
    const conv = String(prep.conv);
    if (!script.messages.length) { toast(T().emptyScript(script.title)); openSettings(script.id); return; }
    const msgs = script.messages.map((m0, i) => { const m = boxText(m0, script.box); return /\{(имя|ім'я|name)\}/i.test(m) ? personalize(m, name) : m; });
    const job = { phase: 'sending', who: prep.who, sent: 0, total: msgs.length, stop: false };
    jobs.set(conv, job);
    cardMarks.set(conv, { name: prep.cardName || '', kind: 'run', until: 0 });
    const finish = (kind, ms) => { jobs.delete(conv); cardMarks.set(conv, { name: prep.cardName || '', kind, until: Date.now() + ms }); };
    const typing = (on) => SHOW_TYPING && api(acc, `/conversations/${conv}/toggle_typing_status`, {
      method: 'POST', body: JSON.stringify({ typing_status: on ? 'on' : 'off' }),
    }).catch(() => {});

    for (let i = 0; i < msgs.length; i++) {
      if (i > 0) {
        typing(true);
        const until = Date.now() + DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
        while (Date.now() < until && !job.stop) await sleep(150);
        if (job.stop) {
          typing(false);
          finish('stop', 15000);
          toast(T().stoppedMsg(job.sent));
          return;
        }
      }
      try {
        await api(acc, `/conversations/${conv}/messages`, {
          method: 'POST', body: JSON.stringify({ content: msgs[i], message_type: 'outgoing', private: false }),
        });
      } catch (e) {
        finish('err', 30000);
        toast(e instanceof AuthError ? T().errAuth : T().errSend(i + 1));
        return;
      }
      job.sent = i + 1;
    }

    job.phase = 'labeling';
    let ok = true;
    try {
      const cur = LABEL ? await api(acc, `/conversations/${conv}/labels`) : null;
      const labels = (cur && cur.payload) || [];
      if (LABEL && !labels.includes(LABEL)) {
        await api(acc, `/conversations/${conv}/labels`, { method: 'POST', body: JSON.stringify({ labels: [...labels, LABEL] }) });
      }
    } catch (e) { ok = false; }

    let fMsg = null, fUrl = null;
    if (FUNDIST_TAG) {
      job.phase = 'fundist';
      const f = prep.fundist ? { ...prep.fundist, tag: script.box.tag } : null;
      if (!f) fMsg = T().fNoLink;
      else {
        fUrl = f.url;
        const r = await fundistTag(f);
        if (!r.ok) fMsg = fundistErr(r, f);
      }
    }
    const problems = [!LABEL && T().noLabel, !ok && T().labelFail(), fMsg].filter(Boolean);
    finish(problems.length ? 'err' : 'done', problems.length ? 30000 : 20000);
    // якщо не вийшло з тегом у Fundist (наприклад, не залогінений) — у віконці буде кнопка «Поставити тег ще раз»
    const retry = fMsg && prep.fundist ? { f: { ...prep.fundist, tag: script.box.tag }, who: prep.who, conv, cardName: prep.cardName || '', labelOk: ok } : null;
    if (problems.length) toast(`${prep.who ? `${prep.who}: ` : ''}${problems.join('\n\n')}`, fMsg ? fUrl : null, retry);
  }

  // ---------- Fundist ----------
  const fundistErr = (r, f) => (r.msg === 'login' ? T().fLogin(f.sub) : r.msg === 'notag' ? T().fNoTag(f.tag)
    : r.msg === 'timeout' ? T().fTimeout : T().fFail(r.msg));
  function fundistTarget(conv, inbox) {
    const s = (conv.meta && conv.meta.sender) || {};
    const ca = s.custom_attributes || {};
    const raw = Object.entries(ca).find(([k]) => k.toLowerCase() === 'userid');
    const val = raw ? String(raw[1]) : '';
    let sub = null, id = null;
    const mm = val.match(/https?:\/\/([a-z0-9-]+)\.boadmin\.org\/[^\s]*?Summary\/(\d+)/i);
    if (mm) { sub = mm[1].toLowerCase(); id = mm[2]; }
    else {
      const n = String(inbox || '').toLowerCase();
      const proj = Object.keys(PROJECT_SUBDOMAIN).find((p) => new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(n));
      const idm = val.match(/(\d{6,})/);
      if (proj && idm) { sub = PROJECT_SUBDOMAIN[proj]; id = idm[1]; }
    }
    if (!sub || !id) return null;
    return { sub, userId: id, tag: '', url: `https://${sub}.boadmin.org/ru/Users/Summary/${id}` };
  }

  function tomorrowExpire() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + 1));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} 23:59`;
  }

  // ---------- тег напряму, без відкриття вкладки (швидше) ----------
  function gmReq(o) {
    return new Promise((resolve) => GM_xmlhttpRequest({ timeout: 20000, ...o, onload: resolve, onerror: () => resolve(null), ontimeout: () => resolve(null) }));
  }
  async function directTag(f) {
    const host = `${f.sub}.boadmin.org`, catKey = `ft_cat_${host}_${f.tag.toLowerCase()}`;
    const page = await gmReq({ method: 'GET', url: f.url });
    if (!page) return null;
    const html = String(page.responseText || '');
    // «не залогінений» — тільки якщо Fundist перекинув на сторінку входу (на сторінці клієнта буває своє поле пароля)
    if (/login|account\/log/i.test(page.finalUrl || '')) return { ok: false, msg: 'login' };
    const token = (html.match(/[0-9a-f]{32}:[0-9a-f]{64}/i) || [])[0];
    let cat = GM_getValue(catKey, null);
    if (!cat) {
      const esc = f.tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = html.match(new RegExp(`<option[^>]*value=["']?(\\d+)["']?[^>]*>\\s*${esc}\\s*<`, 'i'));
      if (m) { cat = m[1]; GM_setValue(catKey, cat); }
    }
    if (!token || !cat) return null;   // не знайшли — зробимо через вкладку, як раніше
    const body = new URLSearchParams({ IDUser: f.userId, IDCategory: cat, TagExpireType: '1', ExpireDate: tomorrowExpire(), Comment: FUNDIST_COMMENT }).toString();
    const r = await gmReq({
      method: 'POST', url: `https://${host}/ru/Users/Tags/Create`, data: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', 'x-csrf-token': token, Referer: f.url },
    });
    if (!r || r.status >= 400) return null;
    const clean = String(r.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return /успешно|уже применен/i.test(clean) ? { ok: true, msg: clean } : null;
  }

  // теги КЛІЄНТА: лише «плашки» з ✖ угорі сторінки (видимі й сховані під «Остальные»), не список усіх тегів
  function hasClientTag(html, name) {
    const endI = html.search(/Системная\s+информация/i);
    const area = endI > 0 ? html.slice(0, endI) : html;
    const e = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`>\\s*${e}\\s*<[\\s\\S]{0,400}?(fa-times|fa-close|fa-xmark|times|close|remove|delete|Удал|×|✖|&times;)`, 'i').test(area);
  }
  async function clientInfo(f) {
    const page = await gmReq({ method: 'GET', url: f.url });
    if (!page) return { err: 'net' };
    if (/login|account\/log/i.test(page.finalUrl || '')) return { err: 'login' };
    const html = String(page.responseText || '');
    const has = BOXES.filter((bx) => hasClientTag(html, bx.tag)).map((bx) => bx.id);
    const tier = ['Highroll', 'HighRoller', 'VIP'].some((t) => hasClientTag(html, t)) ? 'vip'
      : ['PreVIP', 'Privip', 'PriVIP', 'Pre VIP'].some((t) => hasClientTag(html, t)) ? 'previp' : 'ap';
    return { has, tier };
  }

  async function fundistTag(f) {
    // спершу напряму (≈1 с); не вийшло — через фонову вкладку, як раніше
    try {
      const d = await directTag(f);
      if (d) return d;
    } catch (e) {}
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resKey = `ft_res_${id}`;
    GM_setValue(`ft_job_${id}`, { userId: f.userId, tag: f.tag, expire: tomorrowExpire(), comment: FUNDIST_COMMENT });
    const tab = GM_openInTab(`${f.url}#sales-tag=${id}`, { active: false, insert: true, setParent: true });
    const until = Date.now() + FUNDIST_TIMEOUT * 1000;
    let res = null;
    while (Date.now() < until) {
      res = GM_getValue(resKey, null);
      if (res) break;
      await sleep(500);
    }
    try { tab && tab.close && tab.close(); } catch (e) {}
    GM_deleteValue(resKey); GM_deleteValue(`ft_job_${id}`);
    return res || { ok: false, msg: 'timeout' };
  }

  // ---------- маленьке віконце (тільки для помилок і вибору скрипта) ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483002;top:70px;right:380px;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host { all: initial; }
  .box { width: 320px; background: #1F232C; color: #ECEFF4; border: 1px solid #363C49; border-radius: 12px; padding: 12px;
    box-shadow: 0 12px 36px rgba(0,0,0,.5); font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .box[hidden] { display: none; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  p { margin-bottom: 10px; }
  .list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  button { font: inherit; cursor: pointer; border-radius: 8px; padding: 7px 10px; font-weight: 600; }
  .pick { background: #3B82F6; color: #fff; border: 0; text-align: left; }
  .lnk { display: block; color: #7C9BFF; margin-bottom: 10px; font-weight: 600; text-decoration: none; }
  .rt { background: #3B82F6; color: #fff; border: 0; width: 100%; margin-bottom: 6px; }
  .rt:disabled { opacity: .6; cursor: default; }
  .x { background: #272C37; color: #ECEFF4; border: 1px solid #363C49; width: 100%; }
  button:focus-visible { outline: 2px solid #7C9BFF; outline-offset: 1px; }
  .box.wide { width: 560px; max-width: calc(100vw - 24px); padding: 14px; }
  .ph { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; } .ph > div { flex: 1; font-size: 14px; } .mu { color: #9AA2B1; font-weight: 400; }
  .proj { display: inline-block; background: #3B82F6; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: .4px; border-radius: 6px; padding: 1px 8px; margin-left: 2px; }
  .ic { width: 28px; height: 28px; padding: 0; border-radius: 8px; background: transparent; color: #9AA2B1; border: 1px solid transparent; font-size: 13px; }
  .ic:hover { background: #272C37; color: #ECEFF4; border-color: #363C49; }
  .box.wide .x.ic { width: 28px; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .pill { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; background: #272C37; color: #9AA2B1; border: 1px solid #363C49; }
  .pill b { color: #ECEFF4; } .pill.ok { color: #5FD39D; border-color: #2C6B50; background: #1A3329; } .pill.bad { color: #EF6B63; border-color: #6E3431; background: #2A1716; }
  button.pill { cursor: pointer; font-family: inherit; } button.pill:hover { border-color: #EF6B63; }
  .pill.warnp { color: #F2B544; border-color: #7A5A1C; background: #2E2614; }
  .cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .box.narrow { padding: 10px; } .box.narrow .cols { gap: 4px; } .box.narrow .col { padding: 5px; } .box.narrow .bx { padding: 7px 8px; }
  .box.narrow .br { flex-wrap: wrap; gap: 3px; } .box.narrow .br span { padding: 1px 5px; white-space: nowrap; }
  .sets { display: flex; gap: 4px; margin-bottom: 10px; padding: 3px; background: #181B22; border-radius: 10px; }
  .set { flex: 1; white-space: nowrap; background: none; border: 0; color: #8E97A7; font-size: 11.5px; font-weight: 650; padding: 5px 6px; border-radius: 8px; }
  .set:hover { color: #ECEFF4; } .set.on { background: #2B313D; color: #fff; }
  .col { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 12px; border: 1px solid transparent; --c: #8E97A7; }
  .col.g-ap { --c: #5FD39D; } .col.g-previp { --c: #F2B544; } .col.g-vip { --c: #B9A4FF; }
  .col.me { border-color: color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 7%, transparent); }
  .gh { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--c); padding: 0 2px 2px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
  .bx { display: flex; flex-direction: column; align-items: stretch; gap: 5px; text-align: left; background: #252A34; color: #ECEFF4; border: 1px solid #343A47; border-radius: 10px; padding: 9px 10px; transition: border-color .12s, transform .12s; }
  .bx:hover { border-color: var(--c); transform: translateY(-1px); }
  .bn { font-size: 12.5px; font-weight: 700; }
  .br { display: flex; gap: 5px; flex-wrap: wrap; } .br span { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 6px; background: #1B1F27; color: #C9D1E0; }
  .br .fs { color: var(--c); }
  .bd { font-size: 11px; color: #8E97A7; font-weight: 500; }
  .bx.has { border-color: #6E3431; background: #2A1C1D; } .bx.has:hover { border-color: #EF6B63; }
  .tagon { color: #EF6B63; font-weight: 700; } .nt { color: #F2B544; }
</style>
<div class="box" hidden></div>`;
  document.body.appendChild(host);
  const box = root.querySelector('.box');
  let toastTimer = null, pending = null, retryJob = null;

  // блок відкритого чату (шапка + повідомлення + поле вводу) — щоб меню стояло саме над ним, на будь-якому екрані
  function chatPane() {
    const sel = document.querySelector('.conversation-details-wrap, .conversation-panel-wrap');
    if (sel && sel.getBoundingClientRect().width > 250) return sel;
    // запасний варіант: найменший предок кнопки, який займає більшу частину висоти екрана і не на всю ширину
    for (let el = btn.parentElement; el && el !== document.body; el = el.parentElement) {
      const q = el.getBoundingClientRect();
      if (q.height >= window.innerHeight * 0.6 && q.width >= 300 && q.width <= window.innerWidth * 0.85) return el;
    }
    return null;
  }
  function chatList(pane) {
    return (pane || document).querySelector('ul.conversation-panel, .conversation-panel, [class*="message-list"]');
  }
  function placeBox() {
    if (!btn.isConnected) return;
    const r = btn.getBoundingClientRect();
    if (box.classList.contains('wide') && !box.hidden) {
      // меню вибору боксу — всередині блоку самого чату: по центру по ширині, одразу під шапкою чату
      const pane = chatPane(), pr = pane ? pane.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: r.bottom, bottom: window.innerHeight };
      const bw = Math.max(340, Math.min(560, Math.round(pr.right - pr.left - 16)));
      box.style.width = `${bw}px`; box.classList.toggle('narrow', bw < 500);
      const w = box.offsetWidth || 560, hgt = box.offsetHeight || 420;
      const list = chatList(pane), top0 = Math.max(r.bottom, list ? list.getBoundingClientRect().top : r.bottom) + 10;
      host.style.right = 'auto';
      host.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, Math.round(pr.left + (pr.right - pr.left - w) / 2)))}px`;
      host.style.top = `${Math.max(8, Math.min(Math.round(top0), window.innerHeight - hgt - 8))}px`;
      return;
    }
    host.style.left = 'auto';
    host.style.top = `${Math.round(r.bottom + 8)}px`;
    host.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  }
  function toast(text, link, retry = null) {
    box.classList.remove('wide', 'narrow'); box.style.width = ''; placeBox(); clearTimeout(toastTimer); pending = null; retryJob = retry;
    box.innerHTML = `<p style="white-space:pre-line">${esc(text)}</p>`
      + (link ? `<a class="lnk" href="${esc(link)}" target="_blank" rel="noopener">${esc(T().openClient)} ↗</a>` : '')
      + (retry ? `<button class="rt">${esc(T().fRetry)}</button>` : '')
      + `<button class="x">${esc(T().close)}</button>`;
    box.hidden = false;
    // з кнопкою повтору віконце не ховається само — чекає, поки залогінишся
    if (!retry) toastTimer = setTimeout(hideToast, 10000);
  }
  async function retryFundist() {
    const r = retryJob;
    if (!r) return;
    const b = box.querySelector('.rt');
    if (b) { b.disabled = true; b.textContent = T().fRetrying; }
    const res = await fundistTag(r.f);
    if (retryJob !== r) return;   // віконце вже закрили або показали інше
    if (res.ok) {
      toast(`${r.who ? `${r.who}: ` : ''}${T().fRetryOk}`);
      if (r.labelOk) cardMarks.set(r.conv, { name: r.cardName, kind: 'done', until: Date.now() + 20000 });
    } else {
      toast(`${r.who ? `${r.who}: ` : ''}${fundistErr(res, r.f)}`, r.f.url, r);
    }
  }
  // ---------- вибір боксу: 3 колонки (АП / PreVIP / VIP), видно, які теги вже стоять у клієнта ----------
  function pickBox(prep) {
    placeBox(); clearTimeout(toastTimer); pending = prep; retryJob = null;
    box.classList.add('wide');
    const ru = RU();
    prep.autoSet = !!prep.set;   // проєкт визначився — показуємо тільки його бокси
    if (!prep.set) prep.set = GM_getValue('ssLastSet', 'supp');
    const paint = (info) => {
      if (pending !== prep) return;
      const setBoxes = BOXES.filter((bx) => bx.set === prep.set);
      const has = ((info && info.has) || []).filter((id) => setBoxes.some((b) => b.id === id)), tier = info && info.tier;
      const st = !prep.fundist ? (ru ? '⚠ нет ссылки на Fundist — тег не поставлю, проверить теги не могу' : '⚠ немає посилання на Fundist — тег не поставлю')
        : !info ? (ru ? '⏳ смотрю теги клиента в Fundist…' : '⏳ дивлюсь теги клієнта у Fundist…')
          : info.err === 'login' ? (ru ? `⚠ не залогинен в ${prep.fundist.sub}.boadmin.org — какие теги уже стоят, не видно` : `⚠ не залогінений у ${prep.fundist.sub}.boadmin.org`)
            : info.err ? (ru ? '⚠ Fundist не ответил — какие теги стоят, не видно' : '⚠ Fundist не відповів')
              : has.length ? (ru ? `🔴 у клиента уже стоит: ${has.map((id) => BOXES.find((b) => b.id === id).tag).join(', ')}` : `🔴 у клієнта вже стоїть: ${has.map((id) => BOXES.find((b) => b.id === id).tag).join(', ')}`)
                : (ru ? '🟢 тегов продажи у клиента нет' : '🟢 тегів продажу в клієнта немає');
      const tierTxt = { ap: ru ? 'обычный' : 'звичайний', previp: 'PreVIP', vip: 'VIP' }[tier];
      box.innerHTML = `<div class="ph"><div><b>${ru ? 'Какой бокс начислить?' : 'Який бокс нарахувати?'}</b>${prep.autoSet ? ` · <span class="proj">${esc(prep.project ? prep.project.toUpperCase() : (SETS.find((x) => x.id === prep.set) || {}).title || '')}</span>` : ''}${prep.who ? `<span class="mu"> · ${esc(prep.who)}</span>` : ''}</div>
          <button class="ic cfg" title="${ru ? 'Тексты сообщений' : 'Тексти повідомлень'}">⚙</button><button class="ic x" title="${esc(T().close)}">✕</button></div>
        <div class="pills">${tier ? `<span class="pill">${ru ? 'Статус' : 'Статус'}: <b>${tierTxt}</b></span>` : ''}<span class="pill ${has.length ? 'bad' : info && !info.err ? 'ok' : ''}">${esc(st.replace(/^[🔴🟢⚠⏳]\s*/u, ''))}</span>
          ${!LABEL ? `<button class="pill bad cfg nolbl">${ru ? '⚠ не выбрана твоя метка — нажми, чтобы выбрать' : '⚠ не обрана твоя мітка — натисни, щоб обрати'}</button>` : ''}
          ${prep.hasLabel ? `<span class="pill warnp">${ru ? 'в чате уже продавали' : 'у чаті вже продавали'}</span>` : ''}</div>
        ${prep.autoSet ? '' : `<div class="sets">${SETS.map((x) => `<button class="set${x.id === prep.set ? ' on' : ''}" data-set="${x.id}">${esc(x.title)}</button>`).join('')}</div>`}
        <div class="cols">${GROUPS.map((g) => `<div class="col g-${g.id}${tier === g.id ? ' me' : ''}"><div class="gh"><span class="dot"></span>${esc(g.title)}</div>
          ${setBoxes.filter((bx) => bx.group === g.id).map((bx) => {
            const on = has.includes(bx.id), sc = SCRIPTS.find((x) => x.id === bx.id);
            return `<button class="bx${on ? ' has' : ''}" data-box="${bx.id}" title="${esc(bx.tag)}${on ? (ru ? ' — уже стоит у клиента' : ' — вже стоїть у клієнта') : ''}">
              <span class="bn">${esc(bx.name)}</span>
              <span class="br"><span class="fs">${fmtN(bx.fs)} FS</span><span class="rb">${fmtN(bx.rub)} ₽</span></span>
              <span class="bd">${on ? `<span class="tagon">${ru ? 'тег уже стоит' : 'тег вже стоїть'}</span>` : `${ru ? 'деп от' : 'деп від'} ${fmtN(bx.dep)} ₽`}${sc && !sc.messages.length ? ` · <span class="nt">${ru ? 'нет текста' : 'нема тексту'}</span>` : ''}</span></button>`;
          }).join('')}</div>`).join('')}</div>`;
      box.hidden = false;
      placeBox();
    };
    prep.repaint = () => paint(prep.info || (prep.fundist ? null : {}));
    paint(null);
    if (prep.fundist) clientInfo(prep.fundist).then((info) => { prep.info = info; paint(info); }).catch(() => { prep.info = { err: 'net' }; paint(prep.info); });
  }
  window.addEventListener('resize', () => { if (!box.hidden) placeBox(); });
  function hideToast() { box.hidden = true; box.classList.remove('wide', 'narrow'); box.style.width = ''; pending = null; retryJob = null; }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('set') && pending) { pending.set = b.dataset.set; GM_setValue('ssLastSet', pending.set); pending.repaint(); return; }
    if (b.classList.contains('bx') && pending) {
      const prep = { ...pending, script: SCRIPTS.find((s) => s.id === b.dataset.box) };
      const ru = RU();
      if (b.classList.contains('has') && !confirm(ru ? `У клиента уже стоит тег ${prep.script.box.tag}. Всё равно продать «${prep.script.box.name}»?` : `У клієнта вже стоїть тег ${prep.script.box.tag}. Все одно продати «${prep.script.box.name}»?`)) return;
      hideToast(); run(prep); return;
    }
    if (b.classList.contains('cfg')) { const fb = pending && BOXES.find((x) => x.set === pending.set); hideToast(); openSettings(fb ? fb.id : null); return; }
    if (b.classList.contains('rt') && retryJob && !b.disabled) { retryFundist(); return; }
    if (b.classList.contains('x')) hideToast();
  });
  document.addEventListener('pointerdown', (e) => {
    if (box.hidden || retryJob) return;   // віконце з кнопкою повтору закривається тільки кнопкою «Закрити»
    const p = e.composedPath();
    if (!p.includes(host) && !p.includes(btn)) hideToast();
  }, true);

  window.addEventListener('beforeunload', (e) => {
    if ([...jobs.values()].some((j) => j.phase === 'sending')) { e.preventDefault(); e.returnValue = T().leave; return T().leave; }
  });
  // ---------- маленька позначка на картці чату, де зараз іде продажа ----------
  const cardMarks = new Map(); // conv -> { name, kind: 'run' | 'done' | 'stop' | 'err', until }
  function saleWholeCard(el) {
    let cur = el;
    while (cur.parentElement && cur.parentElement !== document.body) {
      const r = cur.parentElement.getBoundingClientRect();
      if (r.height > 200 || r.left > window.innerWidth * 0.5) break;
      cur = cur.parentElement;
    }
    return cur;
  }
  function saleFindCard(conv, name) {
    const a = document.querySelector(`a[href*="/conversations/${conv}"]`);
    if (a) return saleWholeCard(a);
    if (!name) return null;
    const found = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeValue.trim() !== name) continue;
      const el = n.parentElement;
      const r = el.getBoundingClientRect();
      if (!r.width || r.left > window.innerWidth * 0.45) continue;
      let scroll = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll') { scroll = true; break; }
      }
      if (scroll) found.push(el);
    }
    return found.length === 1 ? saleWholeCard(found[0]) : null;
  }
  function paintCard() {
    document.querySelectorAll('[data-ss-overlay]').forEach((o) => o.remove());
    for (const [conv, m] of [...cardMarks]) {
      if (m.kind !== 'run' && Date.now() > m.until) { cardMarks.delete(conv); continue; }
      const card = saleFindCard(conv, m.name);
      if (!card) continue;
      const ru = RU();
      const j = jobs.get(conv);
      const txt = m.kind === 'run'
        ? (j && j.phase === 'sending' ? `💸 ${ru ? 'продажа' : 'продаж'} ${j.sent}/${j.total}` : `💸 ${ru ? 'продажа…' : 'продаж…'}`)
        : m.kind === 'done' ? '💸 ✓ продано'
          : m.kind === 'stop' ? `💸 ${ru ? 'отменено' : 'скасовано'}` : `💸 ⚠ ${ru ? 'продажа' : 'продаж'}`;
      const col = m.kind === 'run' ? ['#2A2340', '#B9A4FF', '#4A3D73'] : m.kind === 'done' ? ['#1E4636', '#5FD39D', '#2C6B50'] : ['#4A3917', '#F2B544', '#7A5A1C'];
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      const ov = document.createElement('div');
      ov.dataset.ssOverlay = '1';
      ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
      const lab = document.createElement('span');
      lab.textContent = txt;
      lab.style.cssText = `position:absolute;right:10px;top:7px;font:700 10.5px system-ui,sans-serif;padding:1px 7px;border-radius:999px;background:${col[0]};color:${col[1]};border:1px solid ${col[2]};`;
      ov.appendChild(lab);
      card.appendChild(ov);
    }
  }
  setInterval(paintCard, 700);

  // ---------- вікно налаштувань ⚙ (ПКМ по кнопці «Продажа» або меню Tampermonkey) ----------
  // ---------- вікно налаштувань ⚙: вкладка на кожен скрипт, повідомлення окремими картками ----------
  function openSettings(startTab) {
    const old = document.getElementById('ss-settings-host');
    if (old) old.remove();
    const h = document.createElement('div');
    h.id = 'ss-settings-host';
    h.style.cssText = 'position:fixed;inset:0;z-index:2147483005;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;';
    const r = h.attachShadow({ mode: 'open' });
    const S = lang === 'uk' ? {
      title: 'Налаштування продажі',
      varsH: 'Слова в {дужках} скрипт підставить сам — міняти їх не треба. Праворуч видно, що отримає клієнт. Натисни, щоб вставити в текст:',
      vName: "ім'я клієнта (немає імені — прибереться)", insTip: 'Вставити в текст',
      lblT: 'Твоя мітка в Chatwoot', lblHint: 'ставиться в чаті після продажу — обери свою', lblNone: '— без мітки —',
      pause: 'Пауза', from: 'від', to: 'до', sec: 'сек',
      lbl: 'Мітка в чаті', lblPh: 'почни вводити — покаже мітки чату',
      msg: 'Повідомлення', add: '+ повідомлення', up: 'Вище', down: 'Нижче', del: 'Видалити',
      name: 'з імені', nameEx: (t) => `«Олексій, ${t}…»`,
      nameTip: 'Вставити в текст:',
      ph: 'Текст повідомлення…', count: (n) => `${n} повідомл.`,
      resetTab: 'стандартний текст', resetTabQ: 'Повернути стандартні тексти для цього боксу?',
      reset: 'Скинути все', close: 'Закрити', save: 'Зберегти', confirm: 'Повернути всі тексти й налаштування до стандартних?',
      wasReset: 'Налаштування скинуто до стандартних', saved: '✓ Збережено', empty: (t) => `У «${t}» немає жодного повідомлення — додай хоча б одне.`,
    } : {
      title: 'Настройки продажи',
      varsH: 'Слова в {скобках} скрипт подставит сам — менять их не нужно. Справа видно, что получит клиент. Нажми, чтобы вставить в текст:',
      vName: 'имя клиента (нет имени — уберётся)', insTip: 'Вставить в текст',
      lblT: 'Твоя метка в Chatwoot', lblHint: 'ставится в чате после продажи — выбери свою', lblNone: '— без метки —',
      pause: 'Пауза', from: 'от', to: 'до', sec: 'сек',
      lbl: 'Метка в чате', lblPh: 'начни вводить — покажет метки чата',
      msg: 'Сообщение', add: '+ сообщение', up: 'Выше', down: 'Ниже', del: 'Удалить',
      name: 'с имени', nameEx: (t) => `«Алексей, ${t}…»`,
      nameTip: 'Вставить в текст:',
      ph: 'Текст сообщения…', count: (n) => `${n} сообщ.`,
      resetTab: 'стандартный текст', resetTabQ: 'Вернуть стандартные тексты для этого бокса?',
      reset: 'Сбросить всё', close: 'Закрыть', save: 'Сохранить', confirm: 'Вернуть все тексты и настройки к стандартным?',
      wasReset: 'Настройки сброшены к стандартным', saved: '✓ Сохранено', empty: (t) => `В «${t}» нет ни одного сообщения — добавь хотя бы одно.`,
    };
    // робоча копія: { id: [{ text, name }] }
    const draft = Object.fromEntries(SCRIPTS.map((s) => [s.id, s.messages.map((t) => ({ text: t }))]));
    const defDraft = (id) => DEFAULTS.msgs[id].map((t) => ({ text: t }));
    let tab = SCRIPTS.some((x) => x.id === startTab) ? startTab : SCRIPTS[0].id;

    r.innerHTML = `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .w { width: min(820px, 95vw); height: min(620px, 90vh); display: flex; flex-direction: column; background: #1B1F27; color: #ECEFF4; border: 1px solid #333946; border-radius: 16px;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; box-shadow: 0 24px 70px rgba(0,0,0,.6); overflow: hidden; }
  .top { padding: 16px 20px 10px; }
  h2 { font-size: 16px; } .hint { color: #8E97A7; font-size: 12px; margin-top: 2px; }
  .body { flex: 1; display: flex; min-height: 0; border-top: 1px solid #2B313C; }
  .tabs { width: 200px; flex: none; overflow-y: auto; padding: 10px 8px; border-right: 1px solid #2B313C; background: #181B22; }
  .gt { font-size: 10.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; padding: 10px 10px 4px; }
  .gt:first-child { padding-top: 2px; }
  .g-ap { --c: #5FD39D; } .g-previp { --c: #F2B544; } .g-vip { --c: #B9A4FF; }
  .gt { color: #8E97A7; }
  .tdot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--c); margin-right: 7px; vertical-align: 1px; }
  .tab { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; background: none; color: #C9D1E0; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; font: inherit; font-size: 12.5px; }
  .tab:hover { background: #232832; }
  .tab small { font-size: 10.5px; color: #8E97A7; background: #232832; border-radius: 999px; padding: 0 7px; }
  .tab.on { background: #262C38; color: #fff; box-shadow: inset 3px 0 0 var(--c); }
  .scroll { flex: 1; overflow-y: auto; padding: 14px 18px; }
  .binfo { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 12px; }
  .binfo b { font-size: 14px; margin-right: 4px; color: var(--c); }
  .binfo span, .binfo code { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: #232832; color: #C9D1E0; }
  .binfo code { color: #8E97A7; font-family: ui-monospace, Menlo, monospace; }
  input, textarea { background: #232832; color: #ECEFF4; border: 1px solid #333946; border-radius: 9px; padding: 8px 10px; font: 13px/1.5 -apple-system, system-ui, sans-serif; }
  .card { margin-bottom: 10px; }
  textarea { width: 100%; min-height: 64px; resize: vertical; }
  .ch { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
  .sp { flex: 1; }
  .nm { display: flex; align-items: center; gap: 5px; color: #9AA2B1; font-size: 12px; cursor: pointer; user-select: none; }
  .ib { background: none; color: #8E97A7; border: 0; border-radius: 6px; width: 26px; height: 24px; cursor: pointer; font: inherit; }
  .ib:hover { background: #232832; color: #ECEFF4; } .ib:disabled { opacity: .3; cursor: default; } .ib.del:hover { color: #EF6B63; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
  .add { border: 1px dashed #3B4352; background: none; color: #7C9BFF; border-radius: 8px; padding: 5px 12px; cursor: pointer; font: inherit; font-weight: 600; font-size: 12px; }
  .lrow { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .lt { font-weight: 650; font-size: 12.5px; }
  select { background: #232832; color: #ECEFF4; border: 1px solid #333946; border-radius: 9px; padding: 6px 10px; font: inherit; min-width: 220px; }
  .vars { margin-top: 16px; padding: 10px 12px; border: 1px solid #2B313C; border-radius: 10px; background: #181B22; display: flex; flex-wrap: wrap; gap: 6px; }
  .vh { width: 100%; color: #8E97A7; font-size: 11.5px; margin-bottom: 2px; }
  .vars .chip { display: inline-flex; gap: 6px; align-items: center; font: 11.5px -apple-system, system-ui, sans-serif; padding: 3px 8px; }
  .vars .chip code { font: 11px ui-monospace, Menlo, monospace; color: #7C9BFF; } .vars .chip span { color: #C9D1E0; }
  .chips { display: flex; align-items: center; gap: 4px; color: #8E97A7; font-size: 11.5px; flex: 1; flex-wrap: wrap; }
  .chip { background: #232832; color: #C9D1E0; border: 1px solid #333946; border-radius: 6px; padding: 1px 7px; font: 11px ui-monospace, Menlo, monospace; cursor: pointer; }
  .chip:hover { border-color: #7C9BFF; color: #fff; }
  .rtab { background: none; border: 0; color: #8E97A7; text-decoration: underline; cursor: pointer; font: inherit; font-size: 11.5px; }
  .gen { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-top: 1px solid #2B313C; color: #9AA2B1; font-size: 12px; }
  .gen label { color: #9AA2B1; } .gen .lbl { flex: 1; max-width: 260px; padding: 5px 9px; }
  .pause { display: flex; align-items: center; gap: 4px; } .pause input { width: 52px; padding: 5px 7px; }
  .err { color: #EF6B63; font-size: 12px; margin-right: auto; align-self: center; }
  .btns { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 20px 14px; }
  .btns button { font: inherit; font-weight: 650; border-radius: 9px; padding: 7px 16px; cursor: pointer; border: 1px solid #333946; background: #232832; color: #ECEFF4; }
  .btns .save { background: #3B82F6; border-color: #3B82F6; color: #fff; }
  .btns .reset { color: #EF6B63; background: none; border-color: transparent; margin-right: auto; }
  input:focus, textarea:focus, button:focus-visible { outline: 2px solid #7C9BFF; outline-offset: 1px; }
</style>
<div class="w" role="dialog" aria-label="${S.title}">
  <div class="top">
    <h2>⚙ ${S.title}</h2>
    <div class="lrow"><span class="lt">🏷 ${S.lblT}</span><select class="lbl"><option value="">${esc(S.lblNone)}</option>${LABEL ? `<option value="${esc(LABEL)}" selected>${esc(LABEL)}</option>` : ''}</select><span class="hint">${S.lblHint}</span></div>
  </div>
  <div class="body"><nav class="tabs"></nav><div class="scroll"></div></div>
  <div class="gen">
    <label>${S.pause}</label><span class="pause"><input class="dmin" type="number" min="0" step="0.5" value="${DELAY_MIN / 1000}">–<input class="dmax" type="number" min="0" step="0.5" value="${DELAY_MAX / 1000}"> ${S.sec}</span>
  </div>
  <div class="btns"><button class="reset">${S.reset}</button><span class="err"></span><button class="x">${S.close}</button><button class="save">${S.save}</button></div>
</div>`;
    const tabsEl = r.querySelector('.tabs'), list = r.querySelector('.scroll'), errEl = r.querySelector('.err');
    const short = (t) => { const s = String(t || '').trim(); return s ? (s.charAt(0).toLowerCase() + s.slice(1, 28)) : '…'; };

    function paintTabs() {
      tabsEl.innerHTML = SETS.map((x) => `<div class="gt">${esc(x.title)}</div>${SCRIPTS.filter((s) => s.box.set === x.id).map((s) => `<button type="button" class="tab g-${s.box.group} ${s.id === tab ? 'on' : ''}" data-tab="${s.id}"><span><i class="tdot"></i>${esc(s.title)}</span><small>${draft[s.id].length}</small></button>`).join('')}`).join('');
    }
    const boxInfo = (bx) => `<div class="binfo g-${bx.group}"><b>${esc(bx.name)}</b><span>${esc((SETS.find((x) => x.id === bx.set) || {}).title || '')} · ${esc((GROUPS.find((g) => g.id === bx.group) || {}).title || '')}</span><span>${fmtN(bx.fs)} FS</span><span>${fmtN(bx.rub)} ₽</span><span>деп ${fmtN(bx.dep)} ₽</span><code>${esc(bx.tag)}</code></div>`;
    function paintList(focusIdx) {
      const items = draft[tab];
      const bx = SCRIPTS.find((x) => x.id === tab).box;
      list.innerHTML = boxInfo(bx) + items.map((m, i) => `<div class="card" data-i="${i}">
        <textarea placeholder="${esc(S.ph)}" spellcheck="false">${esc(m.text)}</textarea>
        <div class="ch"><span class="sp"></span>
          ${items.length > 1 ? `<button type="button" class="ib up" title="${S.up}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="ib down" title="${S.down}" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
          <button type="button" class="ib del" title="${S.del}">✕</button></div>
      </div>`).join('')
        + `<div class="foot"><button type="button" class="add">${S.add}</button>
          <button type="button" class="rtab">${S.resetTab}</button></div>
        <div class="vars"><div class="vh">${S.varsH}</div>
          ${[['{бокс}', bx.name], ['{фс}', fmtN(bx.fs)], ['{руб}', fmtN(bx.rub)], ['{деп}', fmtN(bx.dep)]].map(([c, v]) => `<button type="button" class="chip" data-ins="${c}" title="${esc(S.insTip)}"><code>${c}</code><span>→ ${esc(v)}</span></button>`).join('')}
        </div>`;
      list.querySelectorAll('textarea').forEach((t) => { t.style.height = 'auto'; t.style.height = `${Math.max(64, t.scrollHeight + 2)}px`; });
      if (focusIdx != null) { const t = list.querySelectorAll('textarea')[focusIdx]; if (t) t.focus(); }
    }
    paintTabs(); paintList();

    tabsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.tab'); if (!b) return;
      tab = b.dataset.tab; errEl.textContent = ''; paintTabs(); paintList();
    });
    list.addEventListener('input', (e) => {
      const card = e.target.closest('.card'); if (!card || e.target.tagName !== 'TEXTAREA') return;
      draft[tab][+card.dataset.i].text = e.target.value;
      e.target.style.height = 'auto'; e.target.style.height = `${Math.max(64, e.target.scrollHeight + 2)}px`;
    });
    let lastTa = null;
    list.addEventListener('focusin', (e) => { if (e.target.tagName === 'TEXTAREA') lastTa = e.target; });
    list.addEventListener('mousedown', (e) => { if (e.target.closest('.chip')) e.preventDefault(); });
    list.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) {
        const ta = lastTa && lastTa.isConnected ? lastTa : list.querySelector('textarea');
        if (!ta) return;
        const p = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, p) + chip.dataset.ins + ta.value.slice(ta.selectionEnd ?? p);
        ta.focus(); ta.selectionStart = ta.selectionEnd = p + chip.dataset.ins.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const items = draft[tab];
      if (e.target.closest('.add')) { items.push({ text: '' }); paintTabs(); paintList(items.length - 1); return; }
      if (e.target.closest('.rtab')) { if (confirm(S.resetTabQ)) { draft[tab] = defDraft(tab); paintTabs(); paintList(); } return; }
      const card = e.target.closest('.card'); if (!card) return;
      const i = +card.dataset.i;
      if (e.target.closest('.up') && i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paintList(i - 1); }
      else if (e.target.closest('.down') && i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paintList(i + 1); }
      else if (e.target.closest('.del')) { items.splice(i, 1); paintTabs(); paintList(); }
    });

    document.body.appendChild(h);
    const close = () => h.remove();
    // закривати тільки по кліку на темний фон, а не всередині вікна (кліки з shadow DOM приходять з target = host)
    h.addEventListener('mousedown', (e) => { h._downOnBg = e.composedPath()[0] === h; });
    h.addEventListener('click', (e) => { if (e.composedPath()[0] === h && h._downOnBg) close(); });
    // клавіші в полях не мають долітати до гарячих клавіш чату
    r.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); else close(); });
    r.querySelector('.x').addEventListener('click', close);
    r.querySelector('.reset').addEventListener('click', () => {
      if (!confirm(S.confirm)) return;
      GM_deleteValue('ssConfig2'); applyConfig(null); close(); toast(S.wasReset);
    });
    r.querySelector('.save').addEventListener('click', () => {
      const num = (sel) => parseFloat(String(r.querySelector(sel).value).replace(',', '.'));
      const msgs = {};
      for (const s of SCRIPTS) {
        const items = draft[s.id].map((m) => ({ text: m.text.trim() })).filter((m) => m.text);
        if (!items.length && ALLOW_EMPTY) { msgs[s.id] = []; continue; }
        if (!items.length) { tab = s.id; paintTabs(); paintList(); errEl.textContent = S.empty(s.title); return; }
        msgs[s.id] = items.map((m) => m.text);
      }
      const dmin = num('.dmin'), dmax = num('.dmax');
      const next = {
        msgs,
        DELAY_MIN: Number.isFinite(dmin) ? Math.round(dmin * 1000) : undefined,
        DELAY_MAX: Number.isFinite(dmax) ? Math.round(dmax * 1000) : undefined,
        LABEL: r.querySelector('select.lbl').value.trim(),
      };
      GM_setValue('ssConfig2', next); applyConfig(next);
      close(); toast(S.saved);
    });
    setTimeout(() => { const t = list.querySelector('textarea'); if (t) t.focus(); }, 50);
    // список міток з чату, щоб вибрати свою (зверху ті, де є «продаж»)
    const ids = routeIds();
    api(ids ? ids.acc : '1', '/labels').then((res) => {
      const l = ((res && (res.payload || res)) || []).map((x) => x.title || x).filter((x) => typeof x === 'string');
      // тільки особисті мітки «ім'я-продажа» (lex-продажа, will-продажа…), решту не показуємо
      l.splice(0, l.length, ...l.filter((t) => /^[a-zа-яё0-9_.]+-продажа$/i.test(t.trim()) && !/^продажа/i.test(t.trim())).sort((a, b) => a.localeCompare(b)));
      const sel = r.querySelector('select.lbl'), cur = sel.value;
      if (cur && !l.includes(cur)) l.unshift(cur);
      sel.innerHTML = `<option value="">${esc(S.lblNone)}</option>` + l.map((t) => `<option value="${esc(t)}"${t === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
    }).catch(() => {});
  }
  btn.addEventListener('contextmenu', (e) => { e.preventDefault(); openSettings(); });
  const openSettingsMenu = () => openSettings();
  btn.title = lang === 'uk' ? 'ПКМ — налаштування продажі' : 'ПКМ — настройки продажи';
  GM_registerMenuCommand('⚙ Настройки продажи', openSettingsMenu);

  GM_registerMenuCommand('Язык / Мова: RU ⇄ UA', () => { lang = lang === 'uk' ? 'ru' : 'uk'; GM_setValue('ssLang2', lang); paintBtn(); });

  let timer = null;
  // реагуємо не пізніше ніж за ~0.15 с після змін (раніше чекали, поки сторінка «заспокоїться» — під час завантаження Chatwoot це 5–10 с)
  new MutationObserver(() => { if (!timer) timer = setTimeout(() => { timer = null; scan(); }, 150); })
    .observe(document.body, { childList: true, subtree: true });
  scan();
})();
