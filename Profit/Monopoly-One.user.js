// ==UserScript==
// @name         Monopoly-One Helper
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Автобросок, автооплата, пауза, подсветка и автоулучшения
// @match        https://monopoly-one.com/table*
// @grant        none
// @run-at       document-idle
// @updateURL https://github.com/Ridikxs/tampermonkey-scripts/raw/refs/heads/main/Profit/Monopoly-One.user.js
// @downloadURL https://github.com/Ridikxs/tampermonkey-scripts/raw/refs/heads/main/Profit/Monopoly-One.user.js
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '4.0';
    const LOG = '[Monopoly Helper]';

    /* ------------------------------------------------------------------
     * Константы
     * ------------------------------------------------------------------ */

    /* Ник по умолчанию. Можно сменить кнопкой «Ник» в панели. */
    const DEFAULT_NICK = '侍ジョー';

    const PAUSE_STORAGE_KEY = 'monopoly-helper-paused';
    const SETTINGS_STORAGE_KEY = 'monopoly-helper-settings-v1';
    /* Ключ тот же, что в v2.6: очередь A сохраняется при обновлении. */
    const AUTO_FIELDS_STORAGE_KEY = 'monopoly-helper-auto-fields-v4';

    const PLAYER_CARD_SELECTOR = '.table-body-players-card';
    const FIELD_SELECTOR = '.table-body-board-fields-one';
    const FIELD_CARD_SELECTOR = '.TableFieldcard';
    /*
     * Панель действий. На сайте она всегда есть в DOM, а когда действий нет
     * (или идёт отправка хода), получает класс _hidden и уезжает за экран:
     * кнопки в ней не нажимаем. Сами кнопки - прямые потомки
     * .TableAction-buttons; класс _action есть не у всех.
     */
    const ACTION_PANEL_SELECTOR = '.TableAction:not(._hidden)';
    const ACTION_BUTTON_SELECTOR =
        `${ACTION_PANEL_SELECTOR} .TableAction-buttons > div, ` +
        `${ACTION_PANEL_SELECTOR} .TableAction-buttons ._action`;
    const UI_SELECTOR = '#monopoly-helper-panel, #monopoly-helper-overlay';

    const HIDDEN_CARD_CLASS = 'monopoly-helper-hidden-card-mode';
    const PHANTOM_CARD_CLASS = 'monopoly-helper-phantom-card';

    const MAX_FIELD_LEVEL = 5;

    /* Пауза между автоматическими кликами. */
    const CLICK_COOLDOWN = 1500;
    /* Сколько раз подряд повторять клик, если кнопка не исчезла. */
    const MAX_CLICK_ATTEMPTS = 6;
    /* Сколько ждать изменения уровня поля после «Построить»/«Продать». */
    const LEVEL_WAIT = 1000;
    /* Если улучшение не удалось (например, нет денег), поле пропускается. */
    const FAIL_COOLDOWN = 8000;
    /* Столько неудач подряд (кнопка нажата, уровень не изменился)
       считаются признаком нехватки денег: остаток очереди пропускается. */
    const MAX_CONSECUTIVE_FAILURES = 2;
    /* Не чаще одного сканирования страницы за это время. */
    const MIN_SCAN_INTERVAL = 150;
    /* Если кнопка броска просто заменена новым элементом (без исчезновения),
       очередь A перезапускается не чаще, чем раз в это время. */
    const QUEUE_RERUN_MIN = 30000;
    /* Автопокупка: через сколько мс после появления предложения нажать
       «Купить», если игрок сам не отказался и не купил. */
    const AUTO_BUY_DELAY = 2000;
    /* Сколько раз нажимать «Купить», если предложение не закрылось. */
    const MAX_BUY_ATTEMPTS = 2;

    /*
     * По данным страницы строятся группы 1-8. Группа 0 (Mercedes, Audi,
     * Ford, Land Rover) и группа 9 (Rockstar, Rovio) не строятся.
     */
    const NON_BUILDABLE_GROUPS = new Set(['0', '9']);

    const OWNER_ATTRIBUTE_NAMES = [
        'mnpl-order', 'mnpl-owner', 'mnpl-player', 'mnpl-player-id', 'mnpl-player-index',
        'mnpl-index', 'data-owner', 'data-owner-id', 'data-player',
        'data-player-id', 'data-player-index'
    ];

    const DEFAULT_SETTINGS = {
        nick: DEFAULT_NICK,
        roll: true,      // автобросок
        pay: true,       // автооплата
        buy: true,       // автопокупка поля через AUTO_BUY_DELAY
        upgrade: true,   // автоулучшения (очередь A) перед броском
        sound: true,     // звук при предложении покупки
        collapsed: false, // свёрнутая панель
        upgradeAll: false, // улучшать все полные группы, а не только очередь A
        jail: 'roll',    // в тюрьме: 'roll' кубики, 'pay' платить, 'manual' вручную
        reserve: 0,      // сколько денег оставлять при автопокупке и стройке
        nickLocked: false // ник задан вручную и важнее аккаунта
    };

    const JAIL_MODES = ['roll', 'pay', 'manual'];
    const RESERVE_STEPS = [0, 500, 1000, 2000, 3000];

    /* ------------------------------------------------------------------
     * Хранилище и состояние
     * ------------------------------------------------------------------ */

    function loadSettings() {
        try {
            const parsed = JSON.parse(
                localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null'
            );

            const merged = {
                ...DEFAULT_SETTINGS,
                ...(parsed && typeof parsed === 'object' ? parsed : {})
            };

            if (!JAIL_MODES.includes(merged.jail)) {
                merged.jail = DEFAULT_SETTINGS.jail;
            }

            merged.reserve = Math.max(0, Number(merged.reserve) || 0);

            return merged;
        } catch (error) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(
                SETTINGS_STORAGE_KEY,
                JSON.stringify(settings)
            );
        } catch (error) {
            console.warn(LOG, 'Ошибка сохранения настроек:', error);
        }
    }

    function loadAutoFieldKeys() {
        try {
            const saved = sessionStorage.getItem(AUTO_FIELDS_STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];

            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            console.warn(LOG, 'Ошибка загрузки очереди A:', error);

            return new Set();
        }
    }

    function saveAutoFieldKeys() {
        try {
            sessionStorage.setItem(
                AUTO_FIELDS_STORAGE_KEY,
                JSON.stringify(Array.from(state.autoFieldKeys))
            );
        } catch (error) {
            console.warn(LOG, 'Ошибка сохранения очереди A:', error);
        }
    }

    const settings = loadSettings();

    const state = {
        paused: localStorage.getItem(PAUSE_STORAGE_KEY) === 'true',

        ownerId: null,
        ownerSource: '',

        highlightedFields: new Set(),
        controls: new Map(),          // ключ поля -> контейнер кнопок
        autoFieldKeys: loadAutoFieldKeys(),

        failedUntil: new Map(),       // ключ поля -> время, до которого пропускаем
        cardNames: new Map(),         // ключ поля -> имя его карточки

        quickActionRunning: false,
        preRollRunning: false,

        rollSeen: false,              // кнопка броска сейчас на экране
        rollEl: null,                 // её элемент (новый элемент = новый бросок)
        payEl: null,
        queueDone: false,             // очередь A уже запускалась для этого броска
        queueRanAt: 0,
        attempts: { roll: 0, pay: 0 },
        lastClickAt: { roll: 0, pay: 0 },
        rollRetryAt: 0,               // раньше этого времени бросок не повторяем

        purchaseAlerted: false,
        purchaseKey: '',
        buyTimer: 0,
        buyAttempts: 0,

        counters: { rolls: 0, pays: 0, jailPays: 0, buys: 0, builds: 0 },
        activity: null,               // последнее действие автоматики
        seenScreens: new Set(),       // экраны панели действий, уже записанные в консоль

        lastScanAt: 0,
        scanTimer: 0
    };

    /*
     * Сайт читает event.sourceCapabilities.firesTouchEvents без проверки
     * на null, а у синтетических событий sourceCapabilities равно null.
     */
    const fakeSourceCapabilities = (() => {
        try {
            if (typeof InputDeviceCapabilities === 'function') {
                return new InputDeviceCapabilities({
                    firesTouchEvents: false
                });
            }
        } catch (error) {
            console.debug(LOG, 'InputDeviceCapabilities недоступен:', error);
        }

        return { firesTouchEvents: false };
    })();

    /* ------------------------------------------------------------------
     * Утилиты
     * ------------------------------------------------------------------ */

    function sleep(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    /* Ждёт, пока predicate вернёт истину; возвращает её или null по таймауту. */
    async function waitFor(predicate, timeout, step = 30) {
        const startedAt = Date.now();

        for (;;) {
            const value = predicate();

            if (value) {
                return value;
            }

            if (Date.now() - startedAt >= timeout) {
                return null;
            }

            await sleep(step);
        }
    }

    function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    /* Наибольшее число в тексте: «Купить за 2,600» -> 2600. Нет числа -> null. */
    function parseAmount(text) {
        const numbers = String(text || '').match(/\d[\d\s,.\u00a0]*/g);

        if (!numbers) {
            return null;
        }

        const values = numbers
            .map(item => Number(item.replace(/\D/g, '')))
            .filter(Number.isFinite);

        return values.length ? Math.max(...values) : null;
    }

    function formatAmount(value) {
        return Number(value).toLocaleString('en-US');
    }

    /* Запись о действии автоматики: в консоль, в панель и в счётчики. */
    function note(text, counter) {
        state.activity = { text, at: Date.now() };

        if (counter) {
            state.counters[counter] = (state.counters[counter] || 0) + 1;
        }

        console.log(LOG, text);

        updateControlPanel();
    }

    function normalizeOwnerId(value) {
        const text = normalizeText(value);

        return /^\d+$/.test(text) ? String(Number(text)) : null;
    }

    /* ------------------------------------------------------------------
     * Игрок и owner ID
     * ------------------------------------------------------------------ */

    function getPlayerCards() {
        return Array.from(document.querySelectorAll(PLAYER_CARD_SELECTOR));
    }

    function getNickText(nickElement) {
        return Array.from(nickElement.childNodes)
            .filter(node => {
                return !(
                    node.nodeType === Node.ELEMENT_NODE &&
                    node.classList.contains('custom-me-badge')
                );
            })
            .map(node => node.textContent)
            .join('')
            .trim();
    }

    /* ID аккаунта, под которым открыта игра (его же использует сам сайт). */
    function getMyUserId() {
        try {
            const id = window.API && window.API.user && window.API.user.user_id;

            return id ? String(id) : '';
        } catch (error) {
            return '';
        }
    }

    function findCardByNick() {
        for (const card of getPlayerCards()) {
            const nickElement = card.querySelector('._nick div');

            if (nickElement && getNickText(nickElement) === settings.nick) {
                return card;
            }
        }

        return null;
    }

    /*
     * Моя карточка: сначала по аккаунту (#player_card_<user_id>), если ник
     * не задан вручную; иначе или если аккаунт не найден - по нику.
     */
    function findMyPlayerCard() {
        if (!settings.nickLocked) {
            const userId = getMyUserId();
            const byId = userId
                ? document.getElementById(`player_card_${userId}`)
                : null;

            if (byId) {
                return byId;
            }
        }

        return findCardByNick();
    }

    function getCardUserId(card) {
        const match = /^player_card_(\d+)$/.exec(card?.id || '');

        return match ? match[1] : '';
    }

    /* Фишка игрока получает mnpl-jailed="1", пока он сидит в тюрьме. */
    function isJailed() {
        const userId = getCardUserId(findMyPlayerCard());

        if (!userId) {
            return false;
        }

        return (
            document
                .getElementById(`player_token_${userId}`)
                ?.getAttribute('mnpl-jailed') === '1'
        );
    }

    function getMyMoney() {
        const element = findMyPlayerCard()?.querySelector(
            '.table-body-players-card-body-money'
        );

        return element ? parseAmount(element.textContent) : null;
    }

    function addPlayerBadge() {
        const card = findMyPlayerCard();

        /* Бейдж «Я» не должен оставаться на чужой карточке после смены ника. */
        document.querySelectorAll('.custom-me-badge').forEach(badge => {
            if (!card || !card.contains(badge)) {
                badge.remove();
            }
        });

        const nickElement = card?.querySelector('._nick div');

        if (!nickElement || nickElement.querySelector('.custom-me-badge')) {
            return;
        }

        const badge = document.createElement('span');

        badge.className = 'custom-me-badge';
        badge.textContent = 'Я';

        nickElement.appendChild(badge);
    }

    function detectOwnerFromAttributes(card) {
        for (const element of [card, ...card.querySelectorAll('*')]) {
            for (const name of OWNER_ATTRIBUTE_NAMES) {
                if (!element.hasAttribute(name)) {
                    continue;
                }

                const id = normalizeOwnerId(element.getAttribute(name));

                if (id !== null) {
                    return { id, source: `атрибут ${name}` };
                }
            }
        }

        return null;
    }

    function detectOwnerFromClasses(card) {
        const patterns = [
            /(?:^|\s)mnpl-player[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)player[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)player-index[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)owner[-_](\d+)(?:\s|$)/i
        ];

        for (const element of [card, ...card.querySelectorAll('*')]) {
            const className =
                typeof element.className === 'string' ? element.className : '';

            for (const pattern of patterns) {
                const match = className.match(pattern);

                if (match) {
                    return {
                        id: String(Number(match[1])),
                        source: 'класс карточки'
                    };
                }
            }
        }

        return null;
    }

    function detectOwnerId() {
        const myCard = findMyPlayerCard();

        if (!myCard) {
            return null;
        }

        const found =
            detectOwnerFromAttributes(myCard) ||
            detectOwnerFromClasses(myCard);

        if (found) {
            state.ownerId = found.id;
            state.ownerSource = found.source;

            return state.ownerId;
        }

        /*
         * Последний резерв: позиция карточки в DOM. Она не всегда равна
         * индексу игрока (порядок карточек на странице другой), поэтому
         * основной источник - атрибут mnpl-order.
         */
        const index = getPlayerCards().indexOf(myCard);

        if (index >= 0) {
            state.ownerId = String(index);
            state.ownerSource = 'порядок игроков';

            return state.ownerId;
        }

        return null;
    }

    function changeNick() {
        const answer = window.prompt(
            'Ваш ник на сайте (как в карточке игрока):',
            settings.nick
        );

        const nick = normalizeText(answer);

        if (!nick || nick === settings.nick) {
            return;
        }

        settings.nick = nick;
        settings.nickLocked = true;
        saveSettings();

        state.ownerId = null;
        state.ownerSource = '';

        scanPage();
    }

    /* ------------------------------------------------------------------
     * Поля
     * ------------------------------------------------------------------ */

    /*
     * Список полей и группы строятся один раз за «тик»: кэш сбрасывается
     * микрозадачей. Уровни и владельцы всегда читаются из DOM заново.
     */
    let fieldIndexCache = null;

    function getFieldIndex() {
        if (fieldIndexCache) {
            return fieldIndexCache;
        }

        const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR));
        const groups = new Map();

        for (const field of fields) {
            const group = getFieldGroup(field);

            if (!group) {
                continue;
            }

            if (!groups.has(group)) {
                groups.set(group, []);
            }

            groups.get(group).push(field);
        }

        fieldIndexCache = { fields, groups };

        queueMicrotask(() => {
            fieldIndexCache = null;
        });

        return fieldIndexCache;
    }

    function invalidateFieldIndex() {
        fieldIndexCache = null;
    }

    function getAllFields() {
        return getFieldIndex().fields;
    }

    function getFieldsInGroup(groupId) {
        return (groupId && getFieldIndex().groups.get(groupId)) || [];
    }

    function getFieldOwner(field) {
        return normalizeOwnerId(field.getAttribute('mnpl-owner'));
    }

    function getOwnedFields() {
        if (state.ownerId === null) {
            return [];
        }

        return getAllFields().filter(
            field => getFieldOwner(field) === state.ownerId
        );
    }

    function getFieldGroup(field) {
        return normalizeText(field?.getAttribute('mnpl-group'));
    }

    function getFieldLine(field) {
        return normalizeText(field?.getAttribute('mnpl-line'));
    }

    /*
     * Путь к логотипу бренда отличает поля с одинаковыми
     * mnpl-group и mnpl-line (например Badger и BlackBerry).
     */
    function getFieldLogoKey(field) {
        const logo = field?.querySelector(
            '.table-body-board-fields-one-body ._logo'
        );

        if (!logo) {
            return '';
        }

        const backgroundImage =
            logo.style.backgroundImage ||
            getComputedStyle(logo).backgroundImage ||
            '';

        const match = backgroundImage.match(/url\(["']?(.+?)["']?\)/);

        if (!match) {
            return '';
        }

        try {
            const url = new URL(match[1], window.location.href);

            return decodeURIComponent(url.pathname).toLowerCase();
        } catch (error) {
            return match[1].toLowerCase();
        }
    }

    /* Ключ с логотипом не меняется, поэтому кэшируется по элементу. */
    const fieldKeyCache = new WeakMap();

    function getFieldKey(field) {
        if (!field) {
            return '';
        }

        const cached = fieldKeyCache.get(field);

        if (cached) {
            return cached;
        }

        const group = getFieldGroup(field);
        const logoKey = getFieldLogoKey(field);

        if (group && logoKey) {
            const key = `${group}:${logoKey}`;

            fieldKeyCache.set(field, key);

            return key;
        }

        /* Резервный вариант для клетки без логотипа (не кэшируется). */
        const index = getAllFields().indexOf(field);

        if (index < 0) {
            return '';
        }

        return [group || 'field', getFieldLine(field) || 'line', index]
            .join(':');
    }

    function findFieldByKey(key) {
        if (!key) {
            return null;
        }

        return (
            getOwnedFields().find(field => getFieldKey(field) === key) || null
        );
    }

    function ownsFullGroup(field) {
        if (state.ownerId === null) {
            return false;
        }

        const groupId = getFieldGroup(field);

        if (!groupId || NON_BUILDABLE_GROUPS.has(groupId)) {
            return false;
        }

        const groupFields = getFieldsInGroup(groupId);

        /* Строительная группа содержит не менее двух полей. */
        return (
            groupFields.length >= 2 &&
            groupFields.every(item => getFieldOwner(item) === state.ownerId)
        );
    }

    function getFieldLevel(field) {
        const levelElement = field.querySelector(
            '.table-body-board-fields-one-level'
        );

        if (!levelElement) {
            return 0;
        }

        /* Главное здание = максимальный уровень. */
        if (levelElement.querySelector('._big, ._star_big')) {
            return MAX_FIELD_LEVEL;
        }

        /* Каждый _small = один филиал. */
        return levelElement.querySelectorAll('._small, ._star_small').length;
    }

    /*
     * Правила равномерной застройки:
     *  + только на минимальном уровне группы,
     *  − только на максимальном уровне группы,
     *  A на любом незавершённом поле полной группы.
     */
    function getActionAvailability(field) {
        const none = { upgrade: false, downgrade: false, auto: false };

        if (!field?.isConnected || !ownsFullGroup(field)) {
            return none;
        }

        const levels = getFieldsInGroup(getFieldGroup(field))
            .map(getFieldLevel);

        if (!levels.length) {
            return none;
        }

        const level = getFieldLevel(field);

        return {
            upgrade: level < MAX_FIELD_LEVEL && level === Math.min(...levels),
            downgrade: level > 0 && level === Math.max(...levels),
            auto: level < MAX_FIELD_LEVEL
        };
    }

    /* ------------------------------------------------------------------
     * Синтетические клики
     * ------------------------------------------------------------------ */

    const CLICK_SEQUENCE = [
        // тип события, buttons, detail
        ['pointerover', 0, 0],
        ['mouseover', 0, 0],
        ['pointermove', 0, 0],
        ['mousemove', 0, 0],
        ['pointerdown', 1, 1],
        ['mousedown', 1, 1],
        ['pointerup', 0, 1],
        ['mouseup', 0, 1],
        ['click', 0, 1]
    ];

    function patchSourceCapabilities(event) {
        if (event.sourceCapabilities) {
            return event;
        }

        try {
            Object.defineProperty(event, 'sourceCapabilities', {
                configurable: true,
                value: fakeSourceCapabilities
            });
        } catch (error) {
            console.debug(LOG, 'sourceCapabilities:', error);
        }

        return event;
    }

    function createInputEvent(type, x, y, buttons, detail) {
        const isPointer = type.startsWith('pointer');

        if (isPointer && typeof PointerEvent !== 'function') {
            return null;
        }

        const init = {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX: x,
            clientY: y,
            screenX: window.screenX + x,
            screenY: window.screenY + y,
            button: 0,
            buttons,
            detail
        };

        if (isPointer) {
            Object.assign(init, {
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                width: 1,
                height: 1,
                pressure: buttons ? 0.5 : 0
            });
        }

        return patchSourceCapabilities(
            isPointer ? new PointerEvent(type, init) : new MouseEvent(type, init)
        );
    }

    function dispatchClickSequence(target, x, y) {
        if (!(target instanceof Element)) {
            return false;
        }

        try {
            for (const [type, buttons, detail] of CLICK_SEQUENCE) {
                const event = createInputEvent(type, x, y, buttons, detail);

                if (event) {
                    target.dispatchEvent(event);
                }
            }

            /* После клика сайт мог перерисовать DOM. */
            invalidateFieldIndex();

            return true;
        } catch (error) {
            console.error(LOG, 'Ошибка клика:', error);

            return false;
        }
    }

    /*
     * useHitTarget = true: клик уходит в элемент, реально находящийся
     * под центром кнопки (как при настоящем нажатии мышью).
     */
    function clickElement(element, useHitTarget) {
        if (!(element instanceof HTMLElement) || !element.isConnected) {
            return false;
        }

        const rect = element.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        let target = element;

        if (useHitTarget) {
            const hit = document.elementFromPoint(x, y);

            if (hit && element.contains(hit)) {
                target = hit;
            }
        }

        return dispatchClickSequence(target, x, y);
    }

    /* ------------------------------------------------------------------
     * Карточка поля
     * ------------------------------------------------------------------ */

    function getCurrentFieldCard() {
        return document.querySelector(FIELD_CARD_SELECTOR);
    }

    function getCardName(card) {
        return normalizeText(
            card?.querySelector('.TableFieldcard-top-main')?.textContent
        );
    }

    function getCardSignature(card) {
        if (!card) {
            return '';
        }

        const actions = Array.from(
            card.querySelectorAll('.TableFieldcard-buttons > div')
        )
            .map(button => normalizeText(button.textContent).toLowerCase())
            .join('|');

        return `${getCardName(card)}::${actions}`;
    }

    function findCardAction(card, actionText) {
        if (!card) {
            return null;
        }

        const expected = actionText.toLowerCase();

        for (const button of card.querySelectorAll(
            '.TableFieldcard-buttons > div'
        )) {
            if (normalizeText(button.textContent).toLowerCase().startsWith(expected)) {
                return button;
            }
        }

        return null;
    }

    function waitForCardChange(oldCard, oldSignature, timeout) {
        return waitFor(() => {
            const card = getCurrentFieldCard();

            if (
                card &&
                (!oldCard ||
                    card !== oldCard ||
                    getCardSignature(card) !== oldSignature)
            ) {
                return card;
            }

            return null;
        }, timeout, 40);
    }

    function rememberCard(key, card) {
        const name = getCardName(card);

        if (key && name) {
            state.cardNames.set(key, name);
        }
    }

    /*
     * Открывает карточку поля. Если нужная карточка уже открыта
     * (имя запомнено по прошлому открытию), повторный клик не нужен.
     */
    async function openFieldCard(field) {
        const key = getFieldKey(field);
        const oldCard = getCurrentFieldCard();

        if (
            oldCard &&
            key &&
            state.cardNames.get(key) === getCardName(oldCard)
        ) {
            return oldCard;
        }

        const oldSignature = getCardSignature(oldCard);

        const targets = [
            field,
            field.querySelector('.table-body-board-fields-one-body'),
            field.querySelector('.table-body-board-fields-one-body ._logo'),
            field.querySelector('.table-body-board-fields-one-label')
        ].filter(Boolean);

        for (const target of targets) {
            const rect = target.getBoundingClientRect();

            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }

            dispatchClickSequence(
                target,
                Math.round(rect.left + rect.width / 2),
                Math.round(rect.top + rect.height / 2)
            );

            const card = await waitForCardChange(oldCard, oldSignature, 550);

            if (card) {
                rememberCard(key, card);

                return card;
            }
        }

        /*
         * Нативный field.click() не используется: у такого события
         * sourceCapabilities равно null, и сайт на нём падает.
         * Последний шанс - просто подождать медленный отклик сайта.
         */
        const changed = await waitForCardChange(oldCard, oldSignature, 800);

        if (changed) {
            rememberCard(key, changed);

            return changed;
        }

        /* Мог остаться открытым тот же DOM; имя не запоминаем. */
        return getCurrentFieldCard();
    }

    /*
     * Нажимает кнопку в карточке поля. guard(button) может отменить нажатие.
     * Возвращает 'clicked', 'skipped' (отменил guard) или 'unavailable'.
     */
    async function performFieldAction(field, actionText, guard) {
        if (!field?.isConnected) {
            return 'unavailable';
        }

        document.documentElement.classList.add(HIDDEN_CARD_CLASS);

        try {
            const card = await openFieldCard(field);

            if (!card) {
                console.warn(LOG, 'Карточка поля не открылась:', getFieldKey(field));

                return 'unavailable';
            }

            const actionButton = findCardAction(card, actionText);

            if (!actionButton) {
                console.log(
                    LOG,
                    `"${actionText}" недоступно:`,
                    getCardName(card) || getFieldKey(field)
                );

                return 'unavailable';
            }

            if (guard && guard(actionButton) === false) {
                return 'skipped';
            }

            /* Карточка прозрачна: жмём штатную кнопку напрямую. */
            if (!clickElement(actionButton, false)) {
                console.warn(LOG, `Не удалось нажать "${actionText}"`);

                return 'unavailable';
            }

            return 'clicked';
        } catch (error) {
            console.error(LOG, 'Ошибка действия с полем:', error);

            return 'unavailable';
        } finally {
            getCurrentFieldCard()?.classList.add(PHANTOM_CARD_CLASS);
            document.documentElement.classList.remove(HIDDEN_CARD_CLASS);
        }
    }

    /*
     * Строит или продаёт один филиал и проверяет результат по реальному
     * изменению уровня поля. Возвращает:
     *   'ok'          уровень изменился;
     *   'broke'       стройка отменена: после неё денег меньше резерва;
     *   'unavailable' карточка/кнопка недоступны (быстрая неудача);
     *   'nochange'    кнопка нажата, но уровень не изменился.
     */
    async function changeLevel(field, direction) {
        const key = getFieldKey(field);
        const levelBefore = getFieldLevel(field);
        const label = direction === 'upgrade' ? 'Построить' : 'Продать';

        /* Если на кнопке указана цена, стройка не опускает деньги ниже резерва. */
        const guard =
            direction === 'upgrade'
                ? button => {
                    const price = parseAmount(button.textContent);
                    const money = getMyMoney();

                    if (
                        price !== null &&
                        money !== null &&
                        money - price < settings.reserve
                    ) {
                        console.log(
                            LOG,
                            `Построить пропущено: ${formatAmount(money)} - ` +
                            `${formatAmount(price)} меньше резерва ` +
                            formatAmount(settings.reserve)
                        );

                        return false;
                    }

                    return true;
                }
                : null;

        const result = await performFieldAction(field, label, guard);

        if (result === 'skipped') {
            return 'broke';
        }

        if (result !== 'clicked') {
            return 'unavailable';
        }

        const changed = await waitFor(() => {
            invalidateFieldIndex();

            const current = findFieldByKey(key);

            return current && getFieldLevel(current) !== levelBefore;
        }, LEVEL_WAIT);

        if (!changed) {
            console.warn(LOG, `${label}: уровень не изменился`, key);

            /* Возможно, открылась не та карточка: забываем её имя. */
            state.cardNames.delete(key);

            return 'nochange';
        }

        const name = state.cardNames.get(key) || key;

        if (direction === 'upgrade') {
            note(`Построен филиал: ${name}`, 'builds');
        } else {
            note(`Продан филиал: ${name}`);
        }

        await sleep(120);

        return 'ok';
    }

    /* ------------------------------------------------------------------
     * Кнопки +, − и A
     * ------------------------------------------------------------------ */

    function toggleAutoField(field) {
        const key = getFieldKey(field);

        if (!key) {
            return;
        }

        if (state.autoFieldKeys.has(key)) {
            state.autoFieldKeys.delete(key);
        } else {
            state.autoFieldKeys.add(key);
        }

        saveAutoFieldKeys();
        updateControlButtons();
        updateControlPanel();

        console.log(
            LOG,
            `A ${state.autoFieldKeys.has(key) ? 'ВКЛ' : 'ВЫКЛ'}:`,
            key
        );
    }

    function clearAutoFields() {
        state.autoFieldKeys.clear();
        state.failedUntil.clear();

        saveAutoFieldKeys();
        updateControlButtons();
        updateControlPanel();
    }

    async function executeManualAction(field, action) {
        if (state.quickActionRunning || state.preRollRunning) {
            return;
        }

        const availability = getActionAvailability(field);

        if (!availability[action]) {
            return;
        }

        state.quickActionRunning = true;
        updateControlPanel();

        try {
            await changeLevel(field, action);
        } finally {
            state.quickActionRunning = false;

            updateFields();
            updateControlPanel();
            scheduleScan();
        }
    }

    function handleQuickButton(button, event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const field = findFieldByKey(button.dataset.fieldKey);
        const action = button.dataset.action;

        if (!field) {
            console.warn(LOG, 'Поле не найдено:', button.dataset.fieldKey);

            return;
        }

        if (action === 'auto') {
            toggleAutoField(field);
        } else if (action === 'upgrade' || action === 'downgrade') {
            executeManualAction(field, action);
        }
    }

    function createActionButton(field, action) {
        const button = document.createElement('button');

        button.type = 'button';
        button.dataset.fieldKey = getFieldKey(field);
        button.dataset.action = action;
        button.className = `monopoly-helper-quick-button ${action}`;

        if (action === 'upgrade') {
            button.textContent = '+';
            button.title = 'Построить филиал';
        } else if (action === 'downgrade') {
            button.textContent = '−';
            button.title = 'Продать филиал';
        } else {
            button.textContent = 'A';
            button.title = 'Автоулучшение перед броском';
        }

        button.addEventListener(
            'click',
            event => handleQuickButton(button, event),
            true
        );

        /* Не даём событию уйти на игровое поле. */
        for (const type of ['pointerdown', 'mousedown', 'mouseup']) {
            button.addEventListener(
                type,
                event => event.stopPropagation(),
                true
            );
        }

        return button;
    }

    function createControl(key) {
        const control = document.createElement('div');

        control.className = 'monopoly-helper-field-controls';
        control.dataset.fieldKey = key;

        control.addEventListener('click', event => event.stopPropagation());
        control.addEventListener('pointerdown', event => event.stopPropagation());

        document.getElementById('monopoly-helper-overlay')?.appendChild(control);

        state.controls.set(key, control);

        return control;
    }

    function updateSingleControl(field, availability) {
        const key = getFieldKey(field);

        if (!key) {
            return;
        }

        let control = state.controls.get(key);

        if (!control?.isConnected) {
            control = createControl(key);
        }

        const actions = ['upgrade', 'downgrade', 'auto']
            .filter(action => availability[action]);

        const signature = actions.join('|');

        /* Кнопки не пересоздаются, если их набор не изменился. */
        if (control.dataset.signature !== signature) {
            control.replaceChildren(
                ...actions.map(action => createActionButton(field, action))
            );

            control.dataset.signature = signature;
        }

        const autoButton = control.querySelector('[data-action="auto"]');

        if (autoButton) {
            const enabled = state.autoFieldKeys.has(key);

            autoButton.classList.toggle('enabled', enabled);

            autoButton.title = enabled
                ? 'Автоулучшение включено'
                : 'Включить автоулучшение';
        }
    }

    function updateControlButtons() {
        const activeKeys = new Set();

        for (const field of getOwnedFields()) {
            const key = getFieldKey(field);

            if (!key) {
                continue;
            }

            const availability = getActionAvailability(field);

            if (
                !availability.upgrade &&
                !availability.downgrade &&
                !availability.auto
            ) {
                continue;
            }

            activeKeys.add(key);
            updateSingleControl(field, availability);
        }

        for (const [key, control] of state.controls) {
            if (!activeKeys.has(key)) {
                control.remove();
                state.controls.delete(key);
            }
        }

        positionControls();
    }

    function positionControls() {
        if (!state.controls.size) {
            return;
        }

        const byKey = new Map();

        for (const field of getOwnedFields()) {
            byKey.set(getFieldKey(field), field);
        }

        for (const [key, control] of state.controls) {
            const field = byKey.get(key);

            if (!field || !control.isConnected) {
                control.style.display = 'none';

                continue;
            }

            const rect = field.getBoundingClientRect();

            const visible =
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom > 0 &&
                rect.right > 0 &&
                rect.top < window.innerHeight &&
                rect.left < window.innerWidth;

            if (!visible) {
                control.style.display = 'none';

                continue;
            }

            control.style.display = 'flex';
            control.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
            control.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
        }
    }

    function updateFields() {
        const currentFields = new Set(getOwnedFields());

        for (const field of currentFields) {
            field.classList.add('monopoly-helper-my-field');
        }

        for (const oldField of state.highlightedFields) {
            if (oldField.isConnected && !currentFields.has(oldField)) {
                oldField.classList.remove('monopoly-helper-my-field');
            }
        }

        state.highlightedFields = currentFields;

        updateControlButtons();
    }

    /* ------------------------------------------------------------------
     * Очередь автоматических улучшений
     * ------------------------------------------------------------------ */

    /*
     * Очередь: поля с кнопкой A или, в режиме «все поля», любое
     * незавершённое поле полной группы.
     */
    function getAutoQueueKeys() {
        return getOwnedFields()
            .filter(field => {
                return settings.upgradeAll
                    ? getActionAvailability(field).auto
                    : state.autoFieldKeys.has(getFieldKey(field));
            })
            .map(getFieldKey)
            .filter(Boolean);
    }

    /*
     * Поднимает каждое поле очереди на один уровень, если это разрешает
     * правило равномерной застройки. Поля, где улучшение не удалось,
     * на FAIL_COOLDOWN пропускаются, чтобы не задерживать бросок.
     */
    async function runAutoQueue(shouldAbort) {
        const keys = getAutoQueueKeys();
        let built = 0;
        let failures = 0;

        console.log(LOG, 'Очередь A:', keys.length);

        const money = getMyMoney();

        if (keys.length && money !== null && money < settings.reserve) {
            note(
                `Улучшения пропущены: денег ${formatAmount(money)} ` +
                `меньше резерва ${formatAmount(settings.reserve)}`
            );

            return 0;
        }

        for (const key of keys) {
            if (shouldAbort()) {
                console.log(LOG, 'Очередь A прервана');

                break;
            }

            if ((state.failedUntil.get(key) || 0) > Date.now()) {
                continue;
            }

            /* После каждого улучшения сайт может пересоздать DOM клетки. */
            invalidateFieldIndex();

            const field = findFieldByKey(key);

            if (!field || !getActionAvailability(field).upgrade) {
                continue;
            }

            const result = await changeLevel(field, 'upgrade');

            if (result === 'ok') {
                built++;
                failures = 0;
            } else {
                state.failedUntil.set(key, Date.now() + FAIL_COOLDOWN);

                failures = result === 'nochange' ? failures + 1 : failures;

                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    console.log(LOG, 'Очередь A: вероятно, не хватает денег');

                    /* Остальные поля тоже пропускаем до следующего хода. */
                    for (const rest of keys) {
                        if (!(state.failedUntil.get(rest) > Date.now())) {
                            state.failedUntil.set(rest, Date.now() + FAIL_COOLDOWN);
                        }
                    }

                    break;
                }
            }

            updateFields();
        }

        return built;
    }

    /* ------------------------------------------------------------------
     * Звук, пауза, автоматические действия
     * ------------------------------------------------------------------ */

    let audioContext = null;

    function playAlertSound() {
        if (!settings.sound) {
            return;
        }

        try {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioContextClass) {
                return;
            }

            /* Один контекст на всю игру: новый на каждый сигнал не нужен. */
            audioContext = audioContext || new AudioContextClass();

            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const now = audioContext.currentTime;

            oscillator.type = 'sine';
            oscillator.frequency.value = 800;

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(now + 0.3);
        } catch (error) {
            console.debug(LOG, 'Ошибка звука:', error);
        }
    }

    function setPaused(paused) {
        state.paused = Boolean(paused);

        localStorage.setItem(PAUSE_STORAGE_KEY, String(state.paused));

        updateControlPanel();

        console.log(
            LOG,
            state.paused
                ? 'Автоматизация на паузе'
                : 'Автоматизация включена'
        );

        if (!state.paused) {
            scheduleScan();
        }
    }

    function togglePaused() {
        setPaused(!state.paused);
    }

    function getActionPanel() {
        return document.querySelector(ACTION_PANEL_SELECTOR);
    }

    function getActionButtons() {
        return Array.from(document.querySelectorAll(ACTION_BUTTON_SELECTOR))
            .map(element => {
                return {
                    element,
                    text: normalizeText(element.textContent).toLowerCase()
                };
            });
    }

    function findActionButton(textPart) {
        const found = getActionButtons()
            .find(item => item.text.includes(textPart));

        return found ? found.element : null;
    }

    function getPurchaseTitle() {
        return normalizeText(
            getActionPanel()?.querySelector('.TableAction-top-title')?.textContent
        ).toLowerCase();
    }

    function isPurchaseOfferVisible() {
        return getPurchaseTitle().includes('покупаем');
    }

    /*
     * Отпечаток предложения: только буквы заголовка и пояснения. Другое
     * поле = другой отпечаток; цифры (цена, обратный отсчёт) и знаки
     * на него не влияют.
     */
    function getPurchaseKey() {
        const panel = getActionPanel();

        return ['.TableAction-top-title', '.TableAction-top-text']
            .map(selector => panel?.querySelector(selector)?.textContent || '')
            .join(' ')
            .toLowerCase()
            .replace(/[^a-zа-яё]/gi, '');
    }

    /* Кнопка «Купить за N». «На аукцион» и «Отказаться» не подходят никогда. */
    function findBuyButton() {
        const buttons = getActionButtons();

        const byText = buttons.find(item => {
            return (
                item.text.includes('купить') &&
                !/аукцион|отказ|не покуп/.test(item.text)
            );
        });

        if (byText) {
            return byText.element;
        }

        /* Запасной вариант: подпись другая, но основная (первая) кнопка - покупка. */
        const first = buttons[0];

        if (first && !/аукцион|отказ|бросить|заплатить/.test(first.text)) {
            console.log(LOG, 'Кнопка покупки выбрана по позиции:', first.text);

            return first.element;
        }

        return null;
    }

    /* true, если после траты останется не меньше резерва. */
    function canSpend(button) {
        const price = parseAmount(button.textContent);
        const money = getMyMoney();

        if (price === null || money === null) {
            return true;
        }

        return money - price >= settings.reserve;
    }

    function cancelAutoBuy() {
        window.clearTimeout(state.buyTimer);

        state.buyTimer = 0;
    }

    /*
     * Если за AUTO_BUY_DELAY игрок не купил сам и не нажал «На аукцион»,
     * предложение всё ещё на экране - нажимаем «Купить».
     * Предложения, появившиеся во время паузы, не покупаются.
     */
    function autoBuy() {
        state.buyTimer = 0;

        if (!settings.buy || state.paused || !isPurchaseOfferVisible()) {
            return;
        }

        const button = findBuyButton();

        if (!button) {
            console.log(
                LOG,
                'Кнопка «Купить» не найдена. Кнопки на экране:',
                getActionButtons().map(item => item.text)
            );

            return;
        }

        if (button.classList.contains('_locked')) {
            note('Покупка: кнопка заблокирована, не хватает денег');

            return;
        }

        if (!canSpend(button)) {
            note(
                `Покупка пропущена: после неё останется меньше резерва ` +
                `(${formatAmount(settings.reserve)})`
            );

            return;
        }

        if (state.buyAttempts >= MAX_BUY_ATTEMPTS) {
            return;
        }

        state.buyAttempts++;

        note(`Куплено поле: ${normalizeText(button.textContent)}`, 'buys');

        clickElement(button, true);

        /* Если предложение не закрылось, повторяем клик ещё раз. */
        if (state.buyAttempts < MAX_BUY_ATTEMPTS) {
            state.buyTimer = window.setTimeout(autoBuy, CLICK_COOLDOWN);
        }
    }

    function processPurchaseAlert() {
        const visible = isPurchaseOfferVisible();
        const key = visible ? getPurchaseKey() : '';

        if (visible && (!state.purchaseAlerted || key !== state.purchaseKey)) {
            /* Новое предложение (в том числе сразу вместо предыдущего). */
            state.purchaseAlerted = true;
            state.purchaseKey = key;
            state.buyAttempts = 0;

            playAlertSound();

            cancelAutoBuy();

            if (settings.buy && !state.paused) {
                state.buyTimer = window.setTimeout(autoBuy, AUTO_BUY_DELAY);
            }
        } else if (!visible) {
            /* Покупка, «На аукцион» или конец предложения. */
            state.purchaseAlerted = false;
            state.purchaseKey = '';

            cancelAutoBuy();
        }
    }

    /*
     * Кнопка выхода из тюрьмы (кроме «Бросить кубики»). Карточка выхода
     * предпочтительнее платного выкупа. Подписи на сайте не проверены,
     * поэтому ищем по нескольким корням слов.
     */
    function findJailExitButton() {
        const buttons = getActionButtons()
            .filter(item => !item.text.includes('бросить'));

        const found =
            buttons.find(item => /карт/.test(item.text)) ||
            buttons.find(item => {
                return /заплат|выкуп|выйти|выход|освобод|штраф/.test(item.text);
            });

        return found ? found.element : null;
    }

    /* Новый экран панели действий записывается в консоль один раз. */
    function logActionScreen() {
        const panel = getActionPanel();

        if (!panel || state.seenScreens.size >= 60) {
            return;
        }

        const buttons = getActionButtons().map(item => item.text);

        if (!buttons.length) {
            return;
        }

        const title = normalizeText(
            panel.querySelector('.TableAction-top-title')?.textContent
        );

        const signature = `${title}|${buttons.join('|')}`;

        if (state.seenScreens.has(signature)) {
            return;
        }

        state.seenScreens.add(signature);

        console.log(LOG, 'Экран действия:', {
            title,
            text: normalizeText(
                panel.querySelector('.TableAction-top-text')?.textContent
            ),
            buttons,
            jailed: isJailed()
        });
    }

    /* Очередь A (один раз на появление кнопки), затем бросок. */
    async function runRollSequence() {
        if (state.preRollRunning) {
            return;
        }

        if (settings.upgrade && !state.queueDone) {
            state.queueDone = true;
            state.queueRanAt = Date.now();
            state.preRollRunning = true;
            updateControlPanel();

            try {
                await runAutoQueue(
                    () => state.paused || !findActionButton('бросить кубики')
                );
            } catch (error) {
                console.error(LOG, 'Ошибка очереди A:', error);
            } finally {
                state.preRollRunning = false;

                updateControlPanel();
            }
        }

        if (!canAutoRoll() || state.paused) {
            return;
        }

        if (
            Date.now() < state.rollRetryAt ||
            state.attempts.roll >= MAX_CLICK_ATTEMPTS
        ) {
            return;
        }

        /* Слот клика занимаем сразу, чтобы скан не запустил второй бросок. */
        state.lastClickAt.roll = Date.now();
        state.rollRetryAt = state.lastClickAt.roll + CLICK_COOLDOWN;
        state.attempts.roll++;

        await sleep(100);

        /* Кнопка могла быть перерисована, поэтому ищем её заново. */
        const button = findActionButton('бросить кубики');

        if (!button || state.paused) {
            return;
        }

        note(`Бросок кубиков (попытка ${state.attempts.roll})`, 'rolls');

        clickElement(button, true);
    }

    /* Автобросок включён и не отключён режимом «Тюрьма: вручную». */
    function canAutoRoll() {
        if (!settings.roll) {
            return false;
        }

        return !(settings.jail === 'manual' && isJailed());
    }

    function handleRollButton() {
        if (!canAutoRoll() && !(settings.upgrade && !state.queueDone)) {
            return false;
        }

        runRollSequence();

        return true;
    }

    /*
     * «Заплатить». Вне тюрьмы это налог или рента (настройка «Оплата»),
     * в тюрьме - выкуп, которым управляет режим тюрьмы. Возвращает true,
     * если кнопка обработана (в том числе ожидает паузы между кликами).
     */
    function handleFeeButton(button, jailed) {
        if (jailed) {
            if (settings.jail !== 'pay') {
                return false;
            }

            /* Не хватает денег с учётом резерва: пусть сработает бросок. */
            if (!canSpend(button)) {
                return false;
            }
        } else if (!settings.pay) {
            return false;
        }

        const now = Date.now();
        const lastClick = Math.max(state.lastClickAt.roll, state.lastClickAt.pay);

        if (
            now - lastClick < CLICK_COOLDOWN ||
            state.attempts.pay >= MAX_CLICK_ATTEMPTS
        ) {
            return true;
        }

        state.lastClickAt.pay = now;
        state.attempts.pay++;

        if (jailed) {
            note(`Выход из тюрьмы: ${normalizeText(button.textContent)}`, 'jailPays');
        } else {
            note('Оплата', 'pays');
        }

        clickElement(button, true);

        return true;
    }

    function processActionButtons() {
        const jailed = isJailed();
        const rollButton = findActionButton('бросить кубики');
        const feeButton = jailed
            ? findJailExitButton()
            : findActionButton('заплатить');

        /*
         * Учёт появления кнопок не зависит от паузы. Кнопка, которая
         * исчезла или заменена новым элементом, считается новой:
         * счётчики попыток и пауза повтора сбрасываются (дубли на кубиках,
         * следующий ход, повторная оплата).
         */
        if (!rollButton) {
            state.rollSeen = false;
            state.rollEl = null;
            state.attempts.roll = 0;
        } else if (!state.rollSeen || rollButton !== state.rollEl) {
            /* true: кнопка не исчезала, её только перерисовал сайт. */
            const redrawn = state.rollSeen;

            state.rollSeen = true;
            state.rollEl = rollButton;
            state.attempts.roll = 0;
            state.rollRetryAt = 0;

            /*
             * Очередь A перезапускается для нового броска. Простая
             * перерисовка кнопки (особенно во время работы очереди или
             * при выключенном автобросте) не должна строить лишнее.
             */
            if (
                !state.preRollRunning &&
                (!redrawn || Date.now() - state.queueRanAt > QUEUE_RERUN_MIN)
            ) {
                state.queueDone = false;
            }
        }

        if (!feeButton) {
            state.payEl = null;
            state.attempts.pay = 0;
        } else if (feeButton !== state.payEl) {
            state.payEl = feeButton;
            state.attempts.pay = 0;
        }

        if (
            state.paused ||
            state.preRollRunning ||
            state.quickActionRunning
        ) {
            return;
        }

        /*
         * Порядок: в тюрьме при режиме «платить» выход идёт первым,
         * иначе первой обрабатывается кнопка, стоящая раньше в DOM.
         */
        const feeFirst = jailed && settings.jail === 'pay';

        const candidates = [
            rollButton && { kind: 'roll', element: rollButton, priority: 1 },
            feeButton && {
                kind: 'fee',
                element: feeButton,
                priority: feeFirst ? 0 : 1
            }
        ]
            .filter(Boolean)
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }

                return a.element.compareDocumentPosition(b.element) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                    ? -1
                    : 1;
            });

        for (const candidate of candidates) {
            const handled =
                candidate.kind === 'roll'
                    ? handleRollButton()
                    : handleFeeButton(candidate.element, jailed);

            if (handled) {
                return;
            }
        }
    }

    /* ------------------------------------------------------------------
     * Интерфейс
     * ------------------------------------------------------------------ */

    function addStyles() {
        document.getElementById('monopoly-helper-styles')?.remove();

        const style = document.createElement('style');

        style.id = 'monopoly-helper-styles';

        style.textContent = `
            #monopoly-helper-panel {
                position: fixed;
                top: 90px;
                right: 16px;
                z-index: 2147483647;
                width: 190px;
                box-sizing: border-box;
                padding: 10px;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 10px;
                background: rgba(20, 24, 31, 0.95);
                color: #fff;
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.48);
                font-family: Arial, sans-serif;
                font-size: 12px;
                user-select: none;
                pointer-events: auto;
            }

            #monopoly-helper-head {
                display: flex;
                gap: 6px;
            }

            #monopoly-helper-toggle {
                flex: 1;
                min-width: 0;
                box-sizing: border-box;
                padding: 9px 8px;
                border: 0;
                border-radius: 7px;
                color: #fff;
                cursor: pointer;
                font: 700 13px Arial, sans-serif;
                pointer-events: auto;
            }

            #monopoly-helper-collapse {
                width: 30px;
                border: 0;
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
                cursor: pointer;
                font: 700 14px Arial, sans-serif;
                pointer-events: auto;
            }

            #monopoly-helper-body {
                margin-top: 8px;
            }

            #monopoly-helper-panel.collapsed #monopoly-helper-body {
                display: none;
            }

            #monopoly-helper-options,
            #monopoly-helper-tools {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
            }

            #monopoly-helper-tools {
                margin-top: 5px;
            }

            #monopoly-helper-options .monopoly-helper-chip:last-child:nth-child(odd) {
                grid-column: span 2;
            }

            .monopoly-helper-chip {
                padding: 6px 4px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.07);
                color: rgba(255, 255, 255, 0.6);
                cursor: pointer;
                font: 600 11px Arial, sans-serif;
                pointer-events: auto;
            }

            .monopoly-helper-chip.on {
                border-color: #1f9d62;
                background: rgba(31, 157, 98, 0.28);
                color: #fff;
            }

            #monopoly-helper-status {
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.78);
                font-size: 10px;
                line-height: 1.4;
                text-align: left;
                white-space: pre-line;
                word-break: break-word;
            }

            #monopoly-helper-cycles {
                display: grid;
                gap: 5px;
                margin-top: 5px;
            }

            .monopoly-helper-cycle {
                padding: 6px 8px;
                color: #fff;
                text-align: left;
            }

            #monopoly-helper-tools .monopoly-helper-chip:last-child:nth-child(odd) {
                grid-column: span 2;
            }

            .custom-me-badge {
                display: inline-block;
                margin-left: 5px;
                padding: 2px 6px;
                border-radius: 4px;
                background: #27ae60;
                color: #fff;
                font-size: 11px;
                font-weight: bold;
                vertical-align: middle;
            }

            .table-body-board-fields-one.monopoly-helper-my-field {
                outline: 3px solid #ff3b30 !important;
                outline-offset: -3px !important;
                box-shadow:
                    inset 0 0 0 2px rgba(255, 255, 255, 0.88),
                    inset 0 0 16px rgba(255, 59, 48, 0.62),
                    0 0 10px rgba(255, 59, 48, 0.9) !important;
            }

            /* Карточка скрыта на время автоматических действий и
               после них не перехватывает клики по доске. */
            html.${HIDDEN_CARD_CLASS} .TableFieldcard,
            .TableFieldcard.${PHANTOM_CARD_CLASS} {
                opacity: 0 !important;
                transition: none !important;
                animation: none !important;
            }

            .TableFieldcard.${PHANTOM_CARD_CLASS} {
                pointer-events: none !important;
            }

            #monopoly-helper-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                pointer-events: none;
                overflow: visible;
            }

            .monopoly-helper-field-controls {
                position: fixed;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
                transform: translate(-50%, -50%);
                pointer-events: auto !important;
                touch-action: manipulation;
            }

            .monopoly-helper-quick-button {
                position: relative;
                width: 24px;
                height: 24px;
                box-sizing: border-box;
                padding: 0;
                border: 2px solid rgba(255, 255, 255, 0.98);
                border-radius: 50%;
                color: #fff;
                cursor: pointer;
                pointer-events: auto !important;
                touch-action: manipulation;
                font: 700 16px/20px Arial, sans-serif;
                text-align: center;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
                box-shadow:
                    0 2px 7px rgba(0, 0, 0, 0.85),
                    inset 0 0 4px rgba(255, 255, 255, 0.35);
            }

            .monopoly-helper-quick-button.upgrade { background: #159447; }
            .monopoly-helper-quick-button.downgrade { background: #c9342f; }

            .monopoly-helper-quick-button.auto {
                background: #5d6875;
                font-size: 11px;
            }

            .monopoly-helper-quick-button.auto.enabled {
                background: #1677d2;
                box-shadow:
                    0 0 10px rgba(30, 144, 255, 1),
                    inset 0 0 4px rgba(255, 255, 255, 0.45);
            }

            .monopoly-helper-quick-button:hover { filter: brightness(1.25); }
            .monopoly-helper-quick-button:active { transform: scale(0.9); }

            @media (max-width: 700px) {
                #monopoly-helper-panel {
                    top: 60px;
                    right: 8px;
                    width: 165px;
                    padding: 8px;
                }

                .monopoly-helper-quick-button {
                    width: 20px;
                    height: 20px;
                    border-width: 1px;
                    font-size: 13px;
                    line-height: 17px;
                }

                .monopoly-helper-quick-button.auto { font-size: 9px; }
            }
        `;

        document.head.appendChild(style);
    }

    const OPTION_CHIPS = [
        ['roll', 'Бросок', 'Автоматически бросать кубики'],
        ['pay', 'Оплата', 'Автоматически нажимать «Заплатить»'],
        ['buy', 'Покупка', 'Купить поле через 2 с, если вы не отказались сами'],
        ['upgrade', 'Улучш.', 'Строить по очереди A перед броском'],
        ['sound', 'Звук', 'Сигнал при предложении купить поле']
    ];

    /* Переключатели с несколькими значениями: клик = следующее значение. */
    const JAIL_LABELS = { roll: 'кубики', pay: 'платить', manual: 'вручную' };

    const CYCLES = [
        {
            key: 'upgradeAll',
            values: [false, true],
            label: value => `Улучшать: ${value ? 'все поля' : 'очередь A'}`,
            title: 'Что строить перед броском: только поля с кнопкой A ' +
                'или все незавершённые поля полных групп'
        },
        {
            key: 'jail',
            values: JAIL_MODES,
            label: value => `Тюрьма: ${JAIL_LABELS[value]}`,
            title: 'В тюрьме: бросать кубики (с улучшениями), ' +
                'платить за выход или решать вручную'
        },
        {
            key: 'reserve',
            values: RESERVE_STEPS,
            label: value => `Резерв: ${value ? formatAmount(value) : 'нет'}`,
            title: 'Сколько денег оставлять: автопокупка, стройка и ' +
                'выкуп из тюрьмы не опустят баланс ниже этой суммы'
        }
    ];

    function collectDiagnostics() {
        const panel = getActionPanel();

        return {
            version: VERSION,
            url: window.location.href,
            account: getMyUserId() || null,
            ownerId: state.ownerId,
            ownerSource: state.ownerSource,
            jailed: isJailed(),
            money: getMyMoney(),
            paused: state.paused,
            settings: { ...settings },
            queue: getAutoQueueKeys().length,
            counters: { ...state.counters },
            lastAction: state.activity ? state.activity.text : null,
            actionPanel: panel
                ? {
                    title: normalizeText(
                        panel.querySelector('.TableAction-top-title')?.textContent
                    ),
                    text: normalizeText(
                        panel.querySelector('.TableAction-top-text')?.textContent
                    ),
                    buttons: Array.from(
                        panel.querySelectorAll('.TableAction-buttons > div')
                    ).map(element => ({
                        text: normalizeText(element.textContent),
                        class: element.className
                    }))
                }
                : null
        };
    }

    function copyDiagnostics() {
        const json = JSON.stringify(collectDiagnostics(), null, 2);

        const fallback = () => {
            console.log(LOG, 'Диагностика:\n' + json);

            window.prompt('Скопируйте диагностику (Ctrl + C):', json);
        };

        try {
            navigator.clipboard
                .writeText(json)
                .then(() => note('Диагностика скопирована в буфер обмена'), fallback);
        } catch (error) {
            fallback();
        }
    }

    function createButton(className, text, title, onClick) {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.title = title;

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();

            onClick();
        });

        return button;
    }

    function createInterface() {
        document.getElementById('monopoly-helper-panel')?.remove();
        document.getElementById('monopoly-helper-overlay')?.remove();

        state.controls.clear();

        const overlay = document.createElement('div');

        overlay.id = 'monopoly-helper-overlay';

        document.body.appendChild(overlay);

        const panel = document.createElement('div');

        panel.id = 'monopoly-helper-panel';

        const head = document.createElement('div');

        head.id = 'monopoly-helper-head';

        const toggle = createButton(
            '',
            '',
            'Пауза / включение автоматики (Alt + P)',
            togglePaused
        );

        toggle.id = 'monopoly-helper-toggle';

        const collapse = createButton(
            '',
            '',
            'Свернуть / развернуть панель',
            () => {
                settings.collapsed = !settings.collapsed;

                saveSettings();
                updateControlPanel();
            }
        );

        collapse.id = 'monopoly-helper-collapse';

        head.append(toggle, collapse);

        const body = document.createElement('div');

        body.id = 'monopoly-helper-body';

        const options = document.createElement('div');

        options.id = 'monopoly-helper-options';

        for (const [key, text, title] of OPTION_CHIPS) {
            const chip = createButton(
                'monopoly-helper-chip',
                text,
                title,
                () => {
                    settings[key] = !settings[key];

                    saveSettings();
                    updateControlPanel();
                    scheduleScan();
                }
            );

            chip.dataset.setting = key;

            options.appendChild(chip);
        }

        const cycles = document.createElement('div');

        cycles.id = 'monopoly-helper-cycles';

        for (const cycle of CYCLES) {
            const button = createButton(
                'monopoly-helper-chip monopoly-helper-cycle',
                '',
                cycle.title,
                () => {
                    const index = cycle.values.indexOf(settings[cycle.key]);

                    settings[cycle.key] =
                        cycle.values[(index + 1) % cycle.values.length];

                    saveSettings();
                    updateControlPanel();
                    scheduleScan();
                }
            );

            button.dataset.cycle = cycle.key;

            cycles.appendChild(button);
        }

        const tools = document.createElement('div');

        tools.id = 'monopoly-helper-tools';

        tools.append(
            createButton(
                'monopoly-helper-chip',
                'Ник',
                'Сменить ник игрока',
                changeNick
            ),
            createButton(
                'monopoly-helper-chip',
                'Сброс A',
                'Очистить очередь автоулучшений',
                clearAutoFields
            ),
            createButton(
                'monopoly-helper-chip',
                'Диагн.',
                'Скопировать диагностику (для отчёта об ошибке)',
                copyDiagnostics
            )
        );

        const status = document.createElement('div');

        status.id = 'monopoly-helper-status';

        body.append(options, cycles, tools, status);
        panel.append(head, body);

        document.body.appendChild(panel);

        updateControlPanel();
    }

    function updateControlPanel() {
        const panel = document.getElementById('monopoly-helper-panel');

        if (!panel) {
            return;
        }

        const toggle = document.getElementById('monopoly-helper-toggle');
        const collapse = document.getElementById('monopoly-helper-collapse');
        const status = document.getElementById('monopoly-helper-status');

        panel.classList.toggle('collapsed', settings.collapsed);

        const toggleText = state.paused ? 'Авто: ПАУЗА' : 'Авто: ВКЛ';

        if (toggle.textContent !== toggleText) {
            toggle.textContent = toggleText;
            toggle.style.background = state.paused ? '#c0392b' : '#1f9d62';
        }

        collapse.textContent = settings.collapsed ? '▸' : '▾';

        panel.querySelectorAll('[data-setting]').forEach(chip => {
            chip.classList.toggle('on', Boolean(settings[chip.dataset.setting]));
        });

        for (const cycle of CYCLES) {
            const button = panel.querySelector(`[data-cycle="${cycle.key}"]`);
            const label = cycle.label(settings[cycle.key]);

            if (button && button.textContent !== label) {
                button.textContent = label;
            }
        }

        const text = buildStatusText();

        if (status.textContent !== text) {
            status.textContent = text;
        }
    }

    function buildStatusText() {
        if (state.preRollRunning) {
            return 'Автоулучшение перед броском...';
        }

        if (state.quickActionRunning) {
            return 'Действие с полем...';
        }

        if (state.ownerId === null) {
            return 'Ищу вашу карточку игрока...';
        }

        const money = getMyMoney();
        const counters = state.counters;

        const lines = [
            `Моих полей: ${state.highlightedFields.size} · ` +
                `очередь: ${getAutoQueueKeys().length}`,
            `Деньги: ${money === null ? '-' : formatAmount(money)}` +
                (isJailed() ? ' · в тюрьме' : '')
        ];

        if (state.activity) {
            const time = new Date(state.activity.at).toLocaleTimeString('ru-RU');

            lines.push(`Последнее: ${state.activity.text} (${time})`);
        }

        lines.push(
            `Авто: бросков ${counters.rolls} · покупок ${counters.buys} · ` +
                `построек ${counters.builds}`
        );

        lines.push(
            `Owner ${state.ownerId} (${state.ownerSource}) · ` +
                `v${VERSION} · Alt+P`
        );

        return lines.join('\n');
    }

    function handleKeyboard(event) {
        if (
            event.altKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            event.code === 'KeyP'
        ) {
            event.preventDefault();

            togglePaused();
        }
    }

    /*
     * После настоящего ручного клика снова показываем карточки,
     * которые ранее были открыты автоматикой.
     */
    function handleTrustedPointerDown(event) {
        if (!event.isTrusted || event.target.closest?.(UI_SELECTOR)) {
            return;
        }

        document
            .querySelectorAll(`.TableFieldcard.${PHANTOM_CARD_CLASS}`)
            .forEach(card => card.classList.remove(PHANTOM_CARD_CLASS));
    }

    /* ------------------------------------------------------------------
     * Основной цикл
     * ------------------------------------------------------------------ */

    function scanPage() {
        window.clearTimeout(state.scanTimer);

        state.scanTimer = 0;
        state.lastScanAt = Date.now();

        try {
            addPlayerBadge();

            if (state.ownerId === null) {
                detectOwnerId();
            }

            updateFields();
            processPurchaseAlert();
            processActionButtons();
            logActionScreen();
            updateControlPanel();
        } catch (error) {
            console.error(LOG, 'Ошибка сканирования:', error);
        }
    }

    /*
     * Сканирование не зависит от requestAnimationFrame: в фоновой
     * вкладке браузер его останавливает, и автоматика вставала бы.
     * Первое изменение DOM после паузы обрабатывается сразу,
     * последующие склеиваются в один отложенный скан.
     */
    function scheduleScan() {
        if (state.scanTimer) {
            return;
        }

        const wait = Math.max(
            0,
            MIN_SCAN_INTERVAL - (Date.now() - state.lastScanAt)
        );

        if (wait === 0) {
            scanPage();
        } else {
            state.scanTimer = window.setTimeout(scanPage, wait);
        }
    }

    function isOwnMutation(mutation) {
        const node =
            mutation.target.nodeType === Node.ELEMENT_NODE
                ? mutation.target
                : mutation.target.parentElement;

        return Boolean(node?.closest(UI_SELECTOR));
    }

    function start() {
        addStyles();
        createInterface();

        document.addEventListener('keydown', handleKeyboard);
        document.addEventListener('pointerdown', handleTrustedPointerDown, true);

        window.addEventListener('resize', positionControls);
        window.addEventListener('scroll', positionControls, true);

        const observer = new MutationObserver(mutations => {
            /* Изменения нашей же панели не должны запускать скан. */
            if (!mutations.every(isOwnMutation)) {
                scheduleScan();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,

            /* class не отслеживается, чтобы подсветка не зацикливала observer. */
            attributeFilter: [
                'mnpl-owner', 'mnpl-group', 'mnpl-line', 'mnpl-player',
                'mnpl-player-id', 'mnpl-player-index', 'mnpl-index',
                'data-owner', 'data-owner-id', 'data-player',
                'data-player-id', 'data-player-index'
            ]
        });

        window.setInterval(positionControls, 300);

        /*
         * Страховка: если кнопка не исчезла после клика, а DOM больше
         * не меняется, скан запускается по таймеру и клик повторяется.
         */
        window.setInterval(scheduleScan, 1500);

        window.monopolyHelper = {
            version: VERSION,
            state,
            settings,
            scan: scanPage,
            diagnostics: collectDiagnostics
        };

        scanPage();

        console.log(`Monopoly-One Helper v${VERSION} запущен`);
    }

    if (document.body) {
        start();
    } else {
        window.addEventListener('DOMContentLoaded', start, { once: true });
    }
})();
