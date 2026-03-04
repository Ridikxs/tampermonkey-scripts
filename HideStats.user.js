// ==UserScript==
// @name         HideStats
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Скрывает платежи, реквизит и не нужную информацию для операторов
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideStats.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideStats.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        // 1. УДАЛЕНИЕ элемента (как вы просили)
        const divToRemove = document.querySelector("#PaymentsInfoTitle > div");
        if (divToRemove) divToRemove.remove();

        // --- Функция для обычного скрытия целых блоков (Платежи и Реквизиты) ---
        function setupSimpleToggle(containerSelector, contentSelector, labelText) {
            const container = document.querySelector(containerSelector);
            const content = document.querySelector(contentSelector);
            if (!container || !content) return;

            content.style.display = 'none';
            const btn = document.createElement('button');
            btn.innerText = `Показать ${labelText}`;
            btn.className = 'btn btn-xs btn-primary';
            btn.style.margin = '10px 0';

            container.prepend(btn);

            let isVisible = false;
            btn.addEventListener('click', () => {
                isVisible = !isVisible;
                content.style.display = isVisible ? 'block' : 'none';
                btn.innerText = isVisible ? `Скрыть ${labelText}` : `Показать ${labelText}`;
                btn.className = isVisible ? 'btn btn-xs btn-danger' : 'btn btn-xs btn-primary';
            });
        }

        // --- Функция для частичного скрытия (внутри OutcomeData после 23-го элемента) ---
        function setupPartialToggle() {
            const container = document.querySelector("#UserSummaryWrapper > div.summary-blocks > div.summary-block-right > div:nth-child(11) > div > div > div.ibox-content");
            const outcomeData = document.querySelector("#OutcomeData");
            const pivot = document.querySelector("#OutcomeData > dd:nth-child(23)");

            if (!container || !outcomeData || !pivot) return;

            // Находим все элементы, которые идут ПОСЛЕ 23-го
            const allChildren = Array.from(outcomeData.children);
            const pivotIndex = allChildren.indexOf(pivot);
            const targets = allChildren.slice(pivotIndex + 1);

            // Скрываем их сразу
            targets.forEach(el => el.style.display = 'none');

            // Создаем кнопку
            const btn = document.createElement('button');
            btn.innerText = 'Показать доп. инфо';
            btn.className = 'btn btn-xs btn-primary';
            btn.style.marginBottom = '10px';
            btn.style.display = 'block';

            container.prepend(btn);

            let isVisible = false;
            btn.addEventListener('click', () => {
                isVisible = !isVisible;
                targets.forEach(el => el.style.display = isVisible ? '' : 'none');
                btn.innerText = isVisible ? 'Скрыть доп. инфо' : 'Показать доп. инфо';
                btn.className = isVisible ? 'btn btn-xs btn-danger' : 'btn btn-xs btn-primary';
            });
        }

        // Запускаем настройку всех кнопок
        setupSimpleToggle("#PaymentsInfoTitle", "#PaymentsInfo", "платежи");
        setupSimpleToggle("#PaymentsRequisitesContainer", "#PaymentsRequisitesTable", "реквизиты");
        setupPartialToggle();
    }

    // Ждем 2 секунды, чтобы страница прогрузила все данные
    setTimeout(init, 2000);


})();
