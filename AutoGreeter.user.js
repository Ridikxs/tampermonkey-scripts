// ==UserScript==
// @name         AutoGreeter
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Авто приветствие.
// @author       Calvin
// @match        https://sparkmoth.com/app/*
// @match        https://blueripple.xyz/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=sparkmoth.com
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/AutoGreeter.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/AutoGreeter.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. СИСТЕМА НАСТРОЕК (LOCAL STORAGE)
    // ==========================================
    const CONFIG_KEY = 'autoGreeterConfig_v1';

    const defaultConfig = {
        delay: 15,
        greetings: {
            "sparkmoth.com": "Напиши тут...",
            "blueripple.xyz": "Напиши тут..."
        }
    };

    let config = JSON.parse(localStorage.getItem(CONFIG_KEY));
    if (!config || !config.greetings) {
        config = defaultConfig;
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }

    const domain = window.location.hostname;

    let greetingText = config.greetings[domain] || "";
    let autoGreetDelay = config.delay * 1000;

    let isProcessing = false;
    const processedUsers = new Set();
    const autoTimers = new Map();

    // ==========================================
    // 2. ИНТЕРФЕЙС НАСТРОЕК (GUI)
    // ==========================================

    // Красивое всплывающее уведомление вместо alert
    function showToast(message) {
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px;
            background: #10b981; color: white; padding: 12px 24px;
            border-radius: 8px; font-family: sans-serif; font-size: 14px; font-weight: 500;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            z-index: 100000; opacity: 0; transform: translateY(10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;
        document.body.appendChild(toast);

        // Анимация появления
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Анимация исчезновения через 2 секунды
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300); // Ждем конца CSS-анимации перед удалением из DOM
        }, 2000);
    }

    function saveConfig(newDelay, newSparkmothText, newBluerippleText) {
        config.delay = Math.max(1, Math.min(30, parseInt(newDelay) || 15));
        config.greetings["sparkmoth.com"] = newSparkmothText;
        config.greetings["blueripple.xyz"] = newBluerippleText;

        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

        greetingText = config.greetings[domain] || "";
        autoGreetDelay = config.delay * 1000;

        closeSettingsModal();
        showToast('✅ Настройки успешно сохранены!');
    }

    function openSettingsModal() {
        if (document.getElementById('ag-settings-modal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'ag-settings-modal';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
            z-index: 99999; display: flex; align-items: center; justify-content: center;
        `;

        const modalBox = document.createElement('div');
        // Форсированная темная тема
        modalBox.style.cssText = `
            background: #1e293b; width: 400px; border-radius: 12px; padding: 24px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); font-family: sans-serif;
            color: #f8fafc; display: flex; flex-direction: column; gap: 16px;
            border: 1px solid #334155;
        `;

        modalBox.innerHTML = `
            <h2 style="margin: 0; font-size: 18px; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 12px;">⚙️ Настройки бота</h2>

            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Задержка авто-отправки (сек):</label>
                <input type="number" id="ag-delay-input" min="1" max="30" value="${config.delay}"
                    style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; background: #0f172a; color: #f8fafc; outline: none;">
                <span style="font-size: 11px; color: #94a3b8;">Укажите значение от 1 до 30 секунд.</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Приветствие для SG:</label>
                <textarea id="ag-sparkmoth-input" rows="3" style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; resize: none; background: #0f172a; color: #f8fafc; outline: none;">${config.greetings["sparkmoth.com"]}</textarea>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 13px; font-weight: 600; color: #cbd5e1;">Приветствие для NC:</label>
                <textarea id="ag-blueripple-input" rows="3" style="padding: 8px; border: 1px solid #475569; border-radius: 6px; font-size: 14px; resize: none; background: #0f172a; color: #f8fafc; outline: none;">${config.greetings["blueripple.xyz"]}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                <button id="ag-cancel-btn" style="padding: 8px 16px; border: none; background: #334155; color: #f8fafc; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s;">Отмена</button>
                <button id="ag-save-btn" style="padding: 8px 16px; border: none; background: #10b981; color: white; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s;">Сохранить</button>
            </div>
        `;

        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        // Эффекты наведения для кнопок
        const cancelBtn = document.getElementById('ag-cancel-btn');
        const saveBtn = document.getElementById('ag-save-btn');

        cancelBtn.onmouseover = () => cancelBtn.style.background = '#475569';
        cancelBtn.onmouseout = () => cancelBtn.style.background = '#334155';

        saveBtn.onmouseover = () => saveBtn.style.background = '#059669';
        saveBtn.onmouseout = () => saveBtn.style.background = '#10b981';

        cancelBtn.onclick = closeSettingsModal;
        saveBtn.onclick = () => {
            saveConfig(
                document.getElementById('ag-delay-input').value,
                document.getElementById('ag-sparkmoth-input').value,
                document.getElementById('ag-blueripple-input').value
            );
        };
    }

    function closeSettingsModal() {
        const modal = document.getElementById('ag-settings-modal');
        if (modal) modal.remove();
    }

    function injectSettingsButton() {
        if (document.getElementById('ag-sidebar-btn')) return;

        const sidebarBottomSection = document.querySelector('aside > section:last-of-type');
        if (!sidebarBottomSection) return;

        const btnWrapper = document.createElement('div');
        btnWrapper.id = 'ag-sidebar-btn';
        btnWrapper.style.cssText = 'padding: 8px; width: 100%; flex-shrink: 0;';

        const btn = document.createElement('button');
        btn.innerHTML = '🤖 Настроить бота';
        btn.style.cssText = `
            width: 100%; padding: 6px 12px; background: rgba(16, 185, 129, 0.1);
            color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 8px; font-size: 13px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease;
            display: flex; align-items: center; justify-content: center; gap: 6px;
        `;

        btn.onmouseover = () => {
            btn.style.background = 'rgba(16, 185, 129, 0.2)';
            btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(16, 185, 129, 0.1)';
            btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        };

        btn.onclick = openSettingsModal;
        btnWrapper.appendChild(btn);
        sidebarBottomSection.parentNode.insertBefore(btnWrapper, sidebarBottomSection);
    }

    // ==========================================
    // 3. ОСНОВНАЯ ЛОГИКА АВТОПРИВЕТСТВИЯ
    // ==========================================
    function isAlreadyGreeted() {
        const messages = document.querySelectorAll('.message-bubble-container .prose-bubble p');
        const sparkText = config.greetings["sparkmoth.com"].trim().split(',')[0];
        const blueText = config.greetings["blueripple.xyz"].trim().split(',')[0];

        for (let msg of messages) {
            const text = msg.innerText;
            if ((sparkText && text.includes(sparkText)) || (blueText && text.includes(blueText))) {
                return true;
            }
        }
        return false;
    }

    function markAsDoneAndHide(userName, wrapper, greetBtn) {
        processedUsers.add(userName);

        if (autoTimers.has(userName)) {
            autoTimers.delete(userName);
        }

        if (!wrapper) {
            isProcessing = false;
            return;
        }

        if (greetBtn) {
            greetBtn.innerHTML = '✅';
            greetBtn.style.background = 'rgb(100, 116, 139)';
        }

        const dismissBtn = wrapper.querySelector('.dismiss-btn');
        if (dismissBtn) dismissBtn.style.display = 'none';

        setTimeout(() => {
            if (wrapper && wrapper.style) wrapper.style.opacity = '0';
            setTimeout(() => {
                if (wrapper && wrapper.parentNode) wrapper.remove();
                isProcessing = false;
            }, 300);
        }, 800);
    }

    function processGreeting(conv, userName, wrapper, greetBtn) {
        if (!greetingText) {
            console.warn("Приветствие не настроено для этого домена!");
            return;
        }

        if (isProcessing) return;
        isProcessing = true;

        const originalBtnText = greetBtn ? greetBtn.innerHTML : '👋';
        if (greetBtn) {
            greetBtn.innerHTML = '⏳';
            greetBtn.style.background = 'rgb(245, 158, 11)';
        }

        conv.click();

        let checkCount = 0;

        const checkInterval = setInterval(() => {
            checkCount++;

            const editor = document.querySelector('.ProseMirror');
            const sendButton = document.querySelector('button[type="submit"]');

            if (editor && sendButton && conv.classList.contains('active')) {
                clearInterval(checkInterval);

                setTimeout(() => {
                    if (isAlreadyGreeted()) {
                        markAsDoneAndHide(userName, wrapper, greetBtn);
                        return;
                    }

                    editor.focus();
                    document.execCommand('insertText', false, greetingText);
                    editor.dispatchEvent(new Event('input', { bubbles: true }));

                    setTimeout(() => {
                        sendButton.disabled = false;
                        sendButton.click();
                        markAsDoneAndHide(userName, wrapper, greetBtn);
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
    }

    function renderButtons() {
        injectSettingsButton();

        const conversations = document.querySelectorAll('div.conversation');
        const now = Date.now();

        conversations.forEach(conv => {
            const nameEl = conv.querySelector('.conversation--user');
            if (!nameEl) return;

            const userName = nameEl.childNodes[0] ? nameEl.childNodes[0].textContent.trim() : nameEl.innerText.trim();
            let wrapper = conv.querySelector('.quick-greet-wrapper');

            const isClosed = conv.closest('.resolved-in-open') || (nameEl.innerText && nameEl.innerText.toLowerCase().includes('закрыт'));

            if (isClosed) {
                if (autoTimers.has(userName)) autoTimers.delete(userName);
                if (wrapper) wrapper.remove();
                return;
            }

            if (processedUsers.has(userName)) {
                if (wrapper) wrapper.remove();
                if (autoTimers.has(userName)) autoTimers.delete(userName);
                return;
            }

            if (wrapper && wrapper.getAttribute('data-target-user') !== userName) {
                wrapper.remove();
                wrapper = null;
            }

            let greetBtn = wrapper ? wrapper.querySelector('.action-greet-btn') : null;

            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'quick-greet-wrapper';
                wrapper.setAttribute('data-target-user', userName);
                wrapper.style.cssText = `
                    position: absolute; bottom: 12px; right: 12px; z-index: 50;
                    display: flex; gap: 4px; align-items: center; transition: opacity 0.3s ease;
                `;

                greetBtn = document.createElement('button');
                greetBtn.className = 'action-greet-btn';
                greetBtn.innerHTML = '👋';
                greetBtn.title = 'Поздороваться автоматически';
                greetBtn.style.cssText = `
                    background: rgb(16, 185, 129); color: white; border: none;
                    border-radius: 6px; padding: 4px 8px; font-size: 14px; cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.2s ease, transform 0.2s ease;
                    display: flex; align-items: center; justify-content: center;
                `;

                greetBtn.onmouseover = () => {
                    if (greetBtn.innerHTML === '👋') {
                        greetBtn.style.background = 'rgb(5, 150, 105)';
                        greetBtn.style.transform = 'scale(1.05)';
                    }
                };
                greetBtn.onmouseout = () => {
                    if (greetBtn.innerHTML === '👋') {
                        greetBtn.style.background = 'rgb(16, 185, 129)';
                        greetBtn.style.transform = 'scale(1)';
                    }
                };

                greetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    processGreeting(conv, userName, wrapper, greetBtn);
                });

                const dismissBtn = document.createElement('button');
                dismissBtn.className = 'dismiss-btn';
                dismissBtn.innerHTML = '✖';
                dismissBtn.title = 'Уже поздоровался сам (скрыть)';
                dismissBtn.style.cssText = `
                    background: rgba(226, 232, 240, 0.9); color: rgb(100, 116, 139);
                    border: none; border-radius: 6px; padding: 4px 6px; font-size: 10px;
                    cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    transition: background 0.2s ease, color 0.2s ease; display: flex;
                    align-items: center; justify-content: center; height: 100%;
                `;

                dismissBtn.onmouseover = () => {
                    dismissBtn.style.background = 'rgb(203, 213, 225)';
                    dismissBtn.style.color = 'rgb(71, 85, 105)';
                };
                dismissBtn.onmouseout = () => {
                    dismissBtn.style.background = 'rgba(226, 232, 240, 0.9)';
                    dismissBtn.style.color = 'rgb(100, 116, 139)';
                };

                dismissBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAsDoneAndHide(userName, wrapper, null);
                });

                wrapper.appendChild(dismissBtn);
                wrapper.appendChild(greetBtn);
                conv.appendChild(wrapper);

                autoTimers.set(userName, now);
            }

            if (autoTimers.has(userName)) {
                const spawnTime = autoTimers.get(userName);
                const timePassed = now - spawnTime;

                if (timePassed >= autoGreetDelay) {
                    if (isProcessing) return;
                    autoTimers.delete(userName);
                    if (wrapper && greetBtn) {
                        processGreeting(conv, userName, wrapper, greetBtn);
                    }
                }
            }
        });
    }

    let observerTimer = null;
    const observer = new MutationObserver(() => {
        if (observerTimer) clearTimeout(observerTimer);
        observerTimer = setTimeout(renderButtons, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(renderButtons, 1500);

})();
