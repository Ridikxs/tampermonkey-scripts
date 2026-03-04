// ==UserScript==
// @name         SumDep
// @namespace    http://tampermonkey.net/
// @version      2.0
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

    function injectInterface() {
        // Пробуем найти заголовок блока депозитов
        const header = document.querySelector('#LastDepositsTitle .ibox-title') ||
                       document.querySelector('.ibox-title'); // Запасной вариант

        if (!header || document.getElementById('sumDepWrapper')) return;

        const wrapper = document.createElement('span');
        wrapper.id = 'sumDepWrapper';
        wrapper.style.cssText = 'margin-left: 20px; display: inline-flex; align-items: center; gap: 10px; vertical-align: middle;';

        wrapper.innerHTML = `
            <button id="calcBtn" type="button" style="cursor:pointer; background:#28a745; color:white; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:11px;">ПОСЧИТАТЬ УСПЕШНЫЕ ДЕПОЗИТЫ</button>
            <div id="resultArea" style="display:none; font-size:12px; color: #676a6c; border-left: 1px solid #e7eaec; padding-left: 10px; display: inline-flex; flex-wrap: wrap; gap: 8px;">
            </div>
        `;

        header.appendChild(wrapper);
        document.getElementById('calcBtn').addEventListener('click', calculate);
    }

    function calculate() {
        // Пробуем найти блок успешных депозитов по ID или по вложенности
        const successBlock = document.getElementById('lastDepositsSucceeded') ||
                             document.querySelector('.ibox-content #lastDepositsSucceeded');

        if (!successBlock) {
            // В окружении Canvas алерты не работают, но для Tampermonkey оставляем стандартное уведомление
            alert('Блок "Успешные платежи" не найден. Убедитесь, что он раскрыт.');
            return;
        }

        // Ищем все ячейки таблицы
        const cells = successBlock.querySelectorAll('td');
        let totals = {};
        let count = 0;
        let hasOtherThanEur = false;

        CURRENCIES.forEach(curr => totals[curr] = 0);

        cells.forEach(cell => {
            let text = cell.innerText.trim();
            if (!text) return;

            // Ищем в тексте ячейки упоминание валюты
            let foundCurrency = CURRENCIES.find(curr => text.includes(curr));

            if (foundCurrency) {
                // Извлекаем только число (удаляем буквы, пробелы и запятые)
                let valueStr = text.replace(foundCurrency, '').replace(/,/g, '').replace(/\s/g, '');
                let amount = parseFloat(valueStr);

                if (!isNaN(amount)) {
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
        resArea.style.display = 'inline-flex';

        CURRENCIES.forEach(curr => {
            if (totals[curr] > 0) {
                // Если есть любая другая валюта, EUR скрываем
                if (curr === 'EUR' && hasOtherThanEur) return;

                const span = document.createElement('span');
                span.style.cssText = 'font-weight:bold; padding: 2px 4px; background: #f3f3f4; border-radius: 3px;';

                // Цвет для RUB сделаем чуть ярче, чтобы выделялся
                let color = (curr === 'RUB') ? '#f8ac59' : '#1ab394';

                span.innerHTML = `<span style="color:${color};">${curr}:</span> ${totals[curr].toLocaleString('ru-RU')}`;
                resArea.appendChild(span);
            }
        });

        const countSpan = document.createElement('span');
        countSpan.style.cssText = 'font-size:10px; color:#999; margin-left:5px;';
        countSpan.innerText = `[${count} шт.]`;
        resArea.appendChild(countSpan);
    }

    // Запуск проверки чаще, так как админки часто "лениво" подгружают элементы
    setInterval(injectInterface, 1000);

})();
