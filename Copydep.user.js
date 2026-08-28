// ==UserScript==
// @name         Copydep
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Утилита для копирования данных клиента из шапки.
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

        // Поиск СТАТУСА (строго из списка)
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

        // Поиск ПРОЕКТА
        let projectName = '';
        const projectNameEl = document.querySelector('.project-name.word-break');
        if (projectNameEl) {
            projectName = projectNameEl.textContent.trim();
        }
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

    function injectHeaderButton() {
        // Проверяем, не добавлена ли уже кнопка
        if (document.getElementById('copydep-header-btn')) return;

        // Ищем иконку копирования ID в шапке
        const copyIcon = document.getElementById('SummaryUserIdCopy');
        if (!copyIcon) return;

        const parentTooltip = copyIcon.closest('.usertooltip');
        if (!parentTooltip) return;

        // Создаем контейнер для нашей кнопки
        const wrapper = document.createElement('div');
        wrapper.id = 'copydep-header-btn';
        wrapper.className = 'usertooltip'; // Чтобы стилистика отступов совпадала с сайтом
        wrapper.style.marginLeft = '12px';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';

        const btn = document.createElement('button');
        btn.innerHTML = '📋 Депозит';

        // Стилизация для идеального отображения в светлой и темной теме
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            background: #1ab394;
            color: #ffffff !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 11px;
            line-height: 1.4;
            transition: background-color 0.2s ease, transform 0.1s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            text-shadow: none;
        `;

        // Анимация при наведении и нажатии
        btn.onmouseover = () => btn.style.background = '#18a689';
        btn.onmouseout = () => btn.style.background = '#1ab394';
        btn.onmousedown = () => btn.style.transform = 'scale(0.95)';
        btn.onmouseup = () => btn.style.transform = 'scale(1)';

        // Логика копирования
        btn.onclick = () => {
            const info = getUserInfoFromHeader();
            const statusLower = info.userStatus ? info.userStatus.toLowerCase() : '';
            const isVip = VALID_TAGS.includes(statusLower);

            let lines = [];

            if (!isVip) {
                // Обычный игрок
                lines.push(info.userId);
                lines.push(info.projectName);
            } else {
                // VIP игрок
                lines.push(info.userId);
                lines.push(info.projectName);
                lines.push(''); // Пустая строка
                lines.push(info.userStatus);

                // Финансовый блок
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

            // Визуальный фидбек на кнопке
            const origText = btn.innerHTML;
            btn.innerHTML = '✅ Скопировано!';
            btn.style.background = '#128f76';
            setTimeout(() => {
                btn.innerHTML = origText;
                btn.style.background = '#1ab394';
            }, 1500);
        };

        wrapper.appendChild(btn);

        // Вставляем кнопку сразу после контейнера со стандартной иконкой копирования ID
        parentTooltip.insertAdjacentElement('afterend', wrapper);
    }

    function processTable() {
        const rows = document.querySelectorAll('#lastDepositsAllTable > tbody > tr');

        rows.forEach(row => {
            const colID = row.querySelector('td[name="col-ID"]');
            // Проверяем атрибут, чтобы не обрабатывать строку дважды
            if (colID && !colID.hasAttribute('data-processed')) {
                const rawId = colID.textContent.trim();
                const noteCell = row.querySelector('td[name="col-Note"]');
                const noteText = noteCell.textContent.trim();
                const trimmedNote = ensureSpaceAfterBracket(trimNoteAtDate(noteText));
                const color = getColorForID(noteText.toLowerCase());

                colID.setAttribute('data-processed', 'true');

                const idSpan = document.createElement('span');
                idSpan.textContent = rawId;
                idSpan.style = `color: ${color}; cursor: pointer; font-weight: bold;`;

                // Клик по ID в таблице скопирует строку с ID и описанием (как и было)
                idSpan.onclick = () => {
                    let singleLine = `${rawId} ${trimmedNote}`;
                    const ext = row.querySelector('td[name="col-ExternalTID"]').textContent.trim();
                    if (ext && ext !== '-') singleLine += ` ${ext}`;
                    GM_setClipboard(singleLine.trim());
                };

                colID.textContent = '';
                colID.style.display = 'flex';
                colID.style.alignItems = 'center';
                colID.appendChild(idSpan);
            }
        });
    }

    // Observer следит за изменениями на странице, чтобы добавить кнопку и раскрасить таблицу при динамической подгрузке
    const observer = new MutationObserver(() => {
        injectHeaderButton();
        processTable();
    });

    window.addEventListener('load', () => {
        injectHeaderButton();
        processTable();
        observer.observe(document.body, { childList: true, subtree: true });
    });

})();
