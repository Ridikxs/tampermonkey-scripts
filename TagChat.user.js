// ==UserScript==
// @name         TagChat
// @namespace    http://tampermonkey.net/
// @version      2.4
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
        return { tags, project, status };
    }

    function hideUnwantedAttributes() {
        const attributeSpans = document.querySelectorAll('.px-4.py-3 h4 span.text-n-slate-12');
        attributeSpans.forEach(span => {
            const name = span.textContent.trim().toLowerCase();
            if (ATTR_TO_HIDE.some(attr => name.startsWith(attr))) {
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

        if (t.includes('duplicate')) return `${baseSt} background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;`;
        if (t.includes('reactivation')) return `${baseSt} background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7;`;
        if (t.includes('highroll')) return `${baseSt} background: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.4); color: #fda4af;`;
        if (/^(vip|privip|previp)$/.test(t)) return `${baseSt} background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fcd34d;`;
        if (t.includes('_v2')) return `${baseSt} background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.4); color: #d8b4fe;`;

        return `${baseSt} background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); color: #cbd5e1;`;
    }

    function render() {
        const chatItems = document.querySelectorAll('.conversation');

        chatItems.forEach(chat => {
            const nameEl = chat.querySelector('.conversation--user');
            if (!nameEl) return; // Безопасный пропуск, если блок еще не прогрузился
            
            const chatName = nameEl.textContent.trim();
            const cached = dataCache.get(chatName) || { tags: [], project: null, status: null };

            // Безопасный поиск контейнера с названием проекта (Gama Regular и т.д.)
            const titleContainer = nameEl.previousElementSibling;
            if (!titleContainer) return;
            
            const sourceContainer = titleContainer.querySelector('[title]');
            if (!sourceContainer) return;

            const iconWrapper = sourceContainer.querySelector('.text-n-slate-11.flex-shrink-0, .i-woot-website, .i-woot-telegram')?.parentElement;
            const truncateEl = sourceContainer.querySelector('.truncate');

            let dProj = cached.project;
            let dStat = cached.status;

            // Вытягиваем проект прямо из верстки сайта
            if (!dProj) {
                const fullText = sourceContainer.getAttribute('title') || (truncateEl ? truncateEl.textContent.trim() : '');
                if (fullText) {
                    // Регулярка теперь распознает TG и Regular отдельно
                    const match = fullText.match(/^(.*?)(?:\s+(VIP|PRIVIP|PREVIP|REGULAR|TG|.*_V2))?$/i);
                    dProj = match ? match[1].trim() : fullText;
                    dStat = match && match[2] ? match[2].toUpperCase() : null;
                }
            }

            // Прячем старые иконки и текст
            if (iconWrapper && iconWrapper.style.display !== 'none') iconWrapper.style.display = 'none';
            if (truncateEl && truncateEl.style.display !== 'none') truncateEl.style.display = 'none';

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
                if (/^(vip|privip|previp)$/i.test(dStat)) vipShown = true;
                html += `<span style="${getTagStyle(dStat)}">${dStat}</span>`;
            }

            if (cached.tags && cached.tags.length > 0) {
                cached.tags.forEach(t => {
                    if (/^(vip|privip|previp)$/i.test(t)) {
                        if (vipShown) return;
                        vipShown = true;
                    }
                    html += `<span style="${getTagStyle(t)}">${t}</span>`;
                });
            }

            if (badgeWrapper.innerHTML !== html) {
                badgeWrapper.innerHTML = html;
            }
        });
    }

    // Observer с задержкой, чтобы не вешать страницу при быстрых изменениях
    let observerTimeout = null;
    const observer = new MutationObserver(() => {
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
            const activeChat = document.querySelector('.conversation.active');
            if (activeChat) {
                const nameEl = activeChat.querySelector('.conversation--user');
                if (nameEl) {
                    const activeName = nameEl.textContent.trim();
                    const extracted = extractData();
                    const existing = dataCache.get(activeName) || { tags: [], project: null, status: null };
                    
                    dataCache.set(activeName, {
                        tags: extracted.tags.length > 0 ? extracted.tags : existing.tags,
                        project: extracted.project || existing.project,
                        status: extracted.status || existing.status
                    });
                }
            }
            hideUnwantedAttributes();
            render();
        }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Фолбек: Принудительно запускаем рендер каждые 2 секунды. 
    // Это гарантирует, что бейджи прогрузятся даже если Observer пропустит загрузку страницы.
    setInterval(() => {
        render();
        hideUnwantedAttributes();
    }, 2000);

})();
