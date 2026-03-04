// ==UserScript==
// @name         Analyzer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Исправлен поиск проекта, серые кнопки, старт в свернутом виде, фильтр .casino
// @author       River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Analyzer.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Analyzer.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_EMAIL = 'river_transfer_mail_v10';
    const POS_KEY = 'river_pos_v10';
    const THEME_KEY = 'river_theme_v10';
    const BRIGHT_KEY = 'river_bright_v10';
    const BG_COLOR_KEY = 'river_bg_color_v10';
    const OPACITY_KEY = 'river_opacity_v10';
    const MINIMIZED_KEY = 'river_minimized_v10';

    const PROJECTS = [
        { name: 'CAT', key: 'cat', url: 'http://cc.boadmin.org/' },
        { name: 'GM', key: 'gama', url: 'http://gm.boadmin.org/' },
        { name: 'DY', key: 'daddy', url: 'http://dy.boadmin.org/' },
        { name: 'MR', key: 'mers', url: 'http://mr.boadmin.org/' },
        { name: 'KN', key: 'kent', url: 'http://kn.boadmin.org/' },
        { name: 'R7', key: 'r7', url: 'http://rs.boadmin.org/' },
        { name: 'KT', key: 'kometa', url: 'http://kt.boadmin.org/' },
        { name: 'AK', key: 'arkada', url: 'http://ak.boadmin.org/' }
    ];

    const FUNDIST = [
        { name: 'F2', url: 'https://www2.fundist.org/ru/Users/Summary' },
        { name: 'F7', url: 'https://www7.fundist.org/ru/Users/Summary' },
        { name: 'F9', url: 'https://www9.fundist.org/ru/Users/Summary' }
    ];

    const BLACKLIST = ['boadmin.org', 'fundist.org', 'livechatinc.com', '.casino', 'support@', 'kyc@', 'info@'];
    const HD_URL = 'https://my.livechatinc.com/apps/helpdesk';

    let lastChatId = null;
    let selectedEmail = null;

    function getChatId() {
        const match = window.location.pathname.match(/\/chats\/([^\/]+)/);
        return match ? match[1] : null;
    }

    function getContext() {
        const cid = getChatId();
        if (cid !== lastChatId) { lastChatId = cid; selectedEmail = null; }
        
        // Поиск проекта по тегам и активному чату
        const tags = document.querySelectorAll('.lc-Tag-moduletagcontent___w-HK1, [class*="Tag"], [class*="tag"]');
        let combinedText = "";
        tags.forEach(t => combinedText += " " + t.innerText.toLowerCase());
        const activeChatItem = document.querySelector('[aria-selected="true"], .chat-item.css-6z76hl');
        if (activeChatItem) combinedText += " " + activeChatItem.innerText.toLowerCase();

        let detectedProj = null;
        for (let p of PROJECTS) {
            if (combinedText.includes(p.key.toLowerCase())) {
                detectedProj = p;
                break; 
            }
        }

        let emails = [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
        const container = document.querySelector('[class*="Details"], [class*="CustomerInfo"], [id="main-layout-wrapper"]');
        if (container) {
            const matches = container.innerText.match(emailRegex);
            if (matches) {
                matches.forEach(m => {
                    if (!BLACKLIST.some(b => m.toLowerCase().includes(b))) emails.push(m);
                });
            }
        }
        return { emails: [...new Set(emails)], project: detectedProj };
    }

    function init() {
        if (document.getElementById('river-host-v10')) return;
        
        // Принудительно сворачиваем при старте
        localStorage.setItem(MINIMIZED_KEY, 'true');

        const host = document.createElement('div');
        host.id = 'river-host-v10';
        const savedPos = JSON.parse(localStorage.getItem(POS_KEY)) || { top: '150px', left: '20px' };
        Object.assign(host.style, { position: 'fixed', top: savedPos.top, left: savedPos.left, zIndex: '2147483647', pointerEvents: 'none', minWidth: '245px' });

        const shadow = host.attachShadow({mode: 'open'});
        const root = document.createElement('div');
        root.style.pointerEvents = 'auto';
        const style = document.createElement('style');

        let theme = localStorage.getItem(THEME_KEY) || 'dark';
        let brightLevel = localStorage.getItem(BRIGHT_KEY) || '100';
        let customBg = localStorage.getItem(BG_COLOR_KEY) || (theme === 'dark' ? '#202024' : '#e0e0e0');
        let opacityLevel = localStorage.getItem(OPACITY_KEY) || '100';
        let isMinimized = true;

        const updateStyles = (t, b, bg, op, mini) => {
            const isDark = t === 'dark';
            const txtOpacity = b / 100;
            const panelOpacity = op / 100;
            const txtMain = isDark ? `rgba(255,255,255,${txtOpacity})` : `rgba(0,0,0,${txtOpacity})`;

            style.textContent = `
                #panel { background: ${bg}; opacity: ${panelOpacity}; color: ${txtMain}; padding: 10px; border-radius: 12px; border: 1px solid ${isDark ? '#444' : '#999'}; font-family: sans-serif; min-width: 245px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); box-sizing: border-box; }
                .drag-handle { cursor: move; font-size: 10px; color: ${txtMain}; display: flex; justify-content: space-between; align-items: center; border-bottom: ${mini ? 'none' : '1px solid ' + (isDark ? '#444' : '#ccc')}; padding-bottom: ${mini ? '0' : '6px'}; margin-bottom: ${mini ? '0' : '10px'}; font-weight: bold; letter-spacing: 1px; }
                .controls { display: flex; gap: 8px; align-items: center; }
                .ctrl-btn { cursor: pointer; font-size: 14px; user-select: none; }
                #content-area { display: ${mini ? 'none' : 'block'}; }
                .email-choice { background: rgba(0,0,0,0.1); padding: 8px; border-radius: 6px; margin-bottom: 5px; border: 1px solid rgba(0,0,0,0.2); cursor: pointer; font-size: 11px; text-align: center; color: ${txtMain}; }
                .email-active { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; border: 1px solid #0084ff; }
                .mail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 6px; }
                .mail-txt { font-size: 11px; font-weight: 400; color: ${isDark ? '#fff' : '#000'}; word-break: break-all; flex: 1; }
                .btn-mini { border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: bold; color: #fff; background: #d9534f; }
                .btn-hd-top { background: #5cb85c; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: bold; color: #fff; }
                .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
                .btn-p { border: none; padding: 7px 0; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: 600; background: rgba(0,0,0,0.2); color: ${txtMain}; text-transform: uppercase; border: 1px solid rgba(0,0,0,0.1); }
                .btn-refresh { width: 100%; background: rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.2); color: ${txtMain}; padding: 6px; border-radius: 6px; margin-bottom: 10px; font-size: 10px; cursor: pointer; font-weight: bold; }
                .menu-section { display: none; padding: 8px 0; border-top: 1px solid rgba(0,0,0,0.2); margin-top: 8px; }
                .nav-btn { width: 100%; background: #0084ff; color: #fff; border: none; padding: 6px; border-radius: 5px; font-size: 10px; font-weight: bold; cursor: pointer; margin-bottom: 5px; }
                .theme-btn { font-size: 10px; cursor: pointer; color: #0084ff; margin-bottom: 10px; display: block; font-weight: bold; }
                .sub-head { font-size: 8px; color: ${txtMain}; font-weight: bold; margin: 10px 0 5px; text-transform: uppercase; }
                input[type=range] { width: 100%; cursor: pointer; }
                .btn-back { background: transparent; color: ${txtMain}; border: 1px solid rgba(0,0,0,0.2); width: 100%; margin-top: 10px; font-size: 9px; padding: 5px; cursor: pointer; border-radius: 5px; font-weight: bold; }
            `;
        };

        updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized);
        shadow.appendChild(style); shadow.appendChild(root); document.body.appendChild(host);

        let activeTab = null;

        const draw = () => {
            const data = getContext();
            const isDark = theme === 'dark';
            root.innerHTML = `
                <div id="panel">
                    <div class="drag-handle" id="d-handle">
                        <span>RIVER ANALYZER</span>
                        <div class="controls">
                            <span class="ctrl-btn" id="min-btn">${isMinimized ? '⬜' : '—'}</span>
                            <span class="ctrl-btn" id="set-btn">⚙️</span>
                        </div>
                    </div>
                    <div id="content-area">
                        <div class="menu-section" id="set-menu" style="display: ${activeTab === 'settings' ? 'block' : 'none'}">
                            <span class="theme-btn" id="theme-toggle">${isDark ? '☀️ Светлая' : '🌙 Темная'}</span>
                            <button class="nav-btn" id="open-links">ОТКРЫТЬ ССЫЛКИ 🔗</button>
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px">
                                <span class="sub-head">Цвет:</span>
                                <input type="color" id="bg-picker" value="${customBg}">
                            </div>
                            <div class="sub-head">Прозрачность:</div>
                            <input type="range" id="op-range" min="20" max="100" value="${opacityLevel}">
                            <div class="sub-head">Яркость текста:</div>
                            <input type="range" id="br-range" min="30" max="100" value="${brightLevel}">
                        </div>
                        <div class="menu-section" id="links-menu" style="display: ${activeTab === 'links' ? 'block' : 'none'}">
                            <div class="sub-head">Fundist</div>
                            <div class="actions" style="margin-bottom:10px">
                                ${FUNDIST.map(f => `<button class="btn-p btn-action" style="background:#444;color:#fff" data-url="${f.url}">${f.name}</button>`).join('')}
                            </div>
                            <div class="sub-head">Проекты</div>
                            <div class="actions">
                                ${PROJECTS.map(p => `<button class="btn-p btn-action" data-url="${p.url}">${p.name}</button>`).join('')}
                            </div>
                            <button class="btn-back" id="back-to-settings">← НАЗАД</button>
                        </div>
                        <button class="btn-refresh" id="re-scan">ОБНОВИТЬ ↻</button>
                        <div id="area"></div>
                    </div>
                </div>`;

            const area = root.querySelector('#area');
            if (data.emails.length === 0) {
                area.innerHTML = `<div style="font-size: 10px; text-align: center; color: #666; padding: 10px;">Поиск...</div>`;
            } else if (!selectedEmail) {
                data.emails.forEach(e => {
                    const el = document.createElement('div'); el.className = 'email-choice'; el.innerText = e;
                    el.onclick = () => { selectedEmail = e; draw(); }; area.appendChild(el);
                });
            } else {
                area.innerHTML = `
                    <div class="email-active">
                        <div class="mail-header">
                            <span class="mail-txt">${selectedEmail}</span>
                            <div style="display:flex; gap:4px">
                                <button class="btn-mini" id="c-copy">КОПИЯ</button>
                                <button class="btn-hd-top" id="c-hd">HD</button>
                            </div>
                        </div>
                        <div class="actions">
                            ${PROJECTS.map(p => `<button class="btn-p btn-action" data-url="${p.url}">${p.name}</button>`).join('')}
                        </div>
                        <button class="btn-back" id="c-back">← К СПИСКУ</button>
                    </div>`;
                root.querySelector('#c-copy').onclick = (e) => copyProcess(selectedEmail, e.target);
                root.querySelector('#c-hd').onclick = (e) => copyProcess(selectedEmail, e.target, HD_URL);
                root.querySelector('#c-back').onclick = () => { selectedEmail = null; draw(); };
            }

            root.querySelector('#min-btn').onclick = () => {
                isMinimized = !isMinimized;
                updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized);
                draw();
            };

            root.querySelector('#set-btn').onclick = () => {
                if (isMinimized) { isMinimized = false; activeTab = 'settings'; }
                else { activeTab = activeTab === 'settings' ? null : 'settings'; }
                updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized);
                draw();
            };

            if (activeTab === 'settings') {
                root.querySelector('#open-links').onclick = () => { activeTab = 'links'; draw(); };
                root.querySelector('#bg-picker').oninput = (e) => { customBg = e.target.value; localStorage.setItem(BG_COLOR_KEY, customBg); updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized); };
                root.querySelector('#op-range').oninput = (e) => { opacityLevel = e.target.value; localStorage.setItem(OPACITY_KEY, opacityLevel); updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized); };
                root.querySelector('#br-range').oninput = (e) => { brightLevel = e.target.value; localStorage.setItem(BRIGHT_KEY, brightLevel); updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized); };
                root.querySelector('#theme-toggle').onclick = () => {
                    theme = theme === 'dark' ? 'light' : 'dark';
                    localStorage.setItem(THEME_KEY, theme);
                    customBg = theme === 'dark' ? '#202024' : '#e0e0e0';
                    localStorage.setItem(BG_COLOR_KEY, customBg);
                    updateStyles(theme, brightLevel, customBg, opacityLevel, isMinimized);
                    draw();
                };
            }
            if (activeTab === 'links') {
                root.querySelector('#back-to-settings').onclick = () => { activeTab = 'settings'; draw(); };
            }
            root.querySelectorAll('.btn-action').forEach(b => {
                b.onclick = (e) => copyProcess(selectedEmail || "none", e.target, b.dataset.url);
            });
            root.querySelector('#re-scan').onclick = () => { selectedEmail = null; draw(); };
        };

        async function copyProcess(email, btn, url = null) {
            try { await navigator.clipboard.writeText(email); const old = btn.innerText; btn.innerText = "OK!"; setTimeout(() => btn.innerText = old, 600); } catch (e) {}
            if (url) window.open(url, '_blank');
        }

        draw();

        let drag = false, off = {x:0, y:0};
        host.addEventListener('mousedown', (e) => {
            const p = e.composedPath();
            if (p[0].id === 'd-handle' || p[0].parentNode.id === 'd-handle') {
                drag = true; off.x = e.clientX - host.offsetLeft; off.y = e.clientY - host.offsetTop;
            }
        });
        document.addEventListener('mousemove', (e) => { if (drag) { host.style.left = (e.clientX - off.x) + 'px'; host.style.top = (e.clientY - off.y) + 'px'; } });
        document.addEventListener('mouseup', () => { if (drag) { drag = false; localStorage.setItem(POS_KEY, JSON.stringify({top: host.style.top, left: host.style.left})); } });
    }

    setInterval(init, 1000);

})();

