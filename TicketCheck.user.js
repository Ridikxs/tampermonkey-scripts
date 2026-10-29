// ==UserScript==
// @name         Тикеты клиента (plevantis)
// @namespace    billy.ticket-check
// @version      1.1
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TicketCheck.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TicketCheck.user.js
// @description  Показывает тикеты клиента из чата Сhatwoot
// @match        https://sparkmoth.com/app/*
// @connect      plevantis.net
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ===== НАЛАШТУВАННЯ =====
  const API = 'https://plevantis.net/api/helpdesk/tickets';
  const TICKETS_PAGE = 'https://plevantis.net/support/tickets';
  const AUTO_CHECK = true;          // сама перевіряти, коли відкриваєш чат (цифра на кнопці)
  const CACHE_SECONDS = 60;         // скільки секунд не перепитувати ту саму пошту
  const DONE_STATUSES = ['solved', 'closed', 'spam', 'archive', 'archived', 'trash', 'deleted'];
  // =========================

  const I18N = {
    uk: {
      btn: 'Тікети', checking: 'перевіряю…', inWork: 'в роботі', allDone: 'всі закриті', none: 'немає', err: 'помилка',
      title: 'Тікети клієнта', search: 'Знайти', refresh: 'Оновити', close: 'Закрити',
      loading: 'Шукаю тікети…',
      sumActive: (n) => `В роботі: ${n}`, sumActiveSub: (m) => m ? `І ще закритих: ${m}` : 'Закритих немає',
      sumDone: 'Зараз нічого в роботі', sumDoneSub: (n, a) => `Усі ${n} тікетів закриті, останній оновлено ${a}`,
      sumNone: 'По клієнту тікетів немає', sumNoneSub: 'Пошук по всіх статусах нічого не знайшов',
      partial: (n, t) => `Показано ${n} з ${t}`,
      urgent: 'срочно', noSubject: '(без теми)', client: 'Клієнт', privateNote: 'нотатка',
      history: 'Останні повідомлення', copyOpen: 'Скопіювати #ID і відкрити plevantis', copied: 'Скопійовано',
      errAuth: 'Plevantis не пустив. Відкрий plevantis.net у сусідній вкладці і перевір, що ти залогінений.',
      errNet: 'Не вдалося достукатись до plevantis. Перевір інтернет або VPN і натисни «Оновити».',
      errParse: 'Plevantis відповів чимось незрозумілим. Найчастіше це означає, що сесія закінчилась: залогінься заново.',
      errHttp: (c) => `Plevantis повернув помилку ${c}. Спробуй «Оновити» трохи пізніше.`,
      emailPh: 'пошта клієнта', justNow: 'щойно', minAgo: 'хв тому', hAgo: 'год тому', dAgo: 'дн. тому',
      menu: 'Перевірити тікети вручну',
      back: '← Назад', open: 'Відкрити', onlyMsg: 'Тільки повідомлення',
      fTeam: 'Група', fAgent: 'Веде', fCreated: 'Створено', fUpdated: 'Остання активність', fNobody: 'нікому',
      evStatus: 'Статус', evAssign: 'Призначено', evFields: 'Поля', evFiles: 'Файли', image: 'зображення', system: 'Система',
      cPublic: 'Публічна відповідь', cPrivate: '🔒 Приватна нотатка',
      cPhPublic: 'Відповідь клієнту (прийде йому на пошту)…', cPhPrivate: 'Приватна нотатка для команди (клієнт не побачить)…',
      cSendPublic: 'Надіслати відповідь', cSendPrivate: 'Додати нотатку', cSending: 'Надсилаю…',
      cConfirm: 'Надіслати цю відповідь КЛІЄНТУ на пошту?', cOk: '✓ Надіслано', cErr: (m) => `Не надіслалось: ${m}`,
      cHint: 'Cmd/Ctrl+Enter — надіслати', cStatus: 'статус:', cKeep: 'не міняти',
      cStNo: (st) => `Надіслано, але статус не змінився (лишився ${st}). Скинь мені запит зміни статусу з plevantis (Network).`,
    },
    ru: {
      btn: 'Тикеты', checking: 'проверяю…', inWork: 'в работе', allDone: 'все закрыты', none: 'нет', err: 'ошибка',
      title: 'Тикеты клиента', search: 'Найти', refresh: 'Обновить', close: 'Закрыть',
      loading: 'Ищу тикеты…',
      sumActive: (n) => `В работе: ${n}`, sumActiveSub: (m) => m ? `И ещё закрытых: ${m}` : 'Закрытых нет',
      sumDone: 'Сейчас ничего в работе', sumDoneSub: (n, a) => `Все ${n} тикетов закрыты, последний обновлён ${a}`,
      sumNone: 'По клиенту тикетов нет', sumNoneSub: 'Поиск по всем статусам ничего не нашёл',
      partial: (n, t) => `Показано ${n} из ${t}`,
      urgent: 'срочно', noSubject: '(без темы)', client: 'Клиент', privateNote: 'заметка',
      history: 'Последние сообщения', copyOpen: 'Скопировать #ID и открыть plevantis', copied: 'Скопировано',
      errAuth: 'Plevantis не пустил. Открой plevantis.net в соседней вкладке и проверь, что ты залогинен.',
      errNet: 'Не удалось достучаться до plevantis. Проверь интернет или VPN и нажми «Обновить».',
      errParse: 'Plevantis ответил чем-то непонятным. Чаще всего это значит, что сессия закончилась: залогинься заново.',
      errHttp: (c) => `Plevantis вернул ошибку ${c}. Попробуй «Обновить» чуть позже.`,
      emailPh: 'почта клиента', justNow: 'только что', minAgo: 'мин назад', hAgo: 'ч назад', dAgo: 'дн. назад',
      menu: 'Проверить тикеты вручную',
      back: '← Назад', open: 'Открыть', onlyMsg: 'Только сообщения',
      fTeam: 'Группа', fAgent: 'Ведёт', fCreated: 'Создан', fUpdated: 'Последняя активность', fNobody: 'никому',
      evStatus: 'Статус', evAssign: 'Назначено', evFields: 'Поля', evFiles: 'Файлы', image: 'изображение', system: 'Система',
      cPublic: 'Публичный ответ', cPrivate: '🔒 Приватная заметка',
      cPhPublic: 'Ответ клиенту (придёт ему на почту)…', cPhPrivate: 'Приватная заметка для команды (клиент не увидит)…',
      cSendPublic: 'Отправить ответ', cSendPrivate: 'Добавить заметку', cSending: 'Отправляю…',
      cConfirm: 'Отправить этот ответ КЛИЕНТУ на почту?', cOk: '✓ Отправлено', cErr: (m) => `Не отправилось: ${m}`,
      cHint: 'Cmd/Ctrl+Enter — отправить', cStatus: 'статус:', cKeep: 'не менять',
      cStNo: (st) => `Отправлено, но статус не поменялся (остался ${st}). Скинь мне запрос смены статуса из plevantis (Network).`,
    },
  };
  let lang = GM_getValue('tcLang', 'ru');
  if (!I18N[lang]) lang = 'uk';
  const T = () => I18N[lang];

  const KYIV_TZ = (() => {
    try { new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kyiv' }); return 'Europe/Kyiv'; }
    catch (e) { return 'Europe/Kiev'; }
  })();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isActive = (t) => !DONE_STATUSES.includes(String(t.status || '').toLowerCase()) && !(t.spam && t.spam.status);
  const lastTime = (t) => t.lastMessageAt || t.updatedAt || t.createdAt;

  function ago(iso) {
    const L = T(), m = (Date.now() - Date.parse(iso)) / 60000;
    if (!isFinite(m)) return '';
    if (m < 1) return L.justNow;
    if (m < 60) return `${Math.floor(m)} ${L.minAgo}`;
    if (m < 1440) return `${Math.floor(m / 60)} ${L.hAgo}`;
    return `${Math.floor(m / 1440)} ${L.dAgo}`;
  }
  const fmtDate = (iso) => new Date(iso).toLocaleString(lang === 'ru' ? 'ru-RU' : 'uk-UA', {
    timeZone: KYIV_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  // ---------- запит у plevantis ----------
  const cache = new Map();
  const inflight = new Map();
  // кеш зберігаємо між перезавантаженнями — щоб значок показувався одразу
  const PKEY = 'tcCache';
  try {
    const saved = GM_getValue(PKEY, {});
    for (const [k, v] of Object.entries(saved)) if (Date.now() - v.time < 86400000) cache.set(k, v);
  } catch (e) {}
  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const arr = [...cache.entries()].sort((a, b) => b[1].time - a[1].time).slice(0, 150)
        // у сховище кладемо коротку версію: без повної історії подій (вона велика)
        .map(([k, v]) => [k, { time: v.time, res: { ...v.res, tickets: (v.res.tickets || []).map((t) => ({ ...t, events: (t.events || []).slice(-3) })) } }]);
      GM_setValue(PKEY, Object.fromEntries(arr));
    }, 1500);
  }

  function fetchTickets(email, force) {
    const c = cache.get(email);
    if (!force && c && c.full && Date.now() - c.time < CACHE_SECONDS * 1000) return Promise.resolve(c.res);
    if (inflight.has(email)) return inflight.get(email);
    const p = new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${API}?query=${encodeURIComponent(email)}&sortBy=lastMessageAt&order=desc`,
        headers: { Accept: 'application/json' },
        timeout: 20000,
        onload: (r) => {
          let res;
          if (r.status === 401 || r.status === 403) res = { error: 'auth' };
          else if (r.status < 200 || r.status >= 300) res = { error: 'http', code: r.status };
          else {
            try {
              const j = JSON.parse(r.responseText);
              if (j.ok === false) res = { error: 'auth' };
              else {
                const list = Array.isArray(j.data) ? j.data : [];
                res = { tickets: list, total: j.total ?? list.length, hasNext: !!j.hasNext };
              }
            } catch (e) { res = { error: 'parse' }; }
          }
          if (!res.error) { cache.set(email, { time: Date.now(), res, full: true }); persist(); }
          resolve(res);
        },
        onerror: () => resolve({ error: 'net' }),
        ontimeout: () => resolve({ error: 'net' }),
      });
    }).finally(() => inflight.delete(email));
    inflight.set(email, p);
    return p;
  }

  // ---------- відповідь / приватна нотатка в тікет ----------
  // POST /api/helpdesk/tickets/<ID>/reply  {text, isPrivate} → {ok, data: оновлений тікет}
  function sendReply(ticketId, text, isPrivate, status) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${API}/${encodeURIComponent(ticketId)}/reply`,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        data: JSON.stringify(status ? { text, isPrivate, status } : { text, isPrivate }),
        timeout: 20000,
        onload: (r) => {
          if (r.status === 401 || r.status === 403) { resolve({ error: T().errAuth }); return; }
          let j = null;
          try { j = JSON.parse(r.responseText); } catch (e) {}
          if (r.status < 200 || r.status >= 300 || !j || j.ok === false) {
            resolve({ error: (j && (j.error || j.message)) ? String(j.error.message || j.error || j.message) : `HTTP ${r.status}`, retry: r.status >= 500 });
            return;
          }
          resolve({ ticket: j.data || null });
        },
        onerror: () => resolve({ error: T().errNet, retry: true }),
        ontimeout: () => resolve({ error: T().errNet, retry: true }),
      });
    });
  }
  function getTicket(ticketId) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', url: `${API}/${encodeURIComponent(ticketId)}`, headers: { Accept: 'application/json' }, timeout: 15000,
        onload: (r) => { try { const j = JSON.parse(r.responseText); resolve(j && j.ok !== false ? j.data || null : null); } catch (e) { resolve(null); } },
        onerror: () => resolve(null), ontimeout: () => resolve(null),
      });
    });
  }
  // чи заметка вже є в тікеті (сервер міг зберегти її, але відповісти помилкою)
  function replyLanded(tk, text, isPrivate, since) {
    if (!tk) return false;
    return (tk.events || []).some((e) => e.type === 'message' && e.message && e.author && e.author.type === 'agent'
      && String(e.message.text || '').trim() === text && !!e.message.isPrivate === isPrivate && Date.parse(e.date) >= since - 60000);
  }
  // надіслати з одним автоматичним повтором, якщо plevantis глюкнув (HTTP 5xx / мережа)
  async function sendReplySafe(ticketId, text, isPrivate, status) {
    const since = Date.now();
    let res = await sendReply(ticketId, text, isPrivate, status);
    if (!res.error || !res.retry) return res;
    await new Promise((ok) => setTimeout(ok, 1500));
    const tk = await getTicket(ticketId);
    if (replyLanded(tk, text, isPrivate, since)) {
      // заметка вже збереглась — повторно не шлемо (щоб не було дубля); якщо статус не змінився, це покаже перевірка нижче
      return { ticket: tk };
    }
    res = await sendReply(ticketId, text, isPrivate, status);
    return res;
  }

  // ---------- кнопка біля пошти ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.tcBtn = '1';
  const BTN_BASE = 'position:fixed;z-index:2147482000;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font:600 12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;'
    + 'padding:1px 9px;border-radius:999px;cursor:pointer;white-space:nowrap;vertical-align:middle;border:1px solid;';
  const BTN_COLORS = {
    idle: 'background:#272C37;color:#C9D1E0;border-color:#3A4152;',
    loading: 'background:#272C37;color:#9AA2B1;border-color:#3A4152;',
    active: 'background:#4A3917;color:#F2B544;border-color:#7A5A1C;',
    done: 'background:#1E4636;color:#5FD39D;border-color:#2C6B50;',
    none: 'background:#272C37;color:#9AA2B1;border-color:#3A4152;',
    error: 'background:#482523;color:#EF6B63;border-color:#6E3431;',
  };
  let badge = { kind: 'idle' };

  let compact = false;   // вузька панель контакту — коротший напис, щоб влізло в рядок
  function paintBtn() {
    const L = T();
    const text = compact ? {
      idle: '🎫', loading: '🎫 …', active: `🎫 ${badge.n}`, done: `🎫 ✓${badge.total}`, none: '🎫 0', error: '🎫 !',
    }[badge.kind] : {
      idle: `🎫 ${L.btn}`,
      loading: `🎫 ${L.checking}`,
      active: `🎫 ${L.inWork}: ${badge.n}`,
      done: `🎫 ${badge.total}, ${L.allDone}`,
      none: `🎫 ${L.none}`,
      error: `🎫 ${L.err}`,
    }[badge.kind];
    btn.title = compact ? {
      idle: L.btn, loading: L.checking, active: `${L.inWork}: ${badge.n}`, done: `${badge.total}, ${L.allDone}`, none: L.none, error: L.err,
    }[badge.kind] : '';
    if (btn.textContent !== text) btn.textContent = text;
    btn.style.cssText = BTN_BASE + BTN_COLORS[badge.kind];
    placeBtn();
  }
  // кнопка не вставляється в розмітку Chatwoot (там у різних людей різна верстка — то переноситься, то налазить),
  // а «плаває» поверх сторінки: рівно праворуч від рядка з поштою (після іконок копіювання/редагування)
  let rowEl = null, placing = false, fullW = 170;
  let mailEl = null;   // сам текст пошти — за ним рахуємо висоту рядка (надійніше, ніж за обгортками)
  function rowOf(el) {
    let cur = el, best = el;
    for (let k = 0; k < 6 && cur.parentElement; k++) {
      const p = cur.parentElement, r = p.getBoundingClientRect();
      if (!r.width || !r.height) { cur = p; continue; }   // обгортки без розміру (display: contents) — пропускаємо
      if (r.height > 48 || r.width > window.innerWidth * 0.45) break;   // вище/ширше — вже не рядок з поштою
      cur = p; best = p;
    }
    return best;
  }
  function scrollBox(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll') return p;
    }
    return null;
  }
  // ряд квадратних кнопок-дій під даними контакту (повідомлення, надіслати, редагувати, об'єднати)
  let actEl = null, actAt = 0;
  function findActionBtn() {
    if (actEl && actEl.isConnected && Date.now() - actAt < 3000) return actEl;
    actAt = Date.now(); actEl = null;
    // ряд шукаємо в панелі «Контакт» незалежно від того, де пошта (буває лише внизу, в атрибуті _email)
    let panelLeft = window.innerWidth * 0.5;
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!/^(Контакт|Contact)$/.test(n.nodeValue.trim())) continue;
      const r = n.parentElement.getBoundingClientRect();
      if (r.width && r.left > window.innerWidth * 0.4 && r.top < 140) { panelLeft = r.left - 30; break; }
    }
    const mr = { bottom: -1e9 };
    // кнопки можуть бути не <button>, а div/a з іконкою — шукаємо від іконок (svg) вгору до квадратної «коробки»
    const seen = new Set(), cands = [];
    // іконки в Chatwoot бувають і svg, і CSS-іконками (span class="i-lucide-…")
    document.querySelectorAll('svg, [class*="i-lucide"], [class*="i-ph-"], [class*="i-ri-"], [class*="i-woot"], i').forEach((svg) => {
      const sr = svg.getBoundingClientRect();
      if (!sr.width || sr.left < panelLeft) return;
      for (let e = svg.parentElement, k = 0; e && k < 4; e = e.parentElement, k++) {
        if (e === btn || btn.contains(e)) return;
        const r = e.getBoundingClientRect();
        if (r.width >= 22 && r.width <= 64 && Math.abs(r.width - r.height) <= 8 && r.width > sr.width + 6) {
          if (!seen.has(e)) { seen.add(e); cands.push(e); }
          return;
        }
      }
    });
    // групуємо за рядком: беремо перший рядок під поштою, де 3+ однакові кнопки
    document.querySelectorAll('button').forEach((b) => {
      if (b === btn || seen.has(b)) return;
      const r = b.getBoundingClientRect();
      if (r.left > panelLeft
        && r.width >= 22 && r.width <= 64 && Math.abs(r.width - r.height) <= 8 && !(b.textContent || '').trim()) { seen.add(b); cands.push(b); }
    });
    // групуємо в рядки (верх відрізняється не більше ніж на 6px)
    const groups = [];
    cands.sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top).forEach((el) => {
      const t = el.getBoundingClientRect().top, g = groups[groups.length - 1];
      if (g && Math.abs(g.top - t) <= 6) g.items.push(el); else groups.push({ top: t, items: [el] });
    });
    const tight = (g) => {
      const xs = g.items.map((e) => e.getBoundingClientRect()).sort((a, b) => a.left - b.left);
      let run = 1, best = 1;
      for (let i = 1; i < xs.length; i++) { if (xs[i].left - xs[i - 1].right < 24) { run++; best = Math.max(best, run); } else run = 1; }
      return best >= 3;
    };
    const row = (groups.find((g) => g.items.length >= 3 && tight(g)) || {}).items;
    if (!row) return null;
    actEl = row.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[row.length - 1];
    return actEl;
  }
  function placeBtn() {
    if (!rowEl || !rowEl.isConnected || !mailEl || !mailEl.isConnected) { btn.style.display = 'none'; return; }
    // є ряд кнопок-дій — ставимо плашку в нього, праворуч від останньої кнопки, такої ж висоти, завжди з повним написом
    const ab = findActionBtn();
    if (ab) {
      const ar = ab.getBoundingClientRect();
      let box = scrollBox(ab), vr = box ? box.getBoundingClientRect() : null;
      if (box && vr.height < 120) box = null;
      if (compact) { compact = false; paintBtn(); }
      btn.style.display = 'inline-flex';
      btn.style.height = `${ar.height}px`; btn.style.borderRadius = getComputedStyle(ab).borderRadius || '10px';
      btn.style.padding = '0 14px'; btn.style.fontSize = '12.5px';
      if (box) {
        if (btn.parentElement !== box) box.appendChild(btn);
        if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
        btn.style.position = 'absolute'; btn.style.zIndex = '5';
        btn.style.left = `${ar.right + 10 - vr.left + box.scrollLeft}px`;
        btn.style.top = `${ar.top - vr.top + box.scrollTop}px`;
        inBox = true;
      } else {
        if (btn.parentElement !== document.body) document.body.appendChild(btn);
        btn.style.position = 'fixed';
        btn.style.left = `${ar.right + 10}px`; btn.style.top = `${ar.top}px`;
        inBox = false;
      }
      return;
    }
    const mr = mailEl.getBoundingClientRect(), r0 = rowEl.getBoundingClientRect();
    // рядок = по висоті як текст пошти, по ширині — як рядок
    const rr = { left: Math.min(r0.left || mr.left, mr.left), top: mr.top, bottom: mr.bottom, height: mr.height, width: Math.max(r0.width, mr.width) };
    let box = scrollBox(rowEl), vr = box ? box.getBoundingClientRect() : null;
    if (!vr || vr.height < 120) vr = { top: 0, bottom: window.innerHeight, right: window.innerWidth };
    if (!rr.width || !rr.height) { btn.style.display = 'none'; return; }
    // де закінчується вміст рядка (пошта + іконки)
    let right = rr.left;
    right = Math.max(right, mr.right);
    // край вмісту: текст пошти + маленькі іконки поруч (копіювати, редагувати), а не широкі обгортки на весь рядок
    // іконки біля пошти рахуємо ВСІ, і ті, що з'являються лише при наведенні (олівець), —
    // інакше при наведенні на пошту плашка перемикалась на короткий вигляд і «стрибала»
    rowEl.querySelectorAll('svg, button, img, i, [role="button"]').forEach((n) => {
      const q = n.getBoundingClientRect();
      if (q.width && q.height && q.width <= 44 && q.left >= mr.right - 2 && q.left < mr.right + 80 && q.top < rr.bottom && q.bottom > rr.top && q.right > right) right = q.right;
    });
    // завжди резервуємо місце під обидві іконки (копіювати + олівець), навіть якщо олівця зараз не видно
    right = Math.max(right, mr.right + 76);
    const limit = Math.min(vr.right || window.innerWidth, window.innerWidth) - 8;
    btn.style.display = 'inline-flex';
    let w = btn.offsetWidth;
    if (!placing) {
      placing = true;
      // спершу пробуємо повний напис; не влазить — короткий
      if (compact) { compact = false; paintBtn(); btn.style.display = 'inline-flex'; }
      if (right + 10 + btn.offsetWidth > limit) { compact = true; paintBtn(); }
      placing = false;
      btn.style.display = 'inline-flex'; w = btn.offsetWidth;
    }
    // завжди рівно по правому краю панелі (однаково в усіх чатах); якщо не влазить між поштою і краєм — короткий напис
    const left = Math.max(right + 10, limit - w);
    const top = rr.top + (rr.height - btn.offsetHeight) / 2;
    if (box && vr.height >= 120) {
      // всередині прокрутної панелі: координати відносно неї — далі прокрутка рухає плашку сама, плавно
      if (btn.parentElement !== box) box.appendChild(btn);
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      btn.style.position = 'absolute';
      btn.style.zIndex = '5';
      btn.style.left = `${left - vr.left + box.scrollLeft}px`;
      btn.style.top = `${top - vr.top + box.scrollTop}px`;
      inBox = true;
    } else {
      if (btn.parentElement !== document.body) document.body.appendChild(btn);
      btn.style.position = 'fixed';
      btn.style.left = `${left}px`;
      btn.style.top = `${top}px`;
      inBox = false;
    }
  }
  let inBox = false;
  // прокрутка: якщо плашка всередині панелі — нічого робити не треба (вона їде разом з поштою)
  window.addEventListener('scroll', () => { if (!inBox) requestAnimationFrame(placeBtn); }, true);
  window.addEventListener('resize', () => requestAnimationFrame(placeBtn));

  function badgeFrom(res) {
    if (res.error) return { kind: 'error' };
    const n = res.tickets.filter(isActive).length;
    if (n) return { kind: 'active', n };
    return res.total ? { kind: 'done', total: res.total } : { kind: 'none' };
  }

  async function autoCheck(email) {
    // є збережений результат — показуємо його одразу, свіжий підтягнеться за секунду-дві
    const old = cache.get(email);
    if (old) { badge = badgeFrom(old.res); paintBtn(); } else { badge = { kind: 'loading' }; paintBtn(); }
    const res = await fetchTickets(email);
    if (email !== currentEmail) return;
    badge = badgeFrom(res); paintBtn();
  }

  // ---------- заздалегідь: пошти клієнтів моїх відкритих чатів ----------
  function cwSession() {
    const m = document.cookie.match(/(?:^|;\s*)cw_d_session_info=([^;]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }
  async function prefetchMine() {
    const s = cwSession(), acc = (location.pathname.match(/\/accounts\/(\d+)/) || [])[1];
    if (!s || !acc || document.hidden) return;
    try {
      const r = await fetch(`/api/v1/accounts/${acc}/conversations?status=open&assignee_type=me&page=1`, {
        credentials: 'same-origin',
        headers: { 'access-token': s['access-token'], 'token-type': s['token-type'] || 'Bearer', client: s.client, expiry: s.expiry, uid: s.uid },
      });
      if (!r.ok) return;
      const j = await r.json();
      const emails = ((j && j.data && j.data.payload) || []).map((c) => {
        const snd = (c.meta && c.meta.sender) || {};
        return String(snd.email || (snd.custom_attributes || {})._email || '').trim().toLowerCase();
      }).filter((e) => EMAIL_RE.test(e));
      for (const e of [...new Set(emails)]) {
        const c = cache.get(e);
        if (c && c.full && Date.now() - c.time < 5 * 60000) continue;   // свіже — не чіпаємо
        await fetchTickets(e, true);
        await new Promise((ok) => setTimeout(ok, 800));                    // по одному, щоб не навантажувати plevantis
      }
    } catch (e) {}
  }
  setTimeout(prefetchMine, 3000);
  setInterval(prefetchMine, 120000);

  function findEmailEl() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let best = null, bestLeft = -1;
    const minLeft = window.innerWidth * 0.5;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const v = node.nodeValue;
      if (!v || v.length > 120 || v.indexOf('@') === -1) continue;
      const t = v.trim();
      if (!EMAIL_RE.test(t)) continue;
      const el = node.parentElement;
      if (!el || el === btn || el.closest('input,textarea,[contenteditable="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.left < minLeft) continue;
      if (r.left > bestLeft) { best = { el, email: t.toLowerCase() }; bestLeft = r.left; }
    }
    return best;
  }

  let currentEmail = null;
  function scan() {
    const found = findEmailEl();
    if (!found) {
      if (btn.isConnected) btn.remove();
      rowEl = null; mailEl = null;
      currentEmail = null;
      return;
    }
    if (!btn.isConnected) document.body.appendChild(btn);
    mailEl = found.el;
    rowEl = rowOf(found.el.closest('a') || found.el);
    placeBtn();
    if (found.email !== currentEmail) {
      currentEmail = found.email;
      if (AUTO_CHECK) autoCheck(currentEmail);
      else { badge = { kind: 'idle' }; paintBtn(); }
      if (!panel.hidden) load(currentEmail);
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!panel.hidden && shownEmail === currentEmail) { hidePanel(); return; }
    openPanel(currentEmail);
  });

  // ---------- панель ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483001;top:64px;right:16px;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host { all: initial; }
  .panel {
    --bg:#1F232C; --surface:#272C37; --ink:#ECEFF4; --muted:#9AA2B1; --line:#363C49;
    --act:#F2B544; --act-soft:#4A3917; --ok:#5FD39D; --ok-soft:#1E4636; --bad:#EF6B63; --bad-soft:#482523; --accent:#7C9BFF;
    width: 460px; max-height: calc(100vh - 90px); display: flex; flex-direction: column;
    background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 14px 44px rgba(0,0,0,.5);
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .panel[hidden] { display: none; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  button { font: inherit; cursor: pointer; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .head { padding: 12px 14px 10px; border-bottom: 1px solid var(--line); }
  .row1 { cursor: grab; user-select: none; }
  .row1.dragging { cursor: grabbing; }
  .row1 button { cursor: pointer; }
  .row1 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .title { font-weight: 650; font-size: 14px; }
  .tools { display: flex; align-items: center; gap: 6px; }
  .icon { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; width: 28px; height: 26px; }
  .lang { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
  .lang button { font-size: 11px; font-weight: 600; color: var(--muted); background: none; border: 0; padding: 2px 8px; border-radius: 6px; }
  .lang button.on { background: var(--accent); color: #fff; }
  form { display: flex; gap: 6px; }
  input { flex: 1; min-width: 0; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; font: inherit; }
  .go { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 0 14px; font-weight: 600; }

  .body { overflow-y: auto; padding: 12px 14px 14px; }
  .msg { color: var(--muted); padding: 18px 4px; text-align: center; }
  .error { background: var(--bad-soft); color: var(--bad); border-radius: 10px; padding: 10px 12px; }

  .sum { border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-weight: 650; font-size: 14px; }
  .sum small { display: block; font-weight: 400; font-size: 12px; color: var(--ink); opacity: .75; margin-top: 2px; }
  .sum.act { background: var(--act-soft); color: var(--act); }
  .sum.ok { background: var(--ok-soft); color: var(--ok); }
  .sum.none { background: var(--surface); color: var(--ink); }
  .partial { font-size: 11.5px; color: var(--muted); margin: -4px 0 8px; }

  .t { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; margin-bottom: 8px; cursor: pointer; }
  .t.act { border-left: 3px solid var(--act); }
  .t.done { opacity: .72; }
  .t.done:hover, .t.open { opacity: 1; }
  .top { display: flex; align-items: center; gap: 6px; }
  .id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--muted); }
  .spacer { flex: 1; }
  .when { font-size: 11.5px; color: var(--muted); }
  .chip { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
  .chip.st-act { background: var(--act-soft); color: var(--act); }
  .chip.st-done { background: var(--ok-soft); color: var(--ok); }
  .chip.urg { background: var(--bad-soft); color: var(--bad); }
  /* кольори статусів — як у plevantis */
  .chip.s-open    { background: #1E2A44; color: #6F9BFF; border: 1px solid #34508A; }
  .chip.s-pending { background: #4A3917; color: #F2B544; border: 1px solid #7A5A1C; }
  .chip.s-onhold  { background: #2E2245; color: #B48CFF; border: 1px solid #553B86; }
  .chip.s-solved  { background: #1E4636; color: #5FD39D; border: 1px solid #2C6B50; }
  .chip.s-closed  { background: #2A2F3A; color: #A3ABBA; border: 1px solid #454C5B; }
  .chip.s-other   { background: #2A2F3A; color: #C9D1E0; border: 1px solid #454C5B; }
  .subj { font-weight: 600; margin-top: 3px; }
  .meta { font-size: 12px; color: var(--muted); }
  .last { font-size: 12px; margin-top: 5px; color: var(--ink); opacity: .85; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .last b, .ev b { font-weight: 600; }

  .more { margin-top: 8px; border-top: 1px solid var(--line); padding-top: 8px; cursor: default; }
  .more[hidden] { display: none; }
  .h { font-size: 11.5px; color: var(--muted); margin-bottom: 6px; }
  .ev { font-size: 12px; margin-bottom: 8px; }
  .ev .evh { color: var(--muted); font-size: 11px; }
  .ev .txt { white-space: pre-wrap; word-break: break-word; max-height: 140px; overflow-y: auto; }
  .ev.priv .txt { border-left: 2px solid var(--line); padding-left: 7px; }
  .panel.wide { width: 600px; }
  .dhead { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .back { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-right: 4px; }
  .dsubj { font-size: 15px; font-weight: 650; margin-bottom: 8px; }
  .facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 11px; margin-bottom: 10px; }
  .facts dt { color: var(--muted); }
  .facts dd { word-break: break-word; }
  .onlymsg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-bottom: 10px; cursor: pointer; }
  .tl { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
  .bub { border-radius: 10px; padding: 8px 11px; font-size: 12.5px; border: 1px solid var(--line); }
  .bub .bh { font-size: 11px; color: var(--muted); margin-bottom: 3px; }
  .bub .bh b { color: var(--ink); font-weight: 600; }
  .bub .bt { white-space: pre-wrap; word-break: break-word; }
  .bub a { color: var(--accent); word-break: break-all; }
  .bub.client { background: #24324A; border-color: #34476A; margin-right: 40px; }
  .bub.agent { background: var(--surface); margin-left: 40px; }
  .bub.priv { background: #2E2A1E; border-color: #4A4128; border-style: dashed; margin-left: 40px; }
  .sys { font-size: 11.5px; color: var(--muted); text-align: center; padding: 0 10px; }
  .sys b { color: var(--ink); font-weight: 600; }
  .files { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
  .comp { border: 1px solid var(--line); border-radius: 10px; padding: 9px; margin-bottom: 10px; background: var(--surface); }
  .modes { display: flex; gap: 6px; margin-bottom: 7px; }
  .modes button { flex: 1; background: none; color: var(--muted); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; font-weight: 600; font-size: 12px; }
  .modes button.on.pub { color: #6F9BFF; border-color: #34508A; background: #1E2A44; }
  .modes button.on.priv { color: #F2B544; border-color: #7A5A1C; background: #4A3917; }
  .comp textarea { width: 100%; min-height: 84px; resize: vertical; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font: inherit; }
  .comp textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .crow { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
  .send { border: 0; border-radius: 8px; padding: 6px 12px; font-weight: 650; color: #fff; }
  .send.pub { background: #3B82F6; }
  .send.priv { background: #C2972F; color: #1F232C; }
  .send:disabled { opacity: .6; cursor: default; }
  .cst { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }
  .cst select { background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 5px 6px; font: inherit; }
  .crow { flex-wrap: wrap; }
  .cmsg { font-size: 11.5px; color: var(--muted); }
  .cmsg.ok { color: var(--ok); } .cmsg.bad { color: var(--bad); }
  .act-btn { margin-top: 2px; width: 100%; background: none; color: var(--accent); border: 1px solid var(--line); border-radius: 8px; padding: 6px; font-weight: 600; }
</style>
<div class="panel" hidden>
  <div class="head">
    <div class="row1">
      <span class="title"></span>
      <div class="tools">
        <div class="lang"><button data-lang="uk">UA</button><button data-lang="ru">RU</button></div>
        <button class="icon refresh">↻</button>
        <button class="icon closeb">✕</button>
      </div>
    </div>
    <form><input type="email" spellcheck="false"><button class="go" type="submit"></button></form>
  </div>
  <div class="body"></div>
</div>`;
  document.body.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const panel = $('.panel'), body = $('.body'), input = $('input');
  let shownEmail = null, lastRes = null, sorted = [], detailIdx = null;
  let onlyMsg = GM_getValue('tcOnlyMsg', false);
  const drafts = new Map();               // ID тікета -> текст чернетки
  let compPrivate = true, compBusy = false, compNote = null, compStatus = '';
  const STATUSES = [['open', 'Open'], ['pending', 'Pending'], ['onhold', 'On Hold'], ['solved', 'Solved'], ['closed', 'Closed']];   // compNote: {cls, text}

  function paintChrome() {
    const L = T();
    $('.title').textContent = L.title;
    $('.go').textContent = L.search;
    $('.refresh').title = L.refresh;
    $('.closeb').title = L.close;
    input.placeholder = L.emailPh;
    root.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  }

  function openPanel(email) {
    if (panel.hidden) resetPos();
    paintChrome();
    panel.hidden = false;
    input.value = email || '';
    if (email) load(email); else { body.innerHTML = ''; input.focus(); }
  }
  function hidePanel() { panel.hidden = true; }

  // ---------- перетягування за шапку (верхній рядок із заголовком) ----------
  // відкривається завжди на звичному місці; перетягнуте місце живе, поки віконце відкрите
  const DEF_POS = 'position:fixed;z-index:2147483001;top:64px;right:16px;';
  const resetPos = () => { host.style.cssText = DEF_POS; };
  function clampPos() {
    if (!host.style.left) return;   // ще не перетягували — стоїть на звичному місці
    const w = panel.offsetWidth, hgt = panel.offsetHeight;
    const x = Math.max(4, Math.min(window.innerWidth - w - 4, parseFloat(host.style.left)));
    const y = Math.max(4, Math.min(window.innerHeight - Math.min(hgt, 60) - 4, parseFloat(host.style.top)));
    host.style.left = `${x}px`; host.style.top = `${y}px`;
  }
  let drag = null;
  const row1 = $('.row1');
  row1.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = host.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    row1.setPointerCapture(e.pointerId); row1.classList.add('dragging');
    e.preventDefault();
  });
  row1.addEventListener('pointermove', (e) => {
    if (!drag) return;
    host.style.right = ''; host.style.left = `${e.clientX - drag.dx}px`; host.style.top = `${e.clientY - drag.dy}px`;
    clampPos();
  });
  const endDrag = () => { if (drag) { drag = null; row1.classList.remove('dragging'); } };
  row1.addEventListener('pointerup', endDrag);
  row1.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', clampPos);
  new ResizeObserver(clampPos).observe(panel);   // віконце розширюється, коли відкриваєш тікет — не даємо вилізти за екран

  async function load(email, force) {
    shownEmail = email; detailIdx = null; lastRes = null; panel.classList.remove('wide');
    input.value = email;
    body.innerHTML = `<div class="msg">${esc(T().loading)}</div>`;
    const res = await fetchTickets(email, force);
    if (email !== shownEmail) return;
    lastRes = res;
    if (email === currentEmail) { badge = badgeFrom(res); paintBtn(); }
    renderBody();
  }

  function renderBody() {
    const L = T(), res = lastRes;
    if (!res) return;
    if (res.error) {
      const m = { auth: L.errAuth, net: L.errNet, parse: L.errParse, http: L.errHttp(res.code), api: L.errAuth }[res.error];
      body.innerHTML = `<div class="error">${esc(m)}</div>`;
      return;
    }
    if (detailIdx !== null) { renderDetail(); return; }
    const list = sorted = res.tickets.slice().sort((a, b) => (isActive(b) - isActive(a)) || (Date.parse(lastTime(b)) - Date.parse(lastTime(a))));
    const act = list.filter(isActive).length;
    let html;
    if (act) html = `<div class="sum act">${esc(L.sumActive(act))}<small>${esc(L.sumActiveSub(res.total - act))}</small></div>`;
    else if (list.length) html = `<div class="sum ok">${esc(L.sumDone)}<small>${esc(L.sumDoneSub(res.total, ago(lastTime(list[0]))))}</small></div>`;
    else html = `<div class="sum none">${esc(L.sumNone)}<small>${esc(L.sumNoneSub)}</small></div>`;
    if (res.hasNext || res.total > list.length) html += `<div class="partial">${esc(L.partial(list.length, res.total))}</div>`;

    html += list.map((t, i) => {
      const active = isActive(t);
      const msgs = (t.events || []).filter((e) => e.type === 'message' && e.message && (e.message.text || '').trim());
      const last = msgs[msgs.length - 1];
      const team = t.assignment && t.assignment.team && t.assignment.team.name;
      const agent = t.assignment && t.assignment.agent && t.assignment.agent.name;
      return `
      <div class="t ${active ? 'act' : 'done'}" data-i="${i}" title="${esc(L.open)}">
        ${topLine(t)}
        <div class="subj">${esc((t.subject || '').trim() || L.noSubject)}</div>
        <div class="meta">${esc([team, agent].filter(Boolean).join(', '))}</div>
        ${last ? `<div class="last"><b>${esc(who(last))}:</b> ${esc(cleanText(last.message.text).replace(/\s+/g, ' ').slice(0, 220))}</div>` : ''}
      </div>`;
    }).join('');
    body.innerHTML = html;
  }

  const who = (e) => (e.author && (e.author.name || '').trim())
    || (e.author && e.author.type === 'client' ? (e.author.email || T().client) : '')
    || (e.author && e.author.type === 'rule' ? T().system : '');
  const cleanText = (s) => String(s || '').replace(/\[cid:[^\]]+\]/g, `🖼 ${T().image}`).trim();
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  const stClass = (st) => {
    const k = String(st || '').toLowerCase().replace(/[\s_-]/g, '');
    return ['open', 'pending', 'onhold', 'solved', 'closed'].includes(k) ? `s-${k}` : 's-other';
  };
  function topLine(t) {
    const L = T(), active = isActive(t);
    return `<div class="top">
      <span class="id">#${esc(t.shortID)}</span>
      ${Number(t.priority) >= 20 ? `<span class="chip urg">${esc(L.urgent)}</span>` : ''}
      <span class="chip ${stClass(t.status)}">${esc(String(t.status || '').replace(/_/g, ' '))}</span>
      <span class="spacer"></span>
      <span class="when">${esc(ago(lastTime(t)))}</span>
    </div>`;
  }

  function renderEvent(e) {
    const L = T(), by = who(e);
    const byTxt = by ? `, ${esc(by)}` : '';
    const when = esc(fmtDate(e.date));
    if (e.type === 'message' && e.message && (e.message.text || '').trim()) {
      const priv = e.message.isPrivate;
      const kind = e.author && e.author.type === 'client' ? 'client' : priv ? 'priv' : 'agent';
      return `<div class="bub ${kind}">
        <div class="bh"><b>${esc(by || L.client)}</b>, ${when}${priv ? ` (🔒 ${esc(L.privateNote)})` : ''}</div>
        <div class="bt">${linkify(cleanText(e.message.text))}</div></div>`;
    }
    if (onlyMsg) return '';
    if (e.type === 'attachments' && e.attachments && e.attachments.files && e.attachments.files.length) {
      const files = e.attachments.files.map((f) =>
        `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">📎 ${esc(f.name || 'file')}</a>`).join('');
      return `<div class="bub ${e.author && e.author.type === 'client' ? 'client' : 'agent'}">
        <div class="bh"><b>${esc(by || L.client)}</b>, ${when}</div><div class="files">${files}</div></div>`;
    }
    if (e.type === 'status' && e.status) {
      return `<div class="sys">${esc(L.evStatus)}: ${esc(e.status.old || '?')} → <b>${esc(e.status.new)}</b>${byTxt}, ${when}</div>`;
    }
    if (e.type === 'assignment' && e.assignment && e.assignment.new) {
      const n = e.assignment.new;
      const to = [n.team && n.team.name, n.agent && n.agent.name].filter(Boolean).join(', ') || L.fNobody;
      return `<div class="sys">${esc(L.evAssign)}: <b>${esc(to)}</b>${byTxt}, ${when}</div>`;
    }
    if (e.type === 'customFields' && e.customFields && e.customFields.new) {
      const o = e.customFields.old || {}, n = e.customFields.new;
      const changed = Object.keys(n).filter((k) => o[k] !== n[k]).map((k) => `${k} = ${n[k]}`);
      if (!changed.length) return '';
      return `<div class="sys">${esc(L.evFields)}: <b>${esc(changed.join(', '))}</b>${byTxt}, ${when}</div>`;
    }
    return '';
  }

  function renderDetail() {
    const L = T(), t = sorted[detailIdx];
    if (!t) { detailIdx = null; renderBody(); return; }
    const team = t.assignment && t.assignment.team && t.assignment.team.name;
    const agent = t.assignment && t.assignment.agent && t.assignment.agent.name;
    const facts = [
      [L.fTeam, team], [L.fAgent, agent],
      [L.fCreated, t.createdAt && fmtDate(t.createdAt)],
      [L.fUpdated, lastTime(t) && `${fmtDate(lastTime(t))} (${ago(lastTime(t))})`],
      ...Object.entries(t.customFields || {}).map(([k, v]) => [k, v]),
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');
    body.innerHTML = `
      <div class="dhead"><button class="back">${esc(L.back)}</button></div>
      ${topLine(t)}
      <div class="dsubj">${esc((t.subject || '').trim() || L.noSubject)}</div>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <label class="onlymsg"><input type="checkbox" class="om" ${onlyMsg ? 'checked' : ''}> ${esc(L.onlyMsg)}</label>
      <div class="tl">${(t.events || []).map(renderEvent).join('')}</div>
      ${composer(t)}
      <button class="act-btn" data-copy="${esc(t.shortID)}">${esc(L.copyOpen)}</button>`;
  }
  function composer(t) {
    const L = T(), k = compPrivate ? 'priv' : 'pub';
    return `<div class="comp">
      <div class="modes">
        <button type="button" class="mode pub ${compPrivate ? '' : 'on'}" data-mode="pub">${esc(L.cPublic)}</button>
        <button type="button" class="mode priv ${compPrivate ? 'on' : ''}" data-mode="priv">${esc(L.cPrivate)}</button>
      </div>
      <textarea class="ctext" placeholder="${esc(compPrivate ? L.cPhPrivate : L.cPhPublic)}" ${compBusy ? 'disabled' : ''}>${esc(drafts.get(t.ID) || '')}</textarea>
      <div class="crow">
        <button type="button" class="send ${k}" ${compBusy ? 'disabled' : ''}>${esc(compBusy ? L.cSending : compPrivate ? L.cSendPrivate : L.cSendPublic)}</button>
        <label class="cst">${esc(L.cStatus)}
          <select class="cstatus" ${compBusy ? 'disabled' : ''}>
            <option value="">${esc(L.cKeep)}</option>
            ${STATUSES.map(([v, n]) => `<option value="${v}" ${compStatus === v ? 'selected' : ''}>${n}${String(t.status || '').toLowerCase() === v ? ' •' : ''}</option>`).join('')}
          </select>
        </label>
        <span class="cmsg ${compNote ? compNote.cls : ''}">${esc(compNote ? compNote.text : L.cHint)}</span>
      </div>
    </div>`;
  }
  async function doSend() {
    const L = T(), t = sorted[detailIdx];
    if (!t || compBusy) return;
    const text = (drafts.get(t.ID) || '').trim();
    if (!text) { const ta = $('.ctext'); if (ta) ta.focus(); return; }
    if (!compPrivate && !confirm(L.cConfirm)) return;
    compBusy = true; compNote = null; renderDetail();
    const want = compStatus;
    const res = await sendReplySafe(t.ID, text, compPrivate, want);
    compBusy = false;
    if (res.error) {
      compNote = { cls: 'bad', text: L.cErr(res.error) };
    } else {
      drafts.delete(t.ID);
      if (res.ticket) Object.assign(t, res.ticket);   // plevantis повертає оновлений тікет — показуємо нове повідомлення одразу
      cache.delete(shownEmail);
      compStatus = '';
      // перевіряємо, чи plevantis реально поміняв статус
      const now = String(t.status || '').toLowerCase();
      if (want && res.ticket && now !== want) compNote = { cls: 'bad', text: L.cStNo(now || '?') };
      else compNote = { cls: 'ok', text: L.cOk };
      setTimeout(() => { if (compNote && compNote.cls === 'ok') { compNote = null; const m = $('.cmsg'); if (m) { m.className = 'cmsg'; m.textContent = T().cHint; } } }, 4000);
    }
    if (sorted[detailIdx] === t) {
      renderDetail();
      const c = $('.comp'); if (c) c.scrollIntoView({ block: 'nearest' });
    }
  }

  body.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      GM_setClipboard(cp.dataset.copy, 'text');
      cp.textContent = `${T().copied}: ${cp.dataset.copy}`;
      GM_openInTab(TICKETS_PAGE, { active: true });
      return;
    }
    if (e.target.closest('.back')) {
      detailIdx = null; panel.classList.remove('wide'); renderBody(); body.scrollTop = 0; return;
    }
    const md = e.target.closest('.mode');
    if (md) {
      compPrivate = md.dataset.mode === 'priv'; compNote = null;
      const ta = $('.ctext'), keep = ta ? ta.value : '';
      renderDetail();
      const n = $('.ctext'); if (n) { n.value = keep; n.focus(); }
      return;
    }
    if (e.target.closest('.send')) { doSend(); return; }
    if (e.target.closest('a, .facts, .tl, .onlymsg, .comp')) return;
    const card = e.target.closest('.t[data-i]');
    if (!card) return;
    detailIdx = +card.dataset.i;
    compNote = null; compStatus = '';
    panel.classList.add('wide');
    renderBody();
    body.scrollTop = 0;
  });
  body.addEventListener('input', (e) => {
    if (!e.target.classList.contains('ctext')) return;
    const t = sorted[detailIdx];
    if (t) drafts.set(t.ID, e.target.value);
  });
  // клавіші в полі не мають долітати до гарячих клавіш чату; Cmd/Ctrl+Enter — надіслати
  body.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('ctext')) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSend(); }
    if (e.key !== 'Escape') e.stopPropagation();
  });
  body.addEventListener('change', (e) => {
    if (e.target.classList.contains('cstatus')) { compStatus = e.target.value; return; }
    if (!e.target.classList.contains('om')) return;
    onlyMsg = e.target.checked; GM_setValue('tcOnlyMsg', onlyMsg); renderBody();
  });

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim().toLowerCase();
    if (v) load(v, true);
  });
  $('.refresh').addEventListener('click', () => { const v = input.value.trim().toLowerCase(); if (v) load(v, true); });
  $('.closeb').addEventListener('click', hidePanel);
  root.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; GM_setValue('tcLang', lang);
    paintChrome(); paintBtn(); renderBody();
  }));

  document.addEventListener('pointerdown', (e) => {
    if (panel.hidden) return;
    const path = e.composedPath();
    if (!path.includes(host) && !path.includes(btn)) hidePanel();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) hidePanel(); });

  GM_registerMenuCommand('Проверить тикеты', () => openPanel(currentEmail));

  // ---------- стежимо за зміною чату ----------
  let timer = null;
  // реагуємо не пізніше ніж за ~0.15 с після змін (раніше чекали, поки сторінка «заспокоїться» — під час завантаження Chatwoot це 5–10 с)
  new MutationObserver(() => { if (!timer) timer = setTimeout(() => { timer = null; scan(); }, 250); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  paintBtn();
  scan();
})();
