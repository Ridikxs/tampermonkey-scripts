// ==UserScript==
// @name         New Clock
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Окрашивает таймер при достижении времени.
// @author       Calvin
// @match        https://sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NewClock.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NewClock.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Функция для извлечения нужного времени и перевода его в секунды
    function parseTimeToSeconds(timeStr) {
        let relevantTime = timeStr;

        // Отбрасываем первую часть, если есть точка "•"
        if (timeStr.includes('•')) {
            const parts = timeStr.split('•');
            relevantTime = parts[parts.length - 1].trim();
        }

        let seconds = 0;
        const minMatch = relevantTime.match(/(\d+)\s*m/);
        const secMatch = relevantTime.match(/(\d+)\s*s/);

        if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
        if (secMatch) seconds += parseInt(secMatch[1], 10);

        // Если есть только цифры без букв (например "0")
        if (!minMatch && !secMatch && /\d/.test(relevantTime)) {
            return parseInt(relevantTime.replace(/\D/g, ''), 10) || 0;
        }

        return seconds;
    }

    // Главная функция обновления цветов
    function updateTimerColor() {
        const timerContainers = document.querySelectorAll('div.v-popper--has-tooltip > span');

        timerContainers.forEach(span => {
            const text = span.textContent.trim();

            // Проверяем, что это таймер
            if (/\d/.test(text) && (text.includes('m') || text.includes('s') || text === "0")) {

                const totalSeconds = parseTimeToSeconds(text);
                let newColor = '';

                // Твои настройки цветов и времени:
                if (totalSeconds >= 180) {
                    newColor = '#FF3B30'; // Красный (>= 3 минут)
                } else if (totalSeconds >= 45) {
                    newColor = '#FF9500'; // Оранжевый (от 45 секунд до 3 минут)
                } else {
                    newColor = '#34C759'; // Зеленый (< 45 секунд)
                }

                // Применяем стили с приоритетом
                span.style.setProperty('color', newColor, 'important');
                span.style.setProperty('font-weight', 'bold', 'important');
            }
        });
    }

    // Запускаем проверку каждую секунду
    setInterval(updateTimerColor, 1000);

})();
