
// ==UserScript==
// @name         CSAT Cool
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Динамические Font Awesome иконки CSAT с мгновенным обновлением оценки в Chatwoot.
// @author       Will
// @match        https://sparkmoth.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CSATCool.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CSATCool.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'will-csat-cool-v11';
    const FA_ID = 'will-csat-fontawesome';

    const SELECTOR =
        'span.flex-shrink-0.inline-flex.items-center.gap-0\\.5';


    // =========================================================
    // FONT AWESOME
    // =========================================================

    if (!document.getElementById(FA_ID)) {

        const link = document.createElement('link');

        link.id = FA_ID;
        link.rel = 'stylesheet';

        link.href =
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css';

        document.head.appendChild(link);
    }


    // =========================================================
    // STYLES
    // =========================================================

    if (!document.getElementById(STYLE_ID)) {

        const style = document.createElement('style');

        style.id = STYLE_ID;

        style.textContent = `

            /* ===== BASE ===== */

            .will-csat {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;

                width: 28px;
                height: 28px;

                padding: 0 !important;

                border-radius: 8px;
                border: 1px solid transparent;

                user-select: none;
                cursor: default;

                transition:
                    background-color .15s ease,
                    border-color .15s ease,
                    box-shadow .15s ease,
                    transform .15s ease;
            }


            /*
             * Скрываем только оригинальный эмодзи.
             *
             * Его DOM-элемент и текст остаются,
             * чтобы отслеживать изменения CSAT.
             */

            .will-csat > span:first-child {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;

                font-size: 0 !important;
                line-height: 1 !important;

                width: 100%;
                height: 100%;
            }


            /* ===== FONT AWESOME ===== */

            .will-csat > span:first-child::before {

                display: inline-block;

                font-family:
                    "Font Awesome 6 Free",
                    "Font Awesome 5 Free" !important;

                font-weight: 900 !important;
                font-style: normal !important;

                font-size: 15px !important;
                line-height: 1 !important;

                -webkit-font-smoothing: antialiased;

                transition:
                    transform .15s ease,
                    filter .15s ease;
            }


            /* ================================================
               LIKE
            ================================================ */

            .will-csat-like {

                background: rgba(34,197,94,.14) !important;

                border-color:
                    rgba(34,197,94,.32) !important;

                color: #16a34a !important;

                box-shadow:
                    0 0 5px rgba(34,197,94,.10);
            }


            .will-csat-like > span:first-child::before {

                content: "\\f164";

                color: #22c55e !important;

                filter:
                    drop-shadow(
                        0 0 3px rgba(34,197,94,.30)
                    );
            }


            .will-csat-like:hover {

                background:
                    rgba(34,197,94,.24) !important;

                border-color:
                    rgba(34,197,94,.55) !important;

                box-shadow:
                    0 0 10px rgba(34,197,94,.30);

                transform: translateY(-1px);
            }


            .will-csat-like:hover > span:first-child::before {

                transform: scale(1.15);
            }


            /* ================================================
               DISLIKE
            ================================================ */

            .will-csat-dislike {

                background: rgba(239,68,68,.14) !important;

                border-color:
                    rgba(239,68,68,.32) !important;

                color: #dc2626 !important;

                box-shadow:
                    0 0 5px rgba(239,68,68,.10);
            }


            .will-csat-dislike > span:first-child::before {

                content: "\\f165";

                color: #ef4444 !important;

                filter:
                    drop-shadow(
                        0 0 3px rgba(239,68,68,.30)
                    );
            }


            .will-csat-dislike:hover {

                background:
                    rgba(239,68,68,.24) !important;

                border-color:
                    rgba(239,68,68,.55) !important;

                box-shadow:
                    0 0 10px rgba(239,68,68,.30);

                transform: translateY(-1px);
            }


            .will-csat-dislike:hover > span:first-child::before {

                transform: scale(1.15);
            }


            /* ================================================
               DARK THEME
            ================================================ */

            .dark .will-csat-like {

                background:
                    rgba(34,197,94,.20) !important;

                border-color:
                    rgba(74,222,128,.40) !important;
            }


            .dark .will-csat-like > span:first-child::before {

                color: #4ade80 !important;
            }


            .dark .will-csat-dislike {

                background:
                    rgba(239,68,68,.20) !important;

                border-color:
                    rgba(248,113,113,.40) !important;
            }


            .dark .will-csat-dislike > span:first-child::before {

                color: #f87171 !important;
            }


            /* ================================================
               REDUCED MOTION
            ================================================ */

            @media (prefers-reduced-motion: reduce) {

                .will-csat,
                .will-csat > span:first-child::before {

                    transition: none !important;
                    transform: none !important;
                }
            }

        `;

        document.head.appendChild(style);
    }


    // =========================================================
    // CSAT DETECTION
    // =========================================================

    function getCSATType(element) {

        const emojiSpan = element.firstElementChild;

        if (!emojiSpan) return null;

        const text = emojiSpan.textContent.trim();

        if (text.includes('👍')) {
            return 'like';
        }

        if (text.includes('👎')) {
            return 'dislike';
        }

        return null;
    }


    // =========================================================
    // LIVE UPDATE
    // =========================================================

    function updateCSAT(element) {

        const type = getCSATType(element);

        const wasLike =
            element.classList.contains('will-csat-like');

        const wasDislike =
            element.classList.contains('will-csat-dislike');


        // Если оценку удалили — убираем оформление.

        if (!type) {

            if (wasLike || wasDislike) {

                element.classList.remove(
                    'will-csat',
                    'will-csat-like',
                    'will-csat-dislike'
                );

                element.removeAttribute('data-will-csat');
            }

            return;
        }


        // Если оценка не менялась — ничего не делаем.

        if (
            (type === 'like' && wasLike) ||
            (type === 'dislike' && wasDislike)
        ) {

            return;
        }


        // Обновляем существующий элемент без его замены.

        element.classList.remove(
            'will-csat-like',
            'will-csat-dislike'
        );

        element.classList.add(
            'will-csat',
            `will-csat-${type}`
        );

        element.dataset.willCsat = type;

        element.title =
            type === 'like'
                ? 'Положительная оценка'
                : 'Отрицательная оценка';
    }


    // =========================================================
    // SCAN
    // =========================================================

    function scanCSAT(root = document) {

        if (root.nodeType !== Node.ELEMENT_NODE &&
            root.nodeType !== Node.DOCUMENT_NODE) {
            return;
        }


        // Проверяем сам элемент.

        if (root.matches?.(SELECTOR)) {

            updateCSAT(root);
        }


        // Проверяем вложенные элементы.

        const elements =
            root.querySelectorAll?.(SELECTOR) || [];

        elements.forEach(updateCSAT);
    }


    // =========================================================
    // INITIAL SCAN
    // =========================================================

    scanCSAT();


    // =========================================================
    // REALTIME MUTATION OBSERVER
    //
    // Без setInterval и debounce.
    // Отслеживаем:
    //
    // 1. Новые CSAT
    // 2. Замену эмодзи
    // 3. Изменение текстового узла
    // 4. Обновления Vue / Chatwoot
    // =========================================================

    const observer = new MutationObserver((mutations) => {

        const pending = new Set();


        mutations.forEach(mutation => {

            if (mutation.type === 'characterData') {

                const parent =
                    mutation.target.parentElement;

                const csat =
                    parent?.closest(SELECTOR);

                if (csat) {

                    pending.add(csat);
                }

                return;
            }


            if (mutation.type === 'childList') {

                // Если Chatwoot заменил текст или эмодзи.

                const target =
                    mutation.target;

                const csat =
                    target.nodeType === Node.ELEMENT_NODE
                        ? target.closest?.(SELECTOR)
                        : null;

                if (csat) {

                    pending.add(csat);
                }


                // Если появился новый блок / сообщение.

                mutation.addedNodes.forEach(node => {

                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return;
                    }

                    pending.add(node);
                });
            }

        });


        // Обновляем только изменённые части DOM.

        pending.forEach(node => {

            if (!node.isConnected) return;

            scanCSAT(node);
        });

    });


    observer.observe(document.body, {

        childList: true,

        characterData: true,

        subtree: true

    });


    console.log(
        '%c[Will] CSAT Cool v1.1 — Live Update',
        'color:#22c55e;font-weight:700'
    );

})();
