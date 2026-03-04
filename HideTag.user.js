// ==UserScript==
// @name         HideTag
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Скрывает теги с сохранением оригинальных стилей и крестиков.
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideTag.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HideTag.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initTagHider() {
        const statusContainer = document.querySelector(".fun-page-header__statuses");
        if (!statusContainer || document.getElementById("toggle-tags-btn")) return;

        // Список тегов, которые всегда остаются видимыми
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

        // 1. Создаем кнопку управления
        const toggleBtn = document.createElement("button");
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

        // 2. Создаем контейнер для скрытых тегов
        const tagsWrapper = document.createElement("div");
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

        // 3. Распределяем теги
        const tags = statusContainer.querySelectorAll(".fun-page-header__status-btn.allow-edit");
        tags.forEach(tag => {
            const text = tag.innerText.trim();
            if (!mainTags.includes(text)) {
                tagsWrapper.appendChild(tag);
            }
        });

        // 4. Логика кнопки
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            const isHidden = tagsWrapper.style.display === "none";
            tagsWrapper.style.display = isHidden ? "flex" : "none";
            toggleBtn.style.background = isHidden ? "#1ab394" : "#f05563";
            toggleBtn.innerHTML = isHidden ?
                `<i class="fa fa-eye-slash" style="margin-right: 5px;"></i> Скрыть` :
                `<i class="fa fa-tags" style="margin-right: 5px;"></i> Остальные`;
        };

        // 5. Вставляем элементы
        const historyBtn = statusContainer.querySelector("button:not(.allow-edit)");
        if (historyBtn) {
            historyBtn.after(toggleBtn);
        } else {
            statusContainer.appendChild(toggleBtn);
        }

        statusContainer.after(tagsWrapper);
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector(".fun-page-header__statuses")) {
            initTagHider();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
