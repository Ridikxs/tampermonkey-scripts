// ==UserScript==
// @name         StatusNK
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Индикация загрузки статуса
// @author       calvin
// @match        https://backoffice-public.prod.bosx.cc/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bosx.cc
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/StatusNK.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/StatusNK.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VIP_DEPOSIT_THRESHOLD = 300000;
    const BADGE_ID_NOTES = 'tm-client-status-badge-notes';
    const BADGE_ID_USERNAME = 'tm-client-status-badge-username';
    const IFRAME_ID = 'tm-hidden-dashboard-loader';

    // 1. ВНЕДРЕНИЕ МГНОВЕННЫХ CSS-ПРАВИЛ
    // Это исключает мерцание строк при скролле — браузер скрывает их аппаратно
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        .ag-row[data-is-bonus-note="true"] {
            display: none !important;
        }
        .ag-cell[col-id="LastUpdateTime"][data-utc-converted="true"] .ag-cell-value {
            font-size: 11px !important;
            letter-spacing: -0.3px !important;
            white-space: nowrap !important;
        }
    `;
    document.head.appendChild(styleEl);

    // Кэш статусов клиентов
    const statusCache = {};
    let activeIframeClientId = null;
    let isProcessingGrid = false; // Защита от бесконечного цикла MutationObserver

    // Очистка строки и превращение в число с учетом копеек
    function parseDeposit(text) {
        if (!text) return 0;
        const cleaned = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
    }

    // Получение ID клиента из текущего URL
    function getClientIdFromUrl() {
        const match = window.location.pathname.match(/\/clients\/(\d+)/);
        return match ? match[1] : null;
    }

    // Формирование строки текущего времени UTC и МСК для бейджа
    function getFormattedTimes() {
        const now = new Date();
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };

        const utcTime = now.toLocaleTimeString('ru-RU', { ...timeOptions, timeZone: 'UTC' });
        const mskTime = now.toLocaleTimeString('ru-RU', { ...timeOptions, timeZone: 'Europe/Moscow' });

        return `🕒 UTC: ${utcTime} | МСК: ${mskTime}`;
    }

    // 2. УМНАЯ ОБРАБОТКА ТАБЛИЦЫ AG-GRID (СКРЫТИЕ + СДВИГ В РЕАЛЬНОМ ВРЕМЕНИ)
    function processAgGridNotes() {
        if (isProcessingGrid) return;
        isProcessingGrid = true;

        try {
            const allRows = document.querySelectorAll('.ag-row');
            if (!allRows.length) return;

            const hiddenRowIds = new Set();

            // Первый проход: выявляем строки с "Bonus claimed by id" и вешаем CSS-метку
            allRows.forEach(row => {
                const text = row.textContent || '';
                const rowId = row.getAttribute('row-id') || row.getAttribute('row-index');

                if (text.includes('Bonus claimed by id')) {
                    row.setAttribute('data-is-bonus-note', 'true');
                    if (rowId !== null) hiddenRowIds.add(rowId);
                } else if (row.getAttribute('data-is-bonus-note') === 'true') {
                    // Если строка была переиспользована виртуальным скроллом под другие данные
                    row.removeAttribute('data-is-bonus-note');
                }
            });

            // Второй проход: синхронизируем скрытие во всех колонках (левая, правая, центр)
            if (hiddenRowIds.size > 0) {
                allRows.forEach(row => {
                    const rowId = row.getAttribute('row-id') || row.getAttribute('row-index');
                    if (rowId !== null && hiddenRowIds.has(rowId)) {
                        row.setAttribute('data-is-bonus-note', 'true');
                    }
                });
            }

            // Третий проход: сдвигаем оставшиеся строки вверх, закрывая дыры
            const containers = document.querySelectorAll('.ag-center-cols-container, .ag-pinned-left-cols-container, .ag-pinned-right-cols-container');
            containers.forEach(container => {
                const rows = Array.from(container.querySelectorAll('.ag-row'));
                if (!rows.length) return;

                rows.sort((a, b) => {
                    const indexA = parseFloat(a.getAttribute('row-index') || a.getAttribute('row-id') || 0);
                    const indexB = parseFloat(b.getAttribute('row-index') || b.getAttribute('row-id') || 0);
                    return indexA - indexB;
                });

                let currentY = 0;
                rows.forEach(row => {
                    if (row.getAttribute('data-is-bonus-note') !== 'true') {
                        const height = row.offsetHeight || 32;
                        row.style.transform = `translateY(${currentY}px)`;
                        currentY += height;
                    }
                });

                if (currentY > 0) {
                    container.style.height = `${currentY}px`;
                }
            });

            // Одновременно запускаем конвертацию времени
            convertTableTimesToUTC();
        } finally {
            isProcessingGrid = false;
        }
    }

    // Парсер даты и времени из локального часового пояса ПК в UTC
    function convertLocalToUtc(dateStr) {
        if (!dateStr || dateStr.includes('UTC')) return null;

        let day, month, year, hours, minutes, seconds = 0;

        const dmyMatch = dateStr.trim().match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (dmyMatch) {
            day = parseInt(dmyMatch[1], 10);
            month = parseInt(dmyMatch[2], 10) - 1;
            year = parseInt(dmyMatch[3], 10);
            hours = parseInt(dmyMatch[4], 10);
            minutes = parseInt(dmyMatch[5], 10);
            if (dmyMatch[6]) seconds = parseInt(dmyMatch[6], 10);
        } else {
            const isoMatch = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (isoMatch) {
                year = parseInt(isoMatch[1], 10);
                month = parseInt(isoMatch[2], 10) - 1;
                day = parseInt(isoMatch[3], 10);
                hours = parseInt(isoMatch[4], 10);
                minutes = parseInt(isoMatch[5], 10);
                if (isoMatch[6]) seconds = parseInt(isoMatch[6], 10);
            } else {
                return null;
            }
        }

        const localDate = new Date(year, month, day, hours, minutes, seconds);
        if (isNaN(localDate.getTime())) return null;

        const utcDay = String(localDate.getUTCDate()).padStart(2, '0');
        const utcMonth = String(localDate.getUTCMonth() + 1).padStart(2, '0');
        const utcYear = localDate.getUTCFullYear();
        const utcHours = String(localDate.getUTCHours()).padStart(2, '0');
        const utcMinutes = String(localDate.getUTCMinutes()).padStart(2, '0');
        const utcSeconds = String(localDate.getUTCSeconds()).padStart(2, '0');

        return `${utcDay}/${utcMonth}/${utcYear} ${utcHours}:${utcMinutes}:${utcSeconds} UTC`;
    }

    // Конвертация времени в колонке LastUpdateTime в UTC
    function convertTableTimesToUTC() {
        const timeCells = document.querySelectorAll('.ag-cell[col-id="LastUpdateTime"]:not([data-utc-converted="true"])');
        timeCells.forEach(cell => {
            const valueSpan = cell.querySelector('.ag-cell-value');
            if (!valueSpan) return;

            const originalText = valueSpan.textContent.trim();
            if (!originalText || originalText.includes('UTC')) {
                cell.setAttribute('data-utc-converted', 'true');
                return;
            }

            const convertedTime = convertLocalToUtc(originalText);
            if (convertedTime) {
                valueSpan.textContent = convertedTime;
                cell.title = `Локальное время: ${originalText} | UTC: ${convertedTime}`;
            }
            cell.setAttribute('data-utc-converted', 'true');
        });
    }

    // Анализ DOM-дерева для сбора депозитов и тегов
    function extractClientData(doc) {
        let depositSum = 0;
        let isDataReady = false;

        const depositBlocks = doc.querySelectorAll('.dashboard-cashier-bonuses-info__block');
        depositBlocks.forEach(block => {
            const keyEl = block.querySelector('.dashboard-cashier-bonuses-info__block--key');
            if (keyEl && keyEl.textContent.includes('Total Deposits')) {
                const valueEl = block.querySelector('.dashboard-cashier-bonuses-info__block--value');
                if (valueEl && valueEl.textContent.trim().length > 0) {
                    depositSum = parseDeposit(valueEl.textContent);
                    isDataReady = true;
                }
            }
        });

        if (!isDataReady && doc !== document) {
            return null;
        }

        let hasVipTag = false;
        let hasPreVipTag = false;
        const segmentsContainer = doc.querySelector('.dashboard-segments');
        if (segmentsContainer) {
            const valueElements = segmentsContainer.querySelectorAll('.dashboard-segments__block--value, .dashboard-segments__list--item');
            valueElements.forEach(el => {
                const text = el.textContent || '';
                const tags = text.split(',').map(t => t.trim().toUpperCase());
                if (tags.includes('VIP')) hasVipTag = true;
                if (tags.includes('PREVIP')) hasPreVipTag = true;
            });
        }

        const isVipByDeposit = depositSum >= VIP_DEPOSIT_THRESHOLD;
        let statusText = 'REGULAR';
        let bgColor = '#6c757d';
        let textColor = '#ffffff';

        const formattedSum = depositSum.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        let details = `Депозиты: ${formattedSum}`;

        if (isVipByDeposit || hasVipTag || hasPreVipTag) {
            let reasons = [];
            if (isVipByDeposit) reasons.push('Деп ≥ 300k');
            if (hasVipTag) reasons.push('Тег VIP');
            if (hasPreVipTag) reasons.push('Тег PREVIP');

            if (isVipByDeposit || hasVipTag) {
                statusText = 'VIP';
                bgColor = '#d9534f';
            } else {
                statusText = 'PREVIP';
                bgColor = '#f0ad4e';
            }
            details += ` (${reasons.join(', ')})`;
        }

        return { statusText, details, bgColor, textColor };
    }

    // Загрузка вкладки Dashboard в скрытом iframe
    function loadDashboardViaIframe(clientId) {
        if (statusCache[clientId] || activeIframeClientId === clientId) return;
        activeIframeClientId = clientId;

        const existingIframe = document.getElementById(IFRAME_ID);
        if (existingIframe) existingIframe.remove();

        const iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.src = `https://backoffice-public.prod.bosx.cc/clients/${clientId}/dashboard`;

        Object.assign(iframe.style, {
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            width: '1000px',
            height: '800px',
            opacity: '0',
            pointerEvents: 'none',
            zIndex: '-9999'
        });

        document.body.appendChild(iframe);

        let attempts = 0;
        const maxAttempts = 30;

        const checkInterval = setInterval(() => {
            attempts++;
            const currentId = getClientIdFromUrl();

            if (currentId !== clientId || attempts > maxAttempts) {
                clearInterval(checkInterval);
                if (iframe.parentNode) iframe.remove();
                if (activeIframeClientId === clientId) activeIframeClientId = null;
                return;
            }

            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const data = extractClientData(iframeDoc);
                    if (data) {
                        clearInterval(checkInterval);
                        statusCache[clientId] = data;
                        iframe.remove();
                        activeIframeClientId = null;
                        run();
                    }
                }
            } catch (e) {}
        }, 500);
    }

    // Отрисовка бейджа со статусом и часами
    function renderBadgeEl(targetEl, badgeId, data, position = 'after') {
        if (!targetEl) return;

        let badge = document.getElementById(badgeId);
        if (!badge) {
            badge = document.createElement('div');
            badge.id = badgeId;
            Object.assign(badge.style, {
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                margin: '0 10px',
                borderRadius: '15px',
                fontWeight: 'bold',
                fontSize: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease',
                cursor: 'default',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
                zIndex: '1000'
            });

            if (position === 'after') {
                targetEl.after(badge);
            } else {
                targetEl.prepend(badge);
            }
        }

        const timesString = getFormattedTimes();

        badge.style.backgroundColor = data.bgColor;
        badge.style.color = data.textColor;
        badge.innerHTML = `<span style="letter-spacing: 0.5px;">${data.statusText}</span>&nbsp;<span style="font-size: 11px; opacity: 0.9; font-weight: normal;">| ${data.details} | ${timesString}</span>`;
    }

    // 3. ОТСЛЕЖИВАНИЕ СКРОЛЛА И ИЗМЕНЕНИЙ В DOM (МУТАЦИИ)
    // Подключаем наблюдатель, который реагирует мгновенно при отрисовке новых строк
    const observer = new MutationObserver(() => {
        processAgGridNotes();
    });

    function setupGridObserver() {
        const gridBody = document.querySelector('.ag-body-viewport') || document.querySelector('.ag-root');
        if (gridBody && !gridBody.hasAttribute('data-tm-observed')) {
            gridBody.setAttribute('data-tm-observed', 'true');

            // Наблюдаем за появлением новых узлов (строк) и изменением их атрибутов при скролле
            observer.observe(gridBody, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['row-index', 'row-id', 'style']
            });

            // Дополнительно вешаем обработчик на физический скролл таблицы
            gridBody.addEventListener('scroll', () => {
                requestAnimationFrame(processAgGridNotes);
            }, { passive: true });
        }
    }

    // Главный цикл
    function run() {
        setupGridObserver();
        processAgGridNotes();

        const clientId = getClientIdFromUrl();
        if (!clientId) return;

        const isDashboard = window.location.pathname.includes('/dashboard');
        let clientData = null;

        if (isDashboard) {
            clientData = extractClientData(document);
            if (clientData) {
                statusCache[clientId] = clientData;
            }
        } else {
            if (statusCache[clientId]) {
                clientData = statusCache[clientId];
            } else {
                loadDashboardViaIframe(clientId);

                const usernameEl = document.querySelector('.client__username');
                if (usernameEl && activeIframeClientId === clientId) {
                    renderBadgeEl(usernameEl, BADGE_ID_USERNAME, {
                        statusText: '⏳ ЗАГРУЗКА...',
                        details: 'Чтение Dashboard',
                        bgColor: '#17a2b8',
                        textColor: '#ffffff'
                    }, 'after');
                }
                return;
            }
        }

        if (clientData) {
            const usernameEl = document.querySelector('.client__username');
            if (usernameEl) {
                renderBadgeEl(usernameEl, BADGE_ID_USERNAME, clientData, 'after');
            }

            const notesHeader = document.querySelector('.dashboard-notes__header');
            if (notesHeader) {
                const titleEl = notesHeader.querySelector('.dashboard-notes__header--title');
                renderBadgeEl(titleEl || notesHeader, BADGE_ID_NOTES, clientData, titleEl ? 'after' : 'prepend');
            }
        }
    }

    // Главный интервал остаётся для обновления часов на бейдже и проверки переходов по страницам
    setInterval(run, 400);

})();
