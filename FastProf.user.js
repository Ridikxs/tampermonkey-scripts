// ==UserScript==
// @name         FastProf
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Исправлено: кнопка "Данные клиента" управляет показом поля и не исчезает
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/FastProf.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/FastProf.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function getClientData() {
        const idElem = document.querySelector("#SummaryUserId") || document.querySelector(".userdata-copy");
        const clientId = idElem ? idElem.innerText.trim() : "";

        const projectElem = document.querySelector("#CurrentLogin");
        let project = "";
        if (projectElem) {
            project = projectElem.innerText.split(' ')[0].replace(/[^a-zA-Zа-яА-Я0-9]/g, '');
        }

        let status = "";
        if (document.querySelector("#Statuses-HighRoll")) {
            status = "HighRoll";
        } else if (document.querySelector("#Statuses-VIP")) {
            status = "VIP";
        } else if (document.querySelector("#Statuses-Privip") || document.querySelector("#Statuses-PreVIP") || document.querySelector("#Statuses-PriVip")) {
            status = "Privip";
        }

        // Проверяем наличие тега Reactivation
        const hasReactivation = !!document.querySelector("#Statuses-Reactivation");

        let result = clientId;
        if (project) result += "\n" + project;

        // Если есть статус и это VIP/HighRoll + есть тег Reactivation — пишем через запятую
        if (status) {
            if (hasReactivation && (status === "VIP" || status === "HighRoll")) {
                result += "\n" + status + ", Reactivation";
            } else {
                result += "\n" + status;
            }
        }

        return result.trim();
    }

    function inject() {
        const statusLabel = document.querySelector("#SummaryOnlineStatus");
        // Если нет статуса или наш блок уже есть — выходим
        if (!statusLabel || document.getElementById("my-final-wrapper")) return;

        const parent = statusLabel.parentElement;

        // Обертка для всей нашей конструкции
        const wrapper = document.createElement('span');
        wrapper.id = "my-final-wrapper";
        wrapper.style.cssText = "margin-left: 12px; display: inline-flex; align-items: flex-start; gap: 8px; vertical-align: top; white-space: nowrap;";

        // 1. Постоянная кнопка "Данные клиента"
        const toggleBtn = document.createElement('a');
        toggleBtn.innerText = "Данные клиента";
        toggleBtn.style.cssText = "color: #28a745; font-weight: bold; font-size: 12px; text-decoration: underline; cursor: pointer; margin-top: 2px;";

        // 2. Скрытый по умолчанию блок с полем и кнопкой
        const actionGroup = document.createElement('span');
        actionGroup.id = "my-action-group";
        actionGroup.style.display = "none"; // Скрыто
        actionGroup.style.alignItems = "flex-start";
        actionGroup.style.gap = "8px";

        const textArea = document.createElement('textarea');
        textArea.style.cssText = "height: 80px; width: 200px; font-size: 11px; border: 1px solid #28a745; border-radius: 4px; padding: 4px 6px; color: #333; resize: none; overflow-y: auto; line-height: 1.3; background: white; margin-top: -4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);";

        const copyBtn = document.createElement('button');
        copyBtn.innerText = "Копировать";
        copyBtn.style.cssText = "padding: 0 10px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; height: 24px; margin-top: -4px;";

        actionGroup.appendChild(textArea);
        actionGroup.appendChild(copyBtn);
        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(actionGroup);

        // Вставляем наш блок сразу после статуса offline/online
        statusLabel.after(wrapper);

        // Логика кнопки-переключателя
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            if (actionGroup.style.display === "none") {
                // Если открываем и поле пустое — берем свежие данные
                if (!textArea.value.trim()) {
                    textArea.value = getClientData() + "\n";
                }
                actionGroup.style.display = "inline-flex";
                textArea.focus();
                textArea.setSelectionRange(textArea.value.length, textArea.value.length);
            } else {
                // Если нажали снова — просто прячем
                actionGroup.style.display = "none";
            }
        };

        // Логика копирования
        copyBtn.onclick = () => {
            if (textArea.value.trim() !== "") {
                GM_setClipboard(textArea.value);
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "ОК!";
                setTimeout(() => { copyBtn.innerText = originalText; }, 1000);
            }
        };
    }

    // Проверяем наличие интерфейса каждые 500мс для надежности
    setInterval(inject, 500);

})();
