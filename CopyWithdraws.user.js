// ==UserScript==
// @name         CopyWithdraws
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Утилита для копирования выводов.
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
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CopyWithdraws.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CopyWithdraws.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function getUserInfoFromHeader() {
        const userIdEl = document.querySelector('#SummaryUserId');
        const userId = userIdEl ? userIdEl.textContent.trim() : '';

        let userStatus = ' ';
        const statusesContainer = document.querySelector('#summary-header > div.fun-page-header__statuses');
        if (statusesContainer) {
            const nodes = statusesContainer.children;
            let bestPriority = 0;
            let bestStatus = ' ';
            for (let i = 0; i < nodes.length; i++) {
                const txt = nodes[i].textContent.trim();
                let prio = 0;
                if (txt.toLowerCase() === 'highroll') {
                    prio = 5;
                } else if (txt.toLowerCase() === 'vip') {
                    prio = 4;
                } else if (txt === 'PreVIP') {
                    prio = 3;
                } else if (txt === 'PriVip') {
                    prio = 2;
                } else if (txt === 'Privip') {
                    prio = 1;
                }
                if (prio > bestPriority) {
                    bestPriority = prio;
                    bestStatus = txt;
                }
            }
            if (bestPriority > 0) {
                userStatus = bestStatus;
            }
        }

        let projectName = '';
        const projectNameEl = document.querySelector('.navbar-default.navbar-static-side .project-name.word-break');
        if (projectNameEl) {
            projectName = projectNameEl.textContent.trim();
        }
        if (!projectName) {
            const currentLoginEl = document.querySelector('#CurrentLogin');
            if (currentLoginEl) {
                const dataLogin = currentLoginEl.getAttribute('data-login') || '';
                if (dataLogin) {
                    const idx = dataLogin.indexOf('_');
                    if (idx > 0) {
                        projectName = dataLogin.substring(0, idx);
                    } else {
                        projectName = dataLogin;
                    }
                }
            }
        }
        return { userId, userStatus, projectName };
    }

    function processWithdraws() {
        const tableContainer = document.querySelector("#LastWithdrawsContainer .table-responsive");
        if (!tableContainer) return;

        const rows = tableContainer.querySelectorAll("[id^='withdraw_row_']");
        rows.forEach(row => {
            const idCell = row.querySelector("td.text-left");
            const dateCell = row.querySelector("td:nth-child(2)");
            const amountCell = row.querySelector("td:nth-child(3)");
            const paymentSystemCell = row.querySelector("td:nth-child(4)");
            const requisitesCell = row.querySelector("td:nth-child(5)");
            const paymentIdCell = row.querySelector("td:nth-child(7)");

            if (!idCell || idCell.querySelector('.myIDSpan')) return; // Уже обработано

            const requestId = idCell.textContent.trim();
            const date = dateCell ? dateCell.textContent.trim() : '';
            const amount = amountCell ? amountCell.textContent.trim() : '';
            const paymentSystem = paymentSystemCell ? paymentSystemCell.textContent.trim() : '';
            const requisites = requisitesCell ? requisitesCell.textContent.trim() : '';
            const paymentId = paymentIdCell ? paymentIdCell.textContent.trim() : '';

            idCell.textContent = '';

            const idSpan = document.createElement('span');
            idSpan.className = 'myIDSpan';
            idSpan.textContent = requestId;
            idSpan.style.color = '#007bff'; // Яркий синий цвет для светлой темы
            idSpan.style.cursor = 'pointer';
            idSpan.style.fontWeight = 'bold';
            idSpan.title = 'Копировать заявку';
            idSpan.addEventListener('click', () => {
                const lines = [];
                lines.push(`ID заявки: ${requestId}`);
                lines.push(`Дата: ${date}`);
                lines.push(`Сумма: ${amount}`);
                lines.push(`Платежная система: ${paymentSystem}`);
                lines.push(`Реквизиты: ${requisites}`);
                lines.push(`ID платежа: ${paymentId}`);
                GM_setClipboard(lines.join('\n').trim());
            });

            const robotSpan = document.createElement('span');
            robotSpan.className = 'myRobotSpan';
            robotSpan.textContent = ' 🤖';
            robotSpan.style.color = '#28a745'; // Яркий зелёный цвет для светлой темы
            robotSpan.style.cursor = 'pointer';
            robotSpan.style.fontWeight = 'bold';
            robotSpan.title = 'Копировать заявку (структурно)';
            robotSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const { userId, userStatus, projectName } = getUserInfoFromHeader();

                const lines = [];
                lines.push(userId);
                lines.push(`${userStatus} ${projectName}`.trim());
                lines.push('');
                lines.push(`ID заявки: ${requestId}`);
                lines.push(`Дата: ${date}`);
                lines.push(`Сумма: ${amount}`);
                lines.push(`Платежная система: ${paymentSystem}`);
                lines.push(`Реквизиты: ${requisites}`);
                lines.push(`ID платежа: ${paymentId}`);

                GM_setClipboard(lines.join('\n').trim());
            });

            idCell.appendChild(idSpan);
            idCell.appendChild(robotSpan);
        });
    }

    function waitForElement(selector, callback) {
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback(element);
            }
        }, 300);
    }

    window.addEventListener('load', () => {
        waitForElement("#LastWithdrawsContainer .table-responsive", () => {
            processWithdraws();
            observeBodyChanges();
        });
    });

    function observeBodyChanges() {
        let timer = null;
        const observer = new MutationObserver(() => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                processWithdraws();
            }, 200);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();



