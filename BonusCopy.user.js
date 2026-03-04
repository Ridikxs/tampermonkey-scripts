// ==UserScript==
// @name         BonusCopy
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Копирование информации о бонусе
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/*
// @match        https://backoffice.*.casino/ru/Users/*
// @match        https://*.boadmin.org/ru/Users/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/BonusCopy.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/BonusCopy.user.js
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 1. ГЛУБОКОЕ ОПРЕДЕЛЕНИЕ ПРОЕКТА
    function getProjectName() {
        const host = window.location.hostname.toLowerCase();

        // А) Проверка по специфическим ID/тексту в навигации (как вы просили)
        const navRight = document.querySelector("#WelcomeNav > div.nav.nav-buttons > div.nav-buttons__right");
        const loginInfo = navRight ? navRight.innerText.toUpperCase() : "";

        // Б) Проверка по коротким доменам
        if (host.includes('cc.') || host.includes('catcasino')) return "CAT";
        if (host.includes('ga.') || host.includes('gm.') || host.includes('gamacasino')) return "GAMA";
        if (host.includes('kt.') || host.includes('kometa') || loginInfo.includes('KOMETA')) return "KOMETA";
        if (host.includes('ak.') || host.includes('arkada') || loginInfo.includes('ARKADA')) return "ARKADA";
        if (host.includes('dy.') || host.includes('daddy.casino') || loginInfo.includes('DADDY')) return "DADDY";
        if (host.includes('kn.') || host.includes('kent.casino') || loginInfo.includes('KENT')) return "KENT";
        if (host.includes('mr.') || host.includes('mers.casino') || loginInfo.includes('MERS')) return "MERS";
        if (host.includes('rs.') || host.includes('r7.casino') || loginInfo.includes('R7')) return "R7";

        // В) Поиск по списку брендов в заголовке или навигации
        const brands = ['DADDY', 'CAT', 'GAMA', 'KENT', 'MERS', 'R7', 'ARKADA', 'KOMETA'];
        const fullContent = (document.title + " " + loginInfo).toUpperCase();

        for (let b of brands) {
            if (fullContent.includes(b)) return b;
        }

        return "PROJECT";
    }

    // 2. ПОИСК СТАТУСА (HighRoll > VIP > PreVIP > PriVip)
    function extractStatus() {
        const hr = document.querySelector("#Statuses-HighRoll");
        if (hr && hr.innerText.trim().toUpperCase().includes("HIGHROLL")) return "HighRoll";

        const vip = document.querySelector("#Statuses-VIP");
        if (vip && vip.innerText.trim().toUpperCase().includes("VIP")) return "VIP";

        const previp = document.querySelector("#Statuses-PreVIP");
        if (previp && previp.innerText.trim().toUpperCase().includes("PREVIP")) return "PreVIP";

        const privip = document.querySelector("#Statuses-Privip") || document.querySelector("#Statuses-PriVip");
        if (privip && privip.innerText.trim().toUpperCase().includes("PRIVIP")) return "PriVip";

        return "";
    }

    // 3. ПРИНЦИП: УВИДЕЛ — ЗАПОМНИЛ
    function saveUserData() {
        const path = window.location.pathname;
        const match = path.match(/\/(\d+)$/);
        if (!match) return;

        const cid = match[1];
        const proj = getProjectName();

        // На любой странице, если определили проект — сохраняем его
        if (proj !== "PROJECT") {
            const existingData = JSON.parse(localStorage.getItem(`gemini_user_${cid}`) || '{}');
            localStorage.setItem(`gemini_user_${cid}`, JSON.stringify({
                ...existingData,
                project: proj,
                updated: Date.now()
            }));
        }

        // Если именно на Summary — сохраняем статус
        if (path.includes('/Summary/')) {
            const status = extractStatus();
            const existingData = JSON.parse(localStorage.getItem(`gemini_user_${cid}`) || '{}');
            localStorage.setItem(`gemini_user_${cid}`, JSON.stringify({
                ...existingData,
                status: status,
                project: proj,
                updated: Date.now()
            }));
        }
    }

    // 4. ГЕНЕРАЦИЯ КНОПОК
    function injectButtons() {
        const match = window.location.pathname.match(/\/(\d+)$/);
        if (!match) return;
        const cid = match[1];

        document.querySelectorAll('a').forEach(link => {
            const text = link.innerText.trim();
            const isBonus = /^\d+$/.test(text) && (link.href.includes('bonus_id=') || link.href.includes('Bonuses/Info'));

            if (isBonus && !link.nextElementSibling?.classList.contains('gemini-copy-btn')) {
                const btn = document.createElement('span');
                btn.innerHTML = '📋';
                btn.className = 'gemini-copy-btn';
                Object.assign(btn.style, {
                    cursor: 'pointer', marginLeft: '8px', fontSize: '14px',
                    backgroundColor: '#ff9800', padding: '2px 5px', borderRadius: '4px',
                    color: 'white', display: 'inline-block', fontWeight: 'bold'
                });

                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const stored = JSON.parse(localStorage.getItem(`gemini_user_${cid}`) || '{}');
                    const finalStatus = stored.status || "";
                    // Сначала берем из памяти, если нет — пробуем определить на месте
                    const finalProj = (stored.project && stored.project !== "PROJECT") ? stored.project : getProjectName();

                    const result = `${cid}\n${finalStatus}\n${finalProj}\n${text}`;
                    GM_setClipboard(result);

                    btn.innerHTML = '✅';
                    setTimeout(() => btn.innerHTML = '📋', 800);
                };
                link.after(btn);
            }
        });
    }

    setInterval(() => {
        saveUserData();
        injectButtons();
    }, 1000);

})();




