// ==UserScript==
// @name         Monopoly-One Helper
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Автобросок, автооплата, пауза, подсветка и автоулучшения
// @match        https://monopoly-one.com/table*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const MY_NICK = '侍ジョー';

    const PAUSE_STORAGE_KEY =
        'monopoly-helper-paused';

    /*
     * Новый ключ v4 нужен, чтобы удалить старые конфликтующие
     * идентификаторы вида group:line.
     */
    const AUTO_FIELDS_STORAGE_KEY =
        'monopoly-helper-auto-fields-v4';

    const PLAYER_CARD_SELECTOR =
        '.table-body-players-card';

    const FIELD_SELECTOR =
        '.table-body-board-fields-one';

    const FIELD_CARD_SELECTOR =
        '.TableFieldcard';

    const ACTION_BUTTON_SELECTOR =
        '.TableAction-buttons ._action';

    const MAX_FIELD_LEVEL = 5;
    const CLICK_COOLDOWN = 1500;

    /*
     * Из предоставленных примеров известно, что группа 9
     * не поддерживает строительство.
     */
    const NON_BUILDABLE_GROUPS = new Set([
        '9'
    ]);

    const OWNER_ATTRIBUTE_NAMES = [
        'mnpl-owner',
        'mnpl-player',
        'mnpl-player-id',
        'mnpl-player-index',
        'mnpl-index',
        'data-owner',
        'data-owner-id',
        'data-player',
        'data-player-id',
        'data-player-index'
    ];

    function loadAutoFieldKeys() {
        try {
            const saved = sessionStorage.getItem(
                AUTO_FIELDS_STORAGE_KEY
            );

            if (!saved) {
                return new Set();
            }

            const parsed = JSON.parse(saved);

            return new Set(
                Array.isArray(parsed)
                    ? parsed
                    : []
            );
        } catch (error) {
            console.warn(
                '[Monopoly Helper] Ошибка загрузки очереди A:',
                error
            );

            return new Set();
        }
    }

    const state = {
        paused:
            localStorage.getItem(
                PAUSE_STORAGE_KEY
            ) === 'true',

        ownerId: null,
        ownerSource: '',

        highlightedFields: new Set(),

        /*
         * Ключ поля -> контейнер кнопок.
         */
        controls: new Map(),

        autoFieldKeys: loadAutoFieldKeys(),

        scanScheduled: false,
        purchaseAlerted: false,

        quickActionRunning: false,
        preRollRunning: false,

        lastAutoClickAt: 0
    };

    /*
     * Сайт читает event.sourceCapabilities.firesTouchEvents
     * без проверки sourceCapabilities на null.
     */
    const sourceCapabilities = (() => {
        try {
            if (
                typeof InputDeviceCapabilities ===
                'function'
            ) {
                return new InputDeviceCapabilities({
                    firesTouchEvents: false
                });
            }
        } catch (error) {
            console.debug(
                '[Monopoly Helper] InputDeviceCapabilities недоступен:',
                error
            );
        }

        return {
            firesTouchEvents: false
        };
    })();

    function sleep(milliseconds) {
        return new Promise(resolve => {
            window.setTimeout(
                resolve,
                milliseconds
            );
        });
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeOwnerId(value) {
        const text = normalizeText(value);

        if (!/^\d+$/.test(text)) {
            return null;
        }

        return String(Number(text));
    }

    function saveAutoFieldKeys() {
        try {
            sessionStorage.setItem(
                AUTO_FIELDS_STORAGE_KEY,
                JSON.stringify(
                    Array.from(
                        state.autoFieldKeys
                    )
                )
            );
        } catch (error) {
            console.warn(
                '[Monopoly Helper] Ошибка сохранения очереди A:',
                error
            );
        }
    }

    /*
     * Карточка игрока и определение owner ID.
     */

    function getPlayerCards() {
        return Array.from(
            document.querySelectorAll(
                PLAYER_CARD_SELECTOR
            )
        );
    }

    function getNickText(nickElement) {
        return Array.from(
            nickElement.childNodes
        )
            .filter(node => {
                return !(
                    node.nodeType ===
                        Node.ELEMENT_NODE &&
                    node.classList.contains(
                        'custom-me-badge'
                    )
                );
            })
            .map(node => node.textContent)
            .join('')
            .trim();
    }

    function findMyPlayerCard() {
        const cards = getPlayerCards();

        for (const card of cards) {
            const nickElement =
                card.querySelector(
                    '._nick div'
                );

            if (
                nickElement &&
                getNickText(nickElement) ===
                    MY_NICK
            ) {
                return card;
            }
        }

        return null;
    }

    function addPlayerBadge() {
        const card = findMyPlayerCard();

        if (!card) {
            return;
        }

        const nickElement =
            card.querySelector(
                '._nick div'
            );

        if (
            !nickElement ||
            nickElement.querySelector(
                '.custom-me-badge'
            )
        ) {
            return;
        }

        const badge =
            document.createElement('span');

        badge.className =
            'custom-me-badge';

        badge.textContent = 'Я';

        nickElement.appendChild(badge);
    }

    function detectOwnerFromAttributes(card) {
        const elements = [
            card,
            ...card.querySelectorAll('*')
        ];

        for (const element of elements) {
            for (
                const attributeName
                of OWNER_ATTRIBUTE_NAMES
            ) {
                if (
                    !element.hasAttribute(
                        attributeName
                    )
                ) {
                    continue;
                }

                const ownerId =
                    normalizeOwnerId(
                        element.getAttribute(
                            attributeName
                        )
                    );

                if (ownerId !== null) {
                    return {
                        id: ownerId,
                        source:
                            `атрибут ${attributeName}`
                    };
                }
            }
        }

        return null;
    }

    function detectOwnerFromClasses(card) {
        const elements = [
            card,
            ...card.querySelectorAll('*')
        ];

        const patterns = [
            /(?:^|\s)mnpl-player[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)player[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)player-index[-_](\d+)(?:\s|$)/i,
            /(?:^|\s)owner[-_](\d+)(?:\s|$)/i
        ];

        for (const element of elements) {
            const className =
                typeof element.className ===
                'string'
                    ? element.className
                    : '';

            for (const pattern of patterns) {
                const match =
                    className.match(pattern);

                if (match) {
                    return {
                        id: String(
                            Number(match[1])
                        ),
                        source:
                            'класс карточки'
                    };
                }
            }
        }

        return null;
    }

    function detectOwnerId() {
        const cards = getPlayerCards();
        const myCard = findMyPlayerCard();

        if (!myCard) {
            return null;
        }

        const attributeResult =
            detectOwnerFromAttributes(
                myCard
            );

        if (attributeResult) {
            state.ownerId =
                attributeResult.id;

            state.ownerSource =
                attributeResult.source;

            return state.ownerId;
        }

        const classResult =
            detectOwnerFromClasses(
                myCard
            );

        if (classResult) {
            state.ownerId =
                classResult.id;

            state.ownerSource =
                classResult.source;

            return state.ownerId;
        }

        /*
         * Резервный способ:
         * первая карточка игрока = owner 0,
         * вторая карточка игрока = owner 1.
         */
        const index =
            cards.indexOf(myCard);

        if (index >= 0) {
            state.ownerId =
                String(index);

            state.ownerSource =
                'порядок игроков';

            return state.ownerId;
        }

        return null;
    }

    /*
     * Поля и уникальные идентификаторы.
     */

    function getAllFields() {
        return Array.from(
            document.querySelectorAll(
                FIELD_SELECTOR
            )
        );
    }

    function getOwnedFields() {
        if (state.ownerId === null) {
            return [];
        }

        return getAllFields().filter(field => {
            return normalizeOwnerId(
                field.getAttribute(
                    'mnpl-owner'
                )
            ) === state.ownerId;
        });
    }

    function getFieldGroup(field) {
        return normalizeText(
            field?.getAttribute(
                'mnpl-group'
            )
        );
    }

    function getFieldLine(field) {
        return normalizeText(
            field?.getAttribute(
                'mnpl-line'
            )
        );
    }

    /*
     * Получает URL логотипа бренда.
     *
     * Это позволяет отличить поля с одинаковыми:
     * mnpl-group="8"
     * mnpl-line="3"
     *
     * Например Badger и BlackBerry.
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
            getComputedStyle(
                logo
            ).backgroundImage ||
            '';

        const urlMatch =
            backgroundImage.match(
                /url\(["']?(.+?)["']?\)/
            );

        if (!urlMatch) {
            return '';
        }

        const imageUrl =
            urlMatch[1];

        try {
            const url = new URL(
                imageUrl,
                window.location.href
            );

            return decodeURIComponent(
                url.pathname
            ).toLowerCase();
        } catch (error) {
            return imageUrl.toLowerCase();
        }
    }

    /*
     * Уникальный ключ поля.
     *
     * Основной вариант:
     * group + URL логотипа.
     *
     * Например:
     * 8:/fields/brands/8_smartphones/badger.png
     * 8:/fields/brands/8_smartphones/blackberry.svg
     */
    function getFieldKey(field) {
        if (!field) {
            return '';
        }

        const group =
            getFieldGroup(field);

        const logoKey =
            getFieldLogoKey(field);

        if (group && logoKey) {
            return `${group}:${logoKey}`;
        }

        /*
         * Резервный вариант для клетки без логотипа.
         */
        const fields =
            getAllFields();

        const index =
            fields.indexOf(field);

        if (index < 0) {
            return '';
        }

        return [
            group || 'field',
            getFieldLine(field) || 'line',
            index
        ].join(':');
    }

    function findFieldByKey(key) {
        if (!key) {
            return null;
        }

        for (const field of getOwnedFields()) {
            if (
                getFieldKey(field) === key
            ) {
                return field;
            }
        }

        return null;
    }

    function getFieldsInGroup(groupId) {
        if (!groupId) {
            return [];
        }

        return getAllFields().filter(field => {
            return (
                getFieldGroup(field) ===
                groupId
            );
        });
    }

    function ownsFullGroup(field) {
        if (state.ownerId === null) {
            return false;
        }

        const groupId =
            getFieldGroup(field);

        if (
            !groupId ||
            NON_BUILDABLE_GROUPS.has(
                groupId
            )
        ) {
            return false;
        }

        const groupFields =
            getFieldsInGroup(groupId);

        /*
         * Обычная строительная группа должна
         * содержать не менее двух полей.
         */
        if (groupFields.length < 2) {
            return false;
        }

        return groupFields.every(
            groupField => {
                return normalizeOwnerId(
                    groupField.getAttribute(
                        'mnpl-owner'
                    )
                ) === state.ownerId;
            }
        );
    }

    function getFieldLevel(field) {
        const levelElement =
            field.querySelector(
                '.table-body-board-fields-one-level'
            );

        if (!levelElement) {
            return 0;
        }

        /*
         * Главное здание = максимальный уровень.
         */
        if (
            levelElement.querySelector(
                '._big, ._star_big'
            )
        ) {
            return MAX_FIELD_LEVEL;
        }

        /*
         * Каждый _small = один филиал.
         */
        return levelElement.querySelectorAll(
            '._small, ._star_small'
        ).length;
    }

    /*
     * Правила равномерной застройки:
     *
     * + только на минимальном уровне группы.
     * − только на максимальном уровне группы.
     * A на любом незавершённом поле полной группы.
     */
    function getActionAvailability(field) {
        if (
            !field?.isConnected ||
            !ownsFullGroup(field)
        ) {
            return {
                upgrade: false,
                downgrade: false,
                auto: false
            };
        }

        const groupFields =
            getFieldsInGroup(
                getFieldGroup(field)
            );

        if (!groupFields.length) {
            return {
                upgrade: false,
                downgrade: false,
                auto: false
            };
        }

        const currentLevel =
            getFieldLevel(field);

        const levels =
            groupFields.map(groupField => {
                return getFieldLevel(
                    groupField
                );
            });

        const minimumLevel =
            Math.min(...levels);

        const maximumLevel =
            Math.max(...levels);

        return {
            /*
             * При уровнях 2 и 3:
             * поле уровня 2 получает +,
             * поле уровня 3 не получает +.
             */
            upgrade:
                currentLevel <
                    MAX_FIELD_LEVEL &&
                currentLevel ===
                    minimumLevel,

            /*
             * При уровнях 2 и 3:
             * поле уровня 3 получает −,
             * поле уровня 2 не получает −.
             */
            downgrade:
                currentLevel > 0 &&
                currentLevel ===
                    maximumLevel,

            auto:
                currentLevel <
                MAX_FIELD_LEVEL
        };
    }

    /*
     * Генерация событий мыши.
     */

    function patchSourceCapabilities(event) {
        if (event.sourceCapabilities) {
            return event;
        }

        try {
            Object.defineProperty(
                event,
                'sourceCapabilities',
                {
                    configurable: true,
                    value:
                        sourceCapabilities
                }
            );
        } catch (error) {
            console.debug(
                '[Monopoly Helper] sourceCapabilities:',
                error
            );
        }

        return event;
    }

    function createMouseEvent(
        type,
        x,
        y,
        buttons,
        detail = 0
    ) {
        const event =
            new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,

                clientX: x,
                clientY: y,

                screenX:
                    window.screenX + x,

                screenY:
                    window.screenY + y,

                button: 0,
                buttons,
                detail
            });

        return patchSourceCapabilities(
            event
        );
    }

    function createPointerEvent(
        type,
        x,
        y,
        buttons,
        detail = 0
    ) {
        if (
            typeof PointerEvent !==
            'function'
        ) {
            return null;
        }

        const event =
            new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,

                clientX: x,
                clientY: y,

                screenX:
                    window.screenX + x,

                screenY:
                    window.screenY + y,

                button: 0,
                buttons,
                detail,

                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,

                width: 1,
                height: 1,

                pressure:
                    buttons ? 0.5 : 0
            });

        return patchSourceCapabilities(
            event
        );
    }

    function dispatchInputEvent(
        target,
        type,
        x,
        y,
        buttons,
        detail = 0
    ) {
        const event =
            type.startsWith('pointer')
                ? createPointerEvent(
                    type,
                    x,
                    y,
                    buttons,
                    detail
                )
                : createMouseEvent(
                    type,
                    x,
                    y,
                    buttons,
                    detail
                );

        if (event) {
            target.dispatchEvent(event);
        }
    }

    function dispatchClickSequence(
        target,
        x,
        y
    ) {
        if (!(target instanceof Element)) {
            return false;
        }

        try {
            dispatchInputEvent(
                target,
                'pointerover',
                x,
                y,
                0
            );

            dispatchInputEvent(
                target,
                'mouseover',
                x,
                y,
                0
            );

            dispatchInputEvent(
                target,
                'pointermove',
                x,
                y,
                0
            );

            dispatchInputEvent(
                target,
                'mousemove',
                x,
                y,
                0
            );

            dispatchInputEvent(
                target,
                'pointerdown',
                x,
                y,
                1,
                1
            );

            dispatchInputEvent(
                target,
                'mousedown',
                x,
                y,
                1,
                1
            );

            dispatchInputEvent(
                target,
                'pointerup',
                x,
                y,
                0,
                1
            );

            dispatchInputEvent(
                target,
                'mouseup',
                x,
                y,
                0,
                1
            );

            dispatchInputEvent(
                target,
                'click',
                x,
                y,
                0,
                1
            );

            return true;
        } catch (error) {
            console.error(
                '[Monopoly Helper] Ошибка клика:',
                error
            );

            return false;
        }
    }

    function clickElementDirectly(element) {
        if (
            !(element instanceof HTMLElement) ||
            !element.isConnected
        ) {
            return false;
        }

        const rect =
            element.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return false;
        }

        const x = Math.round(
            rect.left +
            rect.width / 2
        );

        const y = Math.round(
            rect.top +
            rect.height / 2
        );

        return dispatchClickSequence(
            element,
            x,
            y
        );
    }

    function clickVisibleElement(element) {
        if (
            !(element instanceof HTMLElement) ||
            !element.isConnected
        ) {
            return false;
        }

        const rect =
            element.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return false;
        }

        const x = Math.round(
            rect.left +
            rect.width / 2
        );

        const y = Math.round(
            rect.top +
            rect.height / 2
        );

        const elementAtPoint =
            document.elementFromPoint(x, y);

        const target =
            elementAtPoint &&
            element.contains(
                elementAtPoint
            )
                ? elementAtPoint
                : element;

        return dispatchClickSequence(
            target,
            x,
            y
        );
    }

    /*
     * Работа с карточкой поля.
     */

    function getCurrentFieldCard() {
        return document.querySelector(
            FIELD_CARD_SELECTOR
        );
    }

    function getCardName(card) {
        return normalizeText(
            card?.querySelector(
                '.TableFieldcard-top-main'
            )?.textContent
        );
    }

    function getCardSignature(card) {
        if (!card) {
            return '';
        }

        const actions = Array.from(
            card.querySelectorAll(
                '.TableFieldcard-buttons > div'
            )
        )
            .map(button => {
                return normalizeText(
                    button.textContent
                ).toLowerCase();
            })
            .join('|');

        return (
            `${getCardName(card)}::${actions}`
        );
    }

    function findCardAction(
        card,
        actionText
    ) {
        if (!card) {
            return null;
        }

        const expected =
            actionText.toLowerCase();

        const buttons =
            card.querySelectorAll(
                '.TableFieldcard-buttons > div'
            );

        for (const button of buttons) {
            const text = normalizeText(
                button.textContent
            ).toLowerCase();

            if (text === expected) {
                return button;
            }
        }

        return null;
    }

    async function waitForCardChange(
        oldCard,
        oldSignature,
        timeout
    ) {
        const startedAt =
            Date.now();

        while (
            Date.now() - startedAt <
            timeout
        ) {
            const currentCard =
                getCurrentFieldCard();

            if (currentCard) {
                const currentSignature =
                    getCardSignature(
                        currentCard
                    );

                if (
                    !oldCard ||
                    currentCard !==
                        oldCard ||
                    currentSignature !==
                        oldSignature
                ) {
                    return currentCard;
                }
            }

            await sleep(40);
        }

        return null;
    }

    /*
     * Открывает карточку только при нажатии +, −
     * или при обработке очереди A.
     */
    async function openFieldCard(field) {
        const oldCard =
            getCurrentFieldCard();

        const oldSignature =
            getCardSignature(oldCard);

        /*
         * Сначала пробуем настоящий контейнер клетки.
         * Внутренние элементы используются как резерв.
         */
        const targets = [
            field,

            field.querySelector(
                '.table-body-board-fields-one-body'
            ),

            field.querySelector(
                '.table-body-board-fields-one-body ._logo'
            ),

            field.querySelector(
                '.table-body-board-fields-one-label'
            )
        ].filter(Boolean);

        for (const target of targets) {
            const rect =
                target.getBoundingClientRect();

            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                continue;
            }

            const x = Math.round(
                rect.left +
                rect.width / 2
            );

            const y = Math.round(
                rect.top +
                rect.height / 2
            );

            dispatchClickSequence(
                target,
                x,
                y
            );

            const card =
                await waitForCardChange(
                    oldCard,
                    oldSignature,
                    550
                );

            if (card) {
                return card;
            }
        }

        /*
         * Резервный нативный вызов click().
         */
        try {
            field.click();
        } catch (error) {
            console.debug(
                '[Monopoly Helper] field.click():',
                error
            );
        }

        const changedCard =
            await waitForCardChange(
                oldCard,
                oldSignature,
                1000
            );

        if (changedCard) {
            return changedCard;
        }

        /*
         * Если карточка этого же поля уже была открыта,
         * её DOM мог не измениться.
         */
        return getCurrentFieldCard();
    }

    async function performFieldAction(
        field,
        actionText
    ) {
        if (!field?.isConnected) {
            return false;
        }

        document.documentElement.classList.add(
            'monopoly-helper-hidden-card-mode'
        );

        try {
            const card =
                await openFieldCard(field);

            if (!card) {
                console.warn(
                    '[Monopoly Helper] Карточка поля не открылась:',
                    getFieldKey(field)
                );

                return false;
            }

            const actionButton =
                findCardAction(
                    card,
                    actionText
                );

            if (!actionButton) {
                console.log(
                    `[Monopoly Helper] "${actionText}" недоступно:`,
                    getCardName(card) ||
                        getFieldKey(field)
                );

                return false;
            }

            /*
             * Карточка прозрачна, поэтому нажимаем
             * непосредственно её штатную кнопку.
             */
            const clicked =
                clickElementDirectly(
                    actionButton
                );

            if (!clicked) {
                console.warn(
                    `[Monopoly Helper] Не удалось нажать "${actionText}"`
                );

                return false;
            }

            console.log(
                `[Monopoly Helper] ${actionText}:`,
                getCardName(card) ||
                    getFieldKey(field)
            );

            await sleep(700);

            return true;
        } catch (error) {
            console.error(
                '[Monopoly Helper] Ошибка действия с полем:',
                error
            );

            return false;
        } finally {
            const card =
                getCurrentFieldCard();

            if (card) {
                card.classList.add(
                    'monopoly-helper-phantom-card'
                );
            }

            document.documentElement.classList.remove(
                'monopoly-helper-hidden-card-mode'
            );
        }
    }

    /*
     * Быстрые кнопки +, − и A.
     */

    function toggleAutoField(field) {
        const key =
            getFieldKey(field);

        if (!key) {
            return;
        }

        if (
            state.autoFieldKeys.has(key)
        ) {
            state.autoFieldKeys.delete(
                key
            );
        } else {
            state.autoFieldKeys.add(key);
        }

        saveAutoFieldKeys();

        updateControlButtons();
        updateControlPanel();

        console.log(
            `[Monopoly Helper] A ${
                state.autoFieldKeys.has(key)
                    ? 'ВКЛ'
                    : 'ВЫКЛ'
            }:`,
            key
        );
    }

    async function executeManualAction(
        field,
        action
    ) {
        if (
            state.quickActionRunning ||
            state.preRollRunning
        ) {
            return;
        }

        const availability =
            getActionAvailability(field);

        if (
            action === 'upgrade' &&
            !availability.upgrade
        ) {
            return;
        }

        if (
            action === 'downgrade' &&
            !availability.downgrade
        ) {
            return;
        }

        state.quickActionRunning = true;

        updateControlPanel();

        try {
            await performFieldAction(
                field,
                action === 'upgrade'
                    ? 'Построить'
                    : 'Продать'
            );
        } finally {
            state.quickActionRunning = false;

            await sleep(150);

            updateFields();
            updateControlPanel();
        }
    }

    /*
     * Обработчик находится непосредственно на кнопке.
     * Он не зависит от делегирования через overlay.
     */
    function handleQuickButton(
        button,
        event
    ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const fieldKey =
            button.dataset.fieldKey;

        const action =
            button.dataset.action;

        const field =
            findFieldByKey(fieldKey);

        if (!field) {
            console.warn(
                '[Monopoly Helper] Поле не найдено:',
                fieldKey
            );

            return;
        }

        if (action === 'auto') {
            toggleAutoField(field);

            return;
        }

        if (
            action === 'upgrade' ||
            action === 'downgrade'
        ) {
            executeManualAction(
                field,
                action
            );
        }
    }

    function createActionButton(
        field,
        action
    ) {
        const button =
            document.createElement('button');

        const fieldKey =
            getFieldKey(field);

        button.type = 'button';

        button.dataset.fieldKey =
            fieldKey;

        button.dataset.action =
            action;

        button.className =
            `monopoly-helper-quick-button ${action}`;

        if (action === 'upgrade') {
            button.textContent = '+';
            button.title =
                'Построить филиал';
        } else if (
            action === 'downgrade'
        ) {
            button.textContent = '−';
            button.title =
                'Продать филиал';
        } else {
            button.textContent = 'A';
            button.title =
                'Автоулучшение перед броском';
        }

        /*
         * Основное событие.
         */
        button.addEventListener(
            'click',
            event => {
                handleQuickButton(
                    button,
                    event
                );
            },
            true
        );

        /*
         * Не позволяем событию уйти на игровое поле.
         */
        button.addEventListener(
            'pointerdown',
            event => {
                event.stopPropagation();
            },
            true
        );

        button.addEventListener(
            'mousedown',
            event => {
                event.stopPropagation();
            },
            true
        );

        button.addEventListener(
            'mouseup',
            event => {
                event.stopPropagation();
            },
            true
        );

        return button;
    }

    function createControl(
        field,
        key
    ) {
        const control =
            document.createElement('div');

        control.className =
            'monopoly-helper-field-controls';

        control.dataset.fieldKey =
            key;

        control.addEventListener(
            'click',
            event => {
                event.stopPropagation();
            }
        );

        control.addEventListener(
            'pointerdown',
            event => {
                event.stopPropagation();
            }
        );

        const overlay =
            document.getElementById(
                'monopoly-helper-overlay'
            );

        overlay?.appendChild(control);

        state.controls.set(
            key,
            control
        );

        return control;
    }

    function updateSingleControl(
        field,
        availability
    ) {
        const key =
            getFieldKey(field);

        if (!key) {
            return;
        }

        let control =
            state.controls.get(key);

        if (!control?.isConnected) {
            control =
                createControl(
                    field,
                    key
                );
        }

        const actions = [];

        if (availability.upgrade) {
            actions.push('upgrade');
        }

        if (availability.downgrade) {
            actions.push('downgrade');
        }

        if (availability.auto) {
            actions.push('auto');
        }

        const signature =
            actions.join('|');

        /*
         * Кнопки не пересоздаются, если их набор
         * не изменился.
         */
        if (
            control.dataset.signature !==
            signature
        ) {
            const buttons =
                actions.map(action => {
                    return createActionButton(
                        field,
                        action
                    );
                });

            control.replaceChildren(
                ...buttons
            );

            control.dataset.signature =
                signature;
        }

        const autoButton =
            control.querySelector(
                '[data-action="auto"]'
            );

        if (autoButton) {
            const enabled =
                state.autoFieldKeys.has(
                    key
                );

            autoButton.classList.toggle(
                'enabled',
                enabled
            );

            autoButton.title = enabled
                ? 'Автоулучшение включено'
                : 'Включить автоулучшение';
        }
    }

    function updateControlButtons() {
        const ownedFields =
            getOwnedFields();

        const activeKeys =
            new Set();

        for (const field of ownedFields) {
            const key =
                getFieldKey(field);

            if (!key) {
                continue;
            }

            const availability =
                getActionAvailability(
                    field
                );

            const shouldShow =
                availability.upgrade ||
                availability.downgrade ||
                availability.auto;

            if (!shouldShow) {
                continue;
            }

            activeKeys.add(key);

            updateSingleControl(
                field,
                availability
            );
        }

        for (
            const [key, control]
            of state.controls
        ) {
            if (!activeKeys.has(key)) {
                control.remove();

                state.controls.delete(
                    key
                );
            }
        }

        positionControls();
    }

    function positionControls() {
        for (
            const [key, control]
            of state.controls
        ) {
            const field =
                findFieldByKey(key);

            if (
                !field ||
                !control.isConnected
            ) {
                control.style.display =
                    'none';

                continue;
            }

            const rect =
                field.getBoundingClientRect();

            const visible =
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom > 0 &&
                rect.right > 0 &&
                rect.top <
                    window.innerHeight &&
                rect.left <
                    window.innerWidth;

            if (!visible) {
                control.style.display =
                    'none';

                continue;
            }

            control.style.display =
                'flex';

            control.style.left =
                `${Math.round(
                    rect.left +
                    rect.width / 2
                )}px`;

            control.style.top =
                `${Math.round(
                    rect.top +
                    rect.height / 2
                )}px`;
        }
    }

    function updateFields() {
        const currentFields =
            new Set(getOwnedFields());

        for (const field of currentFields) {
            field.classList.add(
                'monopoly-helper-my-field'
            );
        }

        for (
            const oldField
            of state.highlightedFields
        ) {
            if (
                oldField.isConnected &&
                !currentFields.has(oldField)
            ) {
                oldField.classList.remove(
                    'monopoly-helper-my-field'
                );
            }
        }

        state.highlightedFields =
            currentFields;

        updateControlButtons();
    }

    /*
     * Очередь автоматических улучшений.
     */

    function getAutoQueue() {
        return getOwnedFields().filter(
            field => {
                const key =
                    getFieldKey(field);

                return (
                    key &&
                    state.autoFieldKeys.has(
                        key
                    )
                );
            }
        );
    }

    async function runAutoQueue() {
        const queuedKeys =
            getAutoQueue().map(field => {
                return getFieldKey(field);
            });

        console.log(
            '[Monopoly Helper] Очередь A:',
            queuedKeys.length
        );

        for (const key of queuedKeys) {
            /*
             * После каждого улучшения сайт может
             * пересоздать DOM клетки.
             */
            const field =
                findFieldByKey(key);

            if (!field) {
                continue;
            }

            const availability =
                getActionAvailability(
                    field
                );

            if (!availability.upgrade) {
                console.log(
                    '[Monopoly Helper] A пропуск:',
                    key
                );

                continue;
            }

            await performFieldAction(
                field,
                'Построить'
            );

            await sleep(150);

            updateFields();
        }
    }

    /*
     * Звук, пауза и автоматические действия.
     */

    function playAlertSound() {
        try {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContextClass) {
                return;
            }

            const context =
                new AudioContextClass();

            const oscillator =
                context.createOscillator();

            const gain =
                context.createGain();

            oscillator.type = 'sine';

            oscillator.frequency.value =
                800;

            gain.gain.setValueAtTime(
                0.1,
                context.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.3
            );

            oscillator.connect(gain);

            gain.connect(
                context.destination
            );

            oscillator.start();

            oscillator.stop(
                context.currentTime + 0.3
            );

            oscillator.addEventListener(
                'ended',
                () => {
                    context
                        .close()
                        .catch(() => {});
                }
            );
        } catch (error) {
            console.debug(
                '[Monopoly Helper] Ошибка звука:',
                error
            );
        }
    }

    function setPaused(paused) {
        state.paused =
            Boolean(paused);

        localStorage.setItem(
            PAUSE_STORAGE_KEY,
            String(state.paused)
        );

        updateControlPanel();

        console.log(
            state.paused
                ? '[Monopoly Helper] Автоматизация на паузе'
                : '[Monopoly Helper] Автоматизация включена'
        );
    }

    function togglePaused() {
        setPaused(
            !state.paused
        );
    }

    function processPurchaseAlert() {
        const title =
            document.querySelector(
                '.TableAction-top-title'
            );

        const text =
            normalizeText(
                title?.textContent
            ).toLowerCase();

        const purchaseVisible =
            text.includes('покупаем');

        if (
            purchaseVisible &&
            !state.purchaseAlerted
        ) {
            state.purchaseAlerted = true;

            playAlertSound();
        } else if (!purchaseVisible) {
            state.purchaseAlerted = false;
        }
    }

    async function processRollButton(
        rollButton
    ) {
        if (
            state.paused ||
            state.preRollRunning ||
            state.quickActionRunning
        ) {
            return;
        }

        state.preRollRunning = true;

        updateControlPanel();

        try {
            await runAutoQueue();
        } catch (error) {
            console.error(
                '[Monopoly Helper] Ошибка очереди A:',
                error
            );
        } finally {
            state.preRollRunning = false;

            updateControlPanel();

            await sleep(100);

            if (
                rollButton.isConnected &&
                !state.paused
            ) {
                state.lastAutoClickAt =
                    Date.now();

                console.log(
                    '[Monopoly Helper] Бросить кубики'
                );

                clickVisibleElement(
                    rollButton
                );
            }
        }
    }

    function processActionButtons() {
        if (
            state.paused ||
            state.preRollRunning ||
            state.quickActionRunning
        ) {
            return;
        }

        const buttons =
            document.querySelectorAll(
                ACTION_BUTTON_SELECTOR
            );

        for (const button of buttons) {
            const text =
                normalizeText(
                    button.textContent
                ).toLowerCase();

            if (
                text.includes(
                    'бросить кубики'
                )
            ) {
                if (
                    button.dataset
                        .helperProcessing ===
                    'true'
                ) {
                    return;
                }

                button.dataset
                    .helperProcessing =
                    'true';

                processRollButton(button)
                    .finally(() => {
                        window.setTimeout(
                            () => {
                                if (
                                    button.isConnected
                                ) {
                                    delete button
                                        .dataset
                                        .helperProcessing;
                                }
                            },
                            CLICK_COOLDOWN
                        );
                    });

                return;
            }

            if (
                text.includes('заплатить')
            ) {
                if (
                    button.dataset
                        .helperProcessing ===
                    'true'
                ) {
                    return;
                }

                const now = Date.now();

                if (
                    now -
                        state.lastAutoClickAt <
                    CLICK_COOLDOWN
                ) {
                    return;
                }

                button.dataset
                    .helperProcessing =
                    'true';

                state.lastAutoClickAt =
                    now;

                console.log(
                    '[Monopoly Helper] Заплатить банку'
                );

                clickVisibleElement(
                    button
                );

                window.setTimeout(
                    () => {
                        if (
                            button.isConnected
                        ) {
                            delete button
                                .dataset
                                .helperProcessing;
                        }
                    },
                    CLICK_COOLDOWN
                );

                return;
            }
        }
    }

    /*
     * Интерфейс.
     */

    function addStyles() {
        document
            .getElementById(
                'monopoly-helper-styles'
            )
            ?.remove();

        const style =
            document.createElement('style');

        style.id =
            'monopoly-helper-styles';

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

            #monopoly-helper-toggle {
                display: block;
                width: 100%;
                box-sizing: border-box;
                padding: 9px 8px;
                border: 0;
                border-radius: 7px;
                color: #fff;
                cursor: pointer;
                font: 700 13px Arial, sans-serif;
                pointer-events: auto;
            }

            #monopoly-helper-status {
                margin-top: 8px;
                color: rgba(255, 255, 255, 0.78);
                font-size: 10px;
                line-height: 1.4;
                text-align: center;
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

            html.monopoly-helper-hidden-card-mode .TableFieldcard,
            .TableFieldcard.monopoly-helper-phantom-card {
                opacity: 0 !important;
                transition: none !important;
                animation: none !important;
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

            .monopoly-helper-quick-button.upgrade {
                background: #159447;
            }

            .monopoly-helper-quick-button.downgrade {
                background: #c9342f;
            }

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

            .monopoly-helper-quick-button:hover {
                filter: brightness(1.25);
            }

            .monopoly-helper-quick-button:active {
                transform: scale(0.9);
            }

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

                .monopoly-helper-quick-button.auto {
                    font-size: 9px;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function createInterface() {
        document
            .getElementById(
                'monopoly-helper-panel'
            )
            ?.remove();

        document
            .getElementById(
                'monopoly-helper-overlay'
            )
            ?.remove();

        state.controls.clear();

        const overlay =
            document.createElement('div');

        overlay.id =
            'monopoly-helper-overlay';

        document.body.appendChild(
            overlay
        );

        const panel =
            document.createElement('div');

        panel.id =
            'monopoly-helper-panel';

        const toggle =
            document.createElement('button');

        toggle.id =
            'monopoly-helper-toggle';

        toggle.type = 'button';

        toggle.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                togglePaused();
            }
        );

        const status =
            document.createElement('div');

        status.id =
            'monopoly-helper-status';

        panel.append(
            toggle,
            status
        );

        document.body.appendChild(
            panel
        );

        updateControlPanel();
    }

    function updateControlPanel() {
        const toggle =
            document.getElementById(
                'monopoly-helper-toggle'
            );

        const status =
            document.getElementById(
                'monopoly-helper-status'
            );

        if (toggle) {
            toggle.textContent =
                state.paused
                    ? 'Авто: ПАУЗА'
                    : 'Авто: ВКЛ';

            toggle.style.background =
                state.paused
                    ? '#c0392b'
                    : '#1f9d62';
        }

        if (!status) {
            return;
        }

        let text;

        if (state.preRollRunning) {
            text =
                'Автоулучшение перед броском...';
        } else if (
            state.quickActionRunning
        ) {
            text =
                'Действие с полем...';
        } else if (
            state.ownerId === null
        ) {
            text =
                'Определение игрока...';
        } else {
            text =
                `Моих полей: ` +
                `${state.highlightedFields.size}. ` +
                `Очередь A: ` +
                `${getAutoQueue().length}. ` +
                `Owner: ${state.ownerId}. ` +
                'Пауза: Alt + P';
        }

        if (
            status.textContent !== text
        ) {
            status.textContent = text;
        }
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
     * После настоящего ручного клика снова показываем
     * карточки полей, которые ранее были открыты фантомно.
     */
    function handleTrustedPointerDown(event) {
        if (!event.isTrusted) {
            return;
        }

        if (
            event.target.closest?.(
                '#monopoly-helper-panel, ' +
                '#monopoly-helper-overlay'
            )
        ) {
            return;
        }

        document
            .querySelectorAll(
                '.TableFieldcard.monopoly-helper-phantom-card'
            )
            .forEach(card => {
                card.classList.remove(
                    'monopoly-helper-phantom-card'
                );
            });
    }

    /*
     * Основной цикл.
     */

    function scanPage() {
        state.scanScheduled = false;

        addPlayerBadge();

        if (state.ownerId === null) {
            detectOwnerId();
        }

        updateFields();
        processPurchaseAlert();
        processActionButtons();
        updateControlPanel();
    }

    function scheduleScan() {
        if (state.scanScheduled) {
            return;
        }

        state.scanScheduled = true;

        requestAnimationFrame(
            scanPage
        );
    }

    function start() {
        addStyles();
        createInterface();

        document.addEventListener(
            'keydown',
            handleKeyboard
        );

        document.addEventListener(
            'pointerdown',
            handleTrustedPointerDown,
            true
        );

        window.addEventListener(
            'resize',
            positionControls
        );

        window.addEventListener(
            'scroll',
            positionControls,
            true
        );

        const observer =
            new MutationObserver(
                scheduleScan
            );

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,

                /*
                 * class не отслеживается, чтобы наша
                 * подсветка не запускала observer по кругу.
                 */
                attributeFilter: [
                    'mnpl-owner',
                    'mnpl-group',
                    'mnpl-line',
                    'mnpl-player',
                    'mnpl-player-id',
                    'mnpl-player-index',
                    'mnpl-index',
                    'data-owner',
                    'data-owner-id',
                    'data-player',
                    'data-player-id',
                    'data-player-index'
                ]
            }
        );

        window.setInterval(
            () => {
                positionControls();
            },
            300
        );

        window.setInterval(
            () => {
                if (
                    state.ownerId ===
                    null
                ) {
                    detectOwnerId();
                }

                updateFields();
                updateControlPanel();
            },
            1500
        );

        scanPage();

        console.log(
            'Monopoly-One Helper v2.6 запущен'
        );
    }

    if (document.body) {
        start();
    } else {
        window.addEventListener(
            'DOMContentLoaded',
            start,
            {
                once: true
            }
        );
    }
})();
