// ==UserScript==
// @name         AutoGreeter
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  Авто приветствие. 
// @author       Calvin
// @match        https://sparkmoth.com/app/*
// @match        https://blueripple.xyz/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=sparkmoth.com
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/AutoGreeter.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/AutoGreeter.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 1. УТИЛИТЫ ДЛЯ SHADOW DOM И DOM
    // ==========================================
    const deepQuerySelectorAll = (selector, root = document) => {
        const elements = Array.from(root.querySelectorAll(selector));
        const walk = (node) => {
            if (node.shadowRoot) {
                elements.push(...node.shadowRoot.querySelectorAll(selector));
                walk(node.shadowRoot);
            }
            Array.from(node.children).forEach(walk);
        };
        walk(root);
        return elements;
    };

    const deepQuerySelector = (selector, root = document) => {
        let el = root.querySelector(selector);
        if (el) return el;

        let result = null;
        const walk = (node) => {
            if (result) return;
            if (node.shadowRoot) {
                result = node.shadowRoot.querySelector(selector);
                if (result) return;
                walk(node.shadowRoot);
            }
            Array.from(node.children).forEach(walk);
        };
        walk(root);
        return result;
    };

    const createElement = (tag, styles = {}, props = {}) => {
        const el = document.createElement(tag);
        Object.assign(el.style, styles);
        Object.assign(el, props);
        return el;
    };

    // ==========================================
    // 2. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКИ
    // ==========================================
    const CONFIG_KEY = 'autoGreeterConfig_v1';
    const PROCESSED_SESSION_KEY = 'ag_processed_chats_v1';
    const bc = new BroadcastChannel('ag_sync_channel');

    const isPhantom = new URLSearchParams(window.location.search).get('ag_phantom') === '1' || window.self !== window.top;
    let lastPhantomHeartbeat = Date.now();

    const defaultConfig = {
        delay: 15,
        greetings: {
            "sparkmoth.com": " ",
            "blueripple.xyz": " "
        }
    };

    let config = JSON.parse(localStorage.getItem(CONFIG_KEY)) ?? defaultConfig;
    if (!config?.greetings) {
        config = defaultConfig;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    const domain = window.location.hostname;
    let greetingText = config.greetings[domain] ?? "";
    let autoGreetDelay = (config.delay ?? 15) * 1000;
    let isProcessing = false;

    // Хранилище обработанных чатов в sessionStorage (переживает перезагрузку страницы)
    const loadProcessedChats = () => {
        try {
            return new Set(JSON.parse(sessionStorage.getItem(PROCESSED_SESSION_KEY) || '[]'));
        } catch (e) {
            return new Set();
        }
    };

    const processedChats = loadProcessedChats();

    const saveProcessedChats = () => {
        sessionStorage.setItem(PROCESSED_SESSION_KEY, JSON.stringify(Array.from(processedChats)));
    };

    const markProcessed = (key) => {
        processedChats.add(key);
        saveProcessedChats();
    };

    const unmarkProcessed = (key) => {
        processedChats.delete(key);
        saveProcessedChats();
    };

    const autoTimers = new Map();
    const chatLastSeen = new Map();

    // ==========================================
    // 3. ФАНТОМНЫЙ РЕЖИМ (БЕЗЗВУЧНЫЙ IFRAME)
    // ==========================================
    if (isPhantom) {
        const muteScript = document.createElement('script');
        muteScript.textContent = `
            try {
                const noop = () => Promise.resolve();
                window.AudioContext = function() { return { createOscillator: () => ({ start: noop, stop: noop, connect: noop }), destination: {} }; };
                window.webkitAudioContext = window.AudioContext;
                if (window.HTMLMediaElement) {
                    window.HTMLMediaElement.prototype.play = noop;
                    Object.defineProperty(window.HTMLMediaElement.prototype, 'muted', { get: () => true, set: () => {} });
                    Object.defineProperty(window.HTMLMediaElement.prototype, 'volume', { get: () => 0, set: () => {} });
                }
            } catch(e) {}
        `;
        document.documentElement.appendChild(muteScript);
        muteScript.remove();

        setInterval(() => bc.postMessage({ type: 'HEARTBEAT' }), 1000);
    } else {
        setInterval(() => {
            if (Date.now() - lastPhantomHeartbeat > 4000) {
                let iframe = document.getElementById('ag-phantom-frame');
                if (!iframe) {
                    const phantomUrl = new URL(window.location.href);
                    phantomUrl.searchParams.set('ag_phantom', '1');

                    iframe = createElement('iframe', {
                        position: 'fixed', top: '-9999px', left: '-9999px',
                        width: '1280px', height: '800px', opacity: '0',
                        pointerEvents: 'none', border: 'none', zIndex: '-9999'
                    }, {
                        id: 'ag-phantom-frame',
                        src: phantomUrl.toString(),
                        allow: "autoplay 'none'; microphone 'none';"
                    });
                    document.body.appendChild(iframe);
                }
                lastPhantomHeartbeat = Date.now();
            }
        }, 2000);
    }

    bc.onmessage = (e) => {
        if (!e.data) return;
        switch (e.data.type) {
            case 'HEARTBEAT':
                lastPhantomHeartbeat = Date.now();
                break;
            case 'CANCEL_ALL':
                localCancelAll(false);
                break;
            case 'SETTINGS_UPDATED':
                config = e.data.config;
                greetingText = config.greetings[domain] ?? "";
                autoGreetDelay = config.delay * 1000;
                break;
            case 'MARK_DONE':
                markProcessed(e.data.chatKey);
                autoTimers.delete(e.data.chatKey);
                removeWrapper(e.data.chatKey);
                break;
        }
    };

    const removeWrapper = (chatKey) => {
        deepQuerySelectorAll('.quick-greet-wrapper').forEach(w => {
            if (w.dataset.targetChat === chatKey) w.remove();
        });
    };

    // ==========================================
    // 4. ИНТЕРФЕЙС НАСТРОЕК
    // ==========================================
    const showToast = (message) => {
        if (isPhantom) return;
        const toast = createElement('div', {
            position: 'fixed', bottom: '24px', right: '24px', background: '#10b981',
            color: 'white', padding: '12px 24px', borderRadius: '8px', fontFamily: 'sans-serif',
            fontSize: '14px', fontWeight: '500', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            zIndex: '1000000', opacity: '0', transform: 'translateY(10px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease'
        }, { innerText: message });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    };

    const saveConfig = (newDelay, newSparkmothText, newBluerippleText) => {
        config.delay = Math.max(1, Math.min(30, parseInt(newDelay, 10) || 15));
        config.greetings["sparkmoth.com"] = newSparkmothText;
        config.greetings["blueripple.xyz"] = newBluerippleText;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

        greetingText = config.greetings[domain] ?? "";
        autoGreetDelay = config.delay * 1000;

        bc.postMessage({ type: 'SETTINGS_UPDATED', config });

        closeSettingsModal();
        showToast('✅ Настройки успешно сохранены (синхронизировано)!');
    };

    const openSettingsModal = () => {
        if (document.getElementById('ag-settings-modal')) return;

        const modalOverlay = createElement('div', {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
            zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }, { id: 'ag-settings-modal' });

        const modalBox = createElement('div', {
            background: '#1e293b', width: '400px', borderRadius: '12px', padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', fontFamily: 'sans-serif',
            color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '16px',
            border: '1px solid #334155'
        });

        modalBox.innerHTML = `
            <h2 style="margin: 0; font-size: 18px; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 12px;">⚙️ Настройки бота</h2>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Задержка авто-отправки (сек):</label>
                <input type="number" id="ag-delay-input" min="1" max="30" value="${config.delay}"
                    style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; background: #0f172a; color: #f8fafc; outline: none;">
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Приветствие (sparkmoth.com):</label>
                <textarea id="ag-sparkmoth-input" rows="3" style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; resize: none; background: #0f172a; color: #f8fafc; outline: none;">${config.greetings["sparkmoth.com"] ?? ""}</textarea>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Приветствие (blueripple.xyz):</label>
                <textarea id="ag-blueripple-input" rows="3" style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; resize: none; background: #0f172a; color: #f8fafc; outline: none;">${config.greetings["blueripple.xyz"] ?? ""}</textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                <button id="ag-cancel-btn" style="padding: 8px 16px; border: none; background: #334155; color: #f8fafc; border-radius: 6px; cursor: pointer; font-weight: 500;">Отмена</button>
                <button id="ag-save-btn" style="padding: 8px 16px; border: none; background: #10b981; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;">Сохранить</button>
            </div>
        `;

        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        deepQuerySelector('#ag-cancel-btn', modalOverlay).addEventListener('click', closeSettingsModal);
        deepQuerySelector('#ag-save-btn', modalOverlay).addEventListener('click', () => saveConfig(
            deepQuerySelector('#ag-delay-input', modalOverlay).value,
            deepQuerySelector('#ag-sparkmoth-input', modalOverlay).value,
            deepQuerySelector('#ag-blueripple-input', modalOverlay).value
        ));
    };

    const closeSettingsModal = () => document.getElementById('ag-settings-modal')?.remove();

    const localCancelAll = (broadcast = true) => {
        autoTimers.clear();
        deepQuerySelectorAll('div.conversation').forEach(conv => {
            const chatKey = getChatKey(conv);
            if (chatKey) {
                markProcessed(chatKey);
                removeWrapper(chatKey);
            }
        });
        isProcessing = false;
        showToast('🛑 Все текущие автоприветствия отменены!');
        if (broadcast) bc.postMessage({ type: 'CANCEL_ALL' });
    };

    const injectSidebarButtons = () => {
        if (isPhantom || document.getElementById('ag-sidebar-controls')) return;

        const sidebarBottomSection = deepQuerySelector('aside > section:last-of-type');
        if (!sidebarBottomSection) return;

        const controlsWrapper = createElement('div', {
            padding: '8px', width: '100%', flexShrink: '0', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: '50'
        }, { id: 'ag-sidebar-controls' });

        const btnStyle = {
            width: '100%', padding: '6px 12px', borderRadius: '8px', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: '6px'
        };

        const cancelBtn = createElement('button', {
            ...btnStyle, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)'
        }, { innerHTML: '🛑 Отменить приветствия', onclick: () => localCancelAll(true) });

        const settingsBtn = createElement('button', {
            ...btnStyle, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)'
        }, { innerHTML: '🤖 Настроить бота', onclick: openSettingsModal });

        controlsWrapper.append(cancelBtn, settingsBtn);
        sidebarBottomSection.before(controlsWrapper);
    };

    // ==========================================
    // 5. ОСНОВНАЯ ЛОГИКА
    // ==========================================
    const getChatKey = (conv) => {
        const nameEl = conv.querySelector('.conversation--user') ?? conv.shadowRoot?.querySelector('.conversation--user');
        if (!nameEl) return null;

        const userName = nameEl.childNodes[0]?.textContent.trim() ?? nameEl.innerText.trim();
        const avatarEl = conv.querySelector('[role="img"]') ?? conv.shadowRoot?.querySelector('[role="img"]');
        const avatarColor = avatarEl?.style.backgroundColor ?? 'no-color';
        const initialsEl = conv.querySelector('.select-none') ?? conv.shadowRoot?.querySelector('.select-none');
        const initials = initialsEl?.innerText.trim() ?? 'no-initials';

        return `${userName}_${initials}_${avatarColor}`;
    };

    const isAlreadyGreeted = () => {
        const messages = deepQuerySelectorAll('.message-bubble-container .prose-bubble p');
        const sparkText = config.greetings["sparkmoth.com"]?.trim().split(',')[0] ?? '';
        const blueText = config.greetings["blueripple.xyz"]?.trim().split(',')[0] ?? '';

        return messages.slice(-7).some(msg => {
            const text = msg.innerText;
            return (sparkText && text.includes(sparkText)) || (blueText && text.includes(blueText));
        });
    };

    const markAsDoneAndHide = (chatKey, wrapper, greetBtn, broadcast = true) => {
        markProcessed(chatKey);
        chatLastSeen.set(chatKey, Date.now());
        autoTimers.delete(chatKey);

        if (broadcast) bc.postMessage({ type: 'MARK_DONE', chatKey });

        if (!wrapper) {
            isProcessing = false;
            return;
        }

        if (greetBtn) {
            greetBtn.innerHTML = '✅';
            greetBtn.style.background = 'rgb(100, 116, 139)';
        }

        const dismissBtn = wrapper.querySelector('.dismiss-btn') ?? wrapper.shadowRoot?.querySelector('.dismiss-btn');
        if (dismissBtn) dismissBtn.style.display = 'none';

        setTimeout(() => {
            if (wrapper) wrapper.style.opacity = '0';
            setTimeout(() => {
                wrapper?.remove();
                isProcessing = false;
            }, 300);
        }, 800);
    };

    const processGreeting = (conv, chatKey, wrapper, greetBtn) => {
        if (!greetingText || isProcessing) return;
        isProcessing = true;

        const originalBtnText = greetBtn?.innerHTML ?? '👋';
        if (greetBtn) {
            greetBtn.innerHTML = '⏳';
            greetBtn.style.background = 'rgb(245, 158, 11)';
        }

        conv.click();
        let checkCount = 0;

        const checkInterval = setInterval(() => {
            checkCount++;
            const editor = deepQuerySelector('.ProseMirror');
            const sendButton = deepQuerySelector('button[type="submit"]');

            if (editor && sendButton && conv.classList.contains('active')) {
                clearInterval(checkInterval);

                setTimeout(() => {
                    if (!conv.classList.contains('active')) {
                        isProcessing = false;
                        if (greetBtn) {
                            greetBtn.innerHTML = originalBtnText;
                            greetBtn.style.background = 'rgb(16, 185, 129)';
                        }
                        return;
                    }

                    if (isAlreadyGreeted()) {
                        markAsDoneAndHide(chatKey, wrapper, greetBtn);
                        return;
                    }

                    editor.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, greetingText);
                    editor.dispatchEvent(new Event('input', { bubbles: true }));

                    setTimeout(() => {
                        if (conv.classList.contains('active')) {
                            sendButton.disabled = false;
                            sendButton.click();
                            markAsDoneAndHide(chatKey, wrapper, greetBtn);
                        } else {
                            isProcessing = false;
                        }
                    }, 150);
                }, 500);

            } else if (checkCount > 30) {
                clearInterval(checkInterval);
                if (greetBtn) {
                    greetBtn.innerHTML = '❌';
                    greetBtn.style.background = 'rgb(239, 68, 68)';
                    setTimeout(() => {
                        greetBtn.innerHTML = originalBtnText;
                        greetBtn.style.background = 'rgb(16, 185, 129)';
                        isProcessing = false;
                    }, 2000);
                } else {
                    isProcessing = false;
                }
            }
        }, 100);
    };

    const renderButtons = () => {
        injectSidebarButtons();

        const conversations = deepQuerySelectorAll('div.conversation');
        const now = Date.now();
        const currentActiveKeys = new Set();
        const phantomAlive = (now - lastPhantomHeartbeat) < 5000;

        conversations.forEach(conv => {
            const chatKey = getChatKey(conv);
            if (!chatKey) return;

            currentActiveKeys.add(chatKey);
            chatLastSeen.set(chatKey, now);

            let wrapper = conv.querySelector('.quick-greet-wrapper') ?? conv.shadowRoot?.querySelector('.quick-greet-wrapper');
            const nameEl = conv.querySelector('.conversation--user') ?? conv.shadowRoot?.querySelector('.conversation--user');

            const isClosed = conv.closest('.resolved-in-open') || nameEl?.innerText.toLowerCase().includes('закрыт');

            if (isClosed) {
                autoTimers.delete(chatKey);
                unmarkProcessed(chatKey);
                chatLastSeen.delete(chatKey);
                wrapper?.remove();
                return;
            }

            if (processedChats.has(chatKey)) {
                wrapper?.remove();
                autoTimers.delete(chatKey);
                return;
            }

            if (wrapper && wrapper.dataset.targetChat !== chatKey) {
                wrapper.remove();
                wrapper = null;
            }

            let greetBtn = wrapper?.querySelector('.action-greet-btn');

            if (!wrapper) {
                wrapper = createElement('div', {
                    position: 'absolute', bottom: '12px', right: '12px', zIndex: '50',
                    display: 'flex', gap: '4px', alignItems: 'center', transition: 'opacity 0.3s ease'
                }, { className: 'quick-greet-wrapper' });
                wrapper.dataset.targetChat = chatKey;

                greetBtn = createElement('button', {
                    background: 'rgb(16, 185, 129)', color: 'white', border: 'none',
                    borderRadius: '6px', padding: '4px 8px', fontSize: '14px', cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center'
                }, { className: 'action-greet-btn', innerHTML: '👋', title: 'Поздороваться' });

                greetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    processGreeting(conv, chatKey, wrapper, greetBtn);
                });

                const dismissBtn = createElement('button', {
                    background: 'rgba(226, 232, 240, 0.9)', color: 'rgb(100, 116, 139)',
                    border: 'none', borderRadius: '6px', padding: '4px 6px', fontSize: '10px', cursor: 'pointer'
                }, { className: 'dismiss-btn', innerHTML: '✖', title: 'Скрыть' });

                dismissBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAsDoneAndHide(chatKey, wrapper, null, true);
                });

                wrapper.append(dismissBtn, greetBtn);
                conv.appendChild(wrapper);

                autoTimers.set(chatKey, now);
            }

            if (autoTimers.has(chatKey) && ((now - autoTimers.get(chatKey)) >= autoGreetDelay)) {
                if (isPhantom || !phantomAlive) {
                    if (!isProcessing) {
                        autoTimers.delete(chatKey);
                        if (wrapper && greetBtn) processGreeting(conv, chatKey, wrapper, greetBtn);
                    }
                }
            }
        });

        for (const [key, lastSeen] of chatLastSeen.entries()) {
            if (!currentActiveKeys.has(key) && (now - lastSeen > 15000)) {
                unmarkProcessed(key);
                chatLastSeen.delete(key);
                autoTimers.delete(key);
            }
        }
    };

    // ==========================================
    // 6. ЗАПУСК
    // ==========================================
    let observerTimer = null;
    new MutationObserver(() => {
        if (observerTimer) clearTimeout(observerTimer);
        observerTimer = setTimeout(renderButtons, 200);
    }).observe(document.body, { childList: true, subtree: true });

    setInterval(renderButtons, 1500);

})();
