// ==UserScript==
// @name         Live Chat Helper
// @namespace    http://tampermonkey.net/
// @version      2.9
// @description  Ботолог
// @author       Calvin
// @match        *://*.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatHelper.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatHelper.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) {
        return;
    }

    Object.defineProperty(document, 'hidden', {value: false, writable: false});
    Object.defineProperty(document, 'visibilityState', {value: 'visible', writable: false});
    window.addEventListener('visibilitychange', e => e.stopPropagation(), true);

    const REQUIRED_NAMES = ["AI", "Robbie", "Florian", "Hector", "Jasper", "Jamie", "Enzo", "Nicholas", "Atom", "Motor"];
    const isPhantomWindow = (window.name === 'lch_phantom');
    const isMainWindow = !isPhantomWindow;
    const processingChats = new Set();
    const transferCooldown = new Map();
    let isProcessingAction = false;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const workerCode = `
        self.onmessage = function(e) {
            setTimeout(function() {
                self.postMessage(e.data);
            }, e.data.time);
        };
    `;
    const workerBlob = new Blob([workerCode], { type: 'text/javascript' });
    const timerWorker = new Worker(URL.createObjectURL(workerBlob));

    function smartSleep(ms) {
        return new Promise(resolve => {
            const id = Math.random();
            const listener = (e) => {
                if (e.data.id === id) {
                    timerWorker.removeEventListener('message', listener);
                    resolve();
                }
            };
            timerWorker.addEventListener('message', listener);
            timerWorker.postMessage({ id: id, time: ms });
        });
    }

    function createWorkerTimer(callback, interval) {
        const blob = new Blob([`setInterval(() => postMessage('tick'), ${interval});`], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = callback;
    }

    if (isMainWindow) {
        GM_setValue('isAutoCloseAllActive', false);
        GM_setValue('isRunningAutoTransfer', false);
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'tm-helper-panel';
        panel.style = `
            position: fixed; top: 10px; right: 10px; z-index: 999999;
            font-family: sans-serif; font-size: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-radius: 8px;
            width: 200px; transition: all 0.3s ease;
        `;
        
        const isEnabled1 = GM_getValue('isEnabled1', false);
        const isEnabled2 = GM_getValue('isEnabled2', false);
        const isEnabled3 = GM_getValue('isEnabled3', false);
        const phantomTabActive = GM_getValue('phantomTabActive', true);
        const isRunningAutoTransfer = GM_getValue('isRunningAutoTransfer', false);

        panel.innerHTML = `
            <div id="tm-helper-header" style="background: #474747; color: white; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; text-align: center; user-select: none;">
                Live Chat Helper ▾
            </div>
            <div id="tm-helper-content" style="display: none; background: #2c2c2c; color: white; padding: 10px; border-radius: 0 0 8px 8px;">
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_sync1" ${isEnabled1 ? 'checked' : ''}> Авто-супервайз</label>
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_sync2" ${isEnabled2 ? 'checked' : ''}> Закрывать операторов</label>
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_sync3" ${isEnabled3 ? 'checked' : ''}> Закрывать неактивные</label>
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_phantomTab" ${phantomTabActive ? 'checked' : ''}> Фантомный Traffic</label>
                <hr style="border: 0; border-top: 1px solid #444; margin: 8px 0;">
                
                <button id="btn_autoTransfer" style="width:100%; margin-bottom:5px; cursor: pointer; padding: 6px; background: ${isRunningAutoTransfer ? '#4CAF50' : '#5a5a5a'}; color: white; border: none; border-radius: 4px; transition: 0.2s;">Авто перевод: ${isRunningAutoTransfer ? 'ВКЛ' : 'ВЫКЛ'}</button>
                <button id="btn_checkBot" style="width:100%; margin-bottom:5px; cursor: pointer; padding: 6px; background: #5a5a5a; color: white; border: none; border-radius: 4px; transition: 0.2s;">Проверка бота: ВЫКЛ</button>
                <button id="btn_closeAll" style="width:100%; cursor: pointer; padding: 6px; background: #d9534f; color: white; border: none; border-radius: 4px; transition: 0.2s; font-weight: bold;">Закрытие всех: ВЫКЛ</button>
            </div>
        `;

        document.body.appendChild(panel);

        let isExpanded = false;
        const header = document.getElementById('tm-helper-header');
        const content = document.getElementById('tm-helper-content');

        header.onclick = () => {
            isExpanded = !isExpanded;
            content.style.display = isExpanded ? 'block' : 'none';
            header.innerText = isExpanded ? 'Live Chat Helper ▴' : 'Live Chat Helper ▾';
            header.style.borderRadius = isExpanded ? '8px 8px 0 0' : '8px';
            header.style.background = isExpanded ? '#333' : '#474747';
        };

        document.getElementById('tm_sync1').onchange = (e) => GM_setValue('isEnabled1', e.target.checked);
        document.getElementById('tm_sync2').onchange = (e) => GM_setValue('isEnabled2', e.target.checked);
        document.getElementById('tm_sync3').onchange = (e) => GM_setValue('isEnabled3', e.target.checked);
        document.getElementById('tm_phantomTab').onchange = (e) => GM_setValue('phantomTabActive', e.target.checked);

        document.getElementById('btn_autoTransfer').onclick = function() {
            let newState = !GM_getValue('isRunningAutoTransfer', false);
            GM_setValue('isRunningAutoTransfer', newState);
            this.innerText = newState ? 'Авто перевод: ВКЛ' : 'Авто перевод: ВЫКЛ';
            this.style.background = newState ? '#4CAF50' : '#5a5a5a';
        };

        let isCheckActive = false;
        document.getElementById('btn_checkBot').onclick = function() {
            isCheckActive = !isCheckActive;
            this.innerText = isCheckActive ? 'Проверка бота: ВКЛ' : 'Проверка бота: ВЫКЛ';
            this.style.background = isCheckActive ? '#4CAF50' : '#5a5a5a';
        };

        document.getElementById('btn_closeAll').onclick = function() {
            let newState = !GM_getValue('isAutoCloseAllActive', false);
            GM_setValue('isAutoCloseAllActive', newState);
            this.innerText = newState ? 'Закрытие всех: ВКЛ' : 'Закрытие всех: ВЫКЛ';
            this.style.background = newState ? '#c9302c' : '#d9534f';
        };
    }

    function managePhantomWindow() {
        const isActive = GM_getValue('phantomTabActive', true);

        if (isActive) {
            const hb = parseInt(localStorage.getItem('lch_phantom_heartbeat') || '0', 10);
            const isAlive = (Date.now() - hb) < 8000;

            if (!isAlive) {
                localStorage.removeItem('lch_phantom_command');
                const phantom = window.open('https://my.livechatinc.com/engage/traffic', 'lch_phantom', 'width=300,height=300,left=9999,top=9999,menubar=no,toolbar=no,location=no,status=no');

                if (!phantom) {
                    if (!GM_getValue('popupAlertShown', false)) {
                        alert('[Live Chat Helper]\n\nБраузер заблокировал фоновое окно!\nПожалуйста, РАЗРЕШИТЕ ВСПЛЫВАЮЩИЕ ОКНА (Pop-ups) для этого сайта в правой части адресной строки.');
                        GM_setValue('popupAlertShown', true);
                    }
                    GM_setValue('phantomTabActive', false);
                    const cb = document.getElementById('tm_phantomTab');
                    if (cb) cb.checked = false;
                } else {
                    localStorage.setItem('lch_phantom_heartbeat', Date.now().toString());
                }
            }
        } else {
            localStorage.setItem('lch_phantom_command', 'close');
        }
    }

    function keepBotTabActive() {
        if (!window.location.href.includes('/engage/traffic')) {
            window.location.href = 'https://my.livechatinc.com/engage/traffic';
            return;
        }

        const tabs = document.querySelectorAll('button[class*="lc-Tab-module__tab"]');
        for (let tab of tabs) {
            let isTargetTab = false;
            const spans = tab.querySelectorAll('span');
            
            for (let i = 0; i < spans.length; i++) {
                if (spans[i].textContent.replace(/\u00a0/g, '').trim().toLowerCase() === 'bots') {
                    isTargetTab = true;
                    break;
                }
            }

            if (isTargetTab && tab.getAttribute('aria-selected') !== 'true') {
                const span = tab.querySelector('span');
                if (span) {
                    span.click();
                    span.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                }
                tab.click();
                tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                break;
            }
        }
    }

    function clickSuperviseChatButtons() {
        if (!GM_getValue('isEnabled1', false)) return;
        const buttons = document.querySelectorAll('button[class*="lc-Button-module__btn"]');
        buttons.forEach(btn => {
            if (btn.textContent.trim() === 'Supervise chat' && !btn.hasAttribute('data-tm-clicked')) {
                btn.setAttribute('data-tm-clicked', 'true');
                btn.click();
            }
        });
    }

    async function closeSingleChat(chatElement) {
        const chatId = chatElement.getAttribute('data-testid');
        if (!chatId || processingChats.has(chatId)) return; 

        processingChats.add(chatId); 

        try {
            const closeButton = chatElement.querySelector('button[data-testid="list-close-chat-button"]');
            if (closeButton) {
                closeButton.click(); 
                
                let trueStopButton = null;
                for (let i = 0; i < 15; i++) {
                    await sleep(200); 
                    const candidates = document.querySelectorAll('[data-testid="stop-supervise"]');
                    for (let candidate of candidates) {
                        if (candidate.tagName === 'BUTTON' && candidate.textContent.includes('Stop supervising')) {
                            trueStopButton = candidate;
                            break;
                        }
                    }
                    if (trueStopButton) break; 
                }

                if (trueStopButton) {
                    trueStopButton.click();
                    await sleep(400); 
                }
            }
        } finally {
            setTimeout(() => processingChats.delete(chatId), 3000);
        }
    }

    async function processSingleCloses(chatBlocks) {
        for (let chat of chatBlocks) {
            let needsClose = false;
            
            if (GM_getValue('isEnabled2', false)) {
                const nameElement = chat.querySelector('[data-testid="visitor-name"]');
                if (nameElement) {
                    const visitorName = nameElement.textContent.trim();
                    if (!REQUIRED_NAMES.some(name => visitorName.includes(name))) {
                        needsClose = true;
                    }
                }
            }
            
            if (!needsClose && GM_getValue('isEnabled3', false)) {
                const lastMessageEl = chat.querySelector('[data-testid="last-message-text"]');
                if (lastMessageEl && lastMessageEl.textContent.includes('Archived')) {
                    needsClose = true;
                }
            }

            if (needsClose) {
                await closeSingleChat(chat);
            }
        }
    }

    async function processAutoCloseAll(chatBlocks) {
        if (chatBlocks.length === 0) return;

        chatBlocks.forEach((chat, index) => {
            setTimeout(() => {
                const closeButton = chat.querySelector('button[data-testid="list-close-chat-button"]');
                if (closeButton) closeButton.click();
            }, index * 50); 
        });

        const maxWaitTime = 4000 + (chatBlocks.length * 100); 
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime && GM_getValue('isAutoCloseAllActive', false)) {
            const stopButtons = document.querySelectorAll('[data-testid="stop-supervise"]');
            stopButtons.forEach(btn => {
                if (btn.tagName === 'BUTTON' && btn.textContent.includes('Stop supervising')) {
                    btn.click();
                }
            });
            await sleep(200); 
        }
    }

    async function executeSmartTransfer() {
        const menuBtn = document.querySelector('[data-testid="chat-menu-trigger-button"]');
        if (!menuBtn) return false;
        menuBtn.click();
        await sleep(300);

        const takeOverBtn = document.querySelector('[data-testid="takeover-chat"]');
        if (takeOverBtn) {
            takeOverBtn.click();
            await sleep(500);
            const menuBtn2 = document.querySelector('[data-testid="chat-menu-trigger-button"]');
            if (menuBtn2) menuBtn2.click();
            await sleep(300);
        }

        let transferToBtn = null;
        const menuItems = document.querySelectorAll('[role="menuitem"]');
        for (let item of menuItems) {
            if (item.textContent.includes('Transfer to ...')) {
                transferToBtn = item;
                break;
            }
        }

        if (!transferToBtn) return false;
        transferToBtn.click();
        await sleep(500);

        const agentTabBtn = document.querySelector('[data-testid="tab-to-select-agent"]');
        if (agentTabBtn && agentTabBtn.getAttribute('aria-selected') !== 'true') {
            agentTabBtn.click();
            await sleep(400); 
        }

        const agents = document.querySelectorAll('[data-testid="agent-transfer-list-item"]');
        let bestAgent = null;
        let minChats = Infinity;

        agents.forEach(agent => {
            const isOnline = agent.querySelector('.lc-Avatar-module__avatar__status--available___e8YYH');
            if (!isOnline) return;

            const nameEl = agent.querySelector('[data-testid="agent-name"]');
            if (!nameEl) return;
            const name = nameEl.textContent.trim();

            if (REQUIRED_NAMES.some(botName => name.includes(botName))) return;

            let chatCount = 0;
            const countEl = agent.querySelector('[data-testid="active-chats-count"]');
            const noChatsEl = agent.querySelector('[data-testid="no-active-chats"]');

            if (countEl) {
                const match = countEl.textContent.match(/\d+/);
                if (match) chatCount = parseInt(match[0], 10);
            } else if (!noChatsEl) {
                return;
            }

            if (chatCount < minChats) {
                minChats = chatCount;
                bestAgent = agent;
            }
        });

        if (bestAgent) {
            bestAgent.click();
            await sleep(300);
            const confirmBtn = document.querySelector('[data-testid="transfer-button"]');
            if (confirmBtn) {
                confirmBtn.click();
                return true;
            }
        }
        return false;
    }

    async function processAutoTransfer(chatBlocks) {
        let targetChat = null;
        let targetChatId = null;

        for (let chat of chatBlocks) {
            const nameElement = chat.querySelector('[data-testid="visitor-name"]');
            if (nameElement) {
                const visitorName = nameElement.textContent.trim();
                if (REQUIRED_NAMES.some(name => visitorName.includes(name))) {
                    const chatId = chat.getAttribute('data-testid');
                    if (!transferCooldown.has(chatId) || Date.now() - transferCooldown.get(chatId) > 10000) {
                        targetChat = chat;
                        targetChatId = chatId;
                        break;
                    }
                }
            }
        }

        if (targetChat) {
            transferCooldown.set(targetChatId, Date.now());
            targetChat.click();
            await sleep(800); 
            await executeSmartTransfer();
            await sleep(1500); 
        }
    }

    function injectTransferButton() {
        if (document.getElementById('tm-smart-transfer-btn')) return;

        const copyLinkBtn = document.querySelector('button[aria-label="Copy chat link"]');
        if (!copyLinkBtn) return;

        const container = copyLinkBtn.closest('.css-1rek9ee');
        if (!container) return;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'css-1rek9ee';
        btnContainer.id = 'tm-smart-transfer-btn';
        btnContainer.style.marginLeft = '8px';

        const btn = document.createElement('button');
        btn.className = copyLinkBtn.className;
        btn.type = 'button';
        btn.innerHTML = '<span class="lc-Button-module__btn__icon___-CG5y lc-Button-module__btn__icon--left___Xke3Q lc-Icon-module__icon___J5RH5 lc-Icon-module__icon--primary___lclud" style="color:#4CAF50;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg></span>';

        btn.onclick = async () => {
            if (isProcessingAction) return;
            isProcessingAction = true;
            btn.disabled = true;
            btn.style.opacity = '0.5';
            await executeSmartTransfer();
            btn.disabled = false;
            btn.style.opacity = '1';
            isProcessingAction = false;
        };

        btnContainer.appendChild(btn);
        container.parentNode.insertBefore(btnContainer, container.nextSibling);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (isPhantomWindow) {
            try { window.resizeTo(300, 300); window.moveTo(9999, 9999); } catch(e) {}
            
            createWorkerTimer(async () => {
                localStorage.setItem('lch_phantom_heartbeat', Date.now().toString());

                if (localStorage.getItem('lch_phantom_command') === 'close') {
                    localStorage.removeItem('lch_phantom_command');
                    window.close();
                    return;
                }

                window.dispatchEvent(new Event('focus'));
                keepBotTabActive();
                clickSuperviseChatButtons();
            }, 1500);

        } else if (isMainWindow) {
            createUI();

            createWorkerTimer(async () => {
                managePhantomWindow();

                if (isProcessingAction) return;

                clickSuperviseChatButtons();
                injectTransferButton();

                const chatBlocks = document.querySelectorAll('[data-testid="supervised-chats"] li[data-testid^="chat-item"]');

                if (GM_getValue('isAutoCloseAllActive', false)) {
                    isProcessingAction = true;
                    await processAutoCloseAll(chatBlocks);
                    isProcessingAction = false;
                    return;
                }

                if (GM_getValue('isRunningAutoTransfer', false)) {
                    isProcessingAction = true;
                    await processAutoTransfer(chatBlocks);
                    isProcessingAction = false;
                    return;
                }

                isProcessingAction = true;
                await processSingleCloses(chatBlocks);
                isProcessingAction = false;
            }, 1200);
        }
    });

})();
