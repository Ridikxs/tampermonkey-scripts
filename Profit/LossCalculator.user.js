// ==UserScript==
// @name         ProfitLossCalculator
// @namespace    http://tampermonkey.net/
// @version      1.2
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
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/ProfitLossCalculator.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/ProfitLossCalculator.user.js
// ==/UserScript==

(function() {
    'use strict';

    function parseAmounts(text) {
        if (!text) return [];
        text = text.split('(')[0].trim();
        const parts = text.split('/');
        return parts.map(part => {
            const match = part.match(/([\d\s\u00A0]+(?:\.\d+)?)\s*([A-Za-z]+)?/);
            if (match) {
                const val = parseFloat(match[1].replace(/[\s\u00A0]/g, ''));
                const curr = match[2] || '';
                return { val, curr: curr.trim() };
            }
            return { val: 0, curr: '' };
        });
    }

    function calculateAndDisplay() {
        const targetAnchor = document.getElementById('my-final-wrapper') || document.getElementById('SummaryOnlineStatus');

        if (!targetAnchor || document.getElementById('bo-client-profit-badge')) return;

        const depositsEl = document.querySelector('dd[name="col-PaymentSystemDepositsDd"]');
        const withdrawalsEl = document.querySelector('dd[name="col-PaymentSystemWithdrawalsDd"]');

        if (!depositsEl || !withdrawalsEl) return;

        const deposits = parseAmounts(depositsEl.textContent);
        const withdrawals = parseAmounts(withdrawalsEl.textContent);

        if (deposits.length === 0 && withdrawals.length === 0) return;

        const results = [];
        const maxLen = Math.max(deposits.length, withdrawals.length);

        let isPlus = false;
        let isMinus = false;

        for (let i = 0; i < maxLen; i++) {
            const dep = deposits[i] || { val: 0, curr: '' };
            const wit = withdrawals[i] || { val: 0, curr: '' };
            const curr = dep.curr || wit.curr || '';

            const clientProfit = wit.val - dep.val;

            if (clientProfit > 0) isPlus = true;
            if (clientProfit < 0) isMinus = true;

            const formattedProfit = Math.abs(clientProfit)
                .toFixed(2)
                .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

            results.push(`${formattedProfit} ${curr}`);
        }

        let statusText = "Клиент при своих:";
        let badgeColor = "#333333";
        let borderColor = "#cccccc";
        let bgColor = "#f9f9f9";

        if (isPlus && !isMinus) {
            statusText = "В плюсе на:";
            badgeColor = "#721c24";
            borderColor = "#f5c6cb";
            bgColor = "#f8d7da";
        } else if (!isPlus && isMinus) {
            statusText = "В минусе на:";
            badgeColor = "#155724";
            borderColor = "#c3e6cb";
            bgColor = "#d4edda";
        } else if (isPlus && isMinus) {
            statusText = "Разница:";
            badgeColor = "#856404";
            borderColor = "#ffeeba";
            bgColor = "#fff3cd";
        }

        const finalText = `${statusText} ${results.join(' / ')}`;

        const badgeHTML = `
            <span id="bo-client-profit-badge" style="
                display: inline-block;
                margin-left: 12px;
                background-color: ${bgColor};
                color: ${badgeColor};
                border: 1px solid ${borderColor};
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                vertical-align: middle;
            ">
                ${finalText}
            </span>
        `;

        targetAnchor.insertAdjacentHTML('afterend', badgeHTML);
    }

    setInterval(calculateAndDisplay, 1000);
})();
