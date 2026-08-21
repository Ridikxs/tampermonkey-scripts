// ==UserScript==
// @name         HideTag
// @namespace    http://tampermonkey.net/
// @version      2.6
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

    // Внедряем стили, которые управляют отображением без изменения HTML-структуры
    function initStyles() {
        if (document.getElementById("ht-styles")) return;
        const style = document.createElement("style");
        style.id = "ht-styles";
        style.textContent = `
            /* Делаем контейнер гибким */
            .fun-page-header__statuses {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 5px !important;
            }

            /* Жестко фиксируем визуальный порядок основных кнопок, чтобы они не скакали */
            .fun-page-header__add-status-btn { order: 2 !important; margin-left: 5px; }
            .fun-page-header__status-history-btn { order: 3 !important; margin-left: 5px; }

            /* Кнопка скрытия/показа */
            .ht-btn-toggle {
                order: 4;
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
            }

            /* Линия-разделитель (переносит скрытые теги на новую строку) */
            .ht-break {
                order: 5;
                flex-basis: 100%;
                height: 0;
                margin: 5px 0 0 0;
                border-top: 1px solid #e7eaec;
                display: none;
            }

            /* Дополнительные теги визуально сдвигаются в конец */
            .ht-tag-extra {
                order: 6;
            }

            /* Логика скрытия */
            .ht-hidden-state .ht-tag-extra {
                display: none !important;
            }
            .ht-visible-state .ht-break {
                display: block !important;
            }
            .ht-visible-state .ht-tag-extra {
                display: inline-flex !important;
                background: rgba(0,0,0,0.04) !important;
                border: 1px dashed #ccc !important;
            }
        `;
        document.head.appendChild(style);
    }

    function processTags() {
        const container = document.querySelector(".fun-page-header__statuses");
        if (!container) return;

        initStyles();

        // Задаем начальное состояние
        if (!container.classList.contains("ht-container")) {
            container.classList.add("ht-container", "ht-hidden-state");
        }

        // Помечаем теги
        const tags = container.querySelectorAll(".fun-page-header__status-btn.allow-edit");
        tags.forEach(tag => {
            if (tag.dataset.htProcessed) return;

            const nameSpan = tag.querySelector('.name');
            const text = nameSpan ? nameSpan.innerText.trim() : tag.innerText.trim();

            if (!mainTags.includes(text)) {
                tag.classList.add("ht-tag-extra");
            }
            tag.dataset.htProcessed = "true";
        });

        // Создаем кнопку "Остальные" / "Скрыть"
        let toggleBtn = document.getElementById("toggle-tags-btn");
        if (!toggleBtn) {
            toggleBtn = document.createElement("button");
            toggleBtn.id = "toggle-tags-btn";
            toggleBtn.className = "ht-btn-toggle";
            toggleBtn.innerHTML = `<i class="fa fa-tags" style="margin-right: 5px;"></i> Остальные`;
            toggleBtn.onclick = (e) => {
                e.preventDefault();
                const isHidden = container.classList.contains("ht-hidden-state");
                if (isHidden) {
                    container.classList.remove("ht-hidden-state");
                    container.classList.add("ht-visible-state");
                    toggleBtn.style.background = "#1ab394";
                    toggleBtn.innerHTML = `<i class="fa fa-eye-slash" style="margin-right: 5px;"></i> Скрыть`;
                } else {
                    container.classList.remove("ht-visible-state");
                    container.classList.add("ht-hidden-state");
                    toggleBtn.style.background = "#f05563";
                    toggleBtn.innerHTML = `<i class="fa fa-tags" style="margin-right: 5px;"></i> Остальные`;
                }
            };
            container.appendChild(toggleBtn);
        } else if (toggleBtn.parentElement !== container) {
            // Если SPA перерисовало страницу, возвращаем кнопку на место
            container.appendChild(toggleBtn);
        }

        // Создаем невидимый разделитель для красоты
        let breakEl = document.getElementById("ht-break-line");
        if (!breakEl) {
            breakEl = document.createElement("div");
            breakEl.id = "ht-break-line";
            breakEl.className = "ht-break";
            container.appendChild(breakEl);
        } else if (breakEl.parentElement !== container) {
            container.appendChild(breakEl);
        }
    }

    // Дебаунс (задержка) защитит от зависаний, если сайт загружает теги поштучно
    let timeout = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(processTags, 50);
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
