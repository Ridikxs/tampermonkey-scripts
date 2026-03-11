// ==UserScript==
// @name         HelpDesk 24h
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Преобразует время из AM/PM в 24-часовой формат в HelpDesk
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @match        https://app.helpdesk.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Функция для конвертации времени
    function convertTo24h(timeStr) {
        // Регулярное выражение для поиска времени типа 09:57 PM
        const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
        const match = timeStr.match(timeRegex);

        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const modifier = match[3].toUpperCase();

        if (modifier === 'PM' && hours < 12) {
            hours += 12;
        }
        if (modifier === 'AM' && hours === 12) {
            hours = 0;
        }

        const sHours = hours.toString().padStart(2, '0');
        return `${sHours}:${minutes}`;
    }

    // Основная функция поиска и замены
    function formatDates() {
        // Ищем по классу, который ты скинул
        const dateElements = document.querySelectorAll('p.lc-Typography-module__paragraph-xs___TlVSn');

        dateElements.forEach(el => {
            // Проверяем, не обрабатывали ли мы уже этот элемент
            if (el.dataset.timeFormatted) return;

            const originalText = el.textContent;
            const time24 = convertTo24h(originalText);

            if (time24) {
                // Добавляем 24-часовое время в скобках рядом
                el.textContent = `${originalText} (${time24})`;
                el.dataset.timeFormatted = "true"; // Помечаем, чтобы не дублировать
            }
        });
    }

    // Следим за изменениями в интерфейсе (так как HelpDesk подгружает данные динамически)
    const observer = new MutationObserver(() => {
        formatDates();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Первичный запуск
    formatDates();
})();