// ==UserScript==
// @name         Live Chat Helper
// @namespace    http://tampermonkey.net/
// @version      2.4
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

    Object.defineProperty(document, 'hidden', {value: false, writable: false});
    Object.defineProperty(document, 'visibilityState', {value: 'visible', writable: false});
    window.addEventListener('visibilitychange', e => e.stopPropagation(), true);

    const REQUIRED_NAMES = ["AI", "Robbie", "Florian", "Hector", "Jasper", "Jamie", "Enzo", "Nicholas", "Atom", "Motor"];
    const isTopWindow = (window.top === window.self);
    const processingChats = new Set();
    const transferCooldown = new Map();

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

    if (isTopWindow) {
        GM_setValue('isAutoCloseAllActive', false);
        GM_setValue('isRunningAutoTransfer', false);
    }

    if (!isTopWindow) {
        async function focusLoop() {
            while (true) {
                window.dispatchEvent(new Event('focus'));
                await smartSleep(10000);
            }
        }
        focusLoop();
    }

    function createUI() {
        if (!isTopWindow) return;

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
        const phantomTabActive = GM_getValue('phantomTabActive', true);
        const isRunningAutoTransfer = GM_getValue('isRunningAutoTransfer', false);

        panel.innerHTML = `
            <div id="tm-helper-header" style="background: #474747; color: white; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; text-align: center; user-select: none;">
                Live Chat Helper ▾
            </div>
            <div id="tm-helper-content" style="display: none; background: #2c2c2c; color: white; padding: 10px; border-radius: 0 0 8px 8px;">
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_sync1" ${isEnabled1 ? 'checked' : ''}> Авто-супервайз</label>
                <label style="cursor: pointer; display: block; margin-bottom: 5px;"><input type="checkbox" id="tm_sync2" ${isEnabled2 ? 'checked' : ''}> Закрывать операторов</label>
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

        document.getElementById('tm_sync1').onchange = (e) => {
            GM_setValue('isEnabled1', e.target.checked);
        };

        document.getElementById('tm_sync2').onchange = (e) => {
            GM_setValue('isEnabled2', e.target.checked);
        };

        document.getElementById('tm_phantomTab').onchange = (e) => {
            GM_setValue('phantomTabActive', e.target.checked);
            managePhantomIframe();
        };

        document.getElementById('btn_autoTransfer').onclick = function() {
            let currentState = GM_getValue('isRunningAutoTransfer', false);
            let newState = !currentState;
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
            let currentState = GM_getValue('isAutoCloseAllActive', false);
            let newState = !currentState;
            GM_setValue('isAutoCloseAllActive', newState);
            this.innerText = newState ? 'Закрытие всех: ВКЛ' : 'Закрытие всех: ВЫКЛ';
            this.style.background = newState ? '#c9302c' : '#d9534f';
        };
    }

    function managePhantomIframe() {
        if (!isTopWindow) return;
        const iframeId = 'tm-phantom-traffic';
        let iframe = document.getElementById(iframeId);
        const isActive = GM_getValue('phantomTabActive', true);

        if (isActive) {
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = iframeId;
                iframe.src = 'https://my.livechatinc.com/engage/traffic';
                iframe.style.position = 'fixed';
                iframe.style.top = '0';
                iframe.style.left = '0';
                iframe.style.width = '2500px';
                iframe.style.height = '2500px';
                iframe.style.transform = 'translate(-2499px, -2499px)';
                iframe.style.opacity = '1';
                iframe.style.pointerEvents = 'none';
                iframe.style.zIndex = '999998';
                iframe.style.contain = 'strict';
                document.body.appendChild(iframe);
            }
        } else {
            if (iframe) iframe.remove();
        }
    }

    function keepBotTabActive() {
        if (!GM_getValue('phantomTabActive', true)) return;
        if (!window.location.href.includes('/engage/traffic')) return;

        const tabs = document.querySelectorAll('button[class*="lc-Tab-module__tab"]');
        for (let tab of tabs) {
            let isTargetTab = false;
            const spans = tab.querySelectorAll('span');
            
            for (let i = 0; i < spans.length; i++) {
                const cleanText = spans[i].textContent.replace(/\u00a0/g, '').trim().toLowerCase();
                if (cleanText === 'bots') {
                    isTargetTab = true;
                    break;
                }
            }

            if (isTargetTab) {
                if (tab.getAttribute('aria-selected') !== 'true') {
                    const span = tab.querySelector('span');
                    if (span) {
                        span.click();
                        span.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    }
                    tab.click();
                    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                }
                break;
            }
        }
    }

    async function keepBotTabActiveLoop() {
        while (true) {
            keepBotTabActive();
            await smartSleep(3000);
        }
    }

    function clickSuperviseChatButtons() {
        if (!GM_getValue('isEnabled1', false)) return;
        const buttons = document.querySelectorAll('button[class*="lc-Button-module__btn"]');
        buttons.forEach(btn => {
            if (btn.textContent.trim() === 'Supervise chat') {
                if (!btn.hasAttribute('data-tm-clicked')) {
                    btn.setAttribute('data-tm-clicked', 'true');
                    btn.click();
                }
            }
        });
    }

    function checkChatNames() {
        if (!GM_getValue('isEnabled2', false) || GM_getValue('isAutoCloseAllActive', false)) return;
        const chatBlocks = document.querySelectorAll('[data-testid="supervised-chats"] li[data-testid^="chat-item"]'); 
        
        chatBlocks.forEach(chat => {
            const nameElement = chat.querySelector('[data-testid="visitor-name"]');
            if (nameElement) {
                const visitorName = nameElement.textContent.trim();
                if (!REQUIRED_NAMES.some(name => visitorName.includes(name))) {
                    closeSingleChat(chat);
                }
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
                    await smartSleep(200); 
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
                    await smartSleep(500); 
                }
            }
        } finally {
            smartSleep(3000).then(() => processingChats.delete(chatId));
        }
    }

    async function autoCloseAllLoop() {
        while (true) {
            if (GM_getValue('isAutoCloseAllActive', false)) {
                const chatBlocks = document.querySelectorAll('[data-testid="supervised-chats"] li[data-testid^="chat-item"]');
                
                if (chatBlocks.length > 0) {
                    chatBlocks.forEach((chat, index) => {
                        smartSleep(index * 50).then(() => {
                            const closeButton = chat.querySelector('button[data-testid="list-close-chat-button"]');
                            if (closeButton) {
                                closeButton.click();
                            }
                        });
                    });

                    const maxWaitTime = 5000 + (chatBlocks.length * 100); 
                    const startTime = Date.now();

                    while (Date.now() - startTime < maxWaitTime && GM_getValue('isAutoCloseAllActive', false)) {
                        const stopButtons = document.querySelectorAll('[data-testid="stop-supervise"]');
                        stopButtons.forEach(btn => {
                            if (btn.tagName === 'BUTTON' && btn.textContent.includes('Stop supervising')) {
                                btn.click();
                            }
                        });
                        await smartSleep(200); 
                    }
                } else {
                    await smartSleep(1000);
                }
            } else {
                await smartSleep(1000);
            }
        }
    }

    async function executeSmartTransfer() {
        const menuBtn = document.querySelector('[data-testid="chat-menu-trigger-button"]');
        if (!menuBtn) return false;
        menuBtn.click();
        await smartSleep(400);

        const takeOverBtn = document.querySelector('[data-testid="takeover-chat"]');
        if (takeOverBtn) {
            takeOverBtn.click();
            await smartSleep(600);
            const menuBtn2 = document.querySelector('[data-testid="chat-menu-trigger-button"]');
            if (menuBtn2) menuBtn2.click();
            await smartSleep(400);
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
        await smartSleep(600);

        const agentTabBtn = document.querySelector('[data-testid="tab-to-select-agent"]');
        if (agentTabBtn) {
            if (agentTabBtn.getAttribute('aria-selected') !== 'true') {
                agentTabBtn.click();
                await smartSleep(500); 
            } else {
                await smartSleep(200);
            }
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
            await smartSleep(400);
            const confirmBtn = document.querySelector('[data-testid="transfer-button"]');
            if (confirmBtn) {
                confirmBtn.click();
                return true;
            }
        }
        return false;
    }

    async function autoTransferLoop() {
        while (true) {
            if (GM_getValue('isRunningAutoTransfer', false)) {
                const chatBlocks = document.querySelectorAll('[data-testid="supervised-chats"] li[data-testid^="chat-item"]');
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
                    await smartSleep(1000); 
                    
                    await executeSmartTransfer();
                    await smartSleep(2000); 
                } else {
                    await smartSleep(2000);
                }
            } else {
                await smartSleep(1000);
            }
        }
    }

    function injectTransferButton() {
        if (!isTopWindow) return;
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
            btn.disabled = true;
            btn.style.opacity = '0.5';
            await executeSmartTransfer();
            btn.disabled = false;
            btn.style.opacity = '1';
        };

        btnContainer.appendChild(btn);
        container.parentNode.insertBefore(btnContainer, container.nextSibling);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (isTopWindow) {
            createUI();
            managePhantomIframe();
        }

        let observerIsRunning = false;
        const observer = new MutationObserver(async () => {
            if (observerIsRunning) return;
            observerIsRunning = true;
            
            clickSuperviseChatButtons();
            checkChatNames();
            injectTransferButton();
            
            await smartSleep(800); 
            observerIsRunning = false;
        });
        observer.observe(document.body, { childList: true, subtree: true });

        keepBotTabActiveLoop();
        autoCloseAllLoop();
        autoTransferLoop();
    });

})();
