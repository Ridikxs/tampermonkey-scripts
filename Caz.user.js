// ==UserScript==
// @name         Caz
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Играй пока нет чатов
// @author       Calvin
// @match        https://sparkmoth.com/app/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      sparkmothv1-default-rtdb.europe-west1.firebasedatabase.app
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Caz.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Caz.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = "5.0";
    const DB_URL = "https://sparkmothv1-default-rtdb.europe-west1.firebasedatabase.app";

    function formatNum(num) {
        return Number(num).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }

    const BET_STEPS = [10, 50, 100, 250, 500, 1000, 2000];
    let betIndex = 1;
    let activeBet = BET_STEPS[betIndex];

    function getDynamicStrip(isBonus, index) {
        const v = index / (BET_STEPS.length - 1);
        const multWild = 50 + Math.floor(v * 100);
        const multMulti = 15 + Math.floor(v * 15);
        const multCoin = 5 + Math.floor(v * 5);
        const multTicket = 1.5 + Math.floor(v * 1);

        if (isBonus) {
            return [
                { symbol: '👑', mult: multWild, weight: 10 },
                { symbol: '🚀', mult: multMulti, weight: 20 },
                { symbol: '🎰', mult: multCoin, weight: 30 },
                { symbol: '✉️', mult: multTicket, weight: 25 },
                { symbol: '🔮', mult: 0, weight: 5 },
                { symbol: '❌', mult: 0, weight: 10 }
            ];
        } else {
            return [
                { symbol: '👑', mult: multWild, weight: 3 },
                { symbol: '🚀', mult: multMulti, weight: 10 },
                { symbol: '🎰', mult: multCoin, weight: 25 },
                { symbol: '✉️', mult: multTicket, weight: 35 },
                { symbol: '🔮', mult: 0, weight: 7 },
                { symbol: '❌', mult: 0, weight: 20 }
            ];
        }
    }

    function getRandomSymbol(isBonus, index) {
        const strip = getDynamicStrip(isBonus, index);
        let sum = strip.reduce((acc, el) => acc + el.weight, 0);
        let rand = Math.random() * sum;
        for (let item of strip) {
            if (rand < item.weight) return item;
            rand -= item.weight;
        }
    }

    function triggerCoinRain() {
        const rainContainer = document.createElement('div');
        rainContainer.id = 'coin-rain-container';
        document.body.appendChild(rainContainer);
        for (let i = 0; i < 150; i++) {
            const coin = document.createElement('div');
            coin.innerText = Math.random() > 0.5 ? '🪙' : '💵';
            coin.className = 'falling-coin';
            coin.style.left = Math.random() * 100 + 'vw';
            coin.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
            coin.style.animationDelay = (Math.random() * 1.5) + 's';
            rainContainer.appendChild(coin);
        }
        setTimeout(() => rainContainer.remove(), 4000);
    }

    const LOGO_IMG_SELECTOR = 'img[src="/brand-assets/logo_thumbnail.svg"]';

    let balance = 0;
    let workEarned = 0;
    let historyLog = [];
    let hasCalvinScript = false;
    let hasBinance = false;
    let isCloudInitialized = false;
    let isDataLoaded = false;
    let myDbId = null;

    let processedEventIdsArr = GM_getValue("operator_processed_events", []);
    const processedEventIds = new Set(processedEventIdsArr);

    let isSpinning = false;
    let freeSpins = 0;

    const VIP_SCRIPT_COST = 1000000;
    const BINANCE_COST    = 100000000;
    const COINS_PER_MESSAGE = 0.1;
    const COINS_PER_TAG = 0.5;

    function getMyOperatorNames() {
        const names = [];

        const savedName = GM_getValue("caz_manual_name", null);
        if (savedName) names.push(savedName);

        const allImages = document.querySelectorAll('img[alt]');
        allImages.forEach(img => {
            const altText = img.alt.trim().toLowerCase();
            if (altText && !altText.includes('logo') && !altText.includes('icon') && altText !== 'image') {
                names.push(altText);
            }
        });

        const profileNameEl = document.querySelector('.p-1.flex-shrink-0.flex.w-full.justify-between.z-10 .text-sm.font-medium');
        if (profileNameEl && profileNameEl.innerText.trim()) {
            names.push(profileNameEl.innerText.trim().toLowerCase());
        }

        return [...new Set(names)].filter(Boolean);
    }

    function tryInitializeCloud() {
        if (isCloudInitialized) return true;

        const names = getMyOperatorNames();
        if (names.length === 0 || !names[0]) return false;

        myDbId = names[0].replace(/[.#$\[\]]/g, '_');
        isCloudInitialized = true;
        console.log(`%c [REST] Подключение для оператора: ${myDbId}... `, 'background: #1e1e2e; color: #f9e2af; font-weight: bold;');

        const msgEl = document.getElementById('slot-message');
        if (msgEl) { msgEl.innerText = "Загрузка REST API..."; msgEl.style.color = "#f9e2af"; }

        GM_xmlhttpRequest({
            method: "GET",
            url: `${DB_URL}/operators/${myDbId}.json`,
            onload: function(response) {
                isDataLoaded = true;
                if (response.status === 200) {
                    let data = null;
                    try { data = JSON.parse(response.responseText); } catch(e) {}

                    if (data) {
                        balance = data.balance !== undefined ? data.balance : 0;
                        workEarned = data.workEarned !== undefined ? data.workEarned : 0;
                        historyLog = data.history || [];
                        hasCalvinScript = data.hasVip || false;
                        hasBinance = data.hasBinance || false;
                        console.log("%c [REST] Данные успешно загружены! 🟢", "background: #a6e3a1; color: #111; font-weight: bold;");
                    } else {
                        balance = 1000;
                        workEarned = 0;
                        console.log("%c [REST] Новый пользователь, создаем профиль...", "background: #89b4fa; color: #111; font-weight: bold;");
                        pushToCloudREST();
                    }

                    GM_setValue("caz_manual_name", names[0]);
                    finalizeInit();
                } else {
                    console.error("Ошибка REST API", response);
                    if (document.getElementById('modal-balance')) document.getElementById('modal-balance').innerText = "❌ Ошибка базы";
                }
            },
            onerror: function(err) {
                console.error("REST Network Error", err);
                if (document.getElementById('modal-balance')) document.getElementById('modal-balance').innerText = "❌ Блок сети";
            }
        });

        return true;
    }

    function finalizeInit() {
        if (document.getElementById('modal-balance')) {
            document.getElementById('modal-balance').innerText = `🪙 ${formatNum(balance)}`;
            document.getElementById('modal-balance').title = `Точный баланс: ${balance}`;
            document.getElementById('slot-message').innerText = "Готово к игре!";
            document.getElementById('slot-message').style.color = "#a6e3a1";
        }
        updateUIState();
        renderHistory();
        renderShop();
    }

    function pushToCloudREST() {
        if (!isCloudInitialized || !myDbId || !isDataLoaded) return;

        const payload = {
            balance: balance,
            workEarned: workEarned,
            history: historyLog,
            hasVip: hasCalvinScript,
            hasBinance: hasBinance,
            version: SCRIPT_VERSION,
            lastActive: new Date().toISOString()
        };

        GM_xmlhttpRequest({
            method: "PUT",
            url: `${DB_URL}/operators/${myDbId}.json`,
            data: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }
        });
    }

    GM_addStyle(`
        .sparkmoth-casino-logo { cursor: pointer !important; transition: all 0.3s ease; position: relative; }
        .sparkmoth-casino-logo:hover { transform: scale(1.15); filter: drop-shadow(0 0 5px #b4befe); }
        .sparkmoth-casino-logo::after { content: ''; position: absolute; width: 100%; height: 100%; top: 0; left: 0; border-radius: 50%; border: 2px solid #a6e3a1; opacity: 0; animation: logoPulse 2s infinite; pointer-events: none; }
        @keyframes logoPulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
        #slot-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #181825; padding: 20px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 99999; display: none; flex-direction: column; align-items: center; border: 2px solid #b4befe; color: white; font-family: sans-serif; min-width: 380px; min-height: 440px; resize: both; overflow: auto; }
        .modal-header { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #313244; padding-bottom: 10px; cursor: grab; user-select: none; }
        .modal-header:active { cursor: grabbing; }
        #modal-balance { font-weight: bold; color: #f9e2af; font-size: 18px; pointer-events: none; margin-right: auto;}
        .header-controls { display: flex; gap: 8px; margin-left: 15px;}
        .tab-btn { background: #45475a; color: #cdd6f4; border: none; border-radius: 4px; padding: 5px 8px; cursor: pointer; font-size: 14px; }
        .tab-btn:hover { background: #585b70; }
        .close-btn { background: transparent; border: none; color: #f38ba8; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;}
        .reels-container { display: flex; gap: 15px; margin: 10px 0; justify-content: center; width: 100%;}
        .reel { width: 80px; height: 80px; background: #11111b; border: 2px solid #45475a; border-radius: 8px; display: flex; justify-content: center; align-items: center; font-size: 40px; overflow: hidden; flex-shrink: 0; }
        .bet-controls { display: flex; justify-content: center; align-items: center; gap: 15px; width: 100%; margin-bottom: 15px; background: #1e1e2e; padding: 10px; border-radius: 8px; border: 1px solid #313244;}
        .bet-btn { background: #89b4fa; border: none; color: #111; padding: 5px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;}
        .bet-btn:disabled { background: #45475a; color: #7f849c; cursor: not-allowed; }
        .bet-display-box { display: flex; flex-direction: column; align-items: center; min-width: 100px; }
        #bet-display { font-weight: bold; font-size: 18px; color: #cdd6f4;}
        .slot-controls { display: flex; gap: 10px; width: 100%; justify-content: center; margin-top: auto;}
        .spin-btn { background: #a6e3a1; color: #111; padding: 10px 20px; font-size: 18px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; flex-grow: 1;}
        .spin-btn:disabled { background: #585b70; cursor: not-allowed; opacity: 0.5; }
        .bonus-btn { background: #cba6f7; color: #111; padding: 10px 15px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;}
        .bonus-btn:disabled { background: #585b70; cursor: not-allowed; opacity: 0.5; }
        #slot-message { margin: 5px 0 10px; font-size: 16px; font-weight: bold; color: #cdd6f4; height: 20px; text-align: center;}
        #fs-counter { color: #f38ba8; font-weight: bold; font-size: 14px; height: 16px;}
        #volatility-container { margin-top: 15px; text-align: center; font-size: 22px; letter-spacing: 4px; display: flex; justify-content: center; align-items: center; width: 100%; padding-top: 12px; border-top: 1px dashed #313244; }
        .bolt-active { color: #f9e2af; text-shadow: 0 0 12px #f2cd32; transition: all 0.3s; }
        .bolt-inactive { filter: grayscale(100%); opacity: 0.15; transition: all 0.3s; }
        .bolt-max { font-size: 14px; font-weight: bold; color: #f38ba8; text-shadow: 0 0 8px #f38ba8; margin-left: 10px; font-style: italic; letter-spacing: 1px;}
        .side-panel { display: none; width: 100%; background: #11111b; border-radius: 8px; padding: 10px; margin-top: 10px; border: 1px solid #313244; max-height: 250px; overflow-y: auto; }
        .hist-item { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; border-bottom: 1px dashed #313244; padding-bottom: 2px;}
        .hist-time { color: #a6adc8; }
        .hist-type { color: #cdd6f4; }
        .hist-pos { color: #a6e3a1; font-weight: bold;}
        .hist-neg { color: #f38ba8; font-weight: bold;}
        .shop-item { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 5px 0; }
        .buy-shop-btn { background: #f9e2af; color: #111; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .buy-shop-btn:hover { background: #f2cd32; }
        .buy-shop-btn.binance { background: #a6e3a1; }
        .buy-shop-btn.binance:hover { background: #94e289; }
        #coin-rain-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 100000; overflow: hidden; }
        .falling-coin { position: absolute; top: -50px; font-size: 35px; user-select: none; animation: coinFall linear forwards; }
        @keyframes coinFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
    `);

    const modal = document.createElement('div');
    modal.id = 'slot-modal';
    modal.innerHTML = `
        <div class="modal-header" id="modal-drag-handle">
            <span id="modal-balance" title="Ожидание авторизации...">🪙 Ожидание...</span>
            <div class="header-controls">
                <button class="tab-btn" id="btn-top" title="Топ игроков">🏆</button>
                <button class="tab-btn" id="btn-hist" title="История">📜</button>
                <button class="tab-btn" id="btn-shop" title="Магазин">🛒</button>
                <button class="close-btn" id="btn-close-slots">✖</button>
            </div>
        </div>
        <div class="side-panel" id="panel-top"></div>
        <div class="side-panel" id="panel-history"></div>
        <div class="side-panel" id="panel-shop"></div>
        <div id="fs-counter"></div>
        <div class="reels-container" id="reels-view">
            <div class="reel" id="reel-1">❌</div>
            <div class="reel" id="reel-2">❌</div>
            <div class="reel" id="reel-3">❌</div>
        </div>
        <div class="bet-controls">
            <button class="bet-btn" id="btn-bet-down">➖</button>
            <div class="bet-display-box"><span id="bet-display">Ставка: 50</span></div>
            <button class="bet-btn" id="btn-bet-up">➕</button>
            <button class="bet-btn" id="btn-bet-max">MAX</button>
        </div>
        <div id="slot-message">Ожидание подключения...</div>
        <div class="slot-controls">
            <button class="bonus-btn" id="btn-buy-bonus">Бонус (${formatNum(5000)})</button>
            <button class="spin-btn" id="btn-spin">Spin</button>
        </div>
        <div id="volatility-container"></div>
    `;
    document.body.appendChild(modal);

    const uiBalance = document.getElementById('modal-balance');
    const msg = document.getElementById('slot-message');
    const fsCounter = document.getElementById('fs-counter');
    const btnSpin = document.getElementById('btn-spin');
    const btnBonus = document.getElementById('btn-buy-bonus');
    const panelTop = document.getElementById('panel-top');
    const panelHist = document.getElementById('panel-history');
    const panelShop = document.getElementById('panel-shop');
    const betDisplay = document.getElementById('bet-display');
    const volContainer = document.getElementById('volatility-container');
    const btnBetUp = document.getElementById('btn-bet-up');
    const btnBetDown = document.getElementById('btn-bet-down');
    const btnBetMax = document.getElementById('btn-bet-max');

    const dragHandle = document.getElementById('modal-drag-handle');
    let isDragging = false, dragStartX, dragStartY;
    dragHandle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        dragStartX = e.clientX - rect.left;
        dragStartY = e.clientY - rect.top;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        modal.style.left = (e.clientX - dragStartX) + 'px';
        modal.style.top = (e.clientY - dragStartY) + 'px';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    unsafeWindow.addCazCoins = function(amount) {
        if (!tryInitializeCloud() || !isDataLoaded) return;
        updateBalance(amount, "Пополнение Администратором");
    };

    function updateBalance(amount, logType = null) {
        if (!isDataLoaded) return;
        balance = Math.round((balance + amount) * 10) / 10;
        if (uiBalance) {
            uiBalance.innerText = `🪙 ${formatNum(balance)}`;
            uiBalance.title = `Точный баланс: ${balance}`;
        }
        updateUIState();
        if (logType) { logHistory(amount, logType); } else { pushToCloudREST(); }
    }

    function logHistory(amount, type) {
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        historyLog.unshift({ time, amount, type });
        if (historyLog.length > 40) historyLog.pop();
        pushToCloudREST();
    }

    function renderHistory() {
        if (!panelHist) return;
        panelHist.innerHTML = historyLog.length === 0 ? '<div style="text-align:center; color:#6c7086;">История пуста</div>' : '';
        historyLog.forEach(item => {
            const isPos = item.amount > 0;
            const sign = isPos ? '+' : '';
            const colorClass = isPos ? 'hist-pos' : (item.amount < 0 ? 'hist-neg' : 'hist-time');
            panelHist.innerHTML += `<div class="hist-item"><span class="hist-time">[${item.time}]</span><span class="hist-type">${item.type}</span><span class="${colorClass}">${sign}${formatNum(item.amount)}</span></div>`;
        });
    }

    function renderShop() {
        if (!panelShop) return;
        panelShop.innerHTML = `
            <div class="shop-item">
                <span><b>Скрипт от Calvin</b> (персональный)</span>
                ${hasCalvinScript ? '<span style="color:#a6e3a1; font-weight:bold;">КУПЛЕНО ✔️</span>' : `<button class="buy-shop-btn" id="btn-buy-vip">Купить за ${formatNum(VIP_SCRIPT_COST)} 🪙</button>`}
            </div>
            <hr style="border:0; border-top: 1px dashed #313244; width: 100%; margin: 5px 0;">
            <div class="shop-item">
                <span><b>10$ на Binance</b> 💸</span>
                ${hasBinance ? '<span style="color:#a6e3a1; font-weight:bold;">ВЫВЕДЕНО ✔️</span>' : `<button class="buy-shop-btn binance" id="btn-buy-binance">Купить за ${formatNum(BINANCE_COST)} 🪙</button>`}
            </div>
        `;
        const btnBuyVip = document.getElementById('btn-buy-vip');
        if (btnBuyVip) {
            btnBuyVip.onclick = () => {
                if (balance >= VIP_SCRIPT_COST) {
                    hasCalvinScript = true;
                    updateBalance(-VIP_SCRIPT_COST, "Покупка VIP скрипта");
                    modal.style.borderColor = "#f9e2af";
                    triggerCoinRain();
                } else { alert(`Нужно ${formatNum(VIP_SCRIPT_COST)} 🪙`); }
            };
        }
        const btnBuyBinance = document.getElementById('btn-buy-binance');
        if (btnBuyBinance) {
            btnBuyBinance.onclick = () => {
                if (balance >= BINANCE_COST) {
                    hasBinance = true;
                    updateBalance(-BINANCE_COST, "Вывод 10$ на Binance");
                    triggerCoinRain();
                    alert("Заявка на 10$ отправлена!");
                } else { alert(`Нужно ${formatNum(BINANCE_COST)} 🪙`); }
            };
        }
    }

    function renderTop() {
        if (!panelTop) return;
        panelTop.innerHTML = '<div style="text-align:center; color:#6c7086;">Сбор данных...</div>';

        GM_xmlhttpRequest({
            method: "GET",
            url: `${DB_URL}/operators.json`,
            onload: function(response) {
                if (response.status === 200) {
                    let data = null;
                    try { data = JSON.parse(response.responseText); } catch(e) {}

                    if (!data) {
                        panelTop.innerHTML = '<div style="text-align:center; color:#6c7086;">Нет данных</div>';
                        return;
                    }

                    let players = [];
                    for (let key in data) {
                        players.push({
                            name: key,
                            balance: data[key].balance || 0,
                            work: data[key].workEarned || 0
                        });
                    }

                    const names = getMyOperatorNames();
                    const myName = names.length > 0 ? names[0].replace(/[.#$\[\]]/g, '_') : 'unknown';

                    let html = '<div style="color:#f9e2af; font-weight:bold; margin-bottom:5px; text-align:center; text-transform:uppercase;">💰 Топ по балансу</div>';
                    players.sort((a, b) => b.balance - a.balance);

                    for (let i = 0; i < Math.min(3, players.length); i++) {
                        let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                        html += `<div class="hist-item" style="justify-content: flex-start; gap: 10px;">
                                    <span>${medal}</span>
                                    <span class="hist-type" style="text-transform: capitalize; flex-grow: 1;">${players[i].name}</span>
                                    <span class="hist-pos">🪙 ${formatNum(players[i].balance)}</span>
                                 </div>`;
                    }

                    let myIndexBal = players.findIndex(p => p.name === myName);
                    if (myIndexBal !== -1) {
                        html += `<div class="hist-item" style="justify-content: flex-start; gap: 10px; background: rgba(249, 226, 175, 0.1); padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(249, 226, 175, 0.3);">
                                    <span style="color: #a6adc8; width: 20px; text-align: center; font-weight: bold;">#${myIndexBal + 1}</span>
                                    <span class="hist-type" style="text-transform: capitalize; flex-grow: 1; color: #f9e2af; font-weight: bold;">Вы (${myName})</span>
                                    <span class="hist-pos">🪙 ${formatNum(players[myIndexBal].balance)}</span>
                                 </div>`;
                    }

                    html += `<hr style="border:0; border-top: 1px dashed #313244; width: 100%; margin: 10px 0;">`;
                    html += '<div style="color:#a6e3a1; font-weight:bold; margin-bottom:5px; text-align:center; text-transform:uppercase;">🛠️ Топ трудяг (В чатах)</div>';
                    players.sort((a, b) => b.work - a.work);

                    for (let i = 0; i < Math.min(3, players.length); i++) {
                        let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                        html += `<div class="hist-item" style="justify-content: flex-start; gap: 10px;">
                                    <span>${medal}</span>
                                    <span class="hist-type" style="text-transform: capitalize; flex-grow: 1;">${players[i].name}</span>
                                    <span class="hist-pos" style="color:#a6e3a1;">🪙 ${formatNum(players[i].work)}</span>
                                 </div>`;
                    }

                    let myIndexWork = players.findIndex(p => p.name === myName);
                    if (myIndexWork !== -1) {
                        html += `<div class="hist-item" style="justify-content: flex-start; gap: 10px; background: rgba(166, 227, 161, 0.1); padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(166, 227, 161, 0.3);">
                                    <span style="color: #a6adc8; width: 20px; text-align: center; font-weight: bold;">#${myIndexWork + 1}</span>
                                    <span class="hist-type" style="text-transform: capitalize; flex-grow: 1; color: #a6e3a1; font-weight: bold;">Вы (${myName})</span>
                                    <span class="hist-pos" style="color:#a6e3a1;">🪙 ${formatNum(players[myIndexWork].work)}</span>
                                 </div>`;
                    }

                    panelTop.innerHTML = html;
                } else {
                    panelTop.innerHTML = '<div style="text-align:center; color:#f38ba8;">Ошибка загрузки Топа</div>';
                }
            }
        });
    }

    function updateUIState() {
        if (!betDisplay) return;
        const currentBet = BET_STEPS[betIndex];
        betDisplay.innerText = `Ставка: ${formatNum(currentBet)}`;
        const boltLevels = [1, 2, 3, 3, 4, 4, 5];
        const activeBolts = boltLevels[betIndex];
        let boltsHtml = '';
        for(let i = 1; i <= 5; i++) boltsHtml += i <= activeBolts ? '<span class="bolt-active">⚡</span>' : '<span class="bolt-inactive">⚡</span>';
        if(betIndex === BET_STEPS.length - 1) boltsHtml += '<span class="bolt-max">MAX</span>';
        volContainer.innerHTML = boltsHtml;
        btnBonus.innerText = `Купить Бонус (${formatNum(currentBet * 100)})`;
        const locked = isSpinning || freeSpins > 0 || !isDataLoaded;
        btnBetDown.disabled = locked || betIndex === 0;
        btnBetUp.disabled = locked || betIndex === BET_STEPS.length - 1;
        btnBetMax.disabled = locked || betIndex === BET_STEPS.length - 1;
        btnBonus.disabled = locked || balance < (currentBet * 100);
        btnSpin.disabled = locked;
    }

    function performSpin() {
        if (!isDataLoaded) {
            msg.innerText = "Ожидание сети...";
            return;
        }
        const currentBet = BET_STEPS[betIndex];
        if (balance < currentBet && freeSpins === 0) { msg.innerText = "Нет монет для ставки!"; msg.style.color = "#f38ba8"; return; }
        isSpinning = true;
        if (panelTop) panelTop.style.display = 'none';
        if (panelHist) panelHist.style.display = 'none';
        if (panelShop) panelShop.style.display = 'none';

        if (freeSpins === 0) { activeBet = currentBet; updateBalance(-activeBet, `Ставка (${formatNum(activeBet)})`); }
        else { freeSpins--; if (fsCounter) fsCounter.innerText = `Супер Спины: ${freeSpins}`; if (freeSpins === 0 && fsCounter) fsCounter.innerText = "Последний спин!"; }

        updateUIState();
        msg.innerText = "Крутим..."; msg.style.color = "#cdd6f4";
        let ticks = 0;
        const isBonusActive = freeSpins > 0;

        const spinInterval = setInterval(() => {
            const r1 = getRandomSymbol(isBonusActive, betIndex);
            const r2 = getRandomSymbol(isBonusActive, betIndex);
            const r3 = getRandomSymbol(isBonusActive, betIndex);

            if (document.getElementById('reel-1')) document.getElementById('reel-1').innerText = r1.symbol;
            if (document.getElementById('reel-2')) document.getElementById('reel-2').innerText = r2.symbol;
            if (document.getElementById('reel-3')) document.getElementById('reel-3').innerText = r3.symbol;
            ticks++;
            if (ticks > 15) { clearInterval(spinInterval); finishSpin(); }
        }, 80);
    }

    function finishSpin() {
        const isBonusActive = freeSpins > 0;
        let r1 = getRandomSymbol(isBonusActive, betIndex);
        let r2 = getRandomSymbol(isBonusActive, betIndex);
        let r3 = getRandomSymbol(isBonusActive, betIndex);
        const luck = Math.random();

        if (isBonusActive) { if (luck < 0.18) { r2 = r1; r3 = r1; } else if (luck < 0.45) { r2 = r1; } }
        else { if (luck < 0.07) { r2 = r1; r3 = r1; } else if (luck < 0.25) { r2 = r1; } }

        if (document.getElementById('reel-1')) document.getElementById('reel-1').innerText = r1.symbol;
        if (document.getElementById('reel-2')) document.getElementById('reel-2').innerText = r2.symbol;
        if (document.getElementById('reel-3')) document.getElementById('reel-3').innerText = r3.symbol;

        const symbols = [r1.symbol, r2.symbol, r3.symbol];
        const scatterCount = symbols.filter(s => s === '🔮').length;
        let wonAmount = 0; let winType = "";
        if (r1.symbol === r2.symbol && r2.symbol === r3.symbol && r1.mult > 0) { wonAmount = Math.floor(activeBet * r1.mult); winType = `Выигрыш (x${r1.mult})`; }
        else if (r1.symbol === r2.symbol && r1.mult > 0) { const partialMult = Math.max(0.5, r1.mult * 0.3); wonAmount = Math.floor(activeBet * partialMult); winType = `Мини-Вин (x${partialMult.toFixed(1)})`; }

        if (wonAmount > 0) {
            updateBalance(wonAmount, winType);
            if (wonAmount >= activeBet * 10) { msg.innerText = `MEGA WIN! +${formatNum(wonAmount)}`; msg.style.color = "#a6e3a1"; triggerCoinRain(); }
            else if (wonAmount >= activeBet * 3) { msg.innerText = `BIG WIN! +${formatNum(wonAmount)}`; msg.style.color = "#f9e2af"; }
            else { msg.innerText = `Победа: +${formatNum(wonAmount)}`; msg.style.color = "#a6adc8"; }
        } else { msg.innerText = "Нет совпадений"; msg.style.color = "#6c7086"; if (freeSpins === 0 && scatterCount === 0) logHistory(0, `Проигрыш (${formatNum(activeBet)})`); }
        if (scatterCount === 3) { msg.innerText = "🔮 3 СКАТТЕРА! +10 СУПЕР СПИНОВ!"; msg.style.color = "#cba6f7"; logHistory(0, "Бонуска (3 Скаттера)"); freeSpins += 10; if (fsCounter) fsCounter.innerText = `Супер Спины: ${freeSpins}`; }
        else if (scatterCount > 0 && scatterCount < 3 && wonAmount === 0) { msg.innerText = `🔮 Скаттеры (${scatterCount}) = РЕСПИН!`; msg.style.color = "#89b4fa"; logHistory(0, "Респин (Скаттер)"); freeSpins += 1; }
        if (freeSpins > 0) { setTimeout(performSpin, 1200); } else { isSpinning = false; if (fsCounter) fsCounter.innerText = ""; updateUIState(); }
    }

    btnBetUp.onclick = () => { if (betIndex < BET_STEPS.length - 1) { betIndex++; updateUIState(); } };
    btnBetDown.onclick = () => { if (betIndex > 0) { betIndex--; updateUIState(); } };
    btnBetMax.onclick = () => { betIndex = BET_STEPS.length - 1; updateUIState(); };

    document.getElementById('btn-top').onclick = () => { panelShop.style.display = 'none'; panelHist.style.display = 'none'; panelTop.style.display = panelTop.style.display === 'block' ? 'none' : 'block'; if (panelTop.style.display === 'block') renderTop(); };
    document.getElementById('btn-hist').onclick = () => { panelShop.style.display = 'none'; panelTop.style.display = 'none'; panelHist.style.display = panelHist.style.display === 'block' ? 'none' : 'block'; };
    document.getElementById('btn-shop').onclick = () => { panelHist.style.display = 'none'; panelTop.style.display = 'none'; panelShop.style.display = panelShop.style.display === 'block' ? 'none' : 'block'; };
    document.getElementById('btn-close-slots').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('btn-spin').onclick = performSpin;
    document.getElementById('btn-buy-bonus').onclick = () => {
        if (!isDataLoaded) return;
        const cost = BET_STEPS[betIndex] * 100;
        if (balance >= cost && !isSpinning) { activeBet = BET_STEPS[betIndex]; updateBalance(-cost, `Покупка Бонуса (${formatNum(cost)})`); freeSpins = 10; if (fsCounter) fsCounter.innerText = `Супер Спины: ${freeSpins}`; msg.innerText = "БОНУС КУПЛЕН!"; msg.style.color = "#cba6f7"; isSpinning = true; updateUIState(); setTimeout(performSpin, 1000); }
    };

    function isMyMessage(msgElement) {
        if (!msgElement.classList.contains('justify-end')) return false;
        const msgImg = msgElement.querySelector('img');
        const msgName = msgImg ? msgImg.alt.trim().toLowerCase() : '';
        if (!msgName) return false;
        const myNames = getMyOperatorNames();
        return myNames.includes(msgName);
    }

    function scanForActivities() {
        if (!tryInitializeCloud() || !isDataLoaded) return;

        const myNames = getMyOperatorNames();
        const messages = document.querySelectorAll('.message-bubble-container');
        let hasNew = false;

        messages.forEach(msgElement => {
            const msgId = msgElement.getAttribute('data-message-id');
            const updatedAtStr = msgElement.getAttribute('updatedat');
            if (!msgId || !/^\d+$/.test(msgId) || !updatedAtStr) return;
            if (processedEventIds.has(msgId)) return;

            const msgTime = new Date(updatedAtStr).getTime();
            if (Date.now() - msgTime > 300000) { processedEventIds.add(msgId); hasNew = true; return; }

            if (msgElement.classList.contains('justify-end')) {
                if (isMyMessage(msgElement)) {
                    workEarned = Math.round((workEarned + COINS_PER_MESSAGE) * 10) / 10;
                    updateBalance(COINS_PER_MESSAGE, "Ответ в чат (+0.1)");
                }
                processedEventIds.add(msgId); hasNew = true;
            }
            else if (msgElement.classList.contains('justify-center')) {
                const sysNotif = msgElement.querySelector('span[title*="добавил"], span[title*="удалил"]');
                if (sysNotif) {
                    const titleText = sysNotif.getAttribute('title').toLowerCase();
                    const isAdded = titleText.includes('добавил');
                    const isRemoved = titleText.includes('удалил');
                    let mySaleTagFound = false;
                    for (let name of myNames) { if (titleText.includes(`${name}-продажа`)) { mySaleTagFound = true; break; } }

                    if (mySaleTagFound) {
                        if (isAdded) {
                            const actionAuthor = titleText.split(' ')[0];
                            if (myNames.includes(actionAuthor)) {
                                workEarned = Math.round((workEarned + COINS_PER_TAG) * 10) / 10;
                                updateBalance(COINS_PER_TAG, "Тег Продажа (+0.5)");
                            }
                        }
                        else if (isRemoved) {
                            workEarned = Math.round((workEarned - COINS_PER_TAG) * 10) / 10;
                            updateBalance(-COINS_PER_TAG, "Отмена продажи (-0.5)");
                        }
                    }
                }
                processedEventIds.add(msgId); hasNew = true;
            } else { processedEventIds.add(msgId); hasNew = true; }
        });

        if (hasNew) {
            let arr = Array.from(processedEventIds);
            if (arr.length > 500) arr = arr.slice(-500);
            GM_setValue("operator_processed_events", arr);
        }
    }

    let logoReplaced = false;
    const observer = new MutationObserver(((mutations, obs) => {
        tryInitializeCloud();

        const img = document.querySelector(LOGO_IMG_SELECTOR);
        if (img) {
            const container = img.closest('div.grid');
            if (container && !logoReplaced) {
                container.classList.add('sparkmoth-casino-logo');

                container.addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();

                    if (!tryInitializeCloud()) {
                        let manualName = prompt("Скрипт не смог найти ваш никнейм автоматически (сайт обновился).\nПожалуйста, введите ваш никнейм (например, mike):");
                        if (manualName && manualName.trim()) {
                            GM_setValue("caz_manual_name", manualName.trim().toLowerCase());
                            tryInitializeCloud();
                        }
                    }

                    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
                    if(modal.style.display === 'flex' && !modal.style.left) {
                        modal.style.transform = 'translate(-50%, -50%)';
                        modal.style.left = '50%';
                        modal.style.top = '50%';
                    }
                });
                logoReplaced = true;
            }
        } else { logoReplaced = false; }

        scanForActivities();
    }));

    observer.observe(document.body, { childList: true, subtree: true });
})();
