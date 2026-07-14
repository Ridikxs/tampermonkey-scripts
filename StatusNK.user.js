// ==UserScript==
// @name         StatusNK
// @namespace    http://tampermonkey.net/
// @version      3.1
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

    // Кэш статусов клиентов
    const statusCache = {};
    let activeIframeClientId = null;

    // Очистка строки и превращение в число с учетом копеек (десятичных дробей)
    function parseDeposit(text) {
        if (!text) return 0;
        // 1. Удаляем запятые (разделители тысяч, например в 20,404.2)
        // 2. Удаляем всё, кроме цифр и точки
        const cleaned = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
    }

    // Получение ID клиента из текущего URL
    function getClientIdFromUrl() {
        const match = window.location.pathname.match(/\/clients\/(\d+)/);
        return match ? match[1] : null;
    }

    // Анализ DOM-дерева
    function extractClientData(doc) {
        let depositSum = 0;
        let isDataReady = false;

        // 1. Ищем сумму депозитов и проверяем, что Angular успел загрузить цифры
        const depositBlocks = doc.querySelectorAll('.dashboard-cashier-bonuses-info__block');
        depositBlocks.forEach(block => {
            const keyEl = block.querySelector('.dashboard-cashier-bonuses-info__block--key');
            if (keyEl && keyEl.textContent.includes('Total Deposits')) {
                const valueEl = block.querySelector('.dashboard-cashier-bonuses-info__block--value');
                if (valueEl && valueEl.textContent.trim().length > 0) {
                    depositSum = parseDeposit(valueEl.textContent);
                    isDataReady = true; // Подтверждаем, что данные реально загрузились!
                }
            }
        });

        // Если мы парсим iframe, но блок Total Deposits еще не успел получить данные с сервера — отменяем парсинг
        if (!isDataReady && doc !== document) {
            return null;
        }

        // 2. Поиск точных тегов VIP / PREVIP
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

        // 3. Формирование статуса
        const isVipByDeposit = depositSum >= VIP_DEPOSIT_THRESHOLD;
        let statusText = 'REGULAR';
        let bgColor = '#6c757d'; // Серый
        let textColor = '#ffffff';
        
        // Красиво форматируем сумму для вывода (с разделителями тысяч и копейками, если они есть)
        const formattedSum = depositSum.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        let details = `Депозиты: ${formattedSum}`;

        if (isVipByDeposit || hasVipTag || hasPreVipTag) {
            let reasons = [];
            if (isVipByDeposit) reasons.push('Деп ≥ 300k');
            if (hasVipTag) reasons.push('Тег VIP');
            if (hasPreVipTag) reasons.push('Тег PREVIP');

            if (isVipByDeposit || hasVipTag) {
                statusText = 'VIP';
                bgColor = '#d9534f'; // Красный (VIP)
            } else {
                statusText = 'PREVIP';
                bgColor = '#f0ad4e'; // Оранжевый (PREVIP)
            }
            details += ` (${reasons.join(', ')})`;
        }

        return { statusText, details, bgColor, textColor };
    }

    // Загрузка вкладки Dashboard в скрытом iframe с имитацией экрана
    function loadDashboardViaIframe(clientId) {
        if (statusCache[clientId] || activeIframeClientId === clientId) return;
        activeIframeClientId = clientId;

        const existingIframe = document.getElementById(IFRAME_ID);
        if (existingIframe) existingIframe.remove();

        const iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.src = `https://backoffice-public.prod.bosx.cc/clients/${clientId}/dashboard`;
        
        // Делаем iframe полноценным по размеру (1000x800), чтобы Angular не тормозил загрузку,
        // но прячем его далеко за пределы экрана
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
        const maxAttempts = 30; // Максимум 15 секунд ожидания (30 * 500мс)

        const checkInterval = setInterval(() => {
            attempts++;
            const currentId = getClientIdFromUrl();

            // Если пользователь уже перешел в другого клиента или вышло время
            if (currentId !== clientId || attempts > maxAttempts) {
                clearInterval(checkInterval);
                if (iframe.parentNode) iframe.remove();
                if (activeIframeClientId === clientId) activeIframeClientId = null;
                return;
            }

            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    // Пытаемся извлечь данные. Если Angular еще не подтянул цифры депозитов — вернет null
                    const data = extractClientData(iframeDoc);
                    
                    if (data) {
                        clearInterval(checkInterval);
                        statusCache[clientId] = data; // Сохраняем успешный результат
                        iframe.remove(); // Удаляем iframe
                        activeIframeClientId = null;
                        run(); // Мгновенно отрисовываем рассчитанный бейдж
                    }
                }
            } catch (e) {
                // Игнорируем ошибки доступа в момент загрузки страницы
            }
        }, 500);
    }

    // Отрисовка бейджа
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

        badge.style.backgroundColor = data.bgColor;
        badge.style.color = data.textColor;
        badge.innerHTML = `<span style="letter-spacing: 0.5px;">${data.statusText}</span>&nbsp;<span style="font-size: 11px; opacity: 0.9; font-weight: normal;">| ${data.details}</span>`;
    }

    // Главный цикл
    function run() {
        const clientId = getClientIdFromUrl();
        if (!clientId) return;

        const isDashboard = window.location.pathname.includes('/dashboard');
        let clientData = null;

        if (isDashboard) {
            // На Dashboard читаем напрямую
            clientData = extractClientData(document);
            if (clientData) {
                statusCache[clientId] = clientData;
            }
        } else {
            // На других вкладках проверяем кэш
            if (statusCache[clientId]) {
                clientData = statusCache[clientId];
            } else {
                // Запускаем фоновую загрузку
                loadDashboardViaIframe(clientId);
                
                // Пока идет загрузка, показываем красивый синий статус ожидания
                const usernameEl = document.querySelector('.client__username');
                if (usernameEl && activeIframeClientId === clientId) {
                    renderBadgeEl(usernameEl, BADGE_ID_USERNAME, {
                        statusText: '⏳ ЗАГРУЗКА...',
                        details: 'Чтение Dashboard',
                        bgColor: '#17a2b8', // Информационный синий
                        textColor: '#ffffff'
                    }, 'after');
                }
                return;
            }
        }

        // Если финальные данные готовы — выводим их
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

    // Проверяем страницу каждую секунду
    setInterval(run, 1000);

})();
