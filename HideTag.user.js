// ==UserScript==
// @name         HideTag
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Скрывает теги с сохранением оригинальных стилей и крестиков.
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @match        https://backoffice.arkada.casino/ru/Users/Summary*
// @match        https://backoffice.r7.casino/ru/Users/Summary*
// @match        https://backoffice.catcasino.com/ru/Users/Summary*
// @match        https://backoffice.gama.casino/ru/Users/Summary*
// @match        https://backoffice.daddy.casino/ru/Users/Summary*
// @match        https://backoffice.spark.casino/ru/Users/Summary*
// @match        https://backoffice.mers.casino/ru/Users/Summary*
// @match        https://backoffice.kent.casino/ru/Users/Summary*
// @match        https://backoffice.kometa.casino/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideTag.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideTag.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const mainTags = [
        "HighRoll", "VIP", "Privip", "PreVIP", "Reactivation", "Cheater_",
        "VIP Cashback", "SuperVIP", "SuperVIP Cashback", "Cheater",
        "Bonushunter", "test 1", "Blocked", "don't call", "don't write",
        "dont RTNDontEmail", "VIP_DADDY_PM1", "VIP_DADDY_PM2", "VIP_R7_PM1",
        "VIP_R7_PM4", "VIP_R7_PM2", "VIP_R7_PM3", "VIP_KENT_PM1",
        "VIP_KENT_PM2", "VIP_KENT_PM3", "VIP_ARKADA_PM1", "VIP_Cat_PM2",
        "VIP_Cat_PM1", "VIP_Cat_PM4", "VIP_Cat_PM3", "VIP_Gama_PM1",
        "VIP_Gama_PM2", "VIP_Gama_PM3", "VIP_Gama_PM4", "VIP_Gama_PM5",
        "VIP_Kometa_PM1", "VIP_Kometa_PM2", "Danil Er_v2", "Victoria Om_v2",
        "Alina St_v2", "Kirill R_v2", "Nazar_v2", "Alina Ze_v2", "Alina Ka_v2",
        "Vika M_v2", "Sonya P_v2", "Daniela B_v2", "Vlad Y_v2", "Yuliana_v2",
        "Ira S_v2", "Daniil G_v2", "Lubomir_v2", "Amina T_v2", "Vika Ko_v",
        "Alina.M_v2", "Liza Se_v2", "Anna Sh_v2"
    ];

    function processTags() {
        const statusContainer = document.querySelector(".fun-page-header__statuses");
        if (!statusContainer) return;

        // Берем теги, которые ПРЯМО СЕЙЧАС лежат в главном контейнере
        const tags = statusContainer.querySelectorAll(".fun-page-header__status-btn.allow-edit");

        // Если тегов еще нет и кнопка не создана — ждем (решает проблему асинхронной загрузки)
        if (tags.length === 0 && !document.getElementById("toggle-tags-btn")) return;

        // 1. Создаем контейнер для скрытых тегов (если его еще нет)
        let tagsWrapper = document.getElementById("tags-wrapper");
        if (!tagsWrapper) {
            tagsWrapper = document.createElement("div");
            tagsWrapper.id = "tags-wrapper";
            tagsWrapper.className = "fun-page-header__statuses";
            tagsWrapper.style.cssText = `
                display: none;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 12px;
                padding: 12px;
                background: rgba(0,0,0,0.02);
                border: 1px solid #e7eaec;
                border-radius: 4px;
                width: 100%;
            `;
            statusContainer.after(tagsWrapper);
        }

        // 2. Создаем кнопку управления (если ее еще нет)
        let toggleBtn = document.getElementById("toggle-tags-btn");
        if (!toggleBtn) {
            toggleBtn = document.createElement("button");
            toggleBtn.id = "toggle-tags-btn";
            toggleBtn.innerHTML = `<i class="fa fa-tags" style="margin-right: 5px;"></i> Остальные`;
            toggleBtn.className = "fun-page-header__status-btn";
            toggleBtn.style.cssText = `
                display: inline-flex;
                align-items: center;
                height: 30px;
                padding: 0 12px;
                margin-left: 8px;
                background: #f05563;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                vertical-align: middle;
            `;

            toggleBtn.onclick = (e) => {
                e.preventDefault();
                const isHidden = tagsWrapper.style.display === "none";
                tagsWrapper.style.display = isHidden ? "flex" : "none";
                toggleBtn.style.background = isHidden ? "#1ab394" : "#f05563";
                toggleBtn.innerHTML = isHidden ?
                    `<i class="fa fa-eye-slash" style="margin-right: 5px;"></i> Скрыть` :
                    `<i class="fa fa-tags" style="margin-right: 5px;"></i> Остальные`;
            };

            // Надежный поиск кнопки истории: ищем по ID или классу
            const historyBtn = statusContainer.querySelector("#TagsHistoryOpenButton, .fun-page-header__status-history-btn, button:not(.allow-edit)");
            if (historyBtn) {
                historyBtn.before(toggleBtn);
            } else {
                statusContainer.appendChild(toggleBtn);
            }
        }

        // 3. Динамически переносим теги.
        // Перебираем только те теги, которые всё ещё висят в основном контейнере.
        tags.forEach(tag => {
            // Безопасное чтение текста (избегает захвата лишних символов из иконки-крестика)
            const nameSpan = tag.querySelector('.name');
            const text = nameSpan ? nameSpan.innerText.trim() : tag.innerText.trim();

            if (!mainTags.includes(text)) {
                tagsWrapper.appendChild(tag); // Перемещаем тег в скрытый блок
            }
        });
    }

    // Observer теперь постоянно следит за изменениями
    // Если сайт догрузит новый тег через AJAX, процесс сработает снова и уберет его
    const observer = new MutationObserver(() => {
        processTags();
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
    observer.observe(document.body, { childList: true, subtree: true });

})();
