// ==UserScript==
// @name         HelpDesk Workflow — Payment & Private Note
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Payment по проекту Chatwoot, исправление MouseEvent для Tampermonkey, выбор Payment, авторазмер заметки.
// @author       Will
// @match        https://sparkmoth.com/*
// @match        https://hd.sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @match        https://plevantis.net/cw-ticket*
// @match        https://www.plevantis.net/cw-ticket*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const VERSION = '2.5.0';
    const PANEL_CLASS = 'hdw-team-panel';
    const NOTE_CLASS = 'hdw-note-resize';
    const STORAGE_PREFIX = 'hdw-2-context:';
    const STORAGE_LAST = 'hdw-2-last-context';
    const TTL = 30 * 60 * 1000;
    const NOTE_MIN = 180;
    const NOTE_MAX = 2000;
    const MESSAGE_REQUEST = 'hdw2:request-context';
    const MESSAGE_REPLY = 'hdw2:reply-context';
    const TRUSTED_ORIGINS = new Set([
        'https://sparkmoth.com',
        'https://hd.sparkmoth.com',
        'https://blueripple.xyz',
        'https://plevantis.net',
        'https://www.plevantis.net'
    ]);

    const PROJECTS = [
        { name: 'Cat', payment: 'Cat Payment', vip: 'VIP Cat Payment' },
        { name: 'R7', payment: 'R7 Payment', vip: 'R7 Payment VIP' },
        { name: 'Kent', payment: 'Kent Payment', vip: 'Kent Payment VIP' },
        { name: 'Arkada', payment: 'Arkada Payment', vip: 'Arkada Payment VIP' },
        { name: 'Kometa', payment: 'Kometa Payment', vip: 'Kometa Payment VIP' },
        { name: 'Gama', payment: 'Gama Payment', vip: 'VIP Gama Payment' },
        { name: 'Daddy', payment: 'Daddy Payment', vip: 'Daddy Payment VIP' }
    ]; // Mers специально исключён.

    const projectMap = new Map(PROJECTS.map(p => [p.name.toLowerCase(), p]));
    const observedNotes = new WeakSet();
    const pendingSelections = new WeakMap();
    let scanTimer = null;
    let lastChatRoute = '';
    let lastPublished = null;
    let nextApiCheck = 0;
    let cachedInboxes = null;
    let inboxFetchInFlight = null;
    let lastParentRequest = 0;

    GM_addStyle(`
        .${PANEL_CLASS} {
            display:block !important; visibility:visible !important;
            width:100%; min-width:0; padding:6px 7px; margin:5px 0 8px;
            border:1px solid var(--border-strong,#cbd5e1); border-radius:8px;
            background:var(--bg-card2,#f8fafc); color:var(--text,#334155);
            box-sizing:border-box; font:inherit; font-size:11px;
            position:relative; z-index:2;
        }
        .${PANEL_CLASS} * {box-sizing:border-box}
        .${PANEL_CLASS} [hidden] {display:none !important}
        .${PANEL_CLASS} .hdw-top {
            display:flex; flex-wrap:wrap; align-items:center; gap:5px; min-height:23px;
        }
        .${PANEL_CLASS} .hdw-title {font-weight:800;white-space:nowrap;font-size:11px}
        .${PANEL_CLASS} .hdw-badge {
            font-size:10px; font-weight:700; background:rgba(100,116,139,.11);
            color:var(--text-sub,#64748b); border-radius:4px; padding:3px 6px;
            white-space:nowrap;
        }
        .${PANEL_CLASS} .hdw-badge.vip {color:#7c3aed;background:#f3e8ff}
        .${PANEL_CLASS} .hdw-badge.privip {color:#1d4ed8;background:#eff6ff}
        .${PANEL_CLASS} .hdw-badge.regular {color:#475569;background:#f1f5f9}
        .${PANEL_CLASS} button {
            font:inherit; font-size:10px; font-weight:750; cursor:pointer;
            border:1px solid #bfdbfe; border-radius:5px; background:#eff6ff;
            color:#1d4ed8; padding:4px 7px; line-height:1.2;
        }
        .${PANEL_CLASS} button.hdw-vip {border-color:#ddd6fe;background:#f5f3ff;color:#7c3aed}
        .${PANEL_CLASS} button.hdw-toggle {
            margin-left:auto; color:var(--text-sub,#64748b);
            border-color:var(--border-strong,#cbd5e1); background:transparent;
        }
        .${PANEL_CLASS} button:hover:not(:disabled) {filter:brightness(.95)}
        .${PANEL_CLASS} button:disabled {opacity:.52;cursor:wait}
        .${PANEL_CLASS} .hdw-hint {font-size:10px;color:var(--text-sub,#64748b)}
        .${PANEL_CLASS} .hdw-status {margin-top:4px;font-size:10px;line-height:1.3;color:var(--text-sub,#64748b)}
        .${PANEL_CLASS} .hdw-status:empty {display:none}
        .${PANEL_CLASS} .hdw-status.error {color:#dc2626}
        .${PANEL_CLASS} .hdw-status.success {color:#16a34a}
        .${PANEL_CLASS} .hdw-manual {margin-top:6px;padding-top:5px;border-top:1px solid var(--border,#e2e8f0)}
        .${PANEL_CLASS} .hdw-manual-top {display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap}
        .${PANEL_CLASS} .hdw-manual-top label {font-size:10px;color:var(--text-sub,#64748b);margin:0}
        .${PANEL_CLASS} .hdw-manual-top select {
            padding:3px 5px; font:inherit; font-size:10px; border-radius:4px;
            background:var(--bg-card,#fff);color:var(--text,#334155);
            border:1px solid var(--border-strong,#cbd5e1);
        }
        .${PANEL_CLASS} .hdw-grid {
            display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:3px;
        }
        .${PANEL_CLASS} .hdw-project {
            min-width:0;display:grid;grid-template-columns:minmax(44px,.8fr) minmax(0,2fr);
            align-items:center;gap:4px;padding:3px 5px;
            border:1px solid var(--border,#e2e8f0);border-radius:5px;
            background:var(--bg-card,#fff);
        }
        .${PANEL_CLASS} .hdw-project-name {font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .${PANEL_CLASS} .hdw-actions {display:grid;grid-template-columns:1fr 1fr;gap:3px;min-width:0}
        .${PANEL_CLASS} .hdw-actions button {min-width:0;padding:4px 1px}
        textarea.${NOTE_CLASS} {
            display:block !important;width:100% !important;min-height:${NOTE_MIN}px !important;
            max-height:none !important;box-sizing:border-box !important;
            resize:vertical !important;overflow-x:hidden !important;
            line-height:1.5 !important;transition:none !important;
        }
        textarea.${NOTE_CLASS}::-webkit-scrollbar {width:8px}
        textarea.${NOTE_CLASS}::-webkit-scrollbar-thumb {background:#64748b;border-radius:8px}
        @media(max-width:420px) {
            .${PANEL_CLASS} {padding:5px}
            .${PANEL_CLASS} .hdw-grid {grid-template-columns:1fr}
        }
    `);

    const norm = x => String(x ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const visible = el => Boolean(el?.isConnected && el.getClientRects().length);
    const labelText = label => norm(label.textContent).replace(/[：:*]/g, '').trim();
    const isTeam = label => /^(команда|team)$/.test(labelText(label));
    const isPriority = label => /^(приоритет|priority)$/.test(labelText(label));
    const isNote = label => /^(приватная заметка|private note)$/.test(labelText(label));

    // --- Источник: название inbox активного разговора Chatwoot ---
    function parseInbox(name) {
        const text = norm(name).replace(/[^a-zа-яё0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
        if (!text || /\b(payment|платеж|вывод)\b/.test(text)) return null;
        const words = text.split(' ');
        const project = PROJECTS.find(p => words.includes(norm(p.name)));
        if (!project) return null;
        let tier = 'regular';
        if (/(^| )(pre\s*vip|pri\s*vip|privip)( |$)/.test(text)) tier = 'privip';
        else if (/(^| )(vip|highroll)( |$)/.test(text)) tier = 'vip';
        return { project: project.name, tier, inboxName: String(name).trim() };
    }

    function getChatRoute() {
        const url = new URL(location.href);
        const full = `${url.pathname}${url.search}${url.hash}`;
        const account = full.match(/\/accounts\/(\d+)/)?.[1] || '1';
        const routeId = full.match(/\/conversations\/(\d+)(?=[/?#&]|$)/)?.[1];
        const params = new URLSearchParams(url.search);
        const hashParams = new URLSearchParams(url.hash.split('?')[1] || '');
        let id = routeId || '';
        for (const key of ['conversation_id', 'conversationId', 'conversation']) {
            const val = params.get(key) || hashParams.get(key);
            if (!id && /^\d+$/.test(val || '')) id = val;
        }
        return id ? { id, account } : null;
    }

    function getChatInboxFromDOM() {
        const candidates = [];
        for (const el of document.querySelectorAll('[title]')) {
            if (!visible(el)) continue;
            const info = parseInbox(el.getAttribute('title'));
            if (!info) continue;
            if (el.closest('nav,[role="navigation"],aside,[data-testid*="conversation-list" i]')) continue;
            const icon = el.querySelector('.i-woot-website,.i-woot-telegram,.i-woot-api');
            const header = el.closest('header,[data-testid*="conversation-header" i],[class*="conversation-header" i],[class*="conversation-info" i],[class*="conversation-details" i]');
            if (!icon && !header && !el.matches('[data-testid*="inbox" i]')) continue;
            let score = 1 + (icon ? 20 : 0) + (header ? 50 : 0);
            if (el.closest('a[href*="/conversations/"]')) score -= 10;
            candidates.push({ ...info, score });
        }
        if (!candidates.length) return null;
        const highest = Math.max(...candidates.map(c => c.score));
        const top = candidates.filter(c => c.score === highest);
        return new Set(top.map(c => c.project + '|' + c.tier)).size === 1 ? top[0] : null;
    }

    function validContext(x, id = '') {
        return Boolean(x && /^\d+$/.test(String(x.id || '')) &&
            (!id || String(x.id) === String(id)) &&
            projectMap.has(norm(x.project)) &&
            ['regular', 'privip', 'vip'].includes(x.tier) &&
            Number.isFinite(x.at) && Date.now() >= x.at && Date.now() - x.at < TTL);
    }

    function publish(id, info, source) {
        if (!/^\d+$/.test(String(id)) || !info || !projectMap.has(norm(info.project))) return;
        const data = { id: String(id), project: info.project, tier: info.tier,
            inboxName: info.inboxName || '', source, at: Date.now() };
        if (lastPublished && lastPublished.id === data.id &&
            lastPublished.project === data.project && lastPublished.tier === data.tier &&
            Date.now() - lastPublished.at < 10000) return;
        lastPublished = data;
        GM_setValue(STORAGE_PREFIX + data.id, data);
        GM_setValue(STORAGE_LAST, data);
        scheduleScan();
    }

    function authHeaders() {
        const h = { Accept: 'application/json' };
        try {
            const raw = document.cookie.split('; ').find(p => p.startsWith('cw_d_session_info='));
            if (!raw) return h;
            const info = JSON.parse(decodeURIComponent(raw.slice('cw_d_session_info='.length)));
            for (const key of ['access-token', 'client', 'uid']) {
                if (typeof info[key] === 'string' && info[key]) h[key] = info[key];
            }
        } catch { /* Browser session may use another auth method. */ }
        return h;
    }

    async function loadInboxMap(account) {
        if (cachedInboxes) return cachedInboxes;
        if (inboxFetchInFlight) return inboxFetchInFlight;
        inboxFetchInFlight = (async () => {
            try {
                const response = await fetch(`/api/v1/accounts/${account}/inboxes`, {
                    credentials: 'same-origin', headers: authHeaders()
                });
                if (!response.ok) return null;
                const json = await response.json();
                const list = Array.isArray(json) ? json : (json.payload || json.data || []);
                if (!Array.isArray(list)) return null;
                cachedInboxes = new Map(list.map(item => [String(item.id), item.name]));
                return cachedInboxes;
            } catch { return null; } finally { inboxFetchInFlight = null; }
        })();
        return inboxFetchInFlight;
    }

    async function queryConversation(route) {
        try {
            const response = await fetch(`/api/v1/accounts/${route.account}/conversations/${route.id}`, {
                credentials: 'same-origin', headers: authHeaders()
            });
            if (!response.ok) return;
            const raw = await response.json();
            const item = raw?.payload?.conversation || raw?.payload || raw?.conversation || raw;
            let info = parseInbox(item?.inbox?.name || item?.inbox_name || item?.meta?.inbox?.name);
            if (!info && item?.inbox_id != null) {
                const inboxes = await loadInboxMap(route.account);
                info = parseInbox(inboxes?.get(String(item.inbox_id)));
            }
            // A stale API response must never label the next conversation.
            if (info && getChatRoute()?.id === route.id) publish(route.id, info, 'api');
        } catch { /* Read-only optional fallback. */ }
    }

    function syncChat() {
        if (getHelpdeskForm()) return;
        if (!/sparkmoth\.com$/.test(location.hostname)) return;
        const route = getChatRoute();
        if (!route) return;
        const key = `${route.account}:${route.id}`;
        if (key !== lastChatRoute) {
            lastChatRoute = key;
            lastPublished = null;
            nextApiCheck = 0;
        }
        const info = getChatInboxFromDOM();
        if (info) publish(route.id, info, 'dom');
        if (Date.now() > nextApiCheck) {
            nextApiCheck = Date.now() + 20000;
            queryConversation(route);
        }
    }

    // --- HelpDesk: only associate context with matching conversation number ---
    function getHelpdeskForm() {
        for (const form of document.querySelectorAll('form')) {
            if ([...form.querySelectorAll('label')].some(isTeam) &&
                [...form.querySelectorAll('label')].some(isPriority)) return form;
        }
        return null;
    }

    function getHelpdeskId() {
        for (const header of document.querySelectorAll('h1,h2')) {
            if (!/тикет\s+в\s+helpdesk/i.test(header.textContent || '')) continue;
            const titleText = header.parentElement?.textContent || '';
            const found = titleText.match(/разговор\s*#\s*(\d+)/i);
            if (found) return found[1];
        }
        const params = new URL(location.href).searchParams;
        for (const key of ['conversation_id', 'conversationId', 'chatwoot_conversation_id']) {
            const val = params.get(key);
            if (/^\d+$/.test(val || '')) return val;
        }
        return '';
    }

    function getContext() {
        const id = getHelpdeskId();
        if (!id) return null;
        // If script runs in the same DOM as the selected Chatwoot conversation.
        if (getChatRoute()?.id === id) {
            const live = getChatInboxFromDOM();
            if (live) return { id, ...live, at: Date.now(), source: 'dom-live' };
        }
        const saved = GM_getValue(STORAGE_PREFIX + id, null);
        if (validContext(saved, id)) return saved;
        const last = GM_getValue(STORAGE_LAST, null);
        return validContext(last, id) ? last : null;
    }

    function requestFromParent() {
        if (window.parent === window) return;
        const id = getHelpdeskId();
        if (!id || Date.now() - lastParentRequest < 1800) return;
        lastParentRequest = Date.now();
        // Only the conversation number is sent; no customer data or auth headers.
        try { window.parent.postMessage({ type: MESSAGE_REQUEST, id }, '*'); } catch { /* ignore */ }
    }

    window.addEventListener('message', event => {
        if (!TRUSTED_ORIGINS.has(event.origin) || !event.data || typeof event.data !== 'object') return;
        if (event.data.type === MESSAGE_REQUEST) {
            const route = getChatRoute();
            if (!route || !/^\d+$/.test(String(event.data.id)) || route.id !== String(event.data.id)) return;
            const info = getChatInboxFromDOM();
            const stored = GM_getValue(STORAGE_PREFIX + route.id, null);
            const data = info ? { id: route.id, ...info, at: Date.now(), source: 'dom-message' } : stored;
            if (validContext(data, route.id)) {
                event.source?.postMessage({ type: MESSAGE_REPLY, data }, event.origin);
            }
        } else if (event.data.type === MESSAGE_REPLY) {
            const id = getHelpdeskId();
            const data = event.data.data;
            if (!id || !validContext(data, id)) return;
            GM_setValue(STORAGE_PREFIX + id, data);
            GM_setValue(STORAGE_LAST, data);
            scheduleScan();
        }
    });

    function fieldUnderLabel(form, matcher, selector) {
        for (const label of form.querySelectorAll('label')) {
            if (!matcher(label)) continue;
            if (label.htmlFor) {
                const el = document.getElementById(label.htmlFor);
                if (el?.matches(selector)) return { label, field: el };
            }
            const el = label.parentElement?.querySelector(selector);
            if (el) return { label, field: el };
        }
        return null;
    }

    function nativeValue(element, value) {
        const base = element instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(base, 'value')?.set;
        if (setter) setter.call(element, value);
        else element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function updatePriority(form, tier) {
        if (tier === 'regular' || !tier) return 'unchanged';
        const select = fieldUnderLabel(form, isPriority, 'select')?.field;
        const value = tier === 'vip' ? 'urgent' : 'high';
        if (!select || ![...select.options].some(opt => opt.value === value)) return 'missing';
        nativeValue(select, value);
        return select.value === value ? 'updated' : 'missing';
    }

    // --- Autocomplete: portal-aware, scroll-aware, framework-agnostic. ---
    // Вариант HelpDesk на plevantis показывает список под input,
    // но может отрисовать его в PORTAL без .suggestion-container.
    // Поиск во всём DOM с точным сравнением названия команды.
    function isRendered(el) {
        if (!(el instanceof Element) || !el.isConnected) return false;
        if (el.closest(`.${PANEL_CLASS},[hidden]`)) return false;
        for (let parent = el; parent && parent !== document.documentElement; parent = parent.parentElement) {
            const css = getComputedStyle(parent);
            if (css.display === 'none' || css.visibility === 'hidden') return false;
        }
        // Не проверяем пересечение с viewport: нужный пункт может быть
        // НИЖЕ прокручиваемой области списка, но присутствовать в DOM.
        return el.getClientRects().length > 0;
    }

    function optionForNode(node) {
        const base = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!base || base.closest(`.${PANEL_CLASS}`)) return null;
        return base.closest(
            '[role="option"], li, .suggestion-container > *, ' +
            '[class*="suggestion-item" i], [data-testid*="option" i]'
        ) || (base.matches('span,b,strong,em') && base.parentElement?.tagName === 'DIV'
            ? base.parentElement : base);
    }

    function findSuggestion(input, expected) {
        if (!input?.isConnected || !document.body) return null;
        const wanted = norm(expected);
        if (!wanted) return null;
        const items = [];
        const seen = new Set();
        const add = item => {
            if (!item || seen.has(item) || item.contains(input)) return;
            seen.add(item);
            if (norm(item.textContent) !== wanted || !isRendered(item)) return;
            const box = item.getBoundingClientRect();
            const field = input.getBoundingClientRect();
            // При прочих равных предпочитаем подсказку рядом с полем,
            // а не одноимённый элемент в другом диалоге.
            const dist = Math.abs(box.left - field.left) + Math.abs(box.top - field.bottom);
            const local = input.parentElement?.parentElement?.contains(item) ? 4000 : 0;
            const popup = item.closest(
                '.suggestion-container, [role="listbox"], [class*="dropdown" i], [class*="autocomplete" i]'
            ) ? 2000 : 0;
            items.push({ item, score: local + popup - dist });
        };

        // 1. Точный текст дочернего элемента. Работает даже в React Portal.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (norm(node.nodeValue) !== wanted) continue;
            add(optionForNode(node));
        }

        // 2. Для подсказок с несколькими вложенными span.
        if (!items.length) {
            for (const el of document.querySelectorAll(
                '[role="option"], .suggestion-container > *, ' +
                '[class*="suggestion-item" i], li, div'
            )) {
                if (norm(el.textContent) !== wanted) continue;
                if ([...el.children].some(child => norm(child.textContent) === wanted)) continue;
                add(optionForNode(el));
            }
        }

        items.sort((a, b) => b.score - a.score);
        return items[0]?.item || null;
    }

    function waitSuggestion(input, expected, panel, token, timeoutMs = 750) {
        return new Promise(resolve => {
            let finished = false;
            let timeout, poller, observer;
            const finish = result => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
                clearInterval(poller);
                observer?.disconnect();
                resolve(result);
            };
            const check = () => {
                if (!panel.isConnected || !input.isConnected ||
                    pendingSelections.get(panel) !== token) return finish(null);
                const result = findSuggestion(input, expected);
                if (result) finish(result);
            };
            observer = new MutationObserver(check);
            observer.observe(document.body, { childList:true, subtree:true, characterData:true });
            poller = setInterval(check, 70);
            timeout = setTimeout(() => finish(null), timeoutMs);
            check();
        });
    }

    function searchInput(input, value) {
        // Поиск не должен отправлять change: на ряде React autocomplete
        // оно закрывает список прежде, чем выбран пункт.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles:true, composed:true }));
    }

    function triggerOptionSelection(item) {
        if (!item?.isConnected) return false;

        // В Tampermonkey window может быть обёрткой sandbox, а не нативным
        // Window того документа, которому принадлежит элемент. Передача
        // { view: window } в MouseEvent вызывает TypeError при приведении
        // к Window (ошибка, видимая на plevantis.net).
        // Поле view здесь не нужно: конструктора без него достаточно.
        const ownerWindow = item.ownerDocument?.defaultView;
        const MouseEventCtor = ownerWindow?.MouseEvent || MouseEvent;
        const PointerEventCtor = ownerWindow?.PointerEvent;
        const mouseOptions = {
            bubbles: true,
            cancelable: true,
            composed: true,
            button: 0
        };

        try {
            if (typeof PointerEventCtor === 'function' && item.isConnected) {
                item.dispatchEvent(new PointerEventCtor('pointerdown', {
                    ...mouseOptions, buttons: 1, pointerType: 'mouse',
                    isPrimary: true
                }));
            }
        } catch (error) {
            console.debug('[HDW] pointerdown unsupported; using mousedown:', error);
        }

        // Реальное приложение может выбрать команду на pointerdown;
        // тогда подсказка исчезает и повторно нажимать уже не нужно.
        if (!item.isConnected) return true;

        try {
            item.dispatchEvent(new MouseEventCtor('mousedown', {
                ...mouseOptions, buttons: 1
            }));
        } catch (error) {
            console.warn('[HDW] mousedown unsupported; trying click:', error);
        }

        if (!item.isConnected) return true;

        try {
            item.dispatchEvent(new MouseEventCtor('mouseup', {
                ...mouseOptions, buttons: 0
            }));
        } catch (error) {
            console.debug('[HDW] mouseup unsupported:', error);
        }

        if (!item.isConnected) return true;

        // Native click запускает обработчики onClick React.
        item.click();
        return true;
    }

    function status(panel, text, type = '') {
        const node = panel.querySelector('.hdw-status');
        if (!node) return;
        node.className = `hdw-status${type ? ' ' + type : ''}`;
        node.textContent = text;
    }

    async function chooseTeam(panel, input, teamName, tier, expectedContext = null) {
        if (!panel.isConnected || !input.isConnected) return;
        const sameConversation = () => {
            if (!expectedContext) return true;
            const current = getContext();
            return Boolean(current &&
                `${current.id}|${current.project}|${current.tier}` === expectedContext);
        };
        if (!sameConversation()) {
            status(panel, 'Разговор изменился. Обнови выбор.', 'error');
            return;
        }
        const token = Symbol('choose-team');
        pendingSelections.set(panel, token);
        const buttons = [...panel.querySelectorAll('button[data-team]')];
        const isCurrent = () => panel.isConnected && input.isConnected &&
            pendingSelections.get(panel) === token;
        buttons.forEach(button => { button.disabled = true; });
        status(panel, `Поиск: ${teamName}…`);

        try {
            const p = PROJECTS.find(item =>
                item.payment === teamName || item.vip === teamName);
            const searchTerms = [...new Set([
                // В отличие от "pay", фрагмент точного названия должен
                // сузить выдачу до нужной команды и не виртуализировать её.
                teamName.slice(0, -1),
                p?.name || '',
                'pay'
            ].filter(Boolean))];
            let suggestion = null;
            for (const term of searchTerms) {
                if (!isCurrent() || !sameConversation()) return;
                input.focus();
                searchInput(input, term);
                suggestion = findSuggestion(input, teamName) ||
                    await waitSuggestion(input, teamName, panel, token, term === searchTerms[0] ? 800 : 550);
                if (!isCurrent()) return;
                if (suggestion) break;
            }

            if (!suggestion?.isConnected) {
                status(panel, `Не вижу «${teamName}» в DOM-подсказках. Выбери вручную.`, 'error');
                return;
            }
            if (!sameConversation()) return;

            // Нажимаем сам DOM-пункт, а не просто заполняем поле текстом.
            status(panel, `Выбираю: ${teamName}…`);
            triggerOptionSelection(suggestion);

            let committed = false;
            for (let i = 0; i < 14; i++) {
                await wait(65);
                if (!isCurrent()) return;
                if (norm(input.value) === norm(teamName)) {
                    committed = true;
                    break;
                }
            }
            if (!committed) {
                status(panel, `Пункт «${teamName}» найден, но выбор не подтвердился.`, 'error');
                return;
            }
            if (!sameConversation()) {
                status(panel, 'Разговор изменился. Приоритет не тронут.', 'error');
                return;
            }

            const form = input.closest('form');
            const result = form ? updatePriority(form, tier) : 'missing';
            const priorityText = tier === 'vip' ? 'Срочный' :
                tier === 'privip' ? 'Высокий' : '';
            if (result === 'updated') {
                status(panel, `✓ ${teamName} · приоритет: ${priorityText}`, 'success');
            } else if (result === 'unchanged') {
                status(panel, `✓ ${teamName} · приоритет не изменён`, 'success');
            } else {
                status(panel, `✓ ${teamName}, проверь приоритет вручную`, 'error');
            }
        } catch (error) {
            console.error('[HelpDesk Workflow] Selection error:', error);
            if (isCurrent()) {
                // Пользователь увидит конкретное исключение, а не общий текст.
                const reason = String(error?.message || error).slice(0, 120);
                status(panel, `Ошибка выбора: ${reason}`, 'error');
            }
        } finally {
            if (isCurrent()) buttons.forEach(button => { button.disabled = false; });
        }
    }

    // Also handle a REAL human click on a HelpDesk autocomplete option.
    // This is a safe fallback if the user has to pick the displayed option
    // manually: priority follows only when the chosen team matches the chat.
    let manualSelectTimer = null;
    function onManualTeamOption(event) {
        if (!event.isTrusted || !(event.target instanceof Element) ||
            event.target.closest(`.${PANEL_CLASS}`)) return;
        const form = getHelpdeskForm();
        if (!form) return;
        const teamField = fieldUnderLabel(form, isTeam,
            'input[type="text"],input[type="search"],input:not([type])')?.field;
        if (!teamField || !form.contains(event.target)) return;

        const names = PROJECTS.flatMap(p => [p.payment, p.vip]);
        let node = event.target;
        let selectedName = null;
        for (let i = 0; i < 4 && node && node !== form; i++, node = node.parentElement) {
            selectedName = names.find(n => norm(n) === norm(node.textContent));
            if (selectedName) break;
        }
        if (!selectedName) return;

        const ctx = getContext();
        let tier = '';
        if (ctx) {
            const project = projectMap.get(norm(ctx.project));
            const required = ctx.tier === 'regular' ? project?.payment : project?.vip;
            if (selectedName !== required) return;
            tier = ctx.tier;
        } else {
            const panel = form.querySelector(`.${PANEL_CLASS}`);
            const project = PROJECTS.find(p => p.vip === selectedName);
            tier = project ? (panel?.querySelector('[data-role="manual-tier"]')?.value || '') : 'regular';
        }

        const conversationId = getHelpdeskId();
        clearTimeout(manualSelectTimer);
        manualSelectTimer = setTimeout(() => {
            if (!teamField.isConnected || getHelpdeskId() !== conversationId ||
                norm(teamField.value) !== norm(selectedName)) return;
            if (ctx) {
                const fresh = getContext();
                if (!fresh || fresh.id !== ctx.id || fresh.tier !== ctx.tier ||
                    fresh.project !== ctx.project) return;
            }
            const result = updatePriority(form, tier);
            const panel = form.querySelector(`.${PANEL_CLASS}`);
            if (panel && (result === 'updated' || result === 'unchanged')) {
                status(panel, `✓ Выбрано вручную: ${selectedName}`, 'success');
            }
        }, 170);
    }

    function makeButton(text, className, team, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        if (team) button.dataset.team = team;
        button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); handler(); });
        return button;
    }

    function createPanel(input) {
        const panel = document.createElement('section');
        panel.className = PANEL_CLASS;
        panel._hdwInput = input;
        panel._contextKey = null;
        const top = document.createElement('div');
        top.className = 'hdw-top';
        const title = document.createElement('span');
        title.className = 'hdw-title';
        title.textContent = '⚡ Payment';
        const badge = document.createElement('span');
        badge.className = 'hdw-badge';
        badge.dataset.role = 'badge';
        const suggested = makeButton('Payment', '', '', () => {});
        suggested.dataset.role = 'suggested';
        suggested.dataset.team = '';
        const hint = document.createElement('span');
        hint.className = 'hdw-hint';
        hint.dataset.role = 'hint';
        const toggle = makeButton('Выбрать вручную', 'hdw-toggle', '', () => {
            panel._manualOpen = !panel._manualOpen;
            panel.querySelector('.hdw-manual').hidden = !panel._manualOpen;
            toggle.textContent = panel._manualOpen ? 'Скрыть' : 'Выбрать вручную';
        });
        toggle.dataset.role = 'toggle';
        top.append(title, badge, suggested, hint, toggle);

        const manual = document.createElement('div');
        manual.className = 'hdw-manual';
        const manualTop = document.createElement('div');
        manualTop.className = 'hdw-manual-top';
        const tierLabel = document.createElement('label');
        tierLabel.textContent = 'При выборе VIP:';
        const tierChoice = document.createElement('select');
        tierChoice.setAttribute('aria-label', 'Категория ручного VIP выбора');
        tierChoice.innerHTML = `
            <option value="">Приоритет не менять</option>
            <option value="privip">PriVIP → Высокий</option>
            <option value="vip">VIP → Срочный</option>
        `;
        tierChoice.dataset.role = 'manual-tier';
        manualTop.append(tierLabel, tierChoice);
        const grid = document.createElement('div');
        grid.className = 'hdw-grid';
        for (const p of PROJECTS) {
            const row = document.createElement('div');
            row.className = 'hdw-project';
            const name = document.createElement('span');
            name.className = 'hdw-project-name';
            name.textContent = p.name;
            const actions = document.createElement('div');
            actions.className = 'hdw-actions';
            actions.append(
                makeButton('Payment', '', p.payment, () => chooseTeam(panel, input, p.payment, 'regular')),
                makeButton('VIP', 'hdw-vip', p.vip, () => chooseTeam(panel, input, p.vip, tierChoice.value))
            );
            row.append(name, actions);
            grid.append(row);
        }
        manual.append(manualTop, grid);
        const feedback = document.createElement('div');
        feedback.className = 'hdw-status';
        feedback.setAttribute('role', 'status');
        panel.append(top, manual, feedback);
        return panel;
    }

    function renderPanel(panel) {
        const input = panel._hdwInput;
        if (!input?.isConnected) return;
        const ctx = getContext();
        const key = ctx ? `${ctx.id}|${ctx.project}|${ctx.tier}` : `missing:${getHelpdeskId()}`;
        if (panel._contextKey === key) return;
        panel._contextKey = key;
        pendingSelections.set(panel, null);
        const badge = panel.querySelector('[data-role="badge"]');
        const suggested = panel.querySelector('[data-role="suggested"]');
        const hint = panel.querySelector('[data-role="hint"]');
        const toggle = panel.querySelector('[data-role="toggle"]');
        const manual = panel.querySelector('.hdw-manual');
        status(panel, '');
        if (ctx) {
            const project = projectMap.get(norm(ctx.project));
            const vip = ctx.tier !== 'regular';
            const team = vip ? project.vip : project.payment;
            const tierLabel = ctx.tier === 'vip' ? 'VIP' : ctx.tier === 'privip' ? 'PriVIP' : 'Regular';
            badge.textContent = `${project.name} · ${tierLabel}`;
            badge.className = `hdw-badge ${ctx.tier}`;
            suggested.hidden = false;
            suggested.textContent = team;
            suggested.dataset.team = team;
            suggested.className = vip ? 'hdw-vip' : '';
            suggested.onclick = e => {
                e.preventDefault(); e.stopPropagation();
                chooseTeam(panel, input, team, ctx.tier, key);
            };
            hint.textContent = ctx.tier === 'vip' ? '→ Срочный' :
                ctx.tier === 'privip' ? '→ Высокий' : '→ без изменения';
            panel._manualOpen = false;
        } else {
            badge.textContent = 'Проект не определён';
            badge.className = 'hdw-badge';
            suggested.hidden = true;
            suggested.dataset.team = '';
            suggested.onclick = null;
            hint.textContent = '';
            // This is the key fix: show functional buttons even without Chatwoot context.
            panel._manualOpen = true;
            requestFromParent();
        }
        manual.hidden = !panel._manualOpen;
        toggle.textContent = panel._manualOpen ? 'Скрыть' : 'Выбрать вручную';
    }

    function mountPanels() {
        const forms = [...document.querySelectorAll('form')];
        for (const form of forms) {
            const team = fieldUnderLabel(form, isTeam,
                'input[type="text"],input[type="search"],input:not([type])') ||
                (() => {
                    const input = form.querySelector('input[placeholder="Начните вводить название"]');
                    return input ? { label: input.parentElement?.parentElement?.querySelector('label'), field: input } : null;
                })();
            if (!team?.field || !team.label) continue;
            const host = team.label.parentElement;
            if (!host) continue;
            let panel = [...host.children].find(el => el.classList?.contains(PANEL_CLASS));
            if (panel && panel._hdwInput !== team.field) { panel.remove(); panel = null; }
            if (!panel) panel = createPanel(team.field);
            // Always place directly under label Команда, before input.
            if (team.label.nextElementSibling !== panel) team.label.insertAdjacentElement('afterend', panel);
            renderPanel(panel);
        }
    }

    // --- Private Note AutoResize. The sample has no textarea[name]. ---
    function getNotes() {
        const found = new Set(document.querySelectorAll('textarea[name="privateNote"]'));
        for (const form of document.querySelectorAll('form')) {
            const note = fieldUnderLabel(form, isNote, 'textarea');
            if (note?.field) found.add(note.field);
        }
        return [...found];
    }

    function resizeNote(el) {
        if (!el?.isConnected || !visible(el)) return;
        const previous = el.scrollTop;
        el.style.setProperty('height', 'auto', 'important');
        const full = el.scrollHeight + 2;
        const target = Math.min(NOTE_MAX, Math.max(NOTE_MIN, full));
        el.style.setProperty('height', `${target}px`, 'important');
        el.style.setProperty('overflow-y', full > NOTE_MAX ? 'auto' : 'hidden', 'important');
        if (full > NOTE_MAX) el.scrollTop = previous;
    }

    function registerNote(el) {
        if (observedNotes.has(el)) return;
        observedNotes.add(el);
        el.classList.add(NOTE_CLASS);
        let previousValue = el.value;
        el.addEventListener('input', () => { previousValue = el.value; resizeNote(el); });
        el.addEventListener('paste', () => { requestAnimationFrame(() => resizeNote(el)); setTimeout(() => resizeNote(el), 50); });
        el.addEventListener('cut', () => requestAnimationFrame(() => resizeNote(el)));
        const timer = setInterval(() => {
            if (!el.isConnected) { clearInterval(timer); return; }
            if (previousValue !== el.value) { previousValue = el.value; resizeNote(el); }
        }, 250);
        resizeNote(el);
    }

    function scan() {
        syncChat();
        mountPanels();
        for (const note of getNotes()) registerNote(note);
        if (getHelpdeskForm() && !getContext()) requestFromParent();
    }

    function scheduleScan() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scan, 140);
    }

    function start() {
        scan();
        new MutationObserver(mutations => {
            if (mutations.some(m => {
                if (!m.addedNodes.length && !m.removedNodes.length) return false;
                const node = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                return !node?.closest(`.${PANEL_CLASS}`);
            })) scheduleScan();
        }).observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('mousedown', onManualTeamOption, true);
        window.addEventListener('resize', () => getNotes().forEach(resizeNote));
        window.addEventListener('hashchange', scheduleScan);
        window.addEventListener('popstate', scheduleScan);
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener(STORAGE_LAST, scheduleScan);
        }
        setInterval(scan, 1700);
        console.info(`[HelpDesk Workflow] v${VERSION}: portal-aware dropdown selection`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
