// ==UserScript==
// @name         Quick link
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Закрепление ссылок в карте клиента(Локально).
// @author       Calvin/River
// @match        *://*.fundist.org/*
// @match        *://*.casino/*
// @match        *://*.boadmin.org/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/QuickLink.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/QuickLink.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';

    let isRendering = false;

    function getUserId() {
        const idElement = document.getElementById('SummaryUserId');
        if (idElement && idElement.textContent.trim()) return idElement.textContent.trim();

        const idLink = Array.from(document.querySelectorAll('a')).find(a => /Summary\/\d+|IDUser=\d+/.test(a.href));
        if (idLink) {
            const match = idLink.href.match(/Summary\/(\d+)|IDUser=(\d+)/);
            return match ? (match[1] || match[2]) : null;
        }
        return null;
    }

    function renderAll() {
        if (isRendering) return;
        isRendering = true;

        const container = document.querySelector('.fun-page-header__buttons') ||
                          document.querySelector('.summary-links');

        if (!container) {
            isRendering = false;
            return;
        }

        // 1. Проверяем/ставим шестеренку
        if (!document.getElementById("custom-settings-gear")) {
            const gear = document.createElement("span");
            gear.id = "custom-settings-gear";
            gear.innerHTML = "⚙️";
            gear.style.cssText = "cursor:pointer;opacity:0.4;font-size:16px;margin-right:12px;vertical-align:middle;display:inline-block;transition:0.2s;";
            gear.onclick = (e) => { e.preventDefault(); openSettings(); };
            gear.onmouseover = () => gear.style.opacity = "1";
            gear.onmouseout = () => gear.style.opacity = "0.4";
            container.prepend(gear);
        }

        // 2. Ставим кнопки
        const userId = getUserId();
        const baseUrl = window.location.origin;
        const savedLinks = JSON.parse(GM_getValue("custom_links", "[]"));
        const anchor = container.querySelector('a:not(.custom-dynamic-btn)');

        // Чистим старые кнопки перед вставкой, чтобы не дублировались
        container.querySelectorAll('.custom-dynamic-btn').forEach(b => b.remove());

        savedLinks.forEach(link => {
            if (link.path.includes("{ID}") && !userId) return;
            const a = document.createElement('a');
            a.className = 'custom-dynamic-btn';
            let finalPath = link.path.replace("{ID}", userId || "");
            a.href = finalPath.startsWith('http') ? finalPath : baseUrl + finalPath;
            a.innerText = link.name;
            a.target = "_blank";
            a.style.cssText = "display:inline-block;margin-right:12px;color:#28a745!important;text-decoration:underline;font-size:12px;font-weight:bold;cursor:pointer;";

            if (anchor) container.insertBefore(a, anchor);
            else container.appendChild(a);
        });

        isRendering = false;
    }

    function openSettings() {
        if (document.getElementById('custom-modal-bg')) return;
        const bg = document.createElement('div');
        bg.id = 'custom-modal-bg';
        bg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
        bg.innerHTML = `
            <div style="background:#1e1e1e;padding:20px;border-radius:10px;width:350px;color:#eee;box-shadow: 0 0 20px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0;color:#28a745;font-size:16px;">Настройки кнопок</h3>
                <input id="new-name" placeholder="Название (например: Логи)" style="width:calc(100% - 16px);margin-bottom:10px;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                <input id="new-path" placeholder="Путь (/ru/...) или URL" style="width:calc(100% - 16px);margin-bottom:10px;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                <button id="add-btn" style="width:100%;padding:10px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Добавить</button>
                <div id="links-list" style="margin-top:15px;max-height:150px;overflow-y:auto;border-top:1px solid #333;padding-top:10px;"></div>
                <button id="close-modal" style="width:100%;margin-top:15px;padding:8px;background:#444;border:none;color:#fff;border-radius:4px;cursor:pointer;">Готово</button>
            </div>
        `;
        document.body.appendChild(bg);

        const drawList = () => {
            const links = JSON.parse(GM_getValue("custom_links", "[]"));
            const list = bg.querySelector('#links-list');
            list.innerHTML = links.map((l, i) => `
                <div style="padding:6px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
                    <span>${l.name}</span>
                    <span class="del" data-i="${i}" style="color:#ff4d4d;cursor:pointer;font-weight:bold;padding:0 5px;">×</span>
                </div>`).join('');
            list.querySelectorAll('.del').forEach(d => d.onclick = () => {
                links.splice(d.dataset.i, 1);
                GM_setValue("custom_links", JSON.stringify(links));
                drawList(); renderAll();
            });
        };
        drawList();

        bg.querySelector('#add-btn').onclick = () => {
            const n = bg.querySelector('#new-name').value, p = bg.querySelector('#new-path').value;
            if(n && p) {
                const links = JSON.parse(GM_getValue("custom_links", "[]"));
                links.push({name:n, path:p});
                GM_setValue("custom_links", JSON.stringify(links));
                bg.querySelector('#new-name').value = '';
                bg.querySelector('#new-path').value = '';
                drawList(); renderAll();
            }
        };
        bg.querySelector('#close-modal').onclick = () => bg.remove();
    }

    // Следим за изменениями в DOM
    const observer = new MutationObserver(() => {
        const container = document.querySelector('.fun-page-header__buttons') || document.querySelector('.summary-links');
        if (container) {
            // Если наши кнопки исчезли из контейнера - перерисовываем
            if (!container.querySelector('.custom-dynamic-btn') || !document.getElementById("custom-settings-gear")) {
                renderAll();
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Первичный запуск
    renderAll();
})();