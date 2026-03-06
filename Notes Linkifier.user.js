// ==UserScript==
// @name         NotesLinkifier
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Делает только веб-ссылки в Quick Notes кликабельными
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @match        https://app.helpdesk.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NotesLinkifier.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/NotesLinkifier.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const urlRegex = /(https?:\/\/[^\s<]+)/g;

    function linkify() {
        // Выбираем только элементы, где реально лежит текст сообщения
        const elements = document.querySelectorAll('p, .css-0, .css-3irqw0');

        elements.forEach(el => {
            // Пропускаем: если уже есть ссылка, если это заголовок или если поле ввода
            if (el.querySelector('a') || el.closest('header') || el.isContentEditable) return;

            // Работаем через перебор текстовых узлов, чтобы не задеть HTML-разметку
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const nodesToReplace = [];

            while (node = walker.nextNode()) {
                if (urlRegex.test(node.nodeValue)) {
                    nodesToReplace.push(node);
                }
            }

            nodesToReplace.forEach(textNode => {
                const parent = textNode.parentNode;
                if (!parent || parent.tagName === 'A') return;

                const content = textNode.nodeValue;
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                let match;

                urlRegex.lastIndex = 0;
                while ((match = urlRegex.exec(content)) !== null) {
                    // Текст до ссылки
                    fragment.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));

                    // Сама ссылка
                    const a = document.createElement('a');
                    a.href = match[0].trim();
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.textContent = match[0];
                    // Стили: синий цвет, жирный, перенос длинных строк
                    Object.assign(a.style, {
                        color: "#007bff",
                        textDecoration: "underline",
                        fontWeight: "bold",
                        wordBreak: "break-all"
                    });

                    fragment.appendChild(a);
                    lastIndex = urlRegex.lastIndex;
                }
                // Текст после ссылки
                fragment.appendChild(document.createTextNode(content.slice(lastIndex)));
                parent.replaceChild(fragment, textNode);
            });
        });
    }

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(linkify, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    linkify();
})();




