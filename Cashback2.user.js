// ==UserScript==
// @name         Cashback2
// @namespace    http://tampermonkey.net/
// @version      2.9
// @description  Подсчитывает Cashback c доп информацией. 
// @author       Calvin/River
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
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Cashback2.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Cashback2.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let normalCashback = null;
    let liveCashback = null;
    let selectedFromDate = '';
    let selectedToDate = '';
    let projectName = 'Проект';
    let userId = null;
    let currentUserId = null;

    function log(...args) {
        console.log('[CB]', ...args);
    }

    function detectProject() {
        const el = document.querySelector("#CurrentLogin");
        if (!el) return null;
        const txt = el.textContent.trim().split(/\s|→/)[0];
        return txt || null;
    }

    function formatDate(date) {
        const d = new Date(date);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }

    function getLastWeekDates(projName) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const format = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (projName === 'Arkada') {
            const daysToLastSaturday = today.getDay() + 1;
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - daysToLastSaturday);

            const lastSunday = new Date(lastSaturday);
            lastSunday.setDate(lastSaturday.getDate() - 6);

            return { from: format(lastSunday), to: format(lastSaturday) };
        } else {
            const dayOfWeek = today.getDay() || 7;
            const lastSunday = new Date(today);
            lastSunday.setDate(today.getDate() - dayOfWeek);

            const lastMonday = new Date(lastSunday);
            lastMonday.setDate(lastSunday.getDate() - 6);

            return { from: format(lastMonday), to: format(lastSunday) };
        }
    }

    function parseEurValue(text) {
        if (!text) return 0;
        const match = text.match(/([\d\s\u00A0]+(?:[\.,]\d+)?)\s*EUR/);
        if (match && match[1]) {
            const cleanString = match[1].replace(/[\s\u00A0]/g, '').replace(',', '.');
            return parseFloat(cleanString) || 0;
        }
        return 0;
    }

    function getFinancialData() {
        const parse = (selector) => {
            const el = document.querySelector(selector);
            return el ? parseEurValue(el.textContent) : 0;
        };

        const psDeposits = parse('dd[name="col-PaymentSystemDepositsDd"]');
        const manualDeposits = parse('dd[name="col-DepositDd"]');

        const psWithdrawals = parse('dd[name="col-PaymentSystemWithdrawalsDd"]');
        const manualWithdrawals = parse('dd[name="col-WithdrawDd"]');

        return {
            depositsEur: psDeposits + manualDeposits,
            withdrawalsEur: psWithdrawals + manualWithdrawals
        };
    }

    function getLoyaltyLevel() {
        const levelEl = document.querySelector('#LoyaltyBlockDataList tbody tr th[name="col-Level"], #LoyaltyBlockDataList tbody tr td[name="col-Level"]');
        if (levelEl) {
            return parseInt(levelEl.textContent.trim(), 10) || 1;
        }
        return 1;
    }

    function createUI(targetContainer, projName) {
        if (!targetContainer) return;
        const div = document.createElement("div");
        div.id = "cashback-window";
        div.style.marginTop = "30px";
        div.innerHTML = `
            <h3 id="cashback-title">Cashback</h3>
            <div style="margin-bottom: 12px; font-size: 14px; color: #334155;">
                <label style="margin-right: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <input type="radio" name="cbDateMode" value="range" checked> <span>За период</span>
                </label>
                <label style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <input type="radio" name="cbDateMode" value="single"> <span>За один день</span>
                </label>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <input type="date" id="fromDate" style="padding: 3px; border: 1px solid #cbd5e1; border-radius: 4px;">
                <span id="dateSeparator" style="color: #64748b;">➔</span>
                <input type="date" id="toDate" style="padding: 3px; border: 1px solid #cbd5e1; border-radius: 4px;">
                <button id="calculateBtn" style="padding: 4px 12px; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc;">Рассчитать КБ</button>
            </div>
            <p id="cashback-result">Ожидание расчёта...</p>
        `;
        targetContainer.appendChild(div);

        const { from, to } = getLastWeekDates(projName);
        const fromDateEl = document.getElementById('fromDate');
        const toDateEl = document.getElementById('toDate');
        const separatorEl = document.getElementById('dateSeparator');

        fromDateEl.value = from;
        toDateEl.value = to;

        const radios = document.querySelectorAll('input[name="cbDateMode"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'single') {
                    toDateEl.style.display = 'none';
                    separatorEl.style.display = 'none';
                } else {
                    toDateEl.style.display = 'inline-block';
                    separatorEl.style.display = 'inline-block';
                }
            });
        });

        document.getElementById('calculateBtn').addEventListener('click', startCalculation);
    }

    function updateCashbackDisplay() {
        const resultElement = document.getElementById("cashback-result");
        const titleElement = document.getElementById("cashback-title");
        if (titleElement) titleElement.innerText = `Cashback → ${projectName}`;
        if (!resultElement) return;

        if (normalCashback === null || liveCashback === null) {
            resultElement.innerHTML = "Ожидание расчёта...";
            return;
        }

        const realWithoutLive = normalCashback - liveCashback;
        const playerLevel = getLoyaltyLevel();

        const minLossMap = {
            Catcasino: 5000,
            Arkada: 1500,
            Gama: 7000,
            Daddy: 7000,
            Mers: 3000,
            Kent: 3000,
            R7: 4000,
            Kometa: playerLevel >= 2 ? 5000 : 500
        };
        const minLoss = minLossMap[projectName] || 0;

        const { depositsEur, withdrawalsEur } = getFinancialData();
        const globalDiff = depositsEur - withdrawalsEur;
        const isGlobalPlus = withdrawalsEur > depositsEur;

        let statusText = '';
        let statusColor = '';

        if (realWithoutLive === 0) {
            statusText = '❌ Кэшбэк недоступен (Нет ставок)';
            statusColor = 'red';
        } else if (isGlobalPlus) {
            statusText = '❌ Кэшбэк недоступен: Игрок в глобальном плюсе (Выводы > Депозиты)';
            statusColor = 'red';
        } else if (realWithoutLive < 0) {
            statusText = '❌ Кэшбэк недоступен: Клиент в плюсе по ставкам (отрицательное значение)';
            statusColor = 'red';
        } else if (realWithoutLive > 0 && realWithoutLive < minLoss) {
            statusText = `❌ Кэшбэк недоступен: Недостаточный проигрыш (Мин: ${minLoss})`;
            statusColor = 'red';
        } else {
            statusText = '✅ Кэшбэк доступен: Клиент в минусе по ставкам и глобально';
            statusColor = 'green';
        }

        const periodText = (selectedFromDate === selectedToDate)
            ? `<b>${selectedFromDate}</b>`
            : `<b>${selectedFromDate} – ${selectedToDate}</b>`;

        resultElement.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 10px;">
                📅 Расчёт за период: ${periodText}
            </div>
            <b style="color:blue; font-size: 14px;">Ставок с реального баланса: ${normalCashback.toFixed(2)}</b>
            <br><br>
            <b style="color:green; font-size: 14px;">Ставок в лайв: ${liveCashback.toFixed(2)}</b>
            <br><br>
            <b style="color:purple; font-size: 14px;">Ставки с реала без учёта лайв: ${realWithoutLive.toFixed(2)}</b>
            <br><br>
            <div style="padding: 10px; background: #f0f4f8; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 12px; font-size: 13px;">
                <b style="display: block; margin-bottom: 5px;">Глобальная статистика (EUR)</b>
                Депозиты+Ручные: <span style="color: navy;">${depositsEur.toFixed(2)}</span><br>
                Выводы+Ручные: <span style="color: red;">${withdrawalsEur.toFixed(2)}</span><br>
                Разница: <b>${globalDiff.toFixed(2)}</b><br><br>
                <span style="color: #475569; font-weight: bold;">Уровень лояльности: ${playerLevel}</span>
            </div>
            <span style="font-size: 16px; font-weight: bold; color: ${statusColor};">${statusText}</span>
        `;
    }

    async function fetchCashback(isLive = false) {
        if (!selectedFromDate || !selectedToDate || !userId) return;

        const from = encodeURIComponent(selectedFromDate + " 00:00");
        const to = encodeURIComponent(selectedToDate + " 23:59");
        let url = `/ru/Reports/BetsHistory?Month=custom&From=${from}&To=${to}&IDMerchant=0&IDObject=${userId}&sort=PlaceTime&IDSession=&sort=PlaceTime`;

        const categoryMap = {
            R7: [7,19,37,865,10,4508,5407,1364,5410,3604,1366,84,41,1368],
            Arkada: [7,19,37,865,10,4508,1364,6093,6105,3604,1366,84,41,1368],
            Gama: [3982,7,19,37,865,10,4508,1364,3922,3604,1366,84,41,1368],
            Daddy: [7,19,37,865,10,4508,1364,4377,4385,3604,1366,84,41,1368],
            Mers: [7,19,4653,37,865,10,4508,4649,1364,3604,1366,84,41,1368],
            Kent: [7,19,37,865,10,4508,1364,4850,4858,3604,1366,84,41,1368],
            Kometa: [7,19,37,865,10,4508,1364,5748,5744,3604,1366,84,41,1368],
            Catcasino: [7,19,37,865,10,4508,1364,3724,3604,1366,84,41,1368]
        };

        if (isLive) {
            const categories = categoryMap[projectName] || categoryMap.Kent;
            categories.forEach(cat => url += `&GameCategories[]=${cat}`);
        }

        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            if (isLive) liveCashback = 0;
            else normalCashback = 0;
            updateCashbackDisplay();
            return;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const td7 = doc.querySelector("#DataList > tfoot > tr > td:nth-child(7) > p > small");
        const td8 = doc.querySelector("#DataList > tfoot > tr > td:nth-child(8) > p > small");

        if (td7 && td8) {
            const v7 = parseFloat(td7.innerText.split('/')[0].replace(/[^\d.-]/g, '')) || 0;
            let v8 = parseFloat(td8.innerText.split('/')[0].replace(/[^\d.-]/g, '').replace('-', '')) || 0;
            const result = v7 - v8;

            if (isLive) liveCashback = result;
            else normalCashback = result;
        } else {
            if (isLive) liveCashback = 0;
            else normalCashback = 0;
        }

        updateCashbackDisplay();
    }

    function startCalculation() {
        const modeElement = document.querySelector('input[name="cbDateMode"]:checked');
        const mode = modeElement ? modeElement.value : 'range';

        const fromInput = document.getElementById('fromDate').value;
        let toInput = document.getElementById('toDate').value;

        if (mode === 'single') {
            toInput = fromInput;
        }

        if (!fromInput || !toInput) return alert("Выбери даты!");

        selectedFromDate = formatDate(fromInput);
        selectedToDate = formatDate(toInput);

        normalCashback = null;
        liveCashback = null;

        fetchCashback(false);
        fetchCashback(true);
    }

    function addCashbackBlock(html, id = '') {
        const container = document.getElementById("cashback-window");
        if (!container || document.getElementById(id)) return;
        const block = document.createElement("div");
        block.id = id;
        block.innerHTML = html;
        container.appendChild(block);
    }

    function setupNgrToggle() {
        const titleEl = document.getElementById('GgrPerGameTitle');
        if (!titleEl || titleEl.dataset.toggleready) return;

        titleEl.dataset.toggleready = "true";

        const contentEl = titleEl.nextElementSibling;
        if (contentEl && contentEl.classList.contains('ibox-content')) {
            contentEl.style.display = 'none';

            const toggleBtn = document.createElement('button');
            toggleBtn.innerText = 'Показать GGR';
            toggleBtn.style.cssText = "margin-bottom: 12px; padding: 6px 16px; background: #0b79ff; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; transition: 0.2s;";

            toggleBtn.onclick = (e) => {
                e.preventDefault();
                if (contentEl.style.display === 'none') {
                    contentEl.style.display = 'block';
                    toggleBtn.innerText = 'Скрыть GGR';
                    toggleBtn.style.background = '#64748b';
                } else {
                    contentEl.style.display = 'none';
                    toggleBtn.innerText = 'Показать GGR';
                    toggleBtn.style.background = '#0b79ff';
                }
            };

            titleEl.parentNode.insertBefore(toggleBtn, titleEl);
        }
    }

    function showConditionsForProject(name) {
        const shortInfoMap = {
            Catcasino: 'Мин. проигрыш: 5000 RUB',
            Arkada: 'Мин. проигрыш: 1500 RUB | Доступен с: 2 LVL',
            Gama: 'Мин. проигрыш: 70 EUR / 7000 RUB | Доступен с: 1 LVL',
            Daddy: 'Мин. проигрыш: 70 EUR / 7000 RUB | Доступен с: 2 LVL',
            Mers: 'Мин. проигрыш: 30 EUR / 3000 RUB | Доступен с: 2 LVL',
            Kent: 'Мин. проигрыш: 30 EUR / 3000 RUB | Доступен с: 2 LVL',
            R7: 'Мин. проигрыш: 40 EUR / 4000 RUB | Доступен с: 2 LVL',
            Kometa: 'Мин. проигрыш: 5 EUR / 500 RUB | Доступен с: 1 LVL | 2+ LVL Мин. проигрыш 50 EUR / 5 000 RUB '
        };

        const infoMap = {
            Catcasino: `
                <section class="cat-cb" style="font-family:Inter,Arial,sans-serif;max-width:820px;margin:18px auto;padding:18px;border-radius:10px; box-shadow:0 6px 22px rgba(0,0,0,0.08);background:#fff;border:1px solid #eef2f6;">
                  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">Cashback Levels для Catcasino</h2>
                    <div style="font-size:13px;color:#475569;">Актуально для уровней и VIP-тега</div>
                  </header>
                  <div style="display:grid;gap:10px;">
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <b>Cashback Level 5:</b> Размер – <b>5%</b>, Мин. проигрыш для начисления – <b>5000 RUB</b>, Вейджер – <b>x15</b>, Максвин – <b>x3</b><br>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <b>Cashback Level 7:</b> Размер – <b>6%</b>, Мин. проигрыш для начисления – <b>10 000 RUB</b>, Вейджер – <b>x10</b>, Максвин – <b>x3</b><br>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <b>Cashback Level 10:</b> Размер – <b>8%</b>, Мин. проигрыш для начисления – <b>25 000 RUB</b>, Вейджер – <b>x7</b>, Максвин – <b>x5</b><br>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <b>Cashback Level VIP:</b> Размер – <b>10%</b>, доступен по тегу <b>VIP Cashback</b>.<br>
                      Вейджер – <b>x3</b> (отыгрыш распространяется на реальный и бонусный баланс), макс. ставка – <b>1000.00 RUB</b>, макс. размер кешбека – <b>1 000 000.00 RUB</b>, Максвин – <b>x5</b>.<br>
                    </div>
                  </div>
                  <footer style="margin-top:12px;font-size:13px;color:#475569;">
                    🔗 <a href="https://wiki.deltasystem.tech/pages/viewpage.action?pageId=24281530" target="_blank" style="color:#0b79ff;text-decoration:none;"><b>Подробнее → Cat</b></a>
                  </footer>
                </section>
            `,
            Arkada: `
                <section class="arkada-cb" style="font-family:Inter,Arial,sans-serif;max-width:820px;margin:20px auto;padding:18px;border-radius:10px; box-shadow:0 6px 22px rgba(0,0,0,0.08);background:#fff;border:1px solid #eef2f6;">
                  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">ℹ️ Условия кешбэка Arkada</h2>
                    <div style="font-size:13px;color:#475569;">Расчётный период: <b>воскресенье – суббота</b></div>
                  </header>
                  <div style="font-size:13.5px;color:#0b1220;line-height:1.45;">
                    <p style="margin:0 0 10px 0;"><i>Пример: если игрок обратился в вс 23.02, считать нужно с 16.02 по 22.02</i></p>
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <b>Со 2 по 15 LVL:</b><br><br>
                      <b>1 500 - 14 999 RUB</b> — <b>3%</b><br><br>
                      <b>15 000 - 39 999 RUB</b> — <b>5%</b><br><br>
                      <b>40 000 - 149 999 RUB</b> — <b>7%</b><br><br>
                      <b>150 000 - 499 999 RUB</b> — <b>8%</b><br><br>
                      <b>500 000 - 999 999 RUB</b> — <b>10%</b><br><br>
                      <b>1 000 000 - 1 999 999 RUB</b> — <b>12%</b><br><br>
                      <b>2 000 000 - 3 499 999 RUB</b> — <b>13%</b><br><br>
                      <b>3 500 000 - 4 999 999 RUB</b> — <b>14%</b><br><br>
                      <b>5 000 000 - 7 499 999 RUB</b> — <b>15%</b><br><br>
                      <b>7 500 000 - 9 999 999 RUB</b> — <b>16%</b><br><br>
                      <b>10 000 000 - 24 999 999 RUB</b> — <b>17%</b><br><br>
                      <b>25 000 000 - 49 999 999 RUB</b> — <b>18%</b><br><br>
                      <b>50 000 000+ RUB</b> — <b>20%</b><br>
                    </div>
                    <p style="margin:12px 0 0 0;font-size:13px;color:#475569;">
                      📎 <a href="https://wiki.deltasystem.tech/display/SUPDEP/CashBack+Arkada" target="_blank" style="color:#0b79ff;text-decoration:none;"><b>Подробнее → Confluence</b></a>
                    </p>
                  </div>
                </section>
            `,
            Gama: `
                <section class="cb-card" style="font-family:Inter,Arial,sans-serif;max-width:820px;margin:20px auto;padding:18px;border-radius:10px; box-shadow:0 6px 22px rgba(0,0,0,0.08);background:#fff;border:1px solid #eef2f6;">
                  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">Условия кешбэка Gama:</h2>
                    <div style="font-size:13px;color:#475569;">Мин. проигрыш (прошлая неделя): <b>70 EUR / 7 000 RUB</b></div>
                  </header>
                  <div style="display:grid;grid-template-columns:1fr;gap:10px;">
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback Player</h3>
                      <div style="font-size:14px;color:#0b1220;">
                        Размер – <b>5%</b><br>
                        Вейджер – <b>x20</b>, Максвин – <b>x3</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback Regular</h3>
                      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0b1220;">
                        <thead>
                          <tr>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #eef2f6;width:60%;">Диапазон проигрыша</th>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #eef2f6;width:20%;">Размер</th>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #eef2f6;width:20%;">Параметры</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">7 000–9 999.99 RUB / 70–99.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>5%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x15</b>, Максвин <b>x3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">10 000–49 999.99 RUB / 100–499.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>7%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x15</b>, Максвин <b>x3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;">от 50 000 RUB / 500 EUR</td>
                            <td style="padding:8px;"><b>10%</b></td>
                            <td style="padding:8px;">Вейджер <b>x15</b>, Максвин <b>x3</b></td>
                          </tr>
                        </tbody>
                      </table>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback Pro</h3>
                      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0b1220;">
                        <tbody>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">7 000–9 999.99 RUB / 70–99.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>6%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x5</b>, Максвин <b>x5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">10 000–49 999.99 RUB / 100–499.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>8%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x5</b>, Максвин <b>x5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;">от 50 000 RUB / 500 EUR</td>
                            <td style="padding:8px;"><b>10%</b></td>
                            <td style="padding:8px;">Вейджер <b>x5</b>, Максвин <b>x5</b></td>
                          </tr>
                        </tbody>
                      </table>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback Master</h3>
                      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0b1220;">
                        <tbody>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">7 000–9 999.99 RUB / 70–99.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>8%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x3</b>, Максвин <b>x5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">10 000–49 999.99 RUB / 100–499.99 EUR</td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;"><b>9%</b></td>
                            <td style="padding:8px;border-bottom:1px dashed #f1f5f9;">Вейджер <b>x3</b>, Максвин <b>x5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:8px;">от 50 000 RUB / 500 EUR</td>
                            <td style="padding:8px;"><b>10%</b></td>
                            <td style="padding:8px;">Вейджер <b>x3</b>, Максвин <b>x5</b></td>
                          </tr>
                        </tbody>
                      </table>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback Streamer</h3>
                      <div style="font-size:14px;color:#0b1220;">
                        Размер – <b>10%</b><br>
                        Вейджер – <b>x5</b>, Максвин – <b>x3</b><br>
                        Отыгрыш – <b>реальный и бонусный баланс</b>, без ограничения по max ставке
                      </div>
                    </article>
                  </div>
                  <footer style="margin-top:12px;font-size:13px;color:#475569;">
                    <strong>Максимальная ставка для отыгрыша бонуса:</strong> Regular и Pro – <b>5 EUR / 500 RUB</b>; Master – <b>без ограничения</b>.<br>
                    🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/Cashback+-+Gama" target="_blank">Подробнее → Gama</a>
                  </footer>
                </section>
            `,
            Daddy: `
                <section class="daddy-cb" style="font-family:Inter,Arial,sans-serif;max-width:920px;margin:20px auto;padding:20px;border-radius:10px; box-shadow:0 8px 30px rgba(2,6,23,0.06);background:#ffffff;border:1px solid #eef2f6;">
                  <header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">Условия кешбэка Daddy</h2>
                    <div style="font-size:13px;color:#475569;">Мин. проигрыш: <b>70 EUR / 7 000 RUB</b></div>
                  </header>
                  <div style="display:grid;grid-template-columns:1fr;gap:12px;">
                    <div style="padding:12px;border-radius:10px;background:#f8fafc;border:1px solid #eef2f6;">
                      <strong style="display:block;margin-bottom:8px;">Примечание</strong>
                      <div style="font-size:13px;color:#0b1220;line-height:1.45;">
                        1 LVL — кешбека не получает.
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:10px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Уровни и параметры</h3>
                      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0b1220;">
                        <thead>
                          <tr>
                            <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:22%;">Уровень</th>
                            <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:36%;">Проигрыш (EUR / RUB)</th>
                            <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:18%;">Cashback</th>
                            <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:24%;">Max Win</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">2 lvl (Bronze)</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">70–100 EUR / 7 000–9 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>5.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101–300 EUR / 10 000–29 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">301–700 EUR / 30 000–69 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">701–1 800 EUR / 70 000–179 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>8.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR / 180 000+ RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">3 lvl (Silver)</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">70–100 EUR / 7 000–9 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>5.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101–300 EUR / 10 000–29 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">301–700 EUR / 30 000–69 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">701–1 800 EUR / 70 000–179 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>8.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR / 180 000+ RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х5</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">4 lvl (Gold)</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">70–100 EUR / 7 000–9 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>5.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101–300 EUR / 10 000–29 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">301–700 EUR / 30 000–69 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х7</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">701–1 800 EUR / 70 000–179 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>8.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х7</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR / 180 000+ RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х7</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">5 lvl (Diamond)</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">70–100 EUR / 7 000–9 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>5.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101–300 EUR / 10 000–29 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х3</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">301–700 EUR / 30 000–69 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х7</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">701–1 800 EUR / 70 000–179 999 RUB</td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>8.00%</b></td>
                            <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>х7</b></td>
                          </tr>
                          <tr>
                            <td style="padding:10px;border-bottom:0;"></td>
                            <td style="padding:10px;border-bottom:0;">1801+ EUR / 180 000+ RUB</td>
                            <td style="padding:10px;border-bottom:0;"><b>10.00%</b></td>
                            <td style="padding:10px;border-bottom:0;"><b>х7</b></td>
                          </tr>
                        </tbody>
                      </table>
                      <div style="margin-top:12px;font-size:13px;color:#475569;">
                        <strong>Вейджеры по уровням:</strong> Bronze - <b>x15</b> / Silver - <b>x10</b> / Gold - <b>x5</b> / Diamond - <b>x3</b><br>
                        🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/Cashback+-+Daddy" target="_blank">Подробнее → Daddy</a>
                      </div>
                    </div>
                  </div>
                </section>
            `,
            Mers: `
                <b>Условия кешбэка Mers:</b><br>
                💰 Мин. проигрыш: 30 EUR / 3000 RUB<br><br>
                <b>2 lvl</b>: вейджер x15<br>
                <b>3 lvl</b>: вейджер x10<br>
                <b>4 lvl</b>: вейджер x5<br>
                <b>5 lvl</b>: вейджер x3<br><br>
                <b>Cashback Pro</b>: 5%,<br>
                <b>Cashback Leader</b>: 7%,<br>
                <b>Cashback Champion</b>: 10%,<br>
                <b>Cashback Elite</b>: 10%,<br><br>
                🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/Cashback+-+Mers" target="_blank">Подробнее → Mers</a>
            `,
            Kent: `
                <section class="cb-full" style="font-family:Inter,Arial,sans-serif;max-width:920px;margin:18px auto;padding:18px;border-radius:10px; background:#fff;border:1px solid #eef2f6;box-shadow:0 8px 28px rgba(2,6,23,0.06);color:#0b1220;">
                  <header style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h2 style="margin:0;font-size:18px;">Условия начисления Kent</h2>
                    <div style="font-size:13px;color:#475569;">Процент зависит от чистого проигрыша за прошлую календарную неделю</div>
                  </header>
                  <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;margin-bottom:12px;">
                    <b>Правило расчёта процентов для уровней 2–5</b><br><br>
                    <b>30 EUR / 3 000 RUB — 100 EUR / 9 999 RUB</b> — <b>5%</b><br>
                    <b>101 EUR / 10 000 RUB — 250 EUR / 24 999 RUB</b> — <b>6%</b><br>
                    <b>251 EUR / 25 000 RUB — 800 EUR / 79 999 RUB</b> — <b>7%</b><br>
                    <b>801 EUR / 80 000 RUB — 1 800 EUR / 179 999 RUB</b> — <b>8%</b><br>
                    <b>1 801 EUR / 180 000 RUB и более</b> — <b>10%</b><br>
                    <div style="margin-top:8px;color:#475569;">ВНИМАНИЕ! Деление процентов по чистому проигрышу актуально только для уровней 2–5 (Bronze, Silver, Gold, Platinum).</div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr;gap:10px;">
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Bronze</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> От <b>5%</b> до <b>10%</b> в зависимости от чистого проигрыша<br>
                        <b>Вейджер:</b> <b>x15</b><br>
                        <b>Максвин бонусов:</b> 5% — <b>x3</b>; 6% — <b>x3</b>; 7% — <b>x5</b>; 8% — <b>x5</b>; 10% — <b>x5</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Silver</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> От <b>5%</b> до <b>10%</b> в зависимости от чистого проигрыша<br>
                        <b>Вейджер:</b> <b>x10</b><br>
                        <b>Максвин бонусов:</b> 5% — <b>x3</b>; 6% — <b>x3</b>; 7% — <b>x5</b>; 8% — <b>x5</b>; 10% — <b>x5</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Gold</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> От <b>5%</b> до <b>10%</b> в зависимости от чистого проигрыша<br>
                        <b>Вейджер:</b> <b>x5</b><br>
                        <b>Максвин бонусов:</b> 5% — <b>x3</b>; 6% — <b>x5</b>; 7% — <b>x5</b>; 8% — <b>x5</b>; 10% — <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Platinum</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> От <b>5%</b> до <b>10%</b> в зависимости от чистого проигрыша<br>
                        <b>Вейджер:</b> <b>x3</b><br>
                        <b>Максвин бонусов:</b> 5% — <b>x3</b>; 6% — <b>x5</b>; 7% — <b>x5</b>; 8% — <b>x5</b>; 10% — <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Emerald</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> <b>11%</b><br>
                        <b>Вейджер:</b> <b>x3</b><br>
                        <b>Максвин бонусов:</b> <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Ruby</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> <b>12%</b><br>
                        <b>Вейджер:</b> <b>x3</b><br>
                        <b>Максвин бонусов:</b> <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Sapphire</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> <b>13%</b><br>
                        <b>Вейджер:</b> <b>x2</b><br>
                        <b>Максвин бонусов:</b> <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Diamond</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> <b>14%</b><br>
                        <b>Вейджер:</b> <b>x1</b><br>
                        <b>Максвин бонусов:</b> <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                    <article style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;">Cashback Vibranium</h3>
                      <div style="font-size:13px;line-height:1.45;">
                        <b>Процент начисления:</b> <b>15%</b><br>
                        <b>Вейджер:</b> <b>x1</b><br>
                        <b>Максвин бонусов:</b> <b>x7</b><br>
                        <b>Ограничений по макс выигрышу или размеру кэшбека нет</b>
                      </div>
                    </article>
                  </div>
                  <footer style="margin-top:12px;font-size:13px;color:#475569;">
                    <b>Примечание</b>: Деление процентов по чистому проигрышу применяется только для уровней 2–5. Для уровней 6–10 процент фиксирован и указан отдельно.<br>
                    🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/CashBack+-+Kent+Casino" target="_blank">Подробнее → Kent</a>
                  </footer>
                </section>
            `,
            R7: `
                <section class="cb-15lvls" style="font-family:Inter,Arial,sans-serif;max-width:960px;margin:18px auto;padding:18px;border-radius:10px; background:#fff;border:1px solid #eef2f6;box-shadow:0 8px 28px rgba(2,6,23,0.06);color:#0b1220;">
                  <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">Условия кешбэка — R7</h2>
                    <div style="font-size:13px;color:#ef4444;max-width:480px;">
                      <b>ВНИМАНИЕ!</b> Ранее КБ начислялся от любой суммы проигрыша, теперь — от <b>4000 RUB / 40 EUR</b>. Изменения уже вступили в силу.
                    </div>
                  </header>
                  <div style="display:grid;gap:12px;">
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Общее</h3>
                      <div style="font-size:13px;line-height:1.45;color:#475569;">
                        Минимальная сумма проигрыша для начисления кешбека: <b>от 4000 RUB / 40 EUR</b>.
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 1</h3>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Кэшбека нет</b>
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 2–4</h3>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 2</b><br>Процент начисления: <b>2%</b><br>Вейджер: <b>x5</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>2000 EUR / 200 000 RUB</b>
                      </div>
                      <hr style="border:none;border-top:1px dashed #eef2f6;margin:10px 0;">
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 3</b><br>Процент начисления: <b>3%</b><br>Вейджер: <b>x5</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>2000 EUR / 200 000 RUB</b>
                      </div>
                      <hr style="border:none;border-top:1px dashed #eef2f6;margin:10px 0;">
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 4</b><br>Процент начисления: <b>4%</b><br>Вейджер: <b>x5</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>2000 EUR / 200 000 RUB</b>
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 5–8</h3>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 5</b><br>Процент начисления: <b>5%</b><br>Вейджер: <b>x4</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>2000 EUR / 200 000 RUB</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 6</b><br>Процент начисления: <b>6%</b><br>Вейджер: <b>x4</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>5000 EUR / 500 000 RUB</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 7</b><br>Процент начисления: <b>7%</b><br>Вейджер: <b>x4</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>5000 EUR / 500 000 RUB</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 8</b><br>Процент начисления: <b>8%</b><br>Вейджер: <b>x4</b><br>Ограничение по максимальному выигрышу: <b>x5</b><br>Максимальный размер кешбека: <b>5000 EUR / 500 000 RUB</b>
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 9–10</h3>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 9</b><br>Процент начисления: <b>9%</b><br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер кешбека: <b>5000 EUR / 500 000 RUB</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 10</b><br>Процент начисления: <b>10%</b><br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер кешбека: <b>5000 EUR / 500 000 RUB</b>
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 11–15</h3>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 11</b><br>Процент начисления: <b>11%</b><br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер суммы Cashback: <b>неограничен</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 12</b><br>Процент начисления: <b>12%</b><br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер суммы Cashback: <b>неограничен</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 13</b><br>Процент начисления: <b>13%</b><br>Вейджер: <b>x2</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер суммы Cashback: <b>неограничен</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;margin-bottom:10px;">
                        <b>Cashback lvl 14</b><br>Процент начисления: <b>14%</b><br>Вейджер: <b>x2</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер суммы Cashback: <b>неограничен</b>
                      </div>
                      <div style="font-size:13px;line-height:1.45;color:#0b1220;">
                        <b>Cashback lvl 15</b><br>Процент начисления: <b>20%</b><br>Вейджер: <b>x1</b><br>Ограничение по максимальному выигрышу: <b>x3</b><br>Максимальный размер суммы Cashback: <b>неограничен</b>
                      </div>
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#f1f5f9;border:1px solid #e6eef6;">
                      <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">VIP — ежедневный кешбек (по тегу)</h3>
                      <div style="font-size:13px;color:#0b1220;line-height:1.45;">
                        <b>VIP-CB-Everyday - 6LVL</b> → 6 LVL — <b>6%</b>, Ограничение по макс. выигрышу — <b>x5</b><br>
                        <b>VIP-CB-Everyday - 7LVL</b> → 7 LVL — <b>7%</b>, Ограничение по макс. выигрышу — <b>x5</b><br>
                        <b>VIP-CB-Everyday - 8LVL</b> → 8 LVL — <b>8%</b>, Ограничение по макс. выигрышу — <b>x5</b>
                      </div>
                    </div>
                  </div>
                  <footer style="margin-top:12px;font-size:13px;color:#475569;">
                    <b>Примечание:</b> "Ограничение по максимальному выигрышу" означает множитель Max Win, применяемый при расчёте максимальной суммы, которую игрок может вывести после отыгрыша кешбека.<br>
                    🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/CashBack+R7" target="_blank">Подробнее → R7</a>
                  </footer>
                </section>
            `,
            Kometa: `
                <section class="cb-structured" style="font-family:Inter,Arial,sans-serif;max-width:980px;margin:18px auto;padding:18px;border-radius:10px; background:#fff;border:1px solid #eef2f6;box-shadow:0 8px 28px rgba(2,6,23,0.06);color:#0b1220;">
                  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h2 style="margin:0;font-size:18px;color:#0f172a;">Условия кешбэка — Kometa</h2>
                  </header>
                  <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;margin-bottom:12px;">
                    <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 1</h3>
                    <div style="font-size:13px;line-height:1.45;">
                      Процент начисления: <b>3%</b> — от <b>5 EUR / 500 RUB</b><br>
                      Вейджер: <b>x25</b><br>
                      Ограничение по максимальному выигрышу: <b>x3</b>
                    </div>
                  </div>
                  <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eef2f6;margin-bottom:12px;">
                    <h3 style="margin:0 0 10px 0;font-size:15px;color:#0b1220;">Уровни 2–5 — процент зависит от чистого проигрыша за прошлую календарную неделю</h3>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0b1220;">
                      <thead>
                        <tr>
                          <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:14%;">Уровень</th>
                          <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:34%;">Проигрыш (EUR)</th>
                          <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:32%;">Проигрыш (RUB)</th>
                          <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:10%;">% Cashback</th>
                          <th style="text-align:left;padding:10px;border-bottom:1px solid #eef2f6;width:10%;">Max Win</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">2 lvl</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101 - 250 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">10 000 - 24 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>4%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x3</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">251 - 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">25 000 - 79 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">801 - 1 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">80 000 - 179 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">180 000+ RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">3 lvl</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101 - 250 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">10 000 - 24 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>4%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x3</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">251 - 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">25 000 - 79 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x3</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">801 - 1 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">80 000 - 179 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">180 000+ RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">4 lvl</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101 - 250 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">10 000 - 24 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>4%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x3</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">251 - 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">25 000 - 79 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">801 - 1 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">80 000 - 179 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">1801+ EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">180 000+ RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>10%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x7</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">5 lvl</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">101 - 250 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">10 000 - 24 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>4%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x3</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">251 - 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">25 000 - 79 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>6%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">801 - 1 800 EUR</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;">80 000 - 179 999 RUB</td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>7%</b></td>
                          <td style="padding:10px;border-bottom:1px dashed #f1f5f9;"><b>x5</b></td>
                        </tr>
                        <tr>
                          <td style="padding:10px;border-bottom:0;"></td>
                          <td style="padding:10px;border-bottom:0;">1801+ EUR</td>
                          <td style="padding:10px;border-bottom:0;">180 000+ RUB</td>
                          <td style="padding:10px;border-bottom:0;"><b>10%</b></td>
                          <td style="padding:10px;border-bottom:0;"><b>x7</b></td>
                        </tr>
                      </tbody>
                    </table>
                    <div style="margin-top:12px;font-size:13px;color:#475569;">
                      Примечание: в таблице указаны диапазоны и соответствующие Max Win для каждого уровня.
                    </div>
                  </div>
                  <div style="padding:12px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f6;margin-bottom:12px;">
                    <h3 style="margin:0 0 8px 0;font-size:15px;color:#0b1220;">Cashback lvl 6–10</h3>
                    <div style="font-size:13px;line-height:1.45;margin-bottom:10px;">
                      <b>Cashback lvl 6</b><br>Процент начисления: <b>11%</b> — от любой суммы чистого проигрыша<br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x7</b>
                    </div>
                    <div style="font-size:13px;line-height:1.45;margin-bottom:10px;">
                      <b>Cashback lvl 7</b><br>Процент начисления: <b>12%</b> — от любой суммы чистого проигрыша<br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x7</b>
                    </div>
                    <div style="font-size:13px;line-height:1.45;margin-bottom:10px;">
                      <b>Cashback lvl 8</b><br>Процент начисления: <b>13%</b> — от любой суммы чистого проигрыша<br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x7</b>
                    </div>
                    <div style="font-size:13px;line-height:1.45;margin-bottom:10px;">
                      <b>Cashback lvl 9</b><br>Процент начисления: <b>14%</b> — от любой суммы чистого проигрыша<br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x7</b>
                    </div>
                    <div style="font-size:13px;line-height:1.45;">
                      <b>Cashback lvl 10</b><br>Процент начисления: <b>20%</b> — от любой суммы чистого проигрыша<br>Вейджер: <b>x3</b><br>Ограничение по максимальному выигрышу: <b>x7</b>
                    </div>
                  </div>
                  <footer style="margin-top:12px;font-size:13px;color:#475569;">
                    <b>Примечание:</b> "От любой суммы чистого проигрыша" означает, что минимального порога проигрыша для начисления кешбека в уровнях 6–10 нет.<br>
                    🔗 <a href="https://wiki.deltasystem.tech/display/SUPDEP/CashBack+Kometa" target="_blank">Подробнее → Kometa</a>
                  </footer>
                </section>
            `
        };

        const fullHtml = infoMap[name] || '<p>Условия не найдены</p>';
        const shortDesc = shortInfoMap[name] || 'Условия по проекту';

        const finalHtml = `
            <div style="font-family:Inter,Arial,sans-serif; max-width:100%; padding:15px; background:#fff; border-radius:8px; border:1px solid #eef2f6; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:16px; color:#0f172a;">Справка: ${name}</strong>
                    <button class="cb-toggle-btn" style="cursor:pointer; padding:5px 12px; border-radius:5px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:bold; color:#334155; transition:0.2s;">Ещё</button>
                </div>
                <div style="font-size:14px; color:#ea580c; margin-top:8px; font-weight:bold;">
                    ${shortDesc}
                </div>
                <div class="cb-details" style="display:none; margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:15px;">
                    ${fullHtml}
                </div>
            </div>
        `;

        addCashbackBlock(finalHtml, `cb-${name}`);

        const block = document.getElementById(`cb-${name}`);
        if(block) {
            const btn = block.querySelector('.cb-toggle-btn');
            const details = block.querySelector('.cb-details');
            if(btn && details) {
                btn.addEventListener('click', () => {
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                        btn.innerText = 'Скрыть';
                    } else {
                        details.style.display = 'none';
                        btn.innerText = 'Ещё';
                    }
                });
            }
        }
    }

    function watchForPage() {
        setInterval(() => {
            if (!window.location.href.includes('/Users/Summary')) return;

            const targetEl = document.querySelector("#SummaryUserId");
            if (!targetEl) return;

            const newUserId = targetEl.textContent.trim();
            const uiExists = document.getElementById("cashback-window");

            const targetContainer = document.querySelector("#UserSummaryWrapper > div.summary-blocks > div.summary-block-left") || document.querySelector(".summary-block-left");

            if (targetContainer && (!uiExists || currentUserId !== newUserId)) {

                if (uiExists) uiExists.remove();

                currentUserId = newUserId;
                userId = newUserId;
                localStorage.setItem("SummaryUserId", userId);

                projectName = detectProject() || 'Неизвестно';

                createUI(targetContainer, projectName);
                showConditionsForProject(projectName);

                log("✅ Калькулятор загружен для клиента:", userId, "| Проект:", projectName);
            }

            setupNgrToggle();

        }, 1000);
    }

    watchForPage();
})();
