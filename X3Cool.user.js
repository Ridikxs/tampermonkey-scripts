// ==UserScript==
// @name         X3CoolRiv Тест
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Исправлена точность округления до копейки
// @author       River
// @match        https://*.fundist.org/ru/Users/Summary*
// @match        https://backoffice.*.casino/ru/Users/Summary*
// @match        https://*.boadmin.org/ru/Users/Summary*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const targetCurrencies = ["RUB", "KZT", "AZN", "BYN", "UAH", "UZS", "USD", "USDT", "BTC", "ETH", "LTC", "DOGE", "CAD", "NZD", "EUR"];

    function extractNumber(text) {
        if (!text) return 0;
        let clean = text.replace(/\s/g, '').replace(',', '.');
        let match = clean.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[0]) : 0;
    }

    function getPriorityCurrency(selector) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const text = el.innerText;

        for (let curr of targetCurrencies) {
            if (text.includes(curr)) {
                const parts = text.split('/');
                for (let part of parts) {
                    if (part.includes(curr)) {
                        return { coin: curr, value: extractNumber(part) };
                    }
                }
            }
        }
        return null;
    }

    function addCalcInterface() {
        const container = document.querySelector("#LastSuccessfulDepositContainer");

        if (container && !document.querySelector("#calc-wrapper")) {
            const wrapper = document.createElement("div");
            wrapper.id = "calc-wrapper";
            wrapper.style.padding = "15px";
            wrapper.style.marginBottom = "10px";
            wrapper.style.border = "1px solid #e7eaec";
            wrapper.style.borderRadius = "4px";
            wrapper.style.backgroundColor = "#f9f9f9";

            const btn = document.createElement("button");
            btn.innerText = "Проверить оборот x3";
            btn.className = "btn btn-primary btn-sm";
            btn.style.display = "block";
            btn.style.marginBottom = "10px";

            const resultDiv = document.createElement("div");
            resultDiv.id = "calc-result-display";
            resultDiv.style.fontWeight = "bold";
            resultDiv.style.fontSize = "14px";

            btn.onclick = function() {
                const deposit = getPriorityCurrency('[name="col-LastSuccessfulDeposit-Amount-Value"]');
                const bets = getPriorityCurrency('[name="col-LastSuccessfulDeposit-BetAmountAtTheMomentOfDeposit-Value"]');

                if (!deposit || !bets) {
                    resultDiv.innerHTML = "<span style='color: orange;'>Ошибка: Валюта не найдена</span>";
                    return;
                }

                // Исправленная математика: считаем через целые числа (копейки)
                // Math.round уберет микро-погрешности JS типа 0.0000000001
                const depCents = Math.round(deposit.value * 100);
                const betCents = Math.round(bets.value * 100);
                const targetCents = depCents * 3;
                const diffCents = targetCents - betCents;

                const target = (targetCents / 100).toFixed(2);
                const current = (betCents / 100).toFixed(2);
                const diff = (diffCents / 100).toFixed(2);

                if (betCents >= targetCents) {
                    resultDiv.innerHTML = `
                        <div style="color: #1ab394;">
                            ✅ Оборот выполнен!<br>
                            Нужно было: ${target} ${deposit.coin}<br>
                            Сделано: ${current} ${deposit.coin}
                        </div>`;
                } else {
                    resultDiv.innerHTML = `
                        <div style="color: #ed5565;">
                            ❌ Оборот НЕ выполнен<br>
                            Нужно было: ${target} ${deposit.coin}<br>
                            Сделано: ${current} ${deposit.coin}<br>
                            Осталось проставить: ${diff} ${deposit.coin}
                        </div>`;
                }
            };

            wrapper.appendChild(btn);
            wrapper.appendChild(resultDiv);
            container.prepend(wrapper);
        }
    }

    setInterval(addCalcInterface, 2000);
})();