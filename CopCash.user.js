// ==UserScript==
// @name         CopCash
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Копирование данных с учетом приоритета статусов (HighRoll > VIP > PreVIP)
// @author       Calvin/River
// @match        https://www2.fundist.org/ru/Users/Summary*
// @match        https://www7.fundist.org/ru/Users/Summary*
// @match        https://backoffice.r7.casino/ru/Users/Summary*
// @match        https://backoffice.catcasino.com/ru/Users/Summary*
// @match        https://backoffice.gama.casino/ru/Users/Summary*
// @match        https://backoffice.daddy.casino/ru/Users/Summary*
// @match        https://backoffice.spark.casino/ru/Users/Summary*
// @match        https://backoffice.mers.casino/ru/Users/Summary*
// @match        https://backoffice.kent.casino/ru/Users/Summary*
// @match        https://backoffice.kometa.casino/ru/Users/Summary*
// @match        https://www9.fundist.org/ru/Users/Summary*
// @match        https://backoffice.arkada.casino/ru/Users/Summary*
// @match        https://cc.boadmin.org/ru/Users/Summary*
// @match        https://gm.boadmin.org/ru/Users/Summary*
// @match        https://dy.boadmin.org/ru/Users/Summary*
// @match        https://mr.boadmin.org/ru/Users/Summary*
// @match        https://kn.boadmin.org/ru/Users/Summary*
// @match        https://rs.boadmin.org/ru/Users/Summary*
// @match        https://kt.boadmin.org/ru/Users/Summary*
// @match        https://ak.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CopCash.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CopCash.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function init() {
        const targetContainer = document.querySelector("#cashback-window");
        if (!targetContainer || document.querySelector("#copy-data-trigger")) return;

        const copyBtn = document.createElement("button");
        copyBtn.id = "copy-data-trigger";
        copyBtn.innerHTML = "📋 Копировать данные";
        copyBtn.style.cssText = "margin-left: 15px; padding: 4px 12px; background-color: #4040bb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; vertical-align: middle; font-weight: bold;";

        const displayBox = document.createElement("div");
        displayBox.id = "cb-display-info";
        displayBox.style.cssText = "margin-top: 15px; padding: 12px; background: #ffffff; border: 2px dashed #4040bb; border-radius: 8px; font-family: monospace; font-size: 14px; color: #000; line-height: 1.5; display: none; white-space: pre-wrap; width: fit-content;";

        const actionArea = targetContainer.querySelector("div") || targetContainer;
        actionArea.appendChild(copyBtn);
        actionArea.parentNode.insertBefore(displayBox, actionArea.nextSibling);

        copyBtn.addEventListener("click", () => {
            // 1. ИД
            const userId = document.querySelector("#SummaryUserId")?.innerText.trim() || "---";

            // 2. Проект
            const projectRaw = document.querySelector(".daddy-cb h2")?.innerText ||
                               document.querySelector("#cashback-title")?.innerText || "Проект";
            const project = projectRaw.replace(/Условия кешбэка|Cashback|→/g, "").trim();

            // 3. Тег с учетом приоритета (HighRoll > VIP > остальные)
            const tagPriority = ["highroll", "VIP", "PreVIP", "Privip", "PriVip"];
            let userTag = "---";

            // Собираем все текстовые элементы на странице один раз
            const potentialTags = Array.from(document.querySelectorAll("span, div, a, b"));

            // Ищем по списку приоритетов: если нашли первый (самый важный), поиск прекращается
            for (let priorityName of tagPriority) {
                const found = potentialTags.find(el => el.innerText.trim().toLowerCase() === priorityName.toLowerCase());
                if (found) {
                    userTag = found.innerText.trim();
                    break;
                }
            }

            // 4. Анализ КБ
            const resultText = document.querySelector("#cashback-result")?.innerText || "";
            let statusKB = "Нет КБ";
            if (resultText.includes("Выплата:") && !resultText.includes("Выплата: 0.00") && !resultText.includes("Выплата: 0 ")) {
                statusKB = "КБ положен";
            }

            // 5. Даты
            const dateFrom = document.querySelector("#fromDate")?.value || "";
            const dateTo = document.querySelector("#toDate")?.value || "";
            const dateRange = `${dateFrom} - ${dateTo}`;

            const finalData = [userId, project, userTag, statusKB, dateRange].join('\n');

            GM_setClipboard(finalData);
            displayBox.innerText = finalData;
            displayBox.style.display = "block";

            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = "✅ Скопировано!";
            copyBtn.style.backgroundColor = "#28a745";
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.backgroundColor = "#4040bb";
            }, 1500);
        });
    }

    const runCheck = setInterval(() => {
        if (document.querySelector("#cashback-window")) {
            init();
        }
    }, 2000);

})();



