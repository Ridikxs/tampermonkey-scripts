// ==UserScript==
// @name         Chat Highlight
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Адаптивная синяя подсветка выбранного чата с вертикальным индикатором. Поддержка светлой и тёмной темы Chatwoot.
// @author       Will
// @match        https://sparkmoth.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/ChatHighlight.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/ChatHighlight.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'willdoit-modern-selected-chat-v9';

    function installStyles() {

        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `

            /* ================================================
               BASE
            ================================================ */

            .conversations-list .conversation {
                position: relative !important;
                transform: none !important;
                transition:
                    background-color .20s ease,
                    border-color .20s ease,
                    box-shadow .20s ease !important;
            }

            /* ================================================
               LIGHT THEME — SELECTED CHAT
            ================================================ */

            .conversations-list .conversation.active {
                position: relative !important;
                background: #DBEAFE !important;
                border: 1px solid #93C5FD !important;
                border-left: 0 !important;
                border-radius: 9px !important;
                margin-left: 4px !important;
                box-shadow:
                    0 2px 9px rgba(37, 99, 235, .12) !important;
                transform: none !important;
                z-index: 5 !important;
            }

            /* ================================================
               LEFT BLUE INDICATOR
            ================================================ */

            .conversations-list .conversation.active::before {
                content: "" !important;
                position: absolute !important;
                display: block !important;
                left: -5px !important;
                top: 0 !important;
                bottom: 0 !important;
                width: 5px !important;
                height: auto !important;
                border-radius: 5px 0 0 5px !important;
                background: #2563EB !important;
                box-shadow:
                    0 0 8px rgba(37, 99, 235, .30) !important;
                pointer-events: none !important;
                z-index: 10 !important;
            }

            /* ================================================
               LIGHT — TEXT
            ================================================ */

            .conversations-list .conversation.active .conversation--user {
                color: #1E40AF !important;
                font-weight: 750 !important;
                letter-spacing: -.01em !important;
            }

            .conversations-list .conversation.active .text-label-small {
                color: #1D4ED8 !important;
                font-weight: 600 !important;
            }

            .conversations-list .conversation.active .text-n-slate-11 {
                color: #475569 !important;
            }

            .conversations-list .conversation.active .text-xs {
                color: #2563EB !important;
                font-weight: 650 !important;
            }

            .conversations-list .conversation.active .label {
                filter: saturate(1.15) !important;
            }

            .conversations-list .conversation.active [role="img"] {
                box-shadow:
                    0 0 0 2px #FFFFFF,
                    0 0 0 4px rgba(37,99,235,.35) !important;
                transition: box-shadow .18s ease !important;
            }

            .conversations-list .conversation.active:hover {
                background: #BFDBFE !important;
                border-color: #60A5FA !important;
                box-shadow:
                    0 3px 12px rgba(37,99,235,.16) !important;
                transform: none !important;
            }

            /* ================================================
               DARK THEME — SELECTED CHAT
            ================================================ */

            .dark .conversations-list .conversation.active,
            [data-theme="dark"] .conversations-list .conversation.active {
                background: #192D4A !important;
                border: 1px solid #345B91 !important;
                border-left: 0 !important;
                box-shadow:
                    0 2px 10px rgba(0,0,0,.18),
                    0 0 0 1px rgba(59,130,246,.05) !important;
            }

            .dark .conversations-list .conversation.active::before,
            [data-theme="dark"] .conversations-list .conversation.active::before {
                background: #3B82F6 !important;
                box-shadow:
                    0 0 10px rgba(59,130,246,.45) !important;
            }

            /* ================================================
               DARK THEME — ALL TEXT WHITE
            ================================================ */

            .dark .conversations-list .conversation.active .conversation--user,
            [data-theme="dark"] .conversations-list .conversation.active .conversation--user,

            .dark .conversations-list .conversation.active .text-label-small,
            [data-theme="dark"] .conversations-list .conversation.active .text-label-small,

            .dark .conversations-list .conversation.active .text-n-slate-11,
            [data-theme="dark"] .conversations-list .conversation.active .text-n-slate-11,

            .dark .conversations-list .conversation.active .text-xs,
            [data-theme="dark"] .conversations-list .conversation.active .text-xs,

            .dark .conversations-list .conversation.active .label,
            [data-theme="dark"] .conversations-list .conversation.active .label,

            .dark .conversations-list .conversation.active .tagchat-badge,
            [data-theme="dark"] .conversations-list .conversation.active .tagchat-badge,

            .dark .conversations-list .conversation.active .custom-badges-wrapper span,
            [data-theme="dark"] .conversations-list .conversation.active .custom-badges-wrapper span {
                color: #FFFFFF !important;
            }

            .dark .conversations-list .conversation.active .conversation--user,
            [data-theme="dark"] .conversations-list .conversation.active .conversation--user {
                font-weight: 750 !important;
            }

            .dark .conversations-list .conversation.active .text-label-small,
            [data-theme="dark"] .conversations-list .conversation.active .text-label-small {
                font-weight: 600 !important;
            }

            .dark .conversations-list .conversation.active .text-xs,
            [data-theme="dark"] .conversations-list .conversation.active .text-xs {
                font-weight: 650 !important;
            }

            .dark .conversations-list .conversation.active [role="img"],
            [data-theme="dark"] .conversations-list .conversation.active [role="img"] {
                box-shadow:
                    0 0 0 2px #192D4A,
                    0 0 0 4px rgba(96,165,250,.45) !important;
            }

            .dark .conversations-list .conversation.active:hover,
            [data-theme="dark"] .conversations-list .conversation.active:hover {
                background: #213D64 !important;
                border-color: #3B82F6 !important;
                border-left: 0 !important;
                box-shadow:
                    0 3px 13px rgba(0,0,0,.22),
                    0 0 0 1px rgba(59,130,246,.12) !important;
                transform: none !important;
            }

            /* ================================================
               DISABLE DEFAULT ACTIVE ANIMATION
            ================================================ */

            .conversations-list .conversation.active.animate-card-select {
                animation: none !important;
            }

            /* ================================================
               REDUCED MOTION
            ================================================ */

            @media (prefers-reduced-motion: reduce) {
                .conversations-list .conversation {
                    transition: none !important;
                    animation: none !important;
                }
            }

        `;

        document.head.appendChild(style);

        console.log(
            '%c[Will] Chat Highlight v1.9 loaded',
            'color:#3B82F6;font-weight:700'
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            installStyles,
            { once: true }
        );
    } else {
        installStyles();
    }

})();