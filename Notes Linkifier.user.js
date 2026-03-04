// ==UserScript==
// @name         Notes Linkifier
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Делает только веб-ссылки в Quick Notes кликабельными
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NotesLinkifier.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NotesLinkifier.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Шаблон для поиска веб-ссылок (исключаем HTML-теги вроде <br>)
    const urlRegex = /(https?:\/\/[^\s<]+)/g;

    function makeLinksClickable() {
        // Находим все заголовки h5
        const headers = document.querySelectorAll('h5');

        headers.forEach(header => {
            // Ищем блок "Quick Notes"
            if (header.textContent.trim() === 'Quick Notes') {

                // Ищем родительскую карточку (поднимаемся на 4 уровня вверх по структуре HTML)
                const card = header.parentElement.parentElement.parentElement.parentElement;

                if (card) {
                    // Ищем все абзацы с текстом в этой карточке
                    const paragraphs = card.querySelectorAll('p');

                    paragraphs.forEach(p => {
                        // Важная проверка: если внутри абзаца ЕЩЕ НЕТ ссылки (тега <a>)
                        if (!p.querySelector('a')) {
                            let html = p.innerHTML;
                            let isModified = false;

                            // 1. Превращаем URL в синие ссылки
                            if (urlRegex.test(html)) {
                                html = html.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: underline; cursor: pointer; font-weight: bold;">$1</a>');
                                isModified = true;
                            }

                            // Если мы нашли и заменили текст, обновляем содержимое абзаца
                            if (isModified) {
                                p.innerHTML = html;
                            }
                        }
                    });
                }
            }
        });
    }

    // Запускаем наблюдатель, который следит за интерфейсом каждую миллисекунду
    const observer = new MutationObserver(() => {
        makeLinksClickable();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Делаем первый запуск на случай, если страница уже загрузилась
    makeLinksClickable();


})();
