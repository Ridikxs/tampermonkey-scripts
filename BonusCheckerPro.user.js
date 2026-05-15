// ==UserScript==
// @name         BonusCheckerPro
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Проверка бонусов для продажи
// @author       Calvin
// @match        *://*.fundist.org/*
// @match        *://backoffice.r7.casino/*
// @match        *://backoffice.catcasino.com/*
// @match        *://backoffice.gama.casino/*
// @match        *://backoffice.daddy.casino/*
// @match        *://backoffice.mers.casino/*
// @match        *://backoffice.kent.casino/*
// @match        *://backoffice.kometa.casino/*
// @match        *://backoffice.arkada.casino/*
// @match        *://*.boadmin.org/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/BonusCheckerPro.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/BonusCheckerPro.user.js
// ==/UserScript==

(function () {
    'use strict';

    // 1. Полная база данных бонусов с тегами
    const bonusData = {
        'Catcasino': [
            { id: '261062', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 500)', dep: '500', cash: '5 000', fs: '150', tag: 'Sales_SUPP_Other_1' },
            { id: '261176', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 1 000)', dep: '1000', cash: '10 000', fs: '200', tag: 'Sales_SUPP_Other_2' },
            { id: '261179', shortName: 'СуперБокс', fullName: 'СуперБокс (деп 2 000)', dep: '2000', cash: '20 000', fs: '250', tag: 'Sales_SUPP_Other_3' },
            { id: '261188', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 2 000)', dep: '2000', cash: '10 000', fs: '250', tag: 'Sales_SUPP_Previp_1' },
            { id: '261194', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 3 000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_Previp_2' },
            { id: '261203', shortName: 'PreVIP SuperBox', fullName: 'PreVIP SuperBox (деп 5 000)', dep: '5000', cash: '30 000', fs: '400', tag: 'Sales_SUPP_Previp_3' },
            { id: '261200', shortName: 'VIP Box', fullName: 'VIP Box (деп 3 000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_VIP_1' },
            { id: '261206', shortName: 'VIP Box', fullName: 'VIP Box (деп 5 000)', dep: '5000', cash: '25 000', fs: '400', tag: 'Sales_SUPP_VIP_2' },
            { id: '261212', shortName: 'VIP SuperBox', fullName: 'VIP SuperBox (деп 7 000)', dep: '7000', cash: '50 000', fs: '500', tag: 'Sales_SUPP_VIP_3' }
        ],
        'Gama': [
            { id: '260246', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 500)', dep: '500', cash: '5 000', fs: '150', tag: 'Sales_SUPP_Other_1' },
            { id: '260654', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 1000)', dep: '1000', cash: '10 000', fs: '200', tag: 'Sales_SUPP_Other_2' },
            { id: '260678', shortName: 'СуперБокс', fullName: 'СуперБокс (деп 2000)', dep: '2000', cash: '20 000', fs: '250', tag: 'Sales_SUPP_Other_3' },
            { id: '260705', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 2000)', dep: '2000', cash: '10 000', fs: '250', tag: 'Sales_SUPP_Previp_1' },
            { id: '260729', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 3000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_Previp_2' },
            { id: '260780', shortName: 'PreVIP SuperBox', fullName: 'PreVIP SuperBox (деп 5000)', dep: '5000', cash: '30 000', fs: '400', tag: 'Sales_SUPP_Previp_3' },
            { id: '261092', shortName: 'VIP Box', fullName: 'VIP Box (деп 3000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_VIP_1' },
            { id: '261116', shortName: 'VIP Box', fullName: 'VIP Box (деп 5000)', dep: '5000', cash: '25 000', fs: '400', tag: 'Sales_SUPP_VIP_2' },
            { id: '261137', shortName: 'VIP SuperBox', fullName: 'VIP SuperBox (деп 7000)', dep: '7000', cash: '50 000', fs: '500', tag: 'Sales_SUPP_VIP_3' }
        ],
        'Daddy': [
            { id: '278188', shortName: 'Народный Лутбокс', fullName: 'Народный Лутбокс (деп 700)', dep: '700', cash: 'Бонусная игра', fs: '250', tag: 'Sales_Support_Other' },
            { id: '278221', shortName: 'Мега Лутбокс', fullName: 'Мега Лутбокс (деп 1 500)', dep: '1500', cash: 'Бонусная игра', fs: '400', tag: 'Sales_Support_Previp' },
            { id: '278239', shortName: 'Супер Лутбокс', fullName: 'Супер Лутбокс (деп 4 000)', dep: '4000', cash: 'Бонусная игра', fs: '500', tag: 'Sales_Support_VIP' }
        ],
        'Kent': [
            { id: '276400', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 500)', dep: '500', cash: '100 000', fs: '1000', tag: 'Sales_Support_Other' },
            { id: '276763', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 1 000)', dep: '1000', cash: '200 000', fs: '1000', tag: 'Sales_Support_Previp' },
            { id: '278164', shortName: 'Лутбокс на удачу', fullName: 'Лутбокс на удачу (деп 2 000)', dep: '2000', cash: '300 000', fs: '500', tag: 'Sales_Support_VIP' }
        ],
        'R7': [
            { id: '278272', shortName: 'Народный Лутбокс', fullName: 'Народный Лутбокс (деп 700)', dep: '700', cash: 'Бонусная игра', fs: '250', tag: 'Sales_Support_Other' },
            { id: '278311', shortName: 'Мега Лутбокс', fullName: 'Мега Лутбокс (деп 1 500)', dep: '1500', cash: 'Бонусная игра', fs: '400', tag: 'Sales_Support_Previp' },
            { id: '278347', shortName: 'Супер Лутбокс', fullName: 'Супер Лутбокс (деп 4 000)', dep: '4000', cash: 'Бонусная игра', fs: '500', tag: 'Sales_Support_VIP' }
        ],
        'Kometa': [
            { id: '61476', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 500)', dep: '500', cash: '5 000', fs: '150', tag: 'Sales_SUPP_Other_1' },
            { id: '61683', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 1 000)', dep: '1000', cash: '10 000', fs: '200', tag: 'Sales_SUPP_Other_2' },
            { id: '61686', shortName: 'СуперБокс', fullName: 'СуперБокс (деп 2 000)', dep: '2000', cash: '20 000', fs: '250', tag: 'Sales_SUPP_Other_3' },
            { id: '61689', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 2 000)', dep: '2000', cash: '10 000', fs: '250', tag: 'Sales_SUPP_Previp_1' },
            { id: '61692', shortName: 'PreVIP Box', fullName: 'PreVIP Box (деп 3 000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_Previp_2' },
            { id: '61698', shortName: 'PreVIP SuperBox', fullName: 'PreVIP SuperBox (деп 5 000)', dep: '5000', cash: '30 000', fs: '400', tag: 'Sales_SUPP_Previp_3' },
            { id: '61695', shortName: 'VIP Box', fullName: 'VIP Box (деп 3 000)', dep: '3000', cash: '15 000', fs: '300', tag: 'Sales_SUPP_VIP_1' },
            { id: '61701', shortName: 'VIP Box', fullName: 'VIP Box (деп 5 000)', dep: '5000', cash: '25 000', fs: '400', tag: 'Sales_SUPP_VIP_2' },
            { id: '61704', shortName: 'VIP SuperBox', fullName: 'VIP SuperBox (деп 7 000)', dep: '7000', cash: '50 000', fs: '500', tag: 'Sales_SUPP_VIP_3' }
        ],
        'Arkada': [
            { id: '60951', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 500)', dep: '500', cash: '100 000', fs: '1000', tag: 'Sales_Support_Other' },
            { id: '60987', shortName: 'Лутбокс', fullName: 'Лутбокс (деп 1 000)', dep: '1000', cash: '200 000', fs: '1000', tag: 'Sales_Support_Previp' },
            { id: '61152', shortName: 'Лутбокс на удачу', fullName: 'Лутбокс на удачу (деп 2 000)', dep: '2000', cash: '300 000', fs: '500', tag: 'Sales_Support_VIP' }
        ]
    };

    let currentUserId = null;

    function getTemplates(projectName) {
        const key = 'bc_templates_' + projectName;
        let data = GM_getValue(key);
        if (data) return JSON.parse(data);

        let defaultTpls = [
            { id: 'tpl_std', name: '💬 Стандарт', text: 'Отлично, с вашим основным вопросом мы успешно разобрались! А чтобы сделать вашу следующую сессию по-настоящему захватывающей и добавить максимум драйва, у меня есть для вас особенное предложение с огромным потенциалом.\n\nПредлагаю обратить внимание на наш эксклюзивный {имя}! При пополнении всего от {деп} RUB у вас появляется шикарный шанс забрать {награда1} и целых {фс} фриспинов в хитовых слотах от топового провайдера Pragmatic Play. Самый главный плюс этого предложения — отыгрыш доступен как с реального, так и с бонусного баланса, что делает процесс максимально комфортным и свободным. Согласитесь, перспективы просто отличные! Активируем этот Лутбокс для вас прямо сейчас?' },
            { id: 'tpl_nodep', name: '🎁 Бездеп', text: 'Отличный выбор, бездепы — это всегда круто, однако в чате их нет. Давайте расскажу, как их можно получить! Во-первых, загляните в наш магазин на сайте — там можно легко обменивать накопленные коины на бонусы. Во-вторых, обязательно присоединяйтесь к нашему Telegram-каналу, где мы регулярно раздаем промокоды на бездепы. Ну и, конечно, вижу, что вам доступны рассылки — просто следите за почтой и WhatsApp, уверен, промо-отдел скоро вас порадует.\n\nА пока мы ожидаем подходящее предложение, от себя лично очень рекомендую шикарную альтернативу прямо сейчас — наш {имя}! При пополнении всего на {деп} RUB у вас есть шанс забрать {награда2} и целых {фс} фриспинов в хитовых играх от топового провайдера Pragmatic Play. Главный плюс этого предложения в том, что отыгрыш идет как с реального, так и с бонусного баланса, что делает игру максимально комфортной. Согласитесь, отличный вариант! Активируем этот лутбокс для вас?' },
            { id: 'tpl_obj', name: '❓ Возражение', text: 'Понимаю вас, тоже люблю бездепозитные бонусы, однако в чате их действительно нет. А если откровенно, почему рассматриваете исключительно такой формат? Чем именно вас смутило предложение с Лутбоксом?' }
        ];
        GM_setValue(key, JSON.stringify(defaultTpls));
        return defaultTpls;
    }

    function saveTemplates(projectName, templates) {
        GM_setValue('bc_templates_' + projectName, JSON.stringify(templates));
    }

    function detectProject() {
        const el = document.querySelector("#CurrentLogin");
        if (!el) return null;
        return el.textContent.trim().split(/\s|→/)[0] || null;
    }

    function createUI(targetContainer) {
        if (!targetContainer) return;
        const div = document.createElement("div");
        div.id = "bonus-checker-window";
        div.style.cssText = "margin-top: 15px; padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #eef2f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-family: Inter, Arial, sans-serif;";

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                <h3 style="margin:0; color:#0f172a; font-size:16px;">🎁 Статус Лутбоксов</h3>
                <button id="bc-settings-toggle" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Настройки шаблонов">⚙️</button>
            </div>

            <div id="bc-settings-panel" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-bottom:10px;">
                <h4 style="margin:0 0 8px 0; font-size:13px;">Менеджер шаблонов</h4>
                <p style="font-size:11px; color:#64748b; margin-top:0; line-height:1.4;">
                    <b>{имя}</b>, <b>{деп}</b>, <b>{макс}</b>, <b>{фс}</b><br>
                    <b>{награда1}</b> <i>(«невероятный бонус до X RUB»)</i><br>
                    <b>{награда2}</b> <i>(«мощный бонус до X RUB»)</i>
                </p>
                <input type="hidden" id="bc-tpl-id" value="">
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <input type="text" id="bc-tpl-name" placeholder="Название (напр. Шаблон 1)" style="flex:1; padding:4px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px;">
                </div>
                <textarea id="bc-tpl-text" placeholder="Текст шаблона..." style="width:100%; height:80px; padding:4px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; resize:vertical; margin-bottom:5px;"></textarea>

                <div style="display:flex; gap:5px;">
                    <button id="bc-tpl-add" style="flex:1; padding:5px; background:#0ea5e9; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">➕ Добавить / Сохранить</button>
                    <button id="bc-tpl-cancel" style="display:none; padding:5px 10px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">✖ Отмена</button>
                </div>

                <div id="bc-custom-tpl-list" style="margin-top:10px; font-size:12px; max-height: 150px; overflow-y: auto; padding-right: 5px;"></div>
            </div>

            <div id="bonus-checker-result" style="font-size: 13px; color: #64748b;">
                Сбор данных и расчет времени... ⏳
            </div>
        `;
        targetContainer.appendChild(div);

        document.getElementById('bc-settings-toggle').addEventListener('click', () => {
            const panel = document.getElementById('bc-settings-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            renderSettingsList();
        });

        document.getElementById('bc-tpl-add').addEventListener('click', () => {
            const projectName = detectProject() || 'Неизвестно';
            const editId = document.getElementById('bc-tpl-id').value;
            const name = document.getElementById('bc-tpl-name').value.trim();
            const text = document.getElementById('bc-tpl-text').value.trim();
            if(!name || !text) return alert("Заполни название и текст!");

            let tpls = getTemplates(projectName);
            if (editId) {
                const idx = tpls.findIndex(t => t.id === editId);
                if(idx !== -1) { tpls[idx].name = name; tpls[idx].text = text; }
            } else {
                tpls.push({ id: 'tpl_' + Date.now().toString(), name, text });
            }

            saveTemplates(projectName, tpls);
            resetForm();
            renderSettingsList();
            refreshBonusList();
        });

        document.getElementById('bc-tpl-cancel').addEventListener('click', resetForm);

        document.getElementById('bc-settings-panel').addEventListener('click', (e) => {
            const projectName = detectProject() || 'Неизвестно';
            if(e.target.classList.contains('bc-del-tpl')) {
                if(!confirm("Удалить этот шаблон?")) return;
                const id = e.target.getAttribute('data-id');
                saveTemplates(projectName, getTemplates(projectName).filter(t => t.id !== id));
                renderSettingsList();
                refreshBonusList();
            }
            if(e.target.classList.contains('bc-edit-tpl')) {
                const id = e.target.getAttribute('data-id');
                const tpl = getTemplates(projectName).find(t => t.id === id);
                if(tpl) {
                    document.getElementById('bc-tpl-id').value = tpl.id;
                    document.getElementById('bc-tpl-name').value = tpl.name;
                    document.getElementById('bc-tpl-text').value = tpl.text;
                    document.getElementById('bc-tpl-add').innerText = '💾 Сохранить';
                    document.getElementById('bc-tpl-add').style.background = '#10b981';
                    document.getElementById('bc-tpl-cancel').style.display = 'block';
                }
            }
        });
    }

    function resetForm() {
        document.getElementById('bc-tpl-id').value = '';
        document.getElementById('bc-tpl-name').value = '';
        document.getElementById('bc-tpl-text').value = '';
        document.getElementById('bc-tpl-add').innerText = '➕ Добавить';
        document.getElementById('bc-tpl-add').style.background = '#0ea5e9';
        document.getElementById('bc-tpl-cancel').style.display = 'none';
    }

    function renderSettingsList() {
        const projectName = detectProject() || 'Неизвестно';
        const listEl = document.getElementById('bc-custom-tpl-list');
        if(!listEl) return;
        const tpls = getTemplates(projectName);
        if(tpls.length === 0) {
            listEl.innerHTML = '<span style="color:#94a3b8;">Нет шаблонов.</span>';
            return;
        }
        let html = '';
        tpls.forEach(t => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:6px; margin-bottom:4px; border:1px solid #e2e8f0; border-radius:4px;">
                <b style="color:#334155;">${t.name}</b>
                <div>
                    <button class="bc-edit-tpl" data-id="${t.id}" style="color:#0ea5e9; background:none; border:none; cursor:pointer; font-size:14px;" title="Редактировать">✏️</button>
                    <button class="bc-del-tpl" data-id="${t.id}" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:14px; margin-left:5px;" title="Удалить">✖</button>
                </div>
            </div>`;
        });
        listEl.innerHTML = html;
    }

    function refreshBonusList() {
        const projName = detectProject();
        if(currentUserId && projName) checkBonusesInBackground(currentUserId, projName);
    }

    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('copy-template-btn')) {
            const tplId = e.target.getAttribute('data-tpl-id');
            const bonusId = e.target.getAttribute('data-id');
            const proj = e.target.getAttribute('data-proj');

            const b = bonusData[proj].find(x => x.id === bonusId);
            if (!b) return;

            const tpl = getTemplates(proj).find(t => t.id === tplId);
            if(!tpl) return;

            const isBg = b.cash.toLowerCase().includes('бонусная игра');
            const prize1 = isBg ? 'невероятную бонусную игру' : `невероятный бонус до ${b.cash} RUB`;
            const prize2 = isBg ? 'мощную бонусную игру' : `мощный бонус до ${b.cash} RUB`;

            let finalString = tpl.text
                .replace(/{имя}/gi, b.shortName)
                .replace(/{деп}/gi, b.dep)
                .replace(/{макс}/gi, b.cash)
                .replace(/{фс}/gi, b.fs)
                .replace(/{награда1}/gi, prize1)
                .replace(/{награда2}/gi, prize2);

            navigator.clipboard.writeText(finalString).then(() => {
                const origText = e.target.innerText;
                const origBg = e.target.style.background;
                const origCol = e.target.style.color;

                e.target.innerText = '✅ Скопировано!';
                e.target.style.background = '#10b981';
                e.target.style.color = '#fff';

                setTimeout(() => {
                    e.target.innerText = origText;
                    e.target.style.background = origBg;
                    e.target.style.color = origCol;
                }, 2000);
            });
        }

        if (e.target && e.target.classList.contains('copy-tag-btn')) {
            const tagValue = e.target.getAttribute('data-tag');
            navigator.clipboard.writeText(tagValue).then(() => {
                const origText = e.target.innerText;
                const origColor = e.target.style.color;

                e.target.innerText = '✅ Скопировано!';
                e.target.style.color = '#10b981';
                e.target.style.textDecoration = 'none';

                setTimeout(() => {
                    e.target.innerText = origText;
                    e.target.style.color = origColor;
                    e.target.style.textDecoration = 'underline';
                }, 2000);
            });
        }
    });

    async function checkBonusesInBackground(userId, projectName) {
        const resultEl = document.getElementById("bonus-checker-result");
        if (!resultEl) return;

        const projectBonuses = bonusData[projectName];
        if (!projectBonuses || projectBonuses.length === 0) {
            resultEl.innerHTML = `<span style="color:red;">База бонусов для проекта ${projectName} не найдена.</span>`;
            return;
        }

        // Парсинг активных тегов профиля
        const tagElements = document.querySelectorAll('#tags-wrapper .name');
        const userTags = Array.from(tagElements).map(el => el.textContent.trim());

        const nowUtcMs = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const dateOptions = { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };

        try {
            const checkPromises = projectBonuses.map(async (b) => {
                const url = `/ru/Users/Bonuses/${userId}?IDOrName=${b.id}`;
                try {
                    const response = await fetch(url, { credentials: 'same-origin' });
                    if (!response.ok) return { bonus: b, lastActivationMs: -1 };

                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");

                    let lastActivationMs = 0;
                    const rows = doc.querySelectorAll('tr[lbid], tr[id]');

                    rows.forEach(row => {
                        const idCell = row.querySelector('td[name="col-IDBonus"]');
                        const activatedCell = row.querySelector('td[name="col-Activated"]');

                        if (idCell && activatedCell && idCell.textContent.includes(b.id)) {
                            const dateText = activatedCell.textContent.trim();
                            const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);

                            if (dateMatch) {
                                const day = parseInt(dateMatch[1], 10);
                                const month = parseInt(dateMatch[2], 10) - 1;
                                const year = parseInt(dateMatch[3], 10);
                                const hours = parseInt(dateMatch[4], 10);
                                const minutes = parseInt(dateMatch[5], 10);
                                const seconds = parseInt(dateMatch[6], 10);

                                const activationMs = Date.UTC(year, month, day, hours, minutes, seconds);
                                if (activationMs > lastActivationMs) {
                                    lastActivationMs = activationMs;
                                }
                            }
                        }
                    });

                    return { bonus: b, lastActivationMs: lastActivationMs };
                } catch (err) {
                    return { bonus: b, lastActivationMs: -1 };
                }
            });

            const results = await Promise.all(checkPromises);
            let htmlResult = `<ul style="margin: 0; padding-left: 0; list-style: none;">`;

            const allTpls = getTemplates(projectName);
            const btnStyle = "cursor:pointer; padding:3px 8px; margin-right:4px; margin-top:4px; font-size:11px; border-radius:4px; border:1px solid #cbd5e1; background:#f8fafc; color:#334155; font-weight:bold; transition: 0.2s;";

            results.forEach(res => {
                const b = res.bonus;
                const actMs = res.lastActivationMs;
                const hasTag = userTags.includes(b.tag);

                let isAvailable = true;
                let infoHtml = '';

                if (actMs === -1) {
                    isAvailable = false;
                    infoHtml = 'Ошибка проверки';
                } else if (actMs > 0) {
                    const diffMs = nowUtcMs - actMs;
                    const dateObj = new Date(actMs);
                    const formattedDate = dateObj.toLocaleString('ru-RU', dateOptions) + ' UTC';

                    if (diffMs < sevenDaysMs) {
                        isAvailable = false;
                        const nextAvailableMs = actMs + sevenDaysMs;
                        const nextDateObj = new Date(nextAvailableMs);
                        const formattedNext = nextDateObj.toLocaleString('ru-RU', dateOptions) + ' UTC';
                        infoHtml = `Выдан: <span style="font-weight:normal;">${formattedDate}</span><br>Доступен с: <span style="color:#b91c1c;">${formattedNext}</span>`;
                    } else {
                        infoHtml = `Прошлая выдача: <span style="font-weight:normal;">${formattedDate}</span>`;
                    }
                } else {
                    infoHtml = `Никогда не выдавался`;
                }

                const tagHtml = `<span class="copy-tag-btn" data-tag="${b.tag}" style="cursor:pointer; color:#0ea5e9; text-decoration:underline; font-weight:bold;" title="Нажми, чтобы скопировать тег">${b.tag}</span>`;

                if (isAvailable) {
                    let btnsHtml = '';
                    allTpls.forEach(t => {
                        const bgStyle = t.id.startsWith('tpl_') ? 'background:#e0f2fe; border-color:#bae6fd; color:#0369a1;' : '';
                        btnsHtml += `<button class="copy-template-btn" style="${btnStyle} ${bgStyle}" data-tpl-id="${t.id}" data-id="${b.id}" data-proj="${projectName}">${t.name}</button>`;
                    });

                    if (hasTag) {
                        // СИНИЙ БЛОК: Доступен и тег висит на профиле
                        htmlResult += `
                        <li style="margin-bottom: 8px; padding: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;">
                            <b style="color: #1d4ed8; display:block;">🔹 ${b.fullName}</b>
                            <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-top:4px;">
                                <span style="font-size:11px; color:#475569;">ID: ${b.id} | Тег: ${tagHtml}</span>
                                <span style="font-size:11px; color:#0284c7; font-weight:bold; text-align:right; line-height:1.4;">
                                    Присвоен тег! Бонус не был использован.<br>
                                    <span style="font-weight:normal;">${infoHtml}</span>
                                </span>
                            </div>
                            <div style="margin-top: 8px; border-top: 1px dashed #bfdbfe; padding-top: 6px; display:flex; flex-wrap:wrap;">
                                ${btnsHtml}
                            </div>
                        </li>`;
                    } else {
                        // ЗЕЛЕНЫЙ БЛОК: Доступен, тега на профиле нет
                        htmlResult += `
                        <li style="margin-bottom: 8px; padding: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                            <b style="color: #15803d; display:block;">✅ ${b.fullName}</b>
                            <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-top:4px;">
                                <span style="font-size:11px; color:#475569;">ID: ${b.id} | Тег: ${tagHtml}</span>
                                <span style="font-size:11px; color:#10b981; font-weight:bold; text-align:right; line-height:1.4;">${infoHtml}</span>
                            </div>
                            <div style="margin-top: 8px; border-top: 1px dashed #bbf7d0; padding-top: 6px; display:flex; flex-wrap:wrap;">
                                ${btnsHtml}
                            </div>
                        </li>`;
                    }
                } else {
                    // КРАСНЫЙ БЛОК: Недоступен (недавно использован)
                    htmlResult += `
                    <li style="margin-bottom: 8px; padding: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
                        <b style="color: #b91c1c; display:block;">❌ ${b.fullName}</b>
                        <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-top:4px;">
                            <span style="font-size:11px; color:#475569;">ID: ${b.id} | Тег: ${tagHtml}</span>
                            <span style="font-size:11px; color:#ef4444; font-weight:bold; text-align:right; line-height:1.4;">${infoHtml}</span>
                        </div>
                    </li>`;
                }
            });

            htmlResult += `</ul>`;
            resultEl.innerHTML = htmlResult;

        } catch (error) {
            resultEl.innerHTML = `<span style="color:red;">Сбой при проверке. Обновите страницу.</span>`;
            console.error("[Bonus Checker] Ошибка:", error);
        }
    }

    function watchForPage() {
        setInterval(() => {
            if (!window.location.href.includes('/Users/Summary')) return;

            const targetEl = document.querySelector("#SummaryUserId");
            if (!targetEl) return;

            const newUserId = targetEl.textContent.trim();
            const uiExists = document.getElementById("bonus-checker-window");
            const targetContainer = document.querySelector("#UserSummaryWrapper > div.summary-blocks > div.summary-block-left") || document.querySelector(".summary-block-left");

            if (targetContainer && (!uiExists || currentUserId !== newUserId)) {
                if (uiExists) uiExists.remove();

                currentUserId = newUserId;
                const projectName = detectProject() || 'Неизвестно';

                createUI(targetContainer);
                checkBonusesInBackground(currentUserId, projectName);
            }
        }, 1000);
    }

    watchForPage();
})();
