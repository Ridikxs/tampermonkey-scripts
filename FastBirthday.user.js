// ==UserScript==
// @name         FastBirthday
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Формирует сообщение с возможностью настройки текста под себя.
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/FastBirthday.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/FastBirthday.user.js
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Стили для кнопок
    const style = document.createElement('style');
    style.innerHTML = `
        .gemini-copy-btn, .gemini-settings-btn {
            cursor: pointer; margin-left: 5px; font-size: 14px;
            padding: 2px 5px; border-radius: 4px; color: white;
            display: inline-block; font-weight: bold; border: none;
            vertical-align: middle; transition: 0.3s;
        }
        .gemini-copy-btn { background-color: #ff9800; }
        .gemini-settings-btn { background-color: #555; }
        .gemini-copy-btn.success { background-color: #1ab394 !important; }
    `;
    document.head.appendChild(style);

    // Функции для работы с кастомным текстом
    const getCustomText = (key, defaultText) => GM_getValue(key, defaultText);
    const setCustomText = (key, defaultText) => {
        const newText = prompt(`Введите ваш вариант для: "${key}"`, getCustomText(key, defaultText));
        if (newText !== null) GM_setValue(key, newText);
    };

    async function getBonusData(bonusId) {
        const link = document.querySelector("#ReportsBonusesLink");
        if (!link) return null;

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: link.href,
                onload: async function(res) {
                    const doc = new DOMParser().parseFromString(res.responseText, "text/html");
                    const row = doc.querySelector(`tr[id="${bonusId}"]`);
                    if (!row) { resolve(null); return; }

                    const transferText = row.querySelector('[name="col-TransfersToRealBonusBalance"]')?.innerText || "";
                    const rubMatch = transferText.match(/([\d.]+\s*RUB)/);
                    let amountRub = (rubMatch && !rubMatch[0].startsWith("0.00")) ? rubMatch[1] : null;
                    const fs = row.querySelector('[name="col-FreeroundCount"]')?.innerText.trim();

                    const detailsUrl = row.querySelector('.bonus-info')?.href;
                    let expireDate = null, slot = null, wagerX = null;

                    if (detailsUrl) {
                        const details = await new Promise(r => {
                            GM_xmlhttpRequest({ method: "GET", url: detailsUrl, onload: r });
                        });
                        const dDoc = new DOMParser().parseFromString(details.responseText, "text/html");
                        expireDate = dDoc.querySelector('[name="col-Expire-dd"]')?.innerText.trim();
                        slot = dDoc.querySelector('[name="col-FreeroundsGames-dd"]')?.innerText.trim();

                        let rawWager = dDoc.querySelector('[name="col-ReleaseWagering-dd"]')?.innerText.trim();
                        if (!rawWager || rawWager === "—") {
                            rawWager = dDoc.querySelector('[name="col-FreeroundsAwardWagering-dd"]')?.innerText.trim();
                        }
                        if (rawWager && rawWager !== "—") wagerX = rawWager;
                    }

                    // Используем настройки пользователя или дефолт
                    let intro = getCustomText("Приветствие", "Примите от нас небольшой подарочек ");
                    let wagerInfo = getCustomText("Инфо про баланс", "Бонус отыгрывается с бонусного и с реального баланса.");
                    
                    let giftParts = [];
                    if (amountRub) giftParts.push(`в размере ${amountRub}`);
                    if (fs && fs !== "—") {
                        let fsText = `${fs} ФС`;
                        if (slot && slot !== "—") fsText += ` в слоте "${slot}"`;
                        giftParts.push(fsText);
                    }

                    let finalStr = intro + giftParts.join(" и ") + ". ";
                    finalStr += wagerInfo + " ";

                    let conditions = [];
                    if (expireDate && expireDate !== "—") conditions.push(`на отыгрыш ${expireDate}`);
                    if (wagerX) conditions.push(`вейджер ${wagerX}`);

                    if (conditions.length > 0) {
                        finalStr += conditions.join(" и ").charAt(0).toUpperCase() + conditions.join(" и ").slice(1) + ".";
                    }

                    resolve(finalStr.replace(/\s+/g, ' ').trim());
                }
            });
        });
    }

    function inject() {
        const idCells = document.querySelectorAll('#ActiveBonusesTable td[name="col-ID"]:not(.btn-ready)');
        idCells.forEach(cell => {
            const bId = Array.from(cell.childNodes)
                             .filter(node => node.nodeType === Node.TEXT_NODE)
                             .map(node => node.textContent.trim())
                             .join("");

            if (!bId || isNaN(bId)) return;

            // Кнопка копирования
            const btn = document.createElement('span');
            btn.className = 'gemini-copy-btn'; btn.innerText = '📋';
            btn.title = 'Скопировать сообщение';
            btn.onclick = async function() {
                const info = await getBonusData(bId);
                if (info) {
                    GM_setClipboard(info);
                    btn.innerText = '✅'; btn.classList.add('success');
                    setTimeout(() => { btn.innerText = '📋'; btn.classList.remove('success'); }, 2000);
                } else {
                    btn.innerText = '❌'; setTimeout(() => { btn.innerText = '📋'; }, 2000);
                }
            };

            // Кнопка настроек
            const setBtn = document.createElement('span');
            setBtn.className = 'gemini-settings-btn'; setBtn.innerText = '⚙️';
            setBtn.title = 'Настроить текст под себя';
            setBtn.onclick = () => {
                setCustomText("Приветствие", "Примите от нас небольшой подарочек ");
                setCustomText("Инфо про баланс", "Бонус отыгрывается с бонусного и с реального баланса.");
            };

            cell.appendChild(btn);
            cell.appendChild(setBtn);
            cell.classList.add('btn-ready');
        });
    }

    new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
    inject();

})();
