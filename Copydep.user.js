// ==UserScript==
// @name         Copydep
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Утилита для копирования депов.
// @author       Calvin
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
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Copydep.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Copydep.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    const VALID_TAGS = ['highroll', 'previp', 'vip', 'privip'];

    function trimNoteAtDate(note) {
        const pattern = /(Date:\s*\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2};)/i;
        const match = note.match(pattern);
        if (match) {
            const endIndex = note.indexOf(match[0]) + match[0].length;
            return note.substring(0, endIndex);
        }
        return note;
    }

    function ensureSpaceAfterBracket(str) {
        return str.replace(/\)(?!\s|$)/g, ') ');
    }

    function getColorForID(noteTextLower) {
        if (noteTextLower.includes('(paid)') || noteTextLower.includes('(disput-paid)')) return 'green';
        if (noteTextLower.includes("пополнение бонусного счета")) return 'orange';
        if (noteTextLower.includes("пополнение счета")) return 'brown';
        if (noteTextLower.includes("payment status: complete") || noteTextLower.includes("manual confirmed")) return 'green';
        if (noteTextLower.includes("payment status: declined")) return 'red';
        return 'blue';
    }

    function getUserInfoFromHeader() {
        const userIdEl = document.querySelector('#SummaryUserId');
        const userId = userIdEl ? userIdEl.textContent.trim() : '';

        // 1. Поиск СТАТУСА (строго из списка)
        let userStatus = '';
        const statusNodes = document.querySelectorAll('.fun-page-header__statuses .name');
        let maxPriority = -1;

        statusNodes.forEach(node => {
            const rawText = node.textContent.trim();
            const lowerText = rawText.toLowerCase();
            let priority = -1;

            if (lowerText === 'highroll') priority = 5;
            else if (lowerText === 'vip') priority = 4;
            else if (lowerText === 'previp') priority = 3;
            else if (lowerText === 'privip') priority = 2;

            if (priority > maxPriority) {
                maxPriority = priority;
                userStatus = rawText;
            }
        });

        // 2. Поиск ПРОЕКТА (несколько способов)
        let projectName = '';
        // Способ А: Из бокового меню
        const projectNameEl = document.querySelector('.project-name.word-break');
        if (projectNameEl) {
            projectName = projectNameEl.textContent.trim();
        }
        // Способ Б: Если А не сработал, пробуем вытянуть из CurrentLogin
        if (!projectName) {
            const loginEl = document.querySelector('#CurrentLogin');
            const dataLogin = loginEl ? loginEl.getAttribute('data-login') || '' : '';
            if (dataLogin.includes('_')) {
                projectName = dataLogin.split('_')[0];
            } else {
                projectName = dataLogin;
            }
        }

        return { userId, userStatus, projectName };
    }

    function createControls() {
        if (document.getElementById('bulk-copy-container')) return;
        const table = document.querySelector('#lastDepositsAllTable');
        if (!table) return;

        const container = document.createElement('div');
        container.id = 'bulk-copy-container';
        container.style = 'margin-bottom: 15px; display: flex; gap: 10px; align-items: center;';

        const btnSelectAll = document.createElement('button');
        btnSelectAll.textContent = '☑️ Выбрать все';
        btnSelectAll.style = 'padding: 8px 15px; background: #5bc0de; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;';

        const btnCopy = document.createElement('button');
        btnCopy.textContent = '📋 Копировать выбранные';
        btnCopy.style = 'padding: 8px 15px; background: #1ab394; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;';

        btnSelectAll.onclick = () => {
            const cbs = document.querySelectorAll('.dep-checkbox');
            const someUnchecked = Array.from(cbs).some(c => !c.checked);
            cbs.forEach(c => c.checked = someUnchecked);
            btnSelectAll.textContent = someUnchecked ? '⬜ Снять выделение' : '☑️ Выбрать все';
        };

        btnCopy.onclick = () => {
            const selected = document.querySelectorAll('.dep-checkbox:checked');
            if (selected.length === 0) return;

            const info = getUserInfoFromHeader();
            // Формируем вторую строку: "Статус Проект"
            const secondLine = `${info.userStatus} ${info.projectName}`.trim();

            let lines = [info.userId, secondLine, ''];

            selected.forEach(cb => {
                const row = cb.closest('tr');
                const id = row.querySelector('td[name="col-ID"]').getAttribute('data-raw-id');
                const note = row.querySelector('td[name="col-Note"]').getAttribute('data-trimmed-note');
                const ext = row.querySelector('td[name="col-ExternalTID"]').textContent.trim();

                let str = id;
                if (note) str += ` ${note}`;
                if (ext && ext !== '-') str += ` ${ext}`;
                lines.push(str.trim());
            });

            lines.push('', '');

            // Финансовый блок
            if (info.userStatus && VALID_TAGS.includes(info.userStatus.toLowerCase())) {
                const dt1 = document.querySelector("#creditDebetTotals > dt:nth-child(1)")?.textContent.trim() || '';
                const dd1 = document.querySelector("#creditDebetTotals > dd.text-danger")?.textContent.trim() || '';
                if (dt1 || dd1) lines.push(`${dt1} ${dd1}`.trim());

                const dt9 = document.querySelector("#creditDebetTotals > dt:nth-child(9)")?.textContent.trim() || '';
                const dd10 = document.querySelector("#creditDebetTotals > dd:nth-child(10)")?.textContent.trim() || '';
                if (dt9 || dd10) lines.push(`${dt9} ${dd10}`.trim());

                const div12 = document.querySelector("#creditDebetTotals > div:nth-child(12)");
                if (div12) {
                    const match = div12.textContent.match(/(Ручные депозиты:[\s\S]*?)(?=Депозиты:|Возврат:|Корректировка:|$)/i);
                    if (match) lines.push(match[1].trim());
                }
            }

            GM_setClipboard(lines.join('\n').trim());
            const origText = btnCopy.textContent;
            btnCopy.textContent = '✅ Скопировано!';
            setTimeout(() => btnCopy.textContent = origText, 1500);
        };

        container.appendChild(btnSelectAll);
        container.appendChild(btnCopy);
        table.parentNode.insertBefore(container, table);
    }

    function processTable() {
        const rows = document.querySelectorAll('#lastDepositsAllTable > tbody > tr');
        if (rows.length > 0) createControls();

        rows.forEach(row => {
            const colID = row.querySelector('td[name="col-ID"]');
            if (colID && !colID.querySelector('.dep-checkbox')) {
                const rawId = colID.textContent.trim();
                const noteCell = row.querySelector('td[name="col-Note"]');
                const noteText = noteCell.textContent.trim();
                const trimmedNote = ensureSpaceAfterBracket(trimNoteAtDate(noteText));
                const color = getColorForID(noteText.toLowerCase());

                colID.setAttribute('data-raw-id', rawId);
                noteCell.setAttribute('data-trimmed-note', trimmedNote);

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'dep-checkbox';
                cb.style = 'margin-right: 8px; cursor: pointer; transform: scale(1.1);';

                const idSpan = document.createElement('span');
                idSpan.textContent = rawId;
                idSpan.style = `color: ${color}; cursor: pointer; font-weight: bold;`;
                idSpan.onclick = () => {
                    let singleLine = `${rawId} ${trimmedNote}`;
                    const ext = row.querySelector('td[name="col-ExternalTID"]').textContent.trim();
                    if (ext && ext !== '-') singleLine += ` ${ext}`;
                    GM_setClipboard(singleLine.trim());
                };

                const robot = document.createElement('span');
                robot.textContent = ' 🤖';
                robot.style.cursor = 'pointer';
                robot.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.dep-checkbox').forEach(c => c.checked = false);
                    cb.checked = true;
                    document.querySelector('#bulk-copy-container button:last-child').click();
                };

                colID.textContent = '';
                colID.style.display = 'flex';
                colID.style.alignItems = 'center';
                colID.appendChild(cb);
                colID.appendChild(idSpan);
                colID.appendChild(robot);
            }
        });
    }

    const observer = new MutationObserver(() => processTable());
    window.addEventListener('load', () => {
        processTable();
        observer.observe(document.body, { childList: true, subtree: true });
    });

})();

