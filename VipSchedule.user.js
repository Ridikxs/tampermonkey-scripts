// ==UserScript==
// @name         VIP-менеджеры: график
// @namespace    billy.vip-schedule
// @version      1.15
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/VipSchedule.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/VipSchedule.user.js
// @description  Время по Киеву и Москве и работают ли сейчас VIP-менеджеры на каждом проекте (+ стопы «не кидать» из чата Teams, если он открыт во вкладке)
// @match        https://sparkmoth.com/app/*
// @match        https://teams.microsoft.com/*
// @match        https://teams.cloud.microsoft/*
// @match        https://teams.live.com/*
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
    { name: 'KENT',     weekday: ['08:00', '17:00'], weekend: ['08:00', '17:00'] },
    { name: 'R7',       weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'KOMETA',   weekday: ['09:00', '18:00'], weekend: ['09:00', '18:00'] },
    { name: 'ARKADA',   weekday: ['08:00', '17:00'], weekend: ['08:00', '17:00'] },
  ];
  // За скільки хвилин до кінця зміни показувати «скоро кінець»
  const SOON_MINUTES = 30;
  // Teams: частина назви чату, звідки беремо «не кидать / можно кидать» (вкладка Teams у браузері має бути відкрита)
  const TEAMS_CHAT = 'Breaks';
  const TEAMS_FRESH_MIN = 5;
  // =====================================================================

  // ===== ЧАСТИНА ДЛЯ TEAMS: читає чат «Менеджеры | Breaks» і передає стопи плашці графіка =====
  const SCHEDULE = Object.fromEntries(PROJECTS.map((p) => [p.name, { weekday: p.weekday, weekend: p.weekend }]));
  const KEYS = Object.keys(SCHEDULE);
  // ---------- розбір повідомлень з Teams ----------
  // назви проєктів, як їх пишуть у чаті
  const TEAMS_ALIASES = [
    ['CAT', 'кот|коты|котов|котах|коти|котики|кэт|кэты|cat'],
    ['GAMA', 'гама|гамы|гамма|гаммы|gama'],
    ['KOMETA', 'комета|кометы|комету|комете|kometa'],
    ['R7', 'р7|r7|р-7'],
    ['DADDY', 'деди|дедди|дэдди|дэди|дедди|daddy'],
    ['KENT', 'кент|kent'],
    ['ARKADA', 'аркада|аркады|аркаду|arkada'],
    ['Reactivation', 'реактив\\S*|реакт|reactiv\\S*'],
  ];
  const ALIAS_RES = TEAMS_ALIASES.map(([k, a]) => [k, new RegExp(`(^|[^а-яёa-z0-9])(${a})(?=$|[^а-яёa-z0-9])`, 'i')]);
  const ALL_RE = /(^|[^а-яё])(все\s+проект\S*|всех|всё|все\s+чаты)(?=$|[^а-яё])/i;
  const NEG_RE = /(не\s+(кид|перекид|закид|перевод|перевед|скид|переда|кида|отправля|перебрас|бросать|бросай|принима)\S*|временно\s+не|пока\s+не|\bстоп\b)/i;
  const POS_RE = /((можно|можем|можете)\s+(уже\s+|снова\s+|опять\s+)?(кид|перекид|закид|перевод|скид|переда|отправля|перебрас)\S*|(кид|перекид|перевод|скид)\S*\s+можно|снова\s+(кид|перекид|перевод)\S*|можно\s*$)/i;
  // Київська хвилина доби для моменту ts
  function kyivMinOf(ts) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ts)).forEach((x) => { p[x.type] = x.value; });
    let h = +p.hour; if (h === 24) h = 0;
    return { min: h * 60 + +p.minute, dow: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday] };
  }
  // північ за Києвом після моменту ts: новий день — стопи з минулого дня вже не діють
  const kyivMidnightAfter = (ts) => ts + (1440 - kyivMinOf(ts).min) * 60000;
  // кінець зміни проєкту в той день, коли написали повідомлення (для «временно», «пока что» без часу)
  function shiftEndAfter(key, ts) {
    const sc = SCHEDULE[key] || SCHEDULE.GAMA;
    const k = kyivMinOf(ts);
    const r = (k.dow === 0 || k.dow === 6) ? sc.weekend : sc.weekday;
    const [h, m] = r[1].split(':').map(Number);
    let d = h * 60 + m - k.min;
    if (d <= 0) d += 1440;   // написали після кінця зміни — до кінця завтрашньої
    return ts + d * 60000;
  }
  // до якого часу стоп: «до 16:15 / 16.15 / 16 15 / 14» (Київ), «30 минут», «полчаса», «час», «2 часа»
  function untilOf(text, ts, key) {
    const t = text.toLowerCase();
    const at = t.match(/до\s+(\d{1,2})(?:\s*[:.\s]\s*(\d{2}))?(?!\d)/);
    if (at && +at[1] <= 23 && (!at[2] || +at[2] <= 59)) {
      let d = (+at[1] * 60 + +(at[2] || 0)) - kyivMinOf(ts).min;
      if (d <= 0) d += 1440;
      return ts + d * 60000;
    }
    const mins = t.match(/(\d{1,3})\s*(мин|минут|м\b)/);
    if (mins) return ts + +mins[1] * 60000;
    if (/полчаса|пол\s+часа/.test(t)) return ts + 30 * 60000;
    const hrs = t.match(/(\d{1,2})\s*(час|ч\b)/);
    if (hrs) return ts + +hrs[1] * 3600000;
    if (/(^|\s)час(а|ик)?(\s|$)/.test(t)) return ts + 3600000;
    return shiftEndAfter(key, ts);
  }
  // у повідомленні вказано, до якого часу / на скільки («до 16:15», «30 минут», «час»)? Інакше — «пока что»
  const hasExplicitTime = (text) => { const t = String(text || '').toLowerCase(); const at = t.match(/до\s+(\d{1,2})(?:\s*[:.\s]\s*(\d{2}))?(?!\d)/); return !!(at && +at[1] <= 23) || /(\d{1,3})\s*(мин|минут|м\b)|полчаса|пол\s+часа|(\d{1,2})\s*(час|ч\b)|(^|\s)час(а|ик)?(\s|$)/.test(t); };
  // набрали в англійській розкладці («rtyn yt gthtdjlbnm» = «кент не переводить») — перекладаємо в російську
  const EN_RU = { q: 'й', w: 'ц', e: 'у', r: 'к', t: 'е', y: 'н', u: 'г', i: 'ш', o: 'щ', p: 'з', '[': 'х', ']': 'ъ', a: 'ф', s: 'ы', d: 'в', f: 'а', g: 'п', h: 'р', j: 'о', k: 'л', l: 'д', ';': 'ж', "'": 'э', z: 'я', x: 'ч', c: 'с', v: 'м', b: 'и', n: 'т', m: 'ь', ',': 'б', '.': 'ю', '`': 'ё' };
  const toRuLayout = (t) => String(t || '').replace(/[a-z\[\];',.`]/gi, (ch) => { const r = EN_RU[ch.toLowerCase()]; return r ? (ch === ch.toUpperCase() && /[a-z]/i.test(ch) ? r.toUpperCase() : r) : ch; });
  const looksWrongLayout = (t) => { const lat = (String(t).match(/[a-z]/gi) || []).length, cyr = (String(t).match(/[а-яё]/gi) || []).length; return lat >= 6 && lat > cyr * 2; };
  // повідомлення по порядку → { stops: {KEY: {until, at, text}}, clears: {KEY: at} }
  // опечатки в дієслові («перкидывать», «пеерводить», «кидатб») — приводимо до звичайного «кидать»
  const VERBS = ['кидать', 'кидайте', 'кидаем', 'перекидывать', 'перекидывайте', 'закидывать', 'скидывать', 'переводить', 'переводите', 'перевести', 'передавать', 'отправлять', 'перебрасывать', 'принимать'];
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function fixVerbs(text) {
    return String(text || '').replace(/[а-яё]{4,}/gi, (w) => {
      const lw = w.toLowerCase();
      if (/кида|кидыв|кидат|кидай/.test(lw)) return 'кидать';                       // «перкидывать», «пркидывать» і т.п.
      if (/(перев|перед|отправ|брос|принима)/.test(lw)) return w;                   // і так розпізнається
      const lim = lw.length >= 8 ? 2 : 1;
      return VERBS.some((v) => lev(lw, v) <= lim) ? 'кидать' : w;
    });
  }
  function parseTeams(msgs) {
    const stops = {}, clears = {};
    for (const m0 of msgs.slice().sort((a, b) => a.at - b.at)) {
      // у тексті переважно латиниця — найімовірніше, не та розкладка: читаємо як російський текст
      const m1 = looksWrongLayout(m0.text) ? { ...m0, text: toRuLayout(m0.text) } : m0;
      const m = { ...m1, text: fixVerbs(m1.text) };
      const clauses = m.text.split(/[;!?\n]|,\s|\.\s|\s+а\s+|\s+но\s+/i).map((x) => x.trim()).filter(Boolean);
      let carry = [];
      for (const c of clauses) {
        let keys = ALIAS_RES.filter(([, re]) => re.test(c)).map(([k]) => k);
        // «все проекты» — це VIP-менеджери проєктів; Reactivation — окремі менеджери, їх зупиняє тільки «реактив…»
        // «все проекты» + ще щось («все проекты и реактив») — усі проєкти РАЗОМ із названими окремо
        if (ALL_RE.test(c)) keys = [...new Set([...keys, ...KEYS.filter((k) => k !== 'Reactivation')])];
        if (!keys.length) keys = carry;
        if (!keys.length) continue;
        carry = keys;
        let neg = NEG_RE.test(c), pos = POS_RE.test(c);
        // і «не кидать», і «можно кидать» в одному реченні (напр. процитували старе) — правий той, що написаний пізніше
        if (neg && pos) { const ln = c.search(new RegExp(`${NEG_RE.source}(?![\\s\\S]*${NEG_RE.source})`, 'i')), lp = c.search(new RegExp(`${POS_RE.source}(?![\\s\\S]*${POS_RE.source})`, 'i')); if (lp > ln) neg = false; else pos = false; }
        if (pos && !neg) keys.forEach((k) => { delete stops[k]; clears[k] = m.at; });
        // стоп діє максимум до кінця зміни: наступна зміна починається «з чистого аркуша»
        // новий день = усі працюють, поки знову не напишуть «не кидать»: стоп не переходить через північ (Київ)
        else if (neg) keys.forEach((k) => { stops[k] = { until: Math.min(untilOf(c, m.at, k), shiftEndAfter(k, m.at), kyivMidnightAfter(m.at)), at: m.at, text: m.text.slice(0, 120), explicit: hasExplicitTime(c) }; delete clears[k]; });
      }
    }
    return { stops, clears };
  }

  // ---------- читання чату в Teams (вкладка в браузері) ----------
  function teamsReader() {
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;left:12px;bottom:52px;z-index:2147483647;max-width:520px;padding:6px 10px;border-radius:10px;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none;';
    const paint = (ok, text) => {
      if (!badge.isConnected && document.body) document.body.appendChild(badge);
      badge.style.background = ok ? '#1E4636' : '#4A3917';
      badge.style.color = ok ? '#5FD39D' : '#F2B544';
      { const bt = `🕒 График · ${text}`; if (badge.textContent !== bt) badge.textContent = bt; }
    };
    const chatOpen = () => {
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const v = n.nodeValue.trim();
        if (v.length < 60 && v.includes(TEAMS_CHAT) && n.parentElement && n.parentElement.getBoundingClientRect().top < 220 && n.parentElement.getBoundingClientRect().left > 250) return true;
      }
      return false;
    };
    // повідомлення: кожен <time datetime> — це час одного повідомлення; беремо найближчий блок навколо нього
    const readMsgs = () => {
      const out = [];
      const seen = new Set(), seenBody = new Set();
      for (const tm of document.querySelectorAll('time[datetime]')) {
        const at = Date.parse(tm.getAttribute('datetime'));
        if (!at || Date.now() - at > 36 * 3600000) continue;
        // блок саме ЦЬОГО повідомлення: найвищий предок, у якому тільки один час (інакше текст береться з сусіднього, старішого повідомлення)
        let box = tm.closest('[data-tid="chat-pane-message"], [data-tid="chat-pane-item"]');
        if (!box || box.querySelectorAll('time[datetime]').length !== 1) {
          box = tm.parentElement;
          while (box && box.parentElement && box.parentElement.querySelectorAll('time[datetime]').length === 1) box = box.parentElement;
        }
        if (!box || seen.has(box)) continue;
        seen.add(box);
        const body = box.querySelector('[data-tid="chat-pane-message"] [id^="content-"], [id^="content-"], [data-tid="message-body-content"], [data-tid="message-body"]') || box;
        seenBody.add(body);
        const clone = body.cloneNode(true);
        // цитата («відповісти на повідомлення»), ім'я автора, час, реакції — не текст повідомлення
        clone.querySelectorAll('blockquote, [data-tid*="quote" i], [class*="quote" i], [data-tid*="author" i], [data-tid*="reaction" i], [data-tid*="divider" i], [role="separator"], time, button').forEach((x) => x.remove());
        // службові написи Teams (роздільник непрочитаних, «Изменено» тощо) — не текст повідомлення
        const text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ')
          .replace(/(не\s*прочитан\S*(\s+сообщени\S*)?|последнее\s+прочитанное|новые\s+сообщения|изменено|edited|unread\s+messages?|new\s+messages?)/gi, ' ')
          .replace(/\s+/g, ' ').trim();
        if (text) out.push({ at, text: text.slice(0, 300) });
      }
      // повідомлення-«продовження» (той самий автор підряд) Teams показує БЕЗ часу — час беремо з id «content-<мітка часу>»
      for (const el of document.querySelectorAll('[id^="content-"]')) {
        if (seenBody.has(el) || [...seenBody].some((b) => b.contains(el) || el.contains(b))) continue;
        const mm = el.id.match(/^content-(\d{12,14})$/);
        if (!mm) continue;
        const at = +mm[1];
        if (Date.now() - at > 36 * 3600000 || at - Date.now() > 3600000) continue;
        const clone = el.cloneNode(true);
        clone.querySelectorAll('blockquote, [data-tid*="quote" i], [class*="quote" i], [data-tid*="reaction" i], time, button').forEach((x) => x.remove());
        const text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').replace(/(изменено|edited)/gi, ' ').replace(/\s+/g, ' ').trim();
        if (text) out.push({ at, text: text.slice(0, 300) });
      }
      return out;
    };
    const tick = () => {
      if (!document.body) return;
      if (!chatOpen()) { paint(false, `открой чат «…${TEAMS_CHAT}» — тогда читаю стопы`); GM_setValue('vsTeams', { at: Date.now(), ok: false, why: 'чат не открыт' }); return; }
      const msgs = readMsgs();
      const { stops, clears } = parseTeams(msgs);
      const now = Date.now();
      for (const k of Object.keys(stops)) if (stops[k].until <= now) delete stops[k];
      GM_setValue('vsTeams', { at: now, ok: true, n: msgs.length, stops, clears, last: msgs.slice(-5) });
      // без часу в повідомленні («временно», «пока что») — просто назва проєкту, без «до 23:00»
      const list = Object.entries(stops).map(([k, v]) => { if (v.explicit === false) return k; const d = new Date(v.until); return `${k} до ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; });
      paint(true, `читаю «${TEAMS_CHAT}» (${msgs.length} сообщ.) · ${list.length ? `не переводить: ${list.join(', ')}` : 'стопов нет'}`);
    };
    // фонову вкладку Chrome «присипляє» (таймери раз на хвилину) — тікаємо з Worker'а, його не гальмують
    try {
      const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),4000)'], { type: 'text/javascript' })));
      wk.onmessage = () => tick();
    } catch (e) { setInterval(tick, 5000); }
    // нове / відредаговане повідомлення в чаті — читаємо одразу, не чекаючи таймера
    let mT = null;
    new MutationObserver((muts) => {
      if (mT || muts.every((m) => badge.contains(m.target))) return;   // наша власна плашка — не рахуємо
      mT = setTimeout(() => { mT = null; tick(); }, 800);
    })
      .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    setTimeout(tick, 2500);
  }

  if (/teams\.(microsoft\.com|cloud\.microsoft|live\.com)$/.test(location.hostname)) { teamsReader(); return; }

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

  .summary { padding: 7px 11px; border-radius: 10px; font-weight: 600; font-size: 13px; margin-bottom: 10px; }
  .summary.ok { background: var(--open-soft); color: var(--open); }
  .summary.bad { background: var(--closed-soft); color: var(--closed); }
  .summary small { display: block; font-weight: 400; font-size: 11.5px; color: var(--ink); opacity: .7; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .axis, .row { display: grid; grid-template-columns: 150px 1fr 74px; gap: 10px; align-items: center; }
  .row > div:first-child { min-width: 0; }
  .axis { padding: 0 10px 4px; }
  .scale { position: relative; height: 12px; }
  .scale i { position: absolute; transform: translateX(-50%); font-style: normal; font-size: 10px; color: var(--muted); }
  .list { list-style: none; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .row { padding: 8px 10px; border-top: 1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .name { font-weight: 650; font-size: 13px; }
  .sub { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

  // стопи з Teams («не кидать / не переводить») — їх читає скрипт «Бездеп» з вкладки Teams і ділиться через localStorage
  function teamsStops() {
    const now = Date.now();
    const out = { live: false, stops: {} };
    // 1) власне читання Teams (цей же скрипт у вкладці Teams)
    const t = GM_getValue('vsTeams', null);
    if (t && t.ok && now - t.at < TEAMS_FRESH_MIN * 60000) {
      out.live = true;
      for (const [k, v] of Object.entries(t.stops || {})) if (v.until > now) out.stops[k] = { until: v.until, text: v.text, src: 'teams', explicit: v.explicit !== false };
    }
    // 2) якщо стоїть і «Бездеп» — беремо його стопи теж (там можуть бути ручні)
    try {
      const n = JSON.parse(localStorage.getItem('ndStopsShared') || 'null');
      if (n && now - n.at < 60000) {
        if (n.live) out.live = true;
        // з «Бездепу» беремо ТІЛЬКИ ручні стопи (кнопкою). Стопи з Teams — лише власні: інакше старий «не кидать»
        // з іншого скрипта перебивав би «можно» (наприклад, «коты можно переводжить»)
        const ownLive = t && t.ok && now - t.at < TEAMS_FRESH_MIN * 60000;
        for (const [k, v] of Object.entries(n.stops || {})) {
          if (!(v.until > now) || out.stops[k]) continue;
          if (v.src !== 'manual' && ownLive) continue;
          out.stops[k] = v;
        }
      }
    } catch (e) { /* */ }
    return out;
  }
  const hmLocal = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function render() {
    const now = new Date();
    const kp = zoneParts(now, KYIV_TZ), mp = zoneParts(now, MSK_TZ);
    const ts = teamsStops();
    const rows = PROJECTS.map((p) => {
      const st = statusOf(p, kp);
      const sp = ts.stops[p.name];
      // працюють за графіком, але в Teams написали «не переводить» — зараз переводити не можна
      if (st.state === 'open' && sp && sp.until > Date.now()) return { p, st: { ...st, state: 'stop', stopUntil: sp.until, stopText: sp.text || '', stopSrc: sp.src, stopExplicit: sp.explicit !== false } };
      return { p, st };
    });
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
    $('.date').innerHTML = `${L.kyiv}, <b>${L.days[kp.dow]}</b> ${kp.day} ${L.months[kp.month - 1]}`;
    $('.msk-label').textContent = L.moscow;
    root.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    $('.msk-time').textContent = `${pad(mp.h)}:${pad(mp.m)}`;
    let diff = (mp.h * 60 + mp.m) - (kp.h * 60 + kp.m);
    if (diff > 720) diff -= 1440; if (diff < -720) diff += 1440;
    const dh = Math.round(diff / 60);
    $('.msk-diff').textContent = dh === 0 ? L.sameAsKyiv : `${dh > 0 ? '+' : '−'}${Math.abs(dh)} ${L.fromKyiv}`;

    const summary = $('.summary');
    const stopped = rows.filter((r) => r.st.state === 'stop');
    // коротко: хто на стопі з Teams; про Teams пишемо тільки якщо він НЕ читається
    const stopTxt = stopped.length ? `Стоп: ${stopped.map((r) => `${r.p.name}${r.st.stopExplicit ? ` до ${hmLocal(r.st.stopUntil)}` : ''}`).join(', ')}` : '';
    if (open.length) {
      summary.className = 'summary ok';
      const closed = rows.filter((r) => r.st.state === 'closed').map((r) => r.p.name);
      const info = [closed.length ? `${L.closedList}: ${closed.join(', ')}` : '', stopTxt, ts.live ? '' : '🟡 Teams не читается'].filter(Boolean).join(' · ');
      summary.innerHTML = `${open.length === total ? L.allOpen : `${L.someOpen}: ${open.length} ${L.of} ${total}`}${info ? `<small title="${info.replace(/"/g, '&quot;')}">${info}</small>` : ''}`;
    } else {
      const next = rows.slice().sort((a, b) => a.st.minsUntil - b.st.minsUntil)[0];
      summary.className = 'summary bad';
      const info = [stopTxt, ts.live ? '' : '🟡 Teams не читается'].filter(Boolean).join(' · ');
      summary.innerHTML = stopped.length && !rows.some((r) => r.st.state === 'closed' && r.st.minsUntil < 600)
        ? `${L.noneOpen}${info ? `<small>${info}</small>` : ''}`
        : `${L.noneOpen}<small>${L.nearest}: ${next.p.name} ${next.st.tomorrow ? L.tomorrow + ' ' : ''}${L.at} ${hhmm(next.st.opensAt)}, ${L.in} ${dur(next.st.minsUntil)}${info ? ` · ${info}` : ''}</small>`;
    }

    const nowPos = (kp.h * 60 + kp.m + kp.s / 60) / 14.4;
    $('.list').innerHTML = rows.map(({ p, st }) => {
      let cls, sub, tag;
      if (st.state === 'stop') {
        cls = 'closed stop';
        sub = `Не переводить${st.stopExplicit ? ` до ${hmLocal(st.stopUntil)}` : ''}`;
        tag = 'стоп';
      } else if (st.state === 'open') {
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
        <div title="${String(st.stopText || '').replace(/"/g, '&quot;')}"><div class="name">${p.name}</div><div class="sub">${sub}</div></div>
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
