
// ==UserScript==
// @name         TagChat
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Мгновенный парсинг проектов. Яркие адаптивные бейджи для светлой и тёмной темы.
// @author       Calvin
// @match        https://sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TagChat.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TagChat.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_TAGS_REGEX =
        /^(VIP|PRIVIP|PREVIP|.*_V2|Duplicate - Phone|Reactivation|Highroll)$/i;

    const dataCache = new Map();

    const ATTR_TO_HIDE = [
        'project',
        'language',
        'usertime',
        'usertag',
        'loyaltylevel',
        'lastdepositdate',
        'devicetype',
        'duplicatelevel',
        'validationlevel',
        'dateofbirth',
        'depositamount',
        'channel type'
    ];


    // =========================================================
    // STYLES — VIBRANT LIGHT / DARK
    // =========================================================

    function initStyles() {

        if (document.getElementById('tagchat-styles')) return;

        const style = document.createElement('style');

        style.id = 'tagchat-styles';

        style.textContent = `

            /* ================================================
               BASE
            ================================================ */

            .custom-badges-wrapper .tagchat-badge {

                display: inline-flex;
                align-items: center;
                justify-content: center;

                padding: 3px 7px;

                border-radius: 5px;

                font-size: 10px;
                font-weight: 700;

                letter-spacing: .25px;
                line-height: 1.35;

                white-space: nowrap;

                border: 1px solid transparent;

                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,.18),
                    0 1px 3px rgba(0,0,0,.05);

                transition:
                    transform .18s ease,
                    box-shadow .18s ease,
                    filter .18s ease,
                    background .18s ease;

                user-select: none;
            }


            /* Hover */

            .custom-badges-wrapper .tagchat-badge:hover {

                transform: translateY(-1px);

                filter: saturate(1.18) brightness(1.04);

                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,.25),
                    0 3px 9px rgba(0,0,0,.12);
            }



            /* ================================================
               LIGHT THEME
            ================================================ */


            /* PROJECT — ELECTRIC BLUE */

            .tagchat-project {

                background:
                    linear-gradient(
                        135deg,
                        #dbeafe 0%,
                        #bfdbfe 100%
                    );

                border-color: #60a5fa !important;

                color: #1d4ed8;

                text-shadow:
                    0 1px 0 rgba(255,255,255,.7);
            }


            /* VIP — PREMIUM GOLD */

            .tagchat-vip {

                background:
                    linear-gradient(
                        135deg,
                        #fef08a 0%,
                        #fbbf24 100%
                    );

                border-color: #d97706 !important;

                color: #78350f;

                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,.45),
                    0 1px 5px rgba(245,158,11,.17) !important;
            }


            /* DUPLICATE — CRIMSON RED */

            .tagchat-duplicate {

                background:
                    linear-gradient(
                        135deg,
                        #fecaca 0%,
                        #fca5a5 100%
                    );

                border-color: #ef4444 !important;

                color: #991b1b;
            }


            /* REACTIVATION — EMERALD */

            .tagchat-reactivation {

                background:
                    linear-gradient(
                        135deg,
                        #a7f3d0 0%,
                        #6ee7b7 100%
                    );

                border-color: #10b981 !important;

                color: #065f46;
            }


            /* HIGHROLL — HOT PINK / ROSE */

            .tagchat-highroll {

                background:
                    linear-gradient(
                        135deg,
                        #fbcfe8 0%,
                        #f9a8d4 100%
                    );

                border-color: #ec4899 !important;

                color: #9d174d;
            }


            /* PERSONAL V2 — VIOLET */

            .tagchat-v2 {

                background:
                    linear-gradient(
                        135deg,
                        #e9d5ff 0%,
                        #d8b4fe 100%
                    );

                border-color: #a855f7 !important;

                color: #6b21a8;
            }


            /* OTHER — SLATE */

            .tagchat-other {

                background:
                    linear-gradient(
                        135deg,
                        #e2e8f0 0%,
                        #cbd5e1 100%
                    );

                border-color: #94a3b8 !important;

                color: #334155;
            }



            /* ================================================
               DARK THEME
            ================================================ */


            /* PROJECT */

            .dark .tagchat-project,
            [data-theme="dark"] .tagchat-project {

                background:
                    linear-gradient(
                        135deg,
                        rgba(37,99,235,.32),
                        rgba(59,130,246,.18)
                    );

                border-color: #3b82f6 !important;

                color: #93c5fd;

                text-shadow:
                    0 0 7px rgba(59,130,246,.35);
            }


            /* VIP */

            .dark .tagchat-vip,
            [data-theme="dark"] .tagchat-vip {

                background:
                    linear-gradient(
                        135deg,
                        rgba(217,119,6,.40),
                        rgba(245,158,11,.20)
                    );

                border-color: #d97706 !important;

                color: #fde68a;

                text-shadow:
                    0 0 8px rgba(251,191,36,.4);

                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,.12),
                    0 0 7px rgba(245,158,11,.15) !important;
            }


            /* DUPLICATE */

            .dark .tagchat-duplicate,
            [data-theme="dark"] .tagchat-duplicate {

                background:
                    linear-gradient(
                        135deg,
                        rgba(220,38,38,.33),
                        rgba(239,68,68,.15)
                    );

                border-color: #ef4444 !important;

                color: #fca5a5;

                text-shadow:
                    0 0 7px rgba(239,68,68,.3);
            }


            /* REACTIVATION */

            .dark .tagchat-reactivation,
            [data-theme="dark"] .tagchat-reactivation {

                background:
                    linear-gradient(
                        135deg,
                        rgba(5,150,105,.34),
                        rgba(16,185,129,.15)
                    );

                border-color: #10b981 !important;

                color: #6ee7b7;

                text-shadow:
                    0 0 7px rgba(16,185,129,.3);
            }


            /* HIGHROLL */

            .dark .tagchat-highroll,
            [data-theme="dark"] .tagchat-highroll {

                background:
                    linear-gradient(
                        135deg,
                        rgba(219,39,119,.35),
                        rgba(244,63,94,.17)
                    );

                border-color: #ec4899 !important;

                color: #f9a8d4;

                text-shadow:
                    0 0 7px rgba(236,72,153,.3);
            }


            /* V2 */

            .dark .tagchat-v2,
            [data-theme="dark"] .tagchat-v2 {

                background:
                    linear-gradient(
                        135deg,
                        rgba(124,58,237,.36),
                        rgba(168,85,247,.18)
                    );

                border-color: #a855f7 !important;

                color: #e9d5ff;

                text-shadow:
                    0 0 7px rgba(168,85,247,.35);
            }


            /* OTHER */

            .dark .tagchat-other,
            [data-theme="dark"] .tagchat-other {

                background:
                    linear-gradient(
                        135deg,
                        rgba(100,116,139,.32),
                        rgba(148,163,184,.14)
                    );

                border-color: #64748b !important;

                color: #e2e8f0;
            }



            /* ================================================
               COMMON HOVER GLOW
            ================================================ */

            .custom-badges-wrapper .tagchat-project:hover {
                box-shadow:
                    0 0 9px rgba(59,130,246,.30) !important;
            }

            .custom-badges-wrapper .tagchat-vip:hover {
                box-shadow:
                    0 0 10px rgba(245,158,11,.35) !important;
            }

            .custom-badges-wrapper .tagchat-duplicate:hover {
                box-shadow:
                    0 0 9px rgba(239,68,68,.30) !important;
            }

            .custom-badges-wrapper .tagchat-reactivation:hover {
                box-shadow:
                    0 0 9px rgba(16,185,129,.30) !important;
            }

            .custom-badges-wrapper .tagchat-highroll:hover {
                box-shadow:
                    0 0 9px rgba(236,72,153,.30) !important;
            }

            .custom-badges-wrapper .tagchat-v2:hover {
                box-shadow:
                    0 0 9px rgba(168,85,247,.30) !important;
            }

        `;

        document.head.appendChild(style);
    }



    // =========================================================
    // DATA EXTRACTION
    // =========================================================

    function extractData() {

        let tags = [];
        let project = null;
        let status = null;

        const pElements =
            document.querySelectorAll('.is-editable p');

        for (let p of pElements) {

            let text = p.textContent.trim();

            if (
                text.startsWith('[') &&
                text.endsWith(']')
            ) {

                try {

                    const tagsArray = JSON.parse(text);

                    if (Array.isArray(tagsArray)) {

                        const matched = tagsArray.filter(tag => {

                            const t = tag.trim();

                            if (
                                t.toLowerCase() === 'nekontakt_v2'
                            ) {
                                return false;
                            }

                            return TARGET_TAGS_REGEX.test(t);

                        });

                        if (matched.length > 0) {
                            tags = matched;
                        }
                    }

                } catch (e) {}
            }
        }

        return { tags, project, status };
    }



    // =========================================================
    // HIDE UNWANTED ATTRIBUTES
    // =========================================================

    function hideUnwantedAttributes() {

        const attributeSpans =
            document.querySelectorAll(
                '.px-4.py-3 h4 span.text-n-slate-12'
            );

        attributeSpans.forEach(span => {

            const name =
                span.textContent.trim().toLowerCase();

            if (
                ATTR_TO_HIDE.some(
                    attr => name.startsWith(attr)
                )
            ) {

                const containerRow =
                    span.closest('.drag-handle');

                if (
                    containerRow &&
                    containerRow.style.display !== 'none'
                ) {
                    containerRow.style.display = 'none';
                }
            }
        });
    }



    // =========================================================
    // TAG CLASS
    // =========================================================

    function getTagStyle(tagText) {

        const t = tagText.toLowerCase();

        if (t.includes('duplicate')) {
            return 'tagchat-duplicate';
        }

        if (t.includes('reactivation')) {
            return 'tagchat-reactivation';
        }

        if (t.includes('highroll')) {
            return 'tagchat-highroll';
        }

        if (/^(vip|privip|previp)$/.test(t)) {
            return 'tagchat-vip';
        }

        if (t.includes('_v2')) {
            return 'tagchat-v2';
        }

        return 'tagchat-other';
    }



    // =========================================================
    // HTML ESCAPE
    // =========================================================

    function escapeHTML(value) {

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }



    // =========================================================
    // RENDER
    // =========================================================

    function render() {

        const chatItems =
            document.querySelectorAll('.conversation');

        chatItems.forEach(chat => {

            const nameEl =
                chat.querySelector('.conversation--user');

            if (!nameEl) return;

            const chatName =
                nameEl.textContent.trim();

            const cached =
                dataCache.get(chatName) || {
                    tags: [],
                    project: null,
                    status: null
                };

            const titleContainer =
                nameEl.previousElementSibling;

            if (!titleContainer) return;

            const sourceContainer =
                titleContainer.querySelector('[title]');

            if (!sourceContainer) return;


            // Hide original elements

            const originalElements =
                sourceContainer.querySelectorAll(
                    '.inline-flex, .truncate'
                );

            originalElements.forEach(el => {

                if (el.style.display !== 'none') {
                    el.style.display = 'none';
                }
            });


            let dProj = cached.project;
            let dStat = cached.status;


            if (!dProj) {

                const fullText =
                    sourceContainer.getAttribute('title') || '';

                if (fullText) {

                    const match = fullText.match(
                        /^(.*?)(?:\s+(VIP|PRIVIP|PREVIP|REGULAR|TG|.*_V2))?$/i
                    );

                    dProj = match
                        ? match[1].trim()
                        : fullText;

                    dStat = match && match[2]
                        ? match[2].toUpperCase()
                        : null;
                }
            }


            // Badge wrapper

            let badgeWrapper =
                sourceContainer.querySelector(
                    '.custom-badges-wrapper'
                );

            if (!badgeWrapper) {

                badgeWrapper =
                    document.createElement('div');

                badgeWrapper.className =
                    'custom-badges-wrapper flex items-center gap-1 flex-wrap w-full';

                sourceContainer.appendChild(badgeWrapper);
            }


            let html = '';
            let vipShown = false;


            // PROJECT

            if (dProj) {

                html += `
                    <span class="tagchat-badge tagchat-project">
                        ${escapeHTML(dProj)}
                    </span>
                `;
            }


            // STATUS

            if (dStat) {

                if (/^(vip|privip|previp)$/i.test(dStat)) {
                    vipShown = true;
                }

                html += `
                    <span class="tagchat-badge ${getTagStyle(dStat)}">
                        ${escapeHTML(dStat)}
                    </span>
                `;
            }


            // TAGS

            if (cached.tags && cached.tags.length > 0) {

                cached.tags.forEach(t => {

                    if (/^(vip|privip|previp)$/i.test(t)) {

                        if (vipShown) return;

                        vipShown = true;
                    }

                    html += `
                        <span class="tagchat-badge ${getTagStyle(t)}">
                            ${escapeHTML(t)}
                        </span>
                    `;
                });
            }


            if (badgeWrapper.innerHTML !== html) {

                badgeWrapper.innerHTML = html;
            }

        });
    }



    // =========================================================
    // OBSERVER
    // =========================================================

    let observerTimeout = null;

    const observer = new MutationObserver(() => {

        if (observerTimeout) {
            clearTimeout(observerTimeout);
        }

        observerTimeout = setTimeout(() => {

            const activeChat =
                document.querySelector('.conversation.active');

            if (activeChat) {

                const nameEl =
                    activeChat.querySelector('.conversation--user');

                if (nameEl) {

                    const activeName =
                        nameEl.textContent.trim();

                    const extracted =
                        extractData();

                    const existing =
                        dataCache.get(activeName) || {
                            tags: [],
                            project: null,
                            status: null
                        };

                    dataCache.set(activeName, {

                        tags: extracted.tags.length > 0
                            ? extracted.tags
                            : existing.tags,

                        project:
                            extracted.project || existing.project,

                        status:
                            extracted.status || existing.status

                    });
                }
            }

            hideUnwantedAttributes();

            render();

        }, 200);
    });



    // =========================================================
    // INITIALIZATION
    // =========================================================

    initStyles();

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    setInterval(() => {

        render();
        hideUnwantedAttributes();

    }, 2000);

    render();
    hideUnwantedAttributes();

})();
