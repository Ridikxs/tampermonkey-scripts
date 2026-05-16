// ==UserScript==
// @name         SumDep
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Посчитать успешные депозиты
// @author       Calvin/River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SumDep.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SumDep.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CURRENCIES = [
        'AZN', 'BTC', 'BYN', 'CAD', 'DOGE', 'ETH', 'KZT',
        'LTC', 'NZD', 'RUB', 'UAH', 'USD', 'USDT', 'UZS', 'EUR'
    ];

    const PROJECTS = {
        'gama': { min: 10000 },
        'daddy': { min: 10000 },
        'kent': { min: 10000 },
        'r7': { min: 15000, memo: 'Памятка: сумма депов за прошлую неделю не должна превышать сумму выводов не менее чем на 5000 RUB' },
        'kometa': { min: 10000 },
        'arkada': { min: 5000 }
    };

    function getProjectConfig() {
        let extractedName = '';

        const projectDiv = document.querySelector('.project-name.word-break');
        if (projectDiv && projectDiv.innerText) {
            extractedName = projectDiv.innerText.toLowerCase();
        } else {
            const loginSpan = document.getElementById('CurrentLogin');
            if (loginSpan) {
                if (loginSpan.dataset.login) {
                    extractedName = loginSpan.dataset.login.toLowerCase();
                } else if (loginSpan.innerText) {
                    extractedName = loginSpan.innerText.toLowerCase();
                }
            }
        }

        for (const key in PROJECTS) {
            if (extractedName.includes(key)) {
                return { name: key.toUpperCase(), ...PROJECTS[key] };
            }
        }
        return null;
    }

    function injectInterface() {
        const header = document.querySelector('#LastDepositsTitle .ibox-title') ||
                       document.querySelector('#lastDepositsSucceeded')?.closest('.ibox')?.querySelector('.ibox-title');

        if (!header || document.getElementById('sumDepWrapper')) return;

        const wrapper = document.createElement('span');
        wrapper.id = 'sumDepWrapper';
        wrapper.style.cssText = 'margin-left: 20px; display: inline-flex; align-items: center; gap: 10px; vertical-align: middle;';

        wrapper.innerHTML = `
            <button id="calcBtn" type="button" style="cursor:pointer; background:#28a745; color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px; transition: 0.2s;">ПОСЧИТАТЬ УСПЕШНЫЕ ДЕПОЗИТЫ</button>
            <div id="resultArea" style="display:none; font-size:12px; color: #676a6c; border-left: 1px solid #e7eaec; padding-left: 10px; flex-direction: column; gap: 4px;">
            </div>
        `;

        header.appendChild(wrapper);

        const btn = document.getElementById('calcBtn');
        btn.addEventListener('click', calculate);

        btn.addEventListener('mouseenter', () => btn.style.background = '#218838');
        btn.addEventListener('mouseleave', () => btn.style.background = '#28a745');
    }

    function calculate() {
        const successBlock = document.getElementById('lastDepositsSucceeded') ||
                             document.querySelector('.ibox-content #lastDepositsSucceeded');

        if (!successBlock) {
            alert('Блок "Успешные платежи" не найден. Убедитесь, что он раскрыт.');
            return;
        }

        const cells = successBlock.querySelectorAll('td');
        let totals = {};
        let count = 0;
        let hasOtherThanEur = false;

        CURRENCIES.forEach(curr => totals[curr] = 0);

        cells.forEach(cell => {
            let text = cell.innerText.trim();
            if (!text) return;

            let foundCurrency = CURRENCIES.find(curr => text.includes(curr));

            if (foundCurrency) {
                let cleanText = text.replace(/,/g, '').replace(/\s/g, '');
                let match = cleanText.match(/\d+(\.\d+)?/);

                if (match) {
                    let amount = parseFloat(match[0]);
                    totals[foundCurrency] += amount;
                    count++;
                    if (foundCurrency !== 'EUR') hasOtherThanEur = true;
                }
            }
        });

        if (count === 0) {
            alert('Депозиты не найдены в этой таблице.');
            return;
        }

        const resArea = document.getElementById('resultArea');
        resArea.innerHTML = '';
        resArea.style.display = 'flex';

        let currenciesHTML = '';

        CURRENCIES.forEach(curr => {
            if (totals[curr] > 0) {
                if (curr === 'EUR' && hasOtherThanEur) return;

                let color = (curr === 'RUB') ? '#f8ac59' : '#1ab394';
                currenciesHTML += `<span style="font-weight:bold; padding: 2px 4px; background: #f3f3f4; border-radius: 3px;"><span style="color:${color};">${curr}:</span> ${totals[curr].toLocaleString('ru-RU')}</span>`;
            }
        });

        currenciesHTML += `<span style="font-size:10px; color:#999; margin-left:5px; align-self: center;">[${count} шт.]</span>`;

        let mainRow = document.createElement('div');
        mainRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;';
        mainRow.innerHTML = currenciesHTML;
        resArea.appendChild(mainRow);

        const projectConfig = getProjectConfig();

        if (projectConfig) {
            let rubTotal = totals['RUB'] || 0;
            let diff = rubTotal - projectConfig.min;
            let statusText = diff >= 0
                ? '<span style="color:#1ab394; font-weight:bold;">✓ Доступен</span>'
                : `<span style="color:#ed5565; font-weight:bold;">Не хватает ${Math.abs(diff).toLocaleString('ru-RU')} RUB</span>`;

            let infoRow = document.createElement('div');
            infoRow.style.cssText = 'font-size: 11px; padding-top: 4px; border-top: 1px dashed #ccc; width: 100%;';

            let memoHtml = projectConfig.memo ? `<div style="color:#8a6d3b; font-size:10px; margin-top:2px;">${projectConfig.memo}</div>` : '';

            infoRow.innerHTML = `<b>${projectConfig.name}</b> (лутбокс от ${projectConfig.min.toLocaleString('ru-RU')} RUB): ${statusText} ${memoHtml}`;
            resArea.appendChild(infoRow);
        }
    }

    setInterval(injectInterface, 1000);

})();
