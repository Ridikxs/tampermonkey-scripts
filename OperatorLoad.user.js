// ==UserScript==
// @name         Operator Load
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Live-мониторинг открытых чатов операторов через API Chatwoot.
// @author       Will
// @match        https://sparkmoth.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OperatorLoad.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OperatorLoad.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const CONFIG = {
        accountId: 1,
        refreshInterval: 2000,
        agentsInterval: 60000,
        requestTimeout: 8000,
        panelId: 'will-operator-load-panel',
        visibleLimit: 4
    };

    const API = {
        agents: `/api/v1/accounts/${CONFIG.accountId}/agents`,
        metrics:
            `/api/v2/accounts/${CONFIG.accountId}/live_reports/grouped_conversation_metrics?group_by=assignee_id`
    };

    const names = new Map();
    const cards = new Map();

    let panel = null;
    let latestMetrics = [];
    let busy = false;
    let nextAgentsRefresh = 0;
    let lastSuccess = 0;
    let expanded = false;

    // =====================================================
    // CSS
    // =====================================================

    GM_addStyle(`

        #${CONFIG.panelId} {
            display: flex;
            flex-direction: column;
            gap: 7px;
            padding: 9px 10px;

            background: var(--n-solid-2, #fff);

            border-bottom:
                1px solid var(--n-slate-3, #e2e8f0);

            overflow: visible;
        }

        #${CONFIG.panelId} .ol-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;

            font-size: 10px;
            font-weight: 700;
            letter-spacing: .35px;

            color: var(--n-slate-11, #64748b);
        }

        #${CONFIG.panelId} .ol-live {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            white-space: nowrap;
            font-size: 10px;
        }

        #${CONFIG.panelId} .ol-dot {
            width: 6px;
            height: 6px;
            flex-shrink: 0;
            border-radius: 50%;

            background: #22c55e;

            box-shadow:
                0 0 6px rgba(34,197,94,.5);
        }

        #${CONFIG.panelId}.ol-error .ol-dot {
            background: #ef4444;
            box-shadow: none;
        }

        #${CONFIG.panelId}.ol-loading .ol-dot {
            background: #f59e0b;
            box-shadow: none;
        }

        #${CONFIG.panelId} .ol-grid {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            overflow: visible;
        }

        #${CONFIG.panelId} .ol-card {
            position: relative;

            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 7px;

            min-width: 68px;
            max-width: 130px;

            padding: 5px 6px;

            border-radius: 7px;

            background: var(--n-slate-3, #f1f5f9);

            border:
                1px solid var(--n-slate-5, #e2e8f0);

            transition:
                background-color .2s ease,
                border-color .2s ease,
                box-shadow .2s ease;

            user-select: none;
        }

        #${CONFIG.panelId} .ol-card.ol-hidden {
            display: none !important;
        }

        #${CONFIG.panelId} .ol-card:hover {
            border-color: #60a5fa;

            box-shadow:
                0 2px 8px rgba(59,130,246,.10);
        }

        #${CONFIG.panelId} .ol-name {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            color: var(--n-slate-12, #0f172a);

            font-size: 10px;
            font-weight: 650;
        }

        #${CONFIG.panelId} .ol-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            min-width: 21px;
            height: 21px;
            padding: 0 5px;

            border-radius: 5px;

            font-size: 12px;
            font-weight: 800;

            font-variant-numeric: tabular-nums;

            transition:
                color .2s ease,
                background-color .2s ease;
        }

        /* ZERO */

        #${CONFIG.panelId} .ol-zero .ol-count {
            color: #64748b;
            background: rgba(148,163,184,.16);
        }

        /* GREEN: 1-2 */

        #${CONFIG.panelId} .ol-low .ol-count {
            color: #15803d;
            background: rgba(34,197,94,.16);
        }

        /* YELLOW: 3 */

        #${CONFIG.panelId} .ol-medium .ol-count {
            color: #b45309;
            background: rgba(245,158,11,.20);
        }

        /* RED: 4+ */

        #${CONFIG.panelId} .ol-high .ol-count {
            color: #dc2626;
            background: rgba(239,68,68,.17);
        }

        /* SHOW MORE */

        #${CONFIG.panelId} .ol-toggle-wrap {
            display: flex;
            justify-content: center;
            width: 100%;
        }

        #${CONFIG.panelId} .ol-toggle {
            display: none;

            align-items: center;
            justify-content: center;
            gap: 5px;

            width: 100%;

            padding: 5px 8px;

            border: 0;
            border-radius: 6px;

            background: rgba(59,130,246,.08);

            color: #3b82f6;

            font-size: 10px;
            font-weight: 700;

            cursor: pointer;

            transition:
                background-color .15s ease,
                color .15s ease;
        }

        #${CONFIG.panelId} .ol-toggle:hover {
            background: rgba(59,130,246,.15);
        }

        #${CONFIG.panelId} .ol-toggle.ol-visible {
            display: inline-flex;
        }

        /* FLOATING CHANGE INDICATOR */

        #${CONFIG.panelId} .ol-change {
            position: absolute;
            top: -12px;
            right: 1px;
            z-index: 20;

            display: inline-flex;
            align-items: center;
            justify-content: center;

            min-width: 20px;
            padding: 2px 5px;

            border-radius: 5px;

            font-size: 11px;
            font-weight: 900;
            color: white;

            pointer-events: none;
            white-space: nowrap;

            animation: olFloatChange 1.3s ease-out forwards;
        }

        #${CONFIG.panelId} .ol-change.positive {
            background: #22c55e;
            box-shadow: 0 2px 9px rgba(34,197,94,.4);
        }

        #${CONFIG.panelId} .ol-change.negative {
            background: #64748b;
            box-shadow: 0 2px 8px rgba(100,116,139,.25);
        }

        @keyframes olFloatChange {
            0% {
                opacity: 0;
                transform: translateY(7px) scale(.75);
            }

            15% {
                opacity: 1;
                transform: translateY(0) scale(1.12);
            }

            35% {
                opacity: 1;
                transform: translateY(-3px) scale(1);
            }

            75% {
                opacity: 1;
            }

            100% {
                opacity: 0;
                transform: translateY(-17px) scale(.9);
            }
        }

        /* COUNT POP */

        #${CONFIG.panelId} .ol-count.count-pop {
            animation: olCountPop .45s ease;
        }

        @keyframes olCountPop {
            0% { transform: scale(1); }
            35% { transform: scale(1.32); }
            65% { transform: scale(.95); }
            100% { transform: scale(1); }
        }

        /* NEW CHAT FLASH */

        #${CONFIG.panelId} .ol-card.chat-added {
            animation: olCardFlash .85s ease-out;
        }

        @keyframes olCardFlash {
            0% {
                border-color: #22c55e;
                box-shadow: 0 0 0 0 rgba(34,197,94,.5);
            }

            40% {
                border-color: #22c55e;
                box-shadow: 0 0 0 3px rgba(34,197,94,.18);
            }

            100% {
                box-shadow: 0 0 0 0 transparent;
            }
        }

        /* DARK THEME */

        .dark #${CONFIG.panelId},
        [data-theme="dark"] #${CONFIG.panelId} {
            background: #171e2c;
            border-bottom-color: #334155;
        }

        .dark #${CONFIG.panelId} .ol-card,
        [data-theme="dark"] #${CONFIG.panelId} .ol-card {
            background: #222e42;
            border-color: #36465f;
        }

        .dark #${CONFIG.panelId} .ol-name,
        [data-theme="dark"] #${CONFIG.panelId} .ol-name {
            color: #ffffff;
        }

        .dark #${CONFIG.panelId} .ol-zero .ol-count,
        [data-theme="dark"] #${CONFIG.panelId} .ol-zero .ol-count {
            color: #94a3b8;
        }

        .dark #${CONFIG.panelId} .ol-low .ol-count,
        [data-theme="dark"] #${CONFIG.panelId} .ol-low .ol-count {
            color: #4ade80;
        }

        .dark #${CONFIG.panelId} .ol-medium .ol-count,
        [data-theme="dark"] #${CONFIG.panelId} .ol-medium .ol-count {
            color: #fbbf24;
        }

        .dark #${CONFIG.panelId} .ol-high .ol-count,
        [data-theme="dark"] #${CONFIG.panelId} .ol-high .ol-count {
            color: #f87171;
        }

        .dark #${CONFIG.panelId} .ol-toggle,
        [data-theme="dark"] #${CONFIG.panelId} .ol-toggle {
            background: rgba(96,165,250,.10);
            color: #60a5fa;
        }

        .dark #${CONFIG.panelId} .ol-toggle:hover,
        [data-theme="dark"] #${CONFIG.panelId} .ol-toggle:hover {
            background: rgba(96,165,250,.18);
        }

        @media (prefers-reduced-motion: reduce) {
            #${CONFIG.panelId} *,
            #${CONFIG.panelId} *::before,
            #${CONFIG.panelId} *::after {
                animation: none !important;
                transition: none !important;
            }
        }

    `);

    // =====================================================
    // AUTHORIZATION
    // =====================================================

    function getSessionHeaders() {

        const prefix = 'cw_d_session_info=';

        const cookie = document.cookie
            .split(';')
            .map(item => item.trim())
            .find(item => item.startsWith(prefix));

        if (!cookie) {
            throw new Error('SESSION_NOT_FOUND');
        }

        let session;

        try {

            session = JSON.parse(
                decodeURIComponent(cookie.slice(prefix.length))
            );

        } catch {

            throw new Error('SESSION_INVALID');

        }

        const accessToken = session['access-token'];
        const client = session['client'];
        const uid = session['uid'];

        if (!accessToken || !client || !uid) {
            throw new Error('SESSION_HEADERS_MISSING');
        }

        return {
            'access-token': String(accessToken),
            'client': String(client),
            'uid': String(uid),
            'Accept': 'application/json'
        };
    }

    // =====================================================
    // API CLIENT
    // =====================================================

    async function apiGet(url) {

        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.requestTimeout
        );

        try {

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: getSessionHeaders(),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`API_${response.status}`);
            }

            return await response.json();

        } finally {

            clearTimeout(timeout);

        }
    }

    function extractArray(response) {

        if (Array.isArray(response)) {
            return response;
        }

        if (Array.isArray(response?.payload)) {
            return response.payload;
        }

        if (Array.isArray(response?.data)) {
            return response.data;
        }

        if (Array.isArray(response?.payload?.data)) {
            return response.payload.data;
        }

        throw new Error('INVALID_API_RESPONSE');
    }

    // =====================================================
    // AGENTS
    // =====================================================

    async function loadAgents() {

        const response = await apiGet(API.agents);

        const agents = extractArray(response);

        const updated = new Map();

        for (const agent of agents) {

            const id = Number(agent.id);

            if (!Number.isInteger(id)) continue;

            const name = String(
                agent.available_name ||
                agent.name ||
                `Оператор #${id}`
            ).trim();

            updated.set(id, name);
        }

        if (!updated.size) {
            throw new Error('EMPTY_AGENTS');
        }

        names.clear();

        for (const [id, name] of updated) {
            names.set(id, name);
        }

        nextAgentsRefresh =
            Date.now() + CONFIG.agentsInterval;

        for (const [id, card] of cards) {

            const name = names.get(id);

            if (name && card.name.textContent !== name) {
                card.name.textContent = name;
            }
        }
    }

    // =====================================================
    // LIVE METRICS
    // =====================================================

    async function loadMetrics() {

        const response = await apiGet(API.metrics);

        const metrics = extractArray(response);

        return metrics
            .map(item => ({
                id: Number(item.assignee_id),
                count: Number(item.open),
                unattended: Number(item.unattended || 0)
            }))
            .filter(item =>
                Number.isInteger(item.id) &&
                item.id > 0 &&
                Number.isInteger(item.count) &&
                item.count >= 0
            );
    }

    // =====================================================
    // PANEL
    // =====================================================

    function findHeader() {

        const title = [
            ...document.querySelectorAll('h1')
        ].find(el =>
            el.textContent.trim() === 'Диалоги' ||
            el.getAttribute('title') === 'Диалоги'
        );

        return title?.closest(
            'div.flex.items-center.justify-between'
        ) || null;
    }

    function ensurePanel() {

        const header = findHeader();

        if (!header) return null;

        let current = document.getElementById(
            CONFIG.panelId
        );

        if (!current) {

            current = document.createElement('div');

            current.id = CONFIG.panelId;

            const top = document.createElement('div');
            top.className = 'ol-top';

            const label = document.createElement('span');
            label.textContent = 'НАГРУЗКА ОПЕРАТОРОВ';

            const live = document.createElement('span');
            live.className = 'ol-live';

            const dot = document.createElement('span');
            dot.className = 'ol-dot';

            const status = document.createElement('span');
            status.className = 'ol-status';
            status.textContent = 'Подключение...';

            live.append(dot, status);
            top.append(label, live);

            const grid = document.createElement('div');
            grid.className = 'ol-grid';

            const toggleWrap = document.createElement('div');
            toggleWrap.className = 'ol-toggle-wrap';

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'ol-toggle';
            toggle.textContent = 'Показать ещё';

            toggle.addEventListener('click', () => {

                expanded = !expanded;

                applyCollapseState();

            });

            toggleWrap.appendChild(toggle);

            current.append(
                top,
                grid,
                toggleWrap
            );

            cards.clear();
        }

        if (current.previousElementSibling !== header) {
            header.after(current);
        }

        panel = current;

        return current;
    }

    function setStatus(type, message) {

        const current = ensurePanel();

        if (!current) return;

        current.classList.toggle(
            'ol-error',
            type === 'error'
        );

        current.classList.toggle(
            'ol-loading',
            type === 'loading'
        );

        const status = current.querySelector('.ol-status');

        if (status && status.textContent !== message) {
            status.textContent = message;
        }
    }

    // =====================================================
    // LOAD COLORS
    // =====================================================

    function getLoadClass(count) {

        if (count === 0) return 'ol-zero';

        if (count <= 2) return 'ol-low';

        if (count === 3) return 'ol-medium';

        return 'ol-high';
    }

    // =====================================================
    // CARDS
    // =====================================================

    function createCard(operator) {

        const element = document.createElement('div');

        element.className =
            `ol-card ${getLoadClass(operator.count)}`;

        const name = document.createElement('span');

        name.className = 'ol-name';

        name.textContent =
            names.get(operator.id) ||
            `Оператор #${operator.id}`;

        const count = document.createElement('span');

        count.className = 'ol-count';

        count.textContent = operator.count;

        element.append(name, count);

        const data = {
            element,
            name,
            countElement: count,
            count: operator.count,
            timer: null
        };

        cards.set(operator.id, data);

        return data;
    }

    // =====================================================
    // +1 / -1 ANIMATION
    // =====================================================

    function animateChange(card, delta) {

        const element = card.element;
        const count = card.countElement;

        element.querySelectorAll('.ol-change')
            .forEach(node => node.remove());

        clearTimeout(card.timer);

        const indicator = document.createElement('span');

        indicator.className =
            `ol-change ${delta > 0 ? 'positive' : 'negative'}`;

        indicator.textContent =
            delta > 0 ? `+${delta}` : `${delta}`;

        element.appendChild(indicator);

        count.classList.remove('count-pop');
        element.classList.remove('chat-added');

        void count.offsetWidth;

        count.classList.add('count-pop');

        if (delta > 0) {
            element.classList.add('chat-added');
        }

        indicator.addEventListener(
            'animationend',
            () => indicator.remove(),
            { once: true }
        );

        card.timer = setTimeout(() => {

            count.classList.remove('count-pop');
            element.classList.remove('chat-added');

            indicator.remove();

        }, 1400);
    }

    // =====================================================
    // UPDATE CARD WITHOUT RECREATING IT
    // =====================================================

    function updateCard(operator) {

        let card = cards.get(operator.id);

        if (!card) {
            return createCard(operator);
        }

        const name =
            names.get(operator.id) ||
            `Оператор #${operator.id}`;

        if (card.name.textContent !== name) {
            card.name.textContent = name;
        }

        const delta = operator.count - card.count;

        if (delta === 0) return card;

        card.count = operator.count;

        card.countElement.textContent = operator.count;

        card.element.classList.remove(
            'ol-zero',
            'ol-low',
            'ol-medium',
            'ol-high'
        );

        card.element.classList.add(
            getLoadClass(operator.count)
        );

        animateChange(card, delta);

        return card;
    }

    // =====================================================
    // COLLAPSE / EXPAND
    // =====================================================

    function applyCollapseState(total = latestMetrics.length) {

        const current = document.getElementById(
            CONFIG.panelId
        );

        if (!current) return;

        const grid = current.querySelector('.ol-grid');
        const toggle = current.querySelector('.ol-toggle');

        if (!grid || !toggle) return;

        const cardElements = [
            ...grid.querySelectorAll('.ol-card')
        ];

        const hasExtra =
            total > CONFIG.visibleLimit;

        cardElements.forEach((card, index) => {

            const shouldHide =
                !expanded &&
                index >= CONFIG.visibleLimit;

            card.classList.toggle(
                'ol-hidden',
                shouldHide
            );
        });

        toggle.classList.toggle(
            'ol-visible',
            hasExtra
        );

        if (!hasExtra) {

            expanded = false;

            toggle.textContent = 'Показать ещё';

            return;
        }

        const hiddenCount =
            Math.max(
                0,
                total - CONFIG.visibleLimit
            );

        toggle.textContent = expanded
            ? 'Скрыть'
            : `Показать ещё · ${hiddenCount}`;
    }

    // =====================================================
    // RENDER
    // =====================================================

    function render(metrics) {

        latestMetrics = metrics;

        const current = ensurePanel();

        if (!current) return;

        const grid = current.querySelector('.ol-grid');

        const sorted = [...metrics].sort((a, b) =>
            b.count - a.count ||
            (names.get(a.id) || '').localeCompare(
                names.get(b.id) || ''
            )
        );

        const activeIds = new Set(
            sorted.map(item => item.id)
        );

        for (const [id, card] of cards) {

            if (!activeIds.has(id)) {

                clearTimeout(card.timer);

                card.element.remove();

                cards.delete(id);
            }
        }

        sorted.forEach((operator, index) => {

            const card = updateCard(operator);

            card.element.title =
                `${names.get(operator.id) || operator.id}\n` +
                `Открыто: ${operator.count}\n` +
                `Без ответа: ${operator.unattended}`;

            if (grid.children[index] !== card.element) {

                grid.insertBefore(
                    card.element,
                    grid.children[index] || null
                );
            }
        });

        applyCollapseState(sorted.length);
    }

    // =====================================================
    // LIVE UPDATE
    // =====================================================

    async function updateLiveData() {

        if (busy) return;

        busy = true;

        try {

            if (
                !names.size ||
                Date.now() >= nextAgentsRefresh
            ) {

                try {

                    await loadAgents();

                } catch (error) {

                    console.warn(
                        '[Operator Load] Agents:',
                        error.message
                    );

                    nextAgentsRefresh =
                        Date.now() + 15000;
                }
            }

            const metrics = await loadMetrics();

            render(metrics);

            lastSuccess = Date.now();

            setStatus('live', 'LIVE · 2 сек');

        } catch (error) {

            console.warn(
                '[Operator Load] Update:',
                error.message
            );

            const authError = [
                'API_401',
                'API_403',
                'SESSION_NOT_FOUND',
                'SESSION_INVALID',
                'SESSION_HEADERS_MISSING'
            ].includes(error.message);

            setStatus(
                'error',
                authError
                    ? 'Ожидание авторизации'
                    : 'Ошибка обновления'
            );

        } finally {

            busy = false;
        }
    }

    // =====================================================
    // VUE DOM RECOVERY
    // =====================================================

    let mountScheduled = false;

    function scheduleMount() {

        if (mountScheduled) return;

        mountScheduled = true;

        requestAnimationFrame(() => {

            mountScheduled = false;

            const oldPanel = panel;

            const current = ensurePanel();

            if (current && oldPanel !== current) {

                render(latestMetrics);

                setStatus(
                    lastSuccess &&
                    Date.now() - lastSuccess < 10000
                        ? 'live'
                        : 'loading',

                    lastSuccess &&
                    Date.now() - lastSuccess < 10000
                        ? 'LIVE · 2 сек'
                        : 'Подключение...'
                );
            }
        });
    }

    const observer = new MutationObserver(mutations => {

        const relevant = mutations.some(mutation => {

            const target = mutation.target;

            if (
                target.nodeType === Node.ELEMENT_NODE &&
                target.closest?.(`#${CONFIG.panelId}`)
            ) {
                return false;
            }

            const added = [...mutation.addedNodes];

            if (
                added.length &&
                added.every(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.id === CONFIG.panelId
                )
            ) {
                return false;
            }

            return (
                mutation.addedNodes.length > 0 ||
                mutation.removedNodes.length > 0
            );
        });

        if (relevant) {
            scheduleMount();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // =====================================================
    // START
    // =====================================================

    ensurePanel();

    setStatus('loading', 'Подключение...');

    updateLiveData();

    setInterval(
        updateLiveData,
        CONFIG.refreshInterval
    );

    console.log(
        '%c[Will] Operator Load v1.4 initialized',
        'color:#22c55e;font-weight:bold'
    );

})();