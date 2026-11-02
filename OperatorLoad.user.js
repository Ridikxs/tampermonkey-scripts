// ==UserScript==
// @name         Operator Load
// @namespace    http://tampermonkey.net/
// @version      1.7
// @author       Will & Lex
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OperatorLoad.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OperatorLoad.user.js
// @description  Нагрузка чатов: сколько открытых чатов сейчас у каждого оператора и VIP-менеджера, вкладки VIP / AP / Менеджеры (по проектам)
// @match        https://sparkmoth.com/app/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      plevantis.net
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ===================== НАСТРОЙКИ =====================
  const REFRESH_MS = 3000;            // как часто обновлять нагрузку
  const AGENTS_MS = 60000;            // как часто обновлять список операторов (имена, онлайн)
  const TEAMS_MS = 6 * 3600000;       // как часто пересчитывать, кто VIP, а кто AP (по источникам)
  const VIP_INBOX = /vip|privip|previp|highroll/i;   // источник с таким названием = VIP
  // VIP-оператори (за іменем у Chatwoot). Хто не в списку — AP. Тимчасово перекинули AP у VIP — клікни мітку в списку
  const VIP_NAMES = ['scott', 'beatrice', 'charles', 'christine', 'richie', 'sally', 'terry', 'chadwick', 'lex', 'bill', 'holly', 'juliette', 'river', 'casper', 'ezra', 'tom', 'felicia', 'will', 'mike', 'earl', 'warren', 'alexia', 'denzel'];
  const AP_NAMES = ['kenzo', 'robert', 'jax', 'dwayne', 'amanda', 'murphy', 'rakim', 'snape', 'mack', 'harrison', 'marcus', 'bridget', 'aveline', 'freddie', 'duke', 'hops', 'ray', 'ron', 'zane', 'clive', 'clark'];
  const PILL_MAX = 8;                 // сколько операторов показывать на плашке (остальные — «+N»)
  // =====================================================

  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Chatwoot API ----------
  function session() {
    const m = document.cookie.match(/(?:^|;\s*)cw_d_session_info=([^;]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }
  const accId = () => { const m = location.pathname.match(/\/accounts\/(\d+)/); return m ? m[1] : '1'; };
  async function api(path) {
    const s = session();
    if (!s) throw new Error('auth');
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(path, {
        credentials: 'same-origin', cache: 'no-store', signal: ctl.signal,
        headers: { Accept: 'application/json', 'access-token': s['access-token'], 'token-type': s['token-type'] || 'Bearer', client: s.client, expiry: s.expiry, uid: s.uid },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    } finally { clearTimeout(to); }
  }
  const arr = (j) => (Array.isArray(j) ? j : Array.isArray(j && j.payload) ? j.payload : Array.isArray(j && j.data) ? j.data : (j && j.payload && Array.isArray(j.payload.data)) ? j.payload.data : []);

  // ---------- дані ----------
  const agents = new Map();   // id -> { name, status }
  let metrics = [];           // [{ id, open, unattended }]
  let state = 'loading';      // loading | live | error | auth
  let nextAgents = 0;
  // хто VIP: авто — по источниках (оператор в VIP-источнике = VIP), вручну — клік по мітці в списку
  let auto = GM_getValue('olAutoVip', { at: 0, ids: [] });
  // ручного перемикання VIP/AP більше немає — група визначається сама; старі ручні правки скидаємо
  const manual = {};
  GM_setValue('olManual', {});
  let filter = GM_getValue('olFilter', 'all');  // all | vip | ap | mgr (VIP-менеджери)

  // ім'я до пробілу чи «/» (Murphy/Сергей → murphy)
  const key = (id) => { const a = agents.get(id); return a ? String(a.name || '').trim().split(/[\s/]+/)[0].toLowerCase() : ''; };
  // ---------- графік plevantis: відділи (VIP Support / Regular Support) + хто на якій зміні ЗАРАЗ ----------
  // Оновлюється раз на 30 хв; місяць береться поточний (жовтень → листопад сам), для нічних змін — і попередній.
  const PLEV_PROJECT = 'sg';
  const nkey = (n) => String(n || '').trim().split(/[\s/]+/)[0].toLowerCase();
  let dept = GM_getValue('olDept', { at: 0, map: {} });   // ім'я → 'vip' | 'ap' (відділ за графіком)
  const sched = {};                                         // 'YYYY-MM' → { overrides, patterns, names: { key → ім'я в графіку } }
  const kyivNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, h: +p.hour + (+p.minute) / 60 };
  };
  const addDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  function fetchMonth(month) {
    return new Promise((resolve) => GM_xmlhttpRequest({
      method: 'GET', url: `https://plevantis.net/api/schedule?month=${month}&project=${PLEV_PROJECT}`, headers: { Accept: 'application/json' }, timeout: 20000,
      onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch (e) { resolve(null); } },
      onerror: () => resolve(null), ontimeout: () => resolve(null),
    }));
  }
  let schedAt = 0, schedBusy = false;
  async function loadDept() {
    if (schedBusy || Date.now() - schedAt < 30 * 60000) return;
    schedBusy = true; schedAt = Date.now() - 30 * 60000 + 5 * 60000;   // не вийшло — ще раз через 5 хв
    try {
      const now = kyivNow(), months = [...new Set([now.date.slice(0, 7), addDays(now.date, -1).slice(0, 7)])];
      for (const m of months) {
        const j = await fetchMonth(m);
        if (!j || !j.settings) continue;
        const st = j.settings, names = {};
        for (const n of Object.keys(st.operatorPatterns || {})) names[nkey(n)] = n;
        sched[m] = { overrides: j.overrides || {}, patterns: st.operatorPatterns || {}, names };
        if (m === now.date.slice(0, 7)) {
          const co = st.customOrder || {}, gone = st.dismissed || {}, renames = st.renames || {}, map = {};
          const put = (list, kind) => (list || []).forEach((n) => {
            if (gone[n] && gone[n] <= now.date) return;                 // звільнені — не рахуємо
            map[nkey(n)] = kind;
            for (const [from, to] of Object.entries(renames)) if (to === n) map[nkey(from)] = kind;
          });
          put(co.regular_support, 'ap');
          put(co.vip_support, 'vip');
          if (Object.keys(map).length) { dept = { at: Date.now(), map }; GM_setValue('olDept', dept); }
        }
      }
      schedAt = Date.now();
      paint();
    } catch (e) {}
    schedBusy = false;
  }
  // тип зміни на день: виняток (overrides «Ім'я:дата») або базовий цикл (pattern з cycleStart)
  function shiftOn(k, date) {
    const S = sched[date.slice(0, 7)];
    if (!S) return null;
    const name = S.names[k] || Object.keys(S.patterns).find((n) => nkey(n) === k);
    if (!name) return null;
    const ov = S.overrides[`${name}:${date}`];
    if (ov && ov.type) return { type: ov.type, work: ov.work };
    let pats = S.patterns[name];
    pats = (Array.isArray(pats) ? pats : [pats]).filter((p) => p && Array.isArray(p.pattern) && p.cycleStart && p.cycleStart <= date)
      .sort((a, b) => (a.cycleStart < b.cycleStart ? -1 : 1));
    const p = pats[pats.length - 1];
    if (!p) return null;
    const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${p.cycleStart}T12:00:00Z`)) / 86400000);
    return { type: p.pattern[((days % p.pattern.length) + p.pattern.length) % p.pattern.length] };
  }
  // години зміни (від початку дня; >24 — уже наступний день). VIP: vip_evening 9–21, vip_morning 21–9, vip_1200 12–24;
  // AP: morning 9–21, evening 21–9, shift1200 12–24; супервайзери: super_day 9–21, super_night 21–9
  function hoursOf(sh) {
    if (!sh) return [];
    if (Array.isArray(sh.work) && sh.work.length) return sh.work;
    const t = String(sh.type || '');
    if (/^(extra_)?vip_evening$|^(extra_)?morning$|^(extra_)?(super|sup)_day$/.test(t)) return [[9, 21]];
    if (/^(extra_)?vip_morning$|^(extra_)?evening$|^(extra_)?(super|sup)_night$/.test(t)) return [[21, 33]];
    if (/1200$/.test(t)) return [[12, 24]];
    return [];
  }
  // vip_… — VIP-лінія; super/sup — супервайзери; звичайні morning/evening/1200 — лінія AP,
  // але якщо в людини з VIP-відділу звичайний тип без «extra_» — це старий запис її ж VIP-графіка, вважаємо VIP
  // тип зміни = колір у графіку: vip_… — VIP, звичайні morning/evening/1200 — AP (навіть якщо людина в розділі VIP)
  const deptOfType = (t) => {
    if (/vip/.test(t)) return 'vip';
    if (/sup|super/.test(t)) return 'sup';
    if (/morning|evening|1200/.test(t)) return 'ap';
    return null;
  };
  // на якій лінії людина переважно працює цього місяця (за кольорами змін) — коли зараз не на зміні
  const monthCache = {};
  function monthLine(k) {
    const now = kyivNow(), m = now.date.slice(0, 7), ck = `${m}:${k}:${schedAt}`;
    if (ck in monthCache) return monthCache[ck];
    let v = 0, a = 0;
    // дні від сьогодні до кінця місяця важливіші (переведення «з наступного тижня»), тому дивимось ±10 днів навколо сьогодні
    for (let i = -10; i <= 10; i++) {
      const d = addDays(now.date, i);
      if (d.slice(0, 7) !== m) continue;
      const sh = shiftOn(k, d), dl = sh && deptOfType(sh.type);
      if (dl === 'vip') v++; else if (dl === 'ap') a++;
    }
    return (monthCache[ck] = v || a ? (v >= a ? 'vip' : 'ap') : null);
  }
  // на якій лінії людина працює просто зараз (з урахуванням допів на іншому відділі)
  function shiftNow(k) {
    const now = kyivNow();
    const today = shiftOn(k, now.date), yest = shiftOn(k, addDays(now.date, -1));
    if (today && hoursOf(today).some(([a, b]) => now.h >= a && now.h < b)) return deptOfType(today.type);
    if (yest && hoursOf(yest).some(([a, b]) => now.h + 24 >= a && now.h + 24 < b)) return deptOfType(yest.type);   // нічна з учора
    return null;
  }
  // де оператор ЗАРАЗ: за чатами, які він веде (видно чати тих джерел, що бачиш ти)
  function liveKind(id) {
    if (Date.now() - live.at > 6 * 60000) return null;
    const v = live.vip[id] || 0, a = live.ap[id] || 0;
    if (v || a) return v >= a ? 'vip' : 'ap';
    // чатів людини не видно (вона в джерелах, яких ти не бачиш) — не вгадуємо, беремо з графіка plevantis
    return null;
  }
  // ручна мітка > де веде чати зараз > відділ з графіка plevantis > вшиті списки > AP
  // де веде чати зараз > на якій лінії зміна зараз (графік, разом із допами) > відділ за графіком > вшиті списки > AP
  const kindOf = (id) => {
    const lk = liveKind(id);
    if (lk) return lk;
    const k = key(id);
    const sn = shiftNow(k);
    if (sn === 'vip' || sn === 'ap') return sn;
    const ml = monthLine(k);                 // не на зміні — на якій лінії переважно працює зараз
    if (ml) return ml;
    if (dept.map[k]) return dept.map[k];
    if (VIP_NAMES.includes(k)) return 'vip';
    if (AP_NAMES.includes(k)) return 'ap';
    // нового оператора немає в списках: веде чати у VIP-джерелах або стоїть у VIP-джерелі — VIP, інакше AP
    return seenVip.ids.includes(id) || auto.ids.includes(id) ? 'vip' : 'ap';
  };

  async function loadAgents() {
    const list = arr(await api(`/api/v1/accounts/${accId()}/agents`));
    agents.clear();
    for (const a of list) {
      const id = Number(a.id);
      if (Number.isInteger(id)) agents.set(id, { name: String(a.available_name || a.name || `#${id}`).trim(), status: a.availability_status || '', email: String(a.email || '') });
    }
    nextAgents = Date.now() + AGENTS_MS;
  }
  async function loadTeams() {
    if (Date.now() - auto.at < TEAMS_MS && auto.ids.length) return;
    try {
      const inboxes = arr(await api(`/api/v1/accounts/${accId()}/inboxes`)).filter((i) => VIP_INBOX.test(i.name || ''));
      const ids = new Set();
      for (const ib of inboxes) {
        try { arr(await api(`/api/v1/accounts/${accId()}/inbox_members/${ib.id}`)).forEach((a) => ids.add(Number(a.id))); } catch (e) {}
      }
      auto = { at: Date.now(), ids: [...ids] };
      GM_setValue('olAutoVip', auto);
    } catch (e) { auto.at = Date.now() - TEAMS_MS + 600000; }   // не вийшло — спробуємо через 10 хв
  }
  // нові оператори (не в списках): дивимось, в яких джерелах вони зараз ведуть чати.
  // Веде чати у VIP / Privip / Highroll — значить, VIP. Працює без особливих прав: бачимо чати своїх джерел
  let seenVip = GM_getValue('olSeenVip', { at: 0, ids: [] });
  let live = { at: 0, vip: {}, ap: {}, seeVip: false, seeAp: false };   // id → скільки чатів зараз у VIP / у звичайних джерелах
  let seenBusy = false;
  async function loadSeen() {
    if (seenBusy || Date.now() - seenVip.at < 2 * 60000) return;   // раз на 2 хв
    seenBusy = true;
    try {
      const ib = arr(await api(`/api/v1/accounts/${accId()}/inboxes`));
      const vipInbox = new Set(ib.filter((i) => VIP_INBOX.test(i.name || '')).map((i) => Number(i.id)));
      const ids = new Set(), lv = { vip: {}, ap: {} };
      for (let page = 1; page <= 4; page++) {
        const j = await api(`/api/v1/accounts/${accId()}/conversations?status=open&assignee_type=all&page=${page}`);
        const list = (j && j.data && j.data.payload) || [];
        for (const c of list) {
          const a = c.meta && c.meta.assignee;
          if (!a) continue;
          const id = Number(a.id), g = vipInbox.has(Number(c.inbox_id)) ? 'vip' : 'ap';
          lv[g][id] = (lv[g][id] || 0) + 1;
          if (g === 'vip') ids.add(id);
        }
        if (list.length < 25) break;
      }
      seenVip = { at: Date.now(), ids: [...ids] };
      live = { at: Date.now(), vip: lv.vip, ap: lv.ap, seeVip: vipInbox.size > 0, seeAp: ib.length > vipInbox.size };
      GM_setValue('olSeenVip', seenVip);
    } catch (e) { seenVip.at = Date.now() - 4 * 60000; }   // не вийшло — ще раз за хвилину
    seenBusy = false;
  }
  // ---------- проєкт менеджера: 1) ти вказав вручну (клік по рядку); 2) учасник джерела «VIPmanager <проєкт>»; 3) з пошти / імені ----------
  // хто з менеджерів за який проєкт (за поштою акаунта)
  const MGR_BY_EMAIL = {
    'ivan.go@gameup.club': 'REACTIVE',
    'murad.ab@gameup.club': 'R7 / DADDY',
    'maksym.ya@gameup.club': 'KOMETA',
    'oqtay.ma@gameup.club': 'KENT / ARKADA',
    'maxim.ko@gameup.club': 'GAMA / KOMETA',
    'giorgi.at@gameup.club': 'CAT',
  };
  const PROJ_WORDS = [['CAT', /cat/i], ['GAMA', /gama/i], ['KOMETA', /komet/i], ['DADDY', /dad/i], ['KENT', /kent/i], ['R7', /r7/i], ['ARKADA', /arkad/i], ['MERS', /mers/i], ['REACTIVE', /react/i]];
  let mgrInbox = GM_getValue('olMgrInbox', { at: 0, map: {} });   // id менеджера → проєкти з джерел VIPmanager
  async function loadMgrInboxes() {
    if (Date.now() - mgrInbox.at < 30 * 60000) return;
    mgrInbox.at = Date.now();
    try {
      const ibs = arr(await api(`/api/v1/accounts/${accId()}/inboxes`)).filter((i) => /vip\s*manager/i.test(i.name || ''));
      const map = {};
      for (const ib of ibs) {
        const proj = String(ib.name).replace(/vip\s*manager\s*/i, '').trim().toUpperCase();
        try { arr(await api(`/api/v1/accounts/${accId()}/inbox_members/${ib.id}`)).forEach((a) => { const k = String(a.id); map[k] = [...new Set([...(map[k] || []), proj])]; }); } catch (e) {}
      }
      mgrInbox = { at: Date.now(), map };
      GM_setValue('olMgrInbox', mgrInbox);
    } catch (e) { /* наступного разу */ }
  }
  // ім'я менеджера з пошти: maksym.ya@… → Maksym (щоб розрізняти двох на одному проєкті)
  const mgrNick = (id) => { const e = String((agents.get(id) || {}).email || '').split('@')[0].split(/[._-]/)[0]; return e ? e.charAt(0).toUpperCase() + e.slice(1) : ''; };
  // «CAT» → «Cat», «GAMA / KOMETA» → «Gama/Kometa», «R7» лишається
  const projTitle = (p) => String(p || '').split(/\s*\/\s*/).filter(Boolean).map((w) => (/^r7$/i.test(w) ? 'R7' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('/');
  function mgrProject(id) {
    const own = (GM_getValue('olMgrProj', {}) || {})[id];
    if (own) return own;
    const em = String((agents.get(id) || {}).email || '').toLowerCase();
    if (MGR_BY_EMAIL[em]) return MGR_BY_EMAIL[em];
    const ib = mgrInbox.map[String(id)];
    if (ib && ib.length) return ib.join(' / ');
    const a = agents.get(id) || {};
    const src = `${String(a.name || '').replace(/vip\s*manager/i, '')} ${String(a.email || '').split('@')[0]}`;
    const hit = PROJ_WORDS.filter(([, re]) => re.test(src)).map(([k]) => k);
    return hit.join(' / ');
  }

  async function loadMetrics() {
    const list = arr(await api(`/api/v2/accounts/${accId()}/live_reports/grouped_conversation_metrics?group_by=assignee_id`));
    metrics = list.map((x) => ({ id: Number(x.assignee_id), open: Number(x.open) || 0, unattended: Number(x.unattended) || 0 }))
      .filter((x) => Number.isInteger(x.id) && x.id > 0);
  }

  let busy = false;
  async function update() {
    if (busy) return;
    busy = true;
    try {
      if (!agents.size || Date.now() >= nextAgents) { try { await loadAgents(); } catch (e) { nextAgents = Date.now() + 15000; } }
      loadTeams();
      loadSeen();
      loadDept();
      loadMgrInboxes();
      await loadMetrics();
      state = 'live';
    } catch (e) {
      state = /401|403|auth/.test(e.message) ? 'auth' : 'error';
    } finally { busy = false; paint(); }
  }

  // ---------- що показувати ----------
  // акаунти VIP-менеджерів («VIP manager», «VIP manager REACTIVE») — не оператори, не показуємо і не рахуємо
  const NOT_OPERATOR = /\bmanager\b|менеджер/i;
  const isOperator = (id) => { const a = agents.get(id); return !a || !NOT_OPERATOR.test(a.name || ''); };
  // порядок: онлайн (зелені) → на перерві (жовті) → офлайн; усередині — у кого більше чатів, вище
  const ST_ORDER = { online: 0, busy: 1, offline: 2 };
  const byStatus = (a, b) => ((ST_ORDER[a.status] ?? 1) - (ST_ORDER[b.status] ?? 1)) || (b.open - a.open) || a.name.localeCompare(b.name);
  function rows() {
    // вкладка «Менеджеры»: акаунти «VIP manager …» (по проєктах і Reactivation) — скільки в кого відкритих чатів
    if (filter === 'mgr') {
      const mids = new Set([...metrics.map((m) => m.id), ...agents.keys()].filter((id) => !isOperator(id) && agents.has(id)));
      return [...mids].map((id) => {
        const m = metrics.find((x) => x.id === id) || { open: 0, unattended: 0 };
        const a = agents.get(id);
        return { id, name: a.name, status: a.status, open: m.open, unattended: m.unattended, kind: 'mgr', proj: mgrProject(id), nick: mgrNick(id), email: a.email };
      }).sort(byStatus);
    }
    const ids = new Set([...metrics.map((m) => m.id)].filter(isOperator));
    // онлайн-оператори без чатів теж показуємо (з нулем)
    for (const [id, a] of agents) if ((a.status === 'online' || a.status === 'busy') && isOperator(id)) ids.add(id);
    return [...ids].map((id) => {
      const m = metrics.find((x) => x.id === id) || { open: 0, unattended: 0 };
      const a = agents.get(id) || { name: `#${id}`, status: '' };
      return { id, name: a.name, status: a.status, open: m.open, unattended: m.unattended, kind: kindOf(id) };
    })
      .filter((r) => !(r.open === 0 && r.status === 'offline'))
      .filter((r) => filter === 'all' || r.kind === filter)
      .sort(byStatus);
  }
  // колір: VIP — до 3 чатів зелений, 4+ червоний; AP — до 4 зелений, 5+ червоний
  const LIMIT = { vip: 3, ap: 4, mgr: 99 };   // у менеджерів без «червоного» порогу
  const lvl = (n, kind) => (n === 0 ? 'z' : n <= (LIMIT[kind] || 3) ? 'l' : 'h');

  // ---------- плашка ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .pill { display: inline-flex; flex-wrap: nowrap; align-items: center; gap: 5px; padding: 6px 7px; border-radius: 12px; overflow: hidden;
    background: rgba(26, 30, 38, .94); border: 1px solid rgba(255,255,255,.08); color: #ECEFF4;
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    font: 600 11.5px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    box-shadow: 0 6px 20px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04); cursor: pointer; user-select: none; white-space: nowrap; transition: border-color .15s; }
  .pill:hover { border-color: rgba(124,155,255,.45); }
  /* мітка групи: • VIP */
  .tag { display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 2px 7px 2px 6px; border-radius: 999px; background: rgba(255,255,255,.05);
    color: #AEB6C4; font-size: 10px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #F2B544; flex: none; }
  .live .dot { background: #5FD39D; box-shadow: 0 0 0 3px rgba(95,211,157,.15); } .err .dot { background: #EF6B63; }
  .lab { color: #9AA2B1; font-weight: 600; }
  /* оператор: ім'я + кружечок з кількістю */
  .c { display: inline-flex; flex: none; align-items: center; gap: 6px; padding: 2px 2px 2px 8px; border-radius: 999px;
    background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06); }
  .c.hot { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); }
  .cn { color: #D6DCE6; font-weight: 600; font-size: 11px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; }
  .n { display: inline-flex; min-width: 18px; height: 18px; padding: 0 5px; align-items: center; justify-content: center; border-radius: 999px;
    font-weight: 800; font-variant-numeric: tabular-nums; font-size: 10.5px; }
  .z { color: #9AA2B1; background: rgba(148,163,184,.14); }
  .l { color: #0F2A1E; background: #5FD39D; }
  .m { color: #2B1E05; background: #F2B544; }
  .h { color: #2A0B0B; background: #F87171; }
  .more { flex: none; color: #9AA2B1; font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.05); }
  .pill.box { flex-wrap: wrap; align-content: center; }
  .pop { position: absolute; top: calc(100% + 8px); right: 0; width: 300px; max-height: 70vh; overflow: auto; padding: 10px;
    background: rgba(26, 30, 38, .97); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; color: #ECEFF4;
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
    box-shadow: 0 18px 50px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04);
    font: 12.5px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; cursor: default; }
  .pop[hidden] { display: none; }
  .ph { display: flex; align-items: baseline; justify-content: space-between; padding: 2px 4px 8px; }
  .ph b { font-size: 13px; font-weight: 700; } .ph span { color: #8E97A7; font-size: 11px; }
  .seg { display: flex; gap: 3px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 3px; margin-bottom: 8px; }
  .seg button { flex: 1; border: 0; background: none; color: #9AA2B1; border-radius: 7px; padding: 5px 6px; font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: background .15s, color .15s; }
  .seg button:hover { color: #ECEFF4; }
  .seg button.on { background: #3B82F6; color: #fff; box-shadow: 0 2px 8px rgba(59,130,246,.35); }
  .rows { display: flex; flex-direction: column; gap: 2px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 9px; border: 1px solid transparent; }
  .row:hover { background: rgba(255,255,255,.04); }
  .row.hot { background: rgba(239,68,68,.07); border-color: rgba(239,68,68,.22); }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #DDE3EC; }
  .st { width: 7px; height: 7px; border-radius: 50%; flex: none; background: #4A5263; }
  .st.online { background: #5FD39D; box-shadow: 0 0 0 3px rgba(95,211,157,.12); } .st.busy { background: #F2B544; }
  .k { border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); color: #8E97A7; border-radius: 999px; font: 750 9.5px/1 system-ui, sans-serif;
    letter-spacing: .05em; padding: 4px 7px; cursor: pointer; }
  .k { cursor: default; }
  .k.vip { color: #F2B544; border-color: rgba(242,181,68,.35); background: rgba(242,181,68,.1); }
  .k.mgr { color: #B9A4FF; border-color: rgba(185,164,255,.35); background: rgba(185,164,255,.1); }
  .k.man { box-shadow: 0 0 0 2px rgba(124,155,255,.45); }
  .un { color: #F28B82; font-size: 11px; font-weight: 650; }
  .foot { color: #7F8898; font-size: 10.5px; margin-top: 10px; padding: 8px 4px 0; border-top: 1px solid rgba(255,255,255,.06); line-height: 1.4; }
  .empty { color: #9AA2B1; padding: 12px 4px; text-align: center; }
</style>
<div class="wrap" style="position:relative">
  <div class="pill" title="Нагрузка операторов — нажми, чтобы открыть список"></div>
  <div class="pop" hidden></div>
</div>`;
  const pill = root.querySelector('.pill'), pop = root.querySelector('.pop');
  const FL = { all: 'Все', vip: 'VIP', ap: 'AP', mgr: 'Менеджеры' };

  // ділимось розкладом VIP/AP з іншими скриптами (автопривітання бере його для повідомлення про нагрузку)
  function shareKinds() {
    try {
      const vip = [], ap = [];
      for (const id of new Set([...agents.keys(), ...metrics.map((m) => m.id)])) if (isOperator(id)) (kindOf(id) === 'vip' ? vip : ap).push(id);
      localStorage.setItem('olKinds', JSON.stringify({ at: Date.now(), vip, ap }));
    } catch (e) {}
  }
  function paint() {
    shareKinds();
    const list = rows();
    pill.className = `pill ${state === 'live' ? 'live' : state === 'loading' ? '' : 'err'}`;
    // нік — перше слово імені, щоб влізло
    const short = (n) => String(n || '').split(/\s+/)[0] || n;
    const nums = list.slice(0, PILL_MAX).map((r) => { const lv = lvl(r.open, r.kind); return `<span class="c${lv === 'h' ? ' hot' : ''}" title="${esc(r.name)}${r.proj ? ` · ${esc(r.proj)}` : ''}: ${r.open}"><span class="cn">${esc(r.kind === 'mgr' ? (projTitle(r.proj) || '?') : short(r.name))}</span><span class="n ${lv}">${r.open}</span></span>`; }).join('');
    pill.innerHTML = `<span class="tag"><span class="dot"></span>${FL[filter]}</span>${state === 'auth' ? '<span class="lab">нет доступа</span>' : nums || '<span class="lab">—</span>'}${list.length > PILL_MAX ? `<span class="more">+${list.length - PILL_MAX}</span>` : ''}`;
    if (!pop.hidden) paintPop(list);
    place();
    fit(list.length);
  }
  function paintPop(list = rows()) {
    const total = list.reduce((a, r) => a + r.open, 0);
    pop.innerHTML = `<div class="ph"><b>${filter === 'mgr' ? 'Нагрузка менеджеров' : 'Нагрузка операторов'}</b><span>${list.length} ${filter === 'mgr' ? 'менедж.' : 'оп.'} · ${total} чатов</span></div>`
      + `<div class="seg">${Object.entries(FL).map(([k, v]) => `<button type="button" data-f="${k}" class="${filter === k ? 'on' : ''}">${v}</button>`).join('')}</div>`
      + (list.length ? '<div class="rows">' + list.map((r) => `<div class="row${lvl(r.open, r.kind) === 'h' ? ' hot' : ''}" title="${esc(r.name)}\nОткрыто: ${r.open}\nБез ответа: ${r.unattended}">
          <span class="st ${esc(r.status)}"></span><span class="nm"${r.kind === 'mgr' ? ` data-mp="${r.id}" style="cursor:pointer" title="${esc(r.nick || '')}${r.email ? ` · ${esc(r.email)}` : ''}\nКлик — указать проект"` : ''}>${r.kind === 'mgr' ? `Manager ${esc(projTitle(r.proj) || '?')}` : esc(r.name)}</span>
          ${r.unattended ? `<span class="un" title="Без ответа">⏳${r.unattended}</span>` : ''}
          ${r.kind === 'mgr' ? '' : `<span class="k ${r.kind}">${r.kind.toUpperCase()}</span>`}
          <span class="n ${lvl(r.open, r.kind)}">${r.open}</span></div>`).join('') + '</div>'
        : `<div class="empty">${state === 'auth' ? 'Нет доступа к отчётам Chatwoot' : 'Никого нет'}</div>`);
  }
  pill.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    if (!pop.hidden) paintPop();
  });
  pop.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { filter = f.dataset.f; GM_setValue('olFilter', filter); paint(); paintPop(); return; }
    // менеджер: вказати проєкт вручну (CAT, GAMA, KOMETA, DADDY, KENT, R7, ARKADA, MERS, REACTIVE)
    const mp = e.target.closest('[data-mp]');
    if (mp) {
      const id = mp.dataset.mp;
      const map = GM_getValue('olMgrProj', {}) || {};
      const v = prompt('Проект этого менеджера (напр. CAT, GAMA, DADDY, REACTIVE). Пусто — определить автоматически:', map[id] || mgrProject(Number(id)) || '');
      if (v === null) return;
      if (v.trim()) map[id] = v.trim().toUpperCase(); else delete map[id];
      GM_setValue('olMgrProj', map);
      paint(); paintPop();
    }
  });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !e.composedPath().includes(host)) pop.hidden = true; });

  // ---------- місце: праворуч від аватарки клієнта в панелі «Контакт», рівно по ній ----------
  // при скролі панелі плашка тримається під шапкою «Контакт»
  const DEF_RIGHT = 64, DEF_TOP = 44;
  let anchor = { av: null, hd: null, at: 0 };
  function findAnchor() {
    let hd = null;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!/^(Контакт|Contact)$/.test(n.nodeValue.trim())) continue;
      const r = n.parentElement.getBoundingClientRect();
      if (r.width && r.left > window.innerWidth * 0.5 && r.top < 120) { hd = n.parentElement; break; }
    }
    if (!hd) return { av: null, hd: null };
    const hr = hd.getBoundingClientRect();
    const square = (el) => { const r = el.getBoundingClientRect(); return r.width >= 28 && r.width <= 120 && Math.abs(r.width - r.height) <= 6 && r.left >= hr.left - 30 && r.left < hr.left + 60 && r.top > hr.bottom - 4 && r.top < hr.bottom + 220; };
    // аватарка: картинка або квадрат з ініціалами («ХГ»)
    let av = [...document.querySelectorAll('img, [role="img"]')].find((el) => el.getBoundingClientRect().width && square(el)) || null;
    if (!av) {
      const t = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = t.nextNode(); n && !av; n = t.nextNode()) {
        if (!/^[A-ZА-ЯЁІЇЄҐ]{1,2}$/.test(n.nodeValue.trim())) continue;
        for (let p = n.parentElement, k = 0; p && k < 4; p = p.parentElement, k++) if (square(p)) { av = p; break; }
      }
    }
    return { av, hd };
  }
  function place() {
    if (!anchor.av || !anchor.av.isConnected || Date.now() - anchor.at > 2000) { const keep = anchor.blk; anchor = { ...findAnchor(), at: Date.now() }; if (keep && anchor.av && keep.contains(anchor.av)) anchor.blk = keep; }
    pop.style.right = '0'; pop.style.left = 'auto';
    const { av, hd } = anchor;
    if (!av || !hd) {
      // аватарки не видно (панель контакту закрита) — справа зверху під часом, в один рядок
      if (host.parentElement !== document.body) document.body.appendChild(host);
      host.style.position = 'fixed'; host.style.zIndex = '2147483000';
      host.style.left = ''; host.style.right = `${DEF_RIGHT}px`; host.style.top = `${DEF_TOP}px`;
      pill.style.maxWidth = '300px'; pill.style.maxHeight = ''; pill.classList.remove('box');
      return;
    }
    const ar = av.getBoundingClientRect(), hr = hd.getBoundingClientRect();
    const left = ar.right + 12, width = Math.max(140, window.innerWidth - left - 16);
    pill.classList.add('box');
    pill.style.maxWidth = `${width}px`; pill.style.maxHeight = '68px';   // до 2 рядків операторів
    const ph = pill.offsetHeight || 26;
    // плашка вища за аватарку — відсуваємо все, що нижче (ім'я клієнта, пошту…), щоб нічого не налазило
    const extra = Math.max(0, Math.round(ph - ar.height + 6));
    const want = extra ? `${extra}px` : '';
    // відступ ставимо блоку з аватаркою (не самій картинці), щоб зсунулось ім'я клієнта під ним
    if (!anchor.blk || !anchor.blk.isConnected || !anchor.blk.contains(av)) {
      let blk = av;
      while (blk.parentElement && !blk.nextElementSibling && Math.abs(blk.parentElement.getBoundingClientRect().height - blk.getBoundingClientRect().height) < 14) blk = blk.parentElement;
      anchor.blk = blk;
    }
    if (anchor.blk.style.marginBottom !== want) anchor.blk.style.marginBottom = want;
    const top = ph > ar.height ? ar.top : ar.top + (ar.height - ph) / 2;   // поруч з аватаркою
    // всередині прокрутної панелі контакту — прокручується разом з аватаркою, рівно
    let box = null;
    for (let p = av.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.getBoundingClientRect().height > 120) { box = p; break; }
    }
    if (box) {
      const br = box.getBoundingClientRect();
      if (host.parentElement !== box) box.appendChild(host);
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      host.style.position = 'absolute'; host.style.zIndex = '20';
      host.style.right = ''; host.style.left = `${left - br.left + box.scrollLeft}px`; host.style.top = `${top - br.top + box.scrollTop}px`;
    } else {
      if (host.parentElement !== document.body) document.body.appendChild(host);
      host.style.position = 'fixed'; host.style.zIndex = '2147483000';
      host.style.right = ''; host.style.left = `${left}px`; host.style.top = `${Math.max(hr.bottom + 8, top)}px`;
    }
  }
  function fit(total) {
    const chips = [...pill.querySelectorAll('.c')];
    const mw = parseFloat(pill.style.maxWidth) || 300, mh = parseFloat(pill.style.maxHeight) || 0;
    let more = pill.querySelector('.more');
    const over = () => pill.scrollWidth > mw + 1 || (mh && pill.scrollHeight > mh + 1);
    while (over() && chips.length > 1) {
      chips.pop().remove();
      if (!more) { more = document.createElement('span'); more.className = 'more'; pill.appendChild(more); }
      more.textContent = `+${total - chips.length}`;
    }
    place();   // висота могла змінитись — ще раз по центру аватарки
  }
  let rafPos = 0;
  const repos = () => { if (rafPos) return; rafPos = requestAnimationFrame(() => { rafPos = 0; place(); }); };
  window.addEventListener('scroll', () => { if (host.style.position !== 'absolute') repos(); }, true);
  window.addEventListener('resize', () => { anchor.at = 0; repos(); });
  GM_registerMenuCommand('Нагрузка: пересчитать VIP / AP', () => { auto.at = 0; dept.at = 0; seenVip.at = 0; loadTeams(); loadDept(); loadSeen(); });

  document.body.appendChild(host);
  paint();
  update();
  setInterval(update, REFRESH_MS);
})();
