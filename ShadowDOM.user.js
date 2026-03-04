// ==UserScript==
// @name         ShadowDOMriv
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Панель с поддержкой темной темы #202024
// @author       River
// @match        https://my.livechatinc.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isEditMode = false;
    const STORAGE_KEY = 'river-links-v9';
    const POS_KEY = 'river-pos-v9';
    const THEME_KEY = 'river-theme-v9'; // Ключ для сохранения темы

    const DEFAULT_CONFIG = [
        { text: 'Жира', url: 'https://tasks.deltasystem.tech/servicedesk/customer/portals' },
        { text: 'Конфлю', url: 'https://wiki.deltasystem.tech/display/SUPDEP/Sup+CIS' },
        { text: 'График', url: 'https://infinitystarreach-my.sharepoint.com/:x:/g/personal/ayman_jordan_velvix_org/ESdpXl1M6pFDgOsE_l38gwcBw32fvIhN3RjjTuOsVvJjmg?e=vNV2fe&web=1' },
        { text: 'ТБ ВИП', url: 'https://infinitystarreach-my.sharepoint.com/:x:/g/personal/vitaliy_oliver_velvix_org/EeOFznpC9TtDvcSad9SZV9sBFDvOv34DvEPhr6OdvwY5NA?web=1' }
    ];

    function loadLinks() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    }

    function loadPos() {
        const pos = localStorage.getItem(POS_KEY);
        return pos ? JSON.parse(pos) : { top: '80px', left: '300px' };
    }

    function getTheme() {
        return localStorage.getItem(THEME_KEY) || 'light';
    }

    function init() {
        if (document.getElementById('river-host')) return;

        const host = document.createElement('div');
        host.id = 'river-host';
        const pos = loadPos();

        Object.assign(host.style, {
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: '2147483647',
            pointerEvents: 'auto'
        });

        const shadow = host.attachShadow({mode: 'open'});
        const root = document.createElement('div');
        root.id = 'river-root';
        root.className = getTheme(); // Устанавливаем класс темы при загрузке

        const style = document.createElement('style');
        style.textContent = `
            #river-root {
                display: flex; flex-direction: column; gap: 8px; padding: 6px 10px;
                border-radius: 8px; transition: background 0.3s;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                min-width: 120px; cursor: move; border: 1px solid rgba(0,0,0,0.1);
            }
            /* Светлая тема */
            #river-root.light { background: white; border-top: 3px solid #007aff; }
            #river-root.light .btn-link { background: #007aff; color: white; }

            /* Темная тема (#202024) */
            #river-root.dark { background: #202024; border: 1px solid #333; }
            #river-root.dark .btn-link { background: #0084ff; color: white; border: none; }
            #river-root.dark .btn-edit { background: #3a3a3e; color: #ccc; }
            #river-root.dark input { background: #2a2a2e; color: white; border: 1px solid #444; }

            .row { display: flex; gap: 6px; align-items: center; }
            button {
                padding: 5px 10px; border-radius: 6px; cursor: pointer;
                font-weight: 700; font-size: 13px; border: none;
                white-space: nowrap; transition: 0.2s;
            }
            .btn-link:hover { opacity: 0.8; }
            .btn-edit { background: #f0f2f5; color: #666; cursor: default; }
            .btn-del {
                position: absolute; top: -6px; right: -6px; background: #ff4d4f;
                color: white; border-radius: 50%; width: 16px; height: 16px;
                display: flex; align-items: center; justify-content: center;
                font-size: 11px; border: 2px solid #202024; cursor: pointer; z-index: 10;
            }
            .form { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; }
            input { font-size: 11px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; }
            .add-confirm { background: #28a745; color: white; padding: 6px; font-weight: bold; }
            .theme-toggle { background: #6e6e73; color: white; margin-bottom: 5px; font-size: 10px; }
        `;

        shadow.appendChild(style);
        shadow.appendChild(root);
        (document.body || document.documentElement).appendChild(host);

        render(root);
        makeDraggable(host);
    }

    function render(root) {
        root.innerHTML = '';
        const links = loadLinks();
        const currentTheme = getTheme();
        root.className = currentTheme;

        const row = document.createElement('div');
        row.className = 'row';

        links.forEach((item, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';

            const btn = document.createElement('button');
            btn.innerText = item.text;
            btn.className = isEditMode ? 'btn-edit' : 'btn-link';

            if (!isEditMode) {
                btn.onclick = (e) => { e.stopPropagation(); window.open(item.url, '_blank'); };
                btn.onmousedown = (e) => e.stopPropagation();
            } else {
                const del = document.createElement('div');
                del.className = 'btn-del';
                del.innerHTML = '×';
                del.onmousedown = (e) => e.stopPropagation();
                del.onclick = (e) => {
                    e.stopPropagation();
                    const newData = links.filter((_, i) => i !== index);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
                    render(root);
                };
                wrapper.appendChild(del);
            }

            wrapper.appendChild(btn);
            row.appendChild(wrapper);
        });

        // Кнопка настроек
        const gear = document.createElement('button');
        gear.style.cssText = 'background:none; border:none; font-size:16px; padding:0 5px; cursor:pointer; filter: grayscale(1);';
        gear.innerText = isEditMode ? '✅' : '⚙️';
        gear.onmousedown = (e) => e.stopPropagation();
        gear.onclick = (e) => { e.stopPropagation(); isEditMode = !isEditMode; render(root); };

        row.appendChild(gear);
        root.appendChild(row);

        if (isEditMode) {
            const form = document.createElement('div');
            form.className = 'form';
            form.onmousedown = (e) => e.stopPropagation();

            // Кнопка смены темы
            const tbtn = document.createElement('button');
            tbtn.className = 'theme-toggle';
            tbtn.innerText = `Тема: ${currentTheme === 'light' ? 'Светлая' : 'Темная'}`;
            tbtn.onclick = () => {
                const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                localStorage.setItem(THEME_KEY, nextTheme);
                render(root);
            };

            const iName = document.createElement('input'); iName.placeholder = 'Название';
            const iUrl = document.createElement('input'); iUrl.placeholder = 'https://...';
            const iAdd = document.createElement('button'); iAdd.className = 'add-confirm'; iAdd.innerText = 'Добавить плитку';

            iAdd.onclick = () => {
                if (iName.value && iUrl.value) {
                    const newData = [...links, { text: iName.value, url: iUrl.value.trim() }];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
                    render(root);
                }
            };
            form.append(tbtn, iName, iUrl, iAdd);
            root.appendChild(form);
        }
    }

    function makeDraggable(el) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        el.onmousedown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
                localStorage.setItem(POS_KEY, JSON.stringify({ top: el.style.top, left: el.style.left }));
            };
            document.onmousemove = (e) => {
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                el.style.top = (el.offsetTop - pos2) + "px";
                el.style.left = (el.offsetLeft - pos1) + "px";
            };
        };
    }

    setInterval(init, 1000);
})();