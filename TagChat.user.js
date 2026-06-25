// ==UserScript==
// @name         TagChat
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Мгновенный парсинг проектов
// @author       Calvin
// @match        https://sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TagChat.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TagChat.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_TAGS_REGEX = /^(VIP|PRIVIP|PREVIP|.*_V2|Duplicate - Phone|Reactivation|Highroll)$/i;
    const dataCache = new Map();

    const ATTR_TO_HIDE = [
        'project', 'language', 'usertime', 'usertag', 'loyaltylevel',
        'lastdepositdate', 'devicetype', 'duplicatelevel', 'validationlevel',
        'dateofbirth', 'depositamount', 'channel type'
    ];

    function getActiveChatName() {
        const activeChat = document.querySelector('.conversation.active');
        if (activeChat) {
            const nameEl = activeChat.querySelector('.conversation--user');
            if (nameEl) return nameEl.textContent.trim();
        }
        return null;
    }

    function extractData() {
        let tags = [];
        let project = null;
        let status = null;

        const pElements = document.querySelectorAll('.is-editable p');
        for (let p of pElements) {
            let text = p.textContent.trim();
            if (text.startsWith('[') && text.endsWith(']')) {
                try {
                    const tagsArray = JSON.parse(text);
                    if (Array.isArray(tagsArray)) {
                        const matched = tagsArray.filter(tag => {
                            const t = tag.trim();
                            if (t.toLowerCase() === 'nekontakt_v2') return false;
                            return TARGET_TAGS_REGEX.test(t);
                        });
                        if (matched.length > 0) tags = matched;
                    }
                } catch (e) {}
            }
        }

        const wrapElements = document.querySelectorAll('.multiselect-wrap--small');
        for (let wrap of wrapElements) {
            if (wrap.textContent.includes('Назначенный источник')) {
                const h4 = wrap.querySelector('button h4[title]');
                if (h4) {
                    const fullText = h4.getAttribute('title').trim();
                    const match = fullText.match(/^(.*?)(?:\s+(VIP|PRIVIP|PREVIP|REGULAR|.*_V2))?$/i);
                    project = match ? match[1].trim() : fullText;
                    status = match && match[2] ? match[2].toUpperCase() : null;
                }
                break;
            }
        }

        return { tags, project, status };
    }

    function hideUnwantedAttributes() {
        const attributeSpans = document.querySelectorAll('.px-4.py-3 h4 span.text-n-slate-12');
        attributeSpans.forEach(span => {
            const name = span.textContent.trim().toLowerCase();
            const shouldHide = ATTR_TO_HIDE.some(attr => name.startsWith(attr));

            if (shouldHide) {
                const containerRow = span.closest('.drag-handle');
                if (containerRow && containerRow.style.display !== 'none') {
                    containerRow.style.display = 'none';
                }
            }
        });
    }

    function getTagStyle(tagText) {
        const t = tagText.toLowerCase();
        const baseSt = "padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.3px; white-space: nowrap; border: 1px solid;";

        if (t.includes('duplicate')) {
            return `${baseSt} background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;`;
        }
        if (t.includes('reactivation')) {
            return `${baseSt} background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7;`;
        }
        if (t.includes('highroll')) {
            return `${baseSt} background: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.4); color: #fda4af;`;
        }
        if (/^(vip|privip|previp)$/.test(t)) {
            return `${baseSt} background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fcd34d;`;
        }
        if (t.includes('_v2')) {
            return `${baseSt} background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.4); color: #d8b4fe;`;
        }

        return `${baseSt} background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); color: #cbd5e1;`;
    }

    function isVipEquivalent(tagText) {
        return /^(vip|privip|previp)$/i.test(tagText);
    }

    function render() {
        const chatItems = document.querySelectorAll('.conversation');

        chatItems.forEach(chat => {
            const nameEl = chat.querySelector('.conversation--user');
            if (!nameEl) return;
            const chatName = nameEl.textContent.trim();
            const cached = dataCache.get(chatName) || { tags: [], project: null, status: null };

            const sourceContainer = chat.querySelector('.flex-1.min-w-0[title], .flex-1.min-w-0');
            if (!sourceContainer) return;

            const iconEl = sourceContainer.querySelector('.relative.inline-flex') || sourceContainer.querySelector('span[class^="i-"]');
            const truncateEl = sourceContainer.querySelector('.truncate');

            let dProj = cached.project;
            let dStat = cached.status;

            if (!dProj && sourceContainer.hasAttribute('title')) {
                const fullText = sourceContainer.getAttribute('title').trim();
                const match = fullText.match(/^(.*?)(?:\s+(VIP|PRIVIP|PREVIP|REGULAR|.*_V2))?$/i);
                dProj = match ? match[1].trim() : fullText;
                dStat = match && match[2] ? match[2].toUpperCase() : null;
            } else if (!dProj && truncateEl && truncateEl.textContent.trim()) {
                const fullText = truncateEl.textContent.trim();
                const match = fullText.match(/^(.*?)(?:\s+(VIP|PRIVIP|PREVIP|REGULAR|.*_V2))?$/i);
                dProj = match ? match[1].trim() : fullText;
                dStat = match && match[2] ? match[2].toUpperCase() : null;
            }

            if (iconEl) iconEl.style.display = 'none';
            if (truncateEl) truncateEl.style.display = 'none';

            let badgeWrapper = sourceContainer.querySelector('.custom-badges-wrapper');
            if (!badgeWrapper) {
                badgeWrapper = document.createElement('div');
                badgeWrapper.className = 'custom-badges-wrapper flex items-center gap-1 flex-wrap w-full';
                sourceContainer.appendChild(badgeWrapper);
            }

            let html = '';
            let vipShown = false;

            if (dProj) {
                const baseSt = "padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.3px; white-space: nowrap; border: 1px solid;";
                html += `<span style="${baseSt} background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4); color: #93c5fd;">${dProj}</span>`;
            }

            if (dStat) {
                if (isVipEquivalent(dStat)) vipShown = true;
                html += `<span style="${getTagStyle(dStat)}">${dStat}</span>`;
            }

            if (cached.tags.length > 0) {
                cached.tags.forEach(t => {
                    if (isVipEquivalent(t)) {
                        if (vipShown) return;
                        vipShown = true;
                    }
                    html += `<span style="${getTagStyle(t)}">${t}</span>`;
                });
            }

            if (badgeWrapper.innerHTML !== html) {
                badgeWrapper.innerHTML = html;
            }

            const oldTags = chat.querySelector('.custom-user-tags');
            if (oldTags) oldTags.remove();
        });
    }

    const observer = new MutationObserver(() => {
        const activeName = getActiveChatName();
        if (activeName) {
            const extracted = extractData();
            const existing = dataCache.get(activeName) || { tags: [], project: null, status: null };

            dataCache.set(activeName, {
                tags: extracted.tags.length > 0 ? extracted.tags : existing.tags,
                project: extracted.project || existing.project,
                status: extracted.status || existing.status
            });
        }

        hideUnwantedAttributes();
        render();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

})();

})();
