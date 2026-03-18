// ==UserScript==
// @name         LiveChatSounds
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Настройка звуков LiveChat
// @match        *://*.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatSounds.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatSounds.user.js
// @author       Calvin/River
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const defaultSounds = {
        chat: "https://cdn.livechatinc.com/sounds/incoming_chat.mp3",
        message: "https://cdn.livechatinc.com/sounds/message.mp3"
    };

    const localKeys = {
        chat: 'custom_chat_sound',
        message: 'custom_message_sound',
        uploads: 'custom_uploaded_sounds'
    };

    const presetLibrary = {
        "Стандартный звук чата": defaultSounds.chat,
        "Звук 1 (Chat.mp3)": "https://file.garden/aCHScVU4PCQNDvKD/Chat.mp3",
        "Звук 2 (message.mp3)": "https://file.garden/aCHScVU4PCQNDvKD/massage.mp3"
    };

    function getCustomSound(type) {
        return localStorage.getItem(localKeys[type]) || defaultSounds[type];
    }

    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        try {
            const src = this.currentSrc || this.src;
            if (src === defaultSounds.chat) {
                this.src = getCustomSound('chat');
            } else if (src === defaultSounds.message) {
                this.src = getCustomSound('message');
            }
        } catch (err) {
            console.error(err);
        }
        return originalPlay.apply(this, arguments);
    };

    function addSidebarButton() {
        const observer = new MutationObserver(() => {
            if (document.getElementById('soundSettingsBtn')) {
                return;
            }

            const settingsLink = document.querySelector('a[aria-label="Settings"]');
            if (!settingsLink) {
                return;
            }

            const targetLi = settingsLink.closest('li');
            if (!targetLi || !targetLi.parentNode) {
                return;
            }

            const li = document.createElement('li');
            li.className = targetLi.className;
            li.style.listStyle = 'none';

            const btn = document.createElement('div');
            btn.id = 'soundSettingsBtn';
            btn.innerHTML = `
                <div title="Настройка звуков" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; color: #8A9299; transition: color 0.2s;">
                    <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M11.536 14.01a.75.75 0 0 1-.674-.418L8.383 9.61H6.5a3.5 3.5 0 0 1-3.5-3.5v-1a3.5 3.5 0 0 1 3.5-3.5h.25V.75a.75.75 0 0 1 1.5 0V1.11A5.001 5.001 0 0 1 13.5 6v1a5 5 0 0 1-1.964 3.994l1.217 2.431a.75.75 0 0 1-.674 1.085H11.536zM6.5 3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2.25a.75.75 0 0 1 .67.416l2.179 4.358-.928-1.857a.75.75 0 0 1 .297-.996A3.5 3.5 0 0 0 12 7V6a3.5 3.5 0 0 0-3.5-3.5h-2z"/>
                    </svg>
                </div>`;

            btn.addEventListener('click', showSettingsPanel);
            li.appendChild(btn);
            targetLi.parentNode.insertBefore(li, targetLi);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function playSound(url) {
        new Audio(url).play();
    }

    function deleteCustomSound(selectId) {
        const select = document.getElementById(selectId);
        const label = select.options[select.selectedIndex].text;
        if (presetLibrary[label]) {
            return;
        }
        const uploads = JSON.parse(localStorage.getItem(localKeys.uploads) || '{}');
        delete uploads[label];
        localStorage.setItem(localKeys.uploads, JSON.stringify(uploads));
        document.getElementById('soundPanel').remove();
        showSettingsPanel();
    }

    function showSettingsPanel() {
        if (document.getElementById('soundPanel')) {
            return;
        }

        const savedCustomSounds = JSON.parse(localStorage.getItem(localKeys.uploads) || '{}');
        const allSounds = Object.assign({}, presetLibrary, savedCustomSounds);

        let customOptions = '';
        for (const [label, url] of Object.entries(allSounds)) {
            customOptions += `<option value="${url}">${label}</option>`;
        }

        const panel = document.createElement('div');
        panel.id = 'soundPanel';
        panel.style.cssText = `
            position: fixed;
            top: 50px;
            left: 70px;
            background: #1e1e1e;
            color: white;
            border: 1px solid #444;
            padding: 20px;
            z-index: 999999;
            width: 360px;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            font-family: sans-serif;
        `;

        panel.innerHTML = `
            <h3 style="margin-top: 0; font-size: 16px;">Настройка звуков</h3>

            <label style="display: block; margin-bottom: 15px;">
                <span style="display: block; margin-bottom: 5px; color: #ccc;">Звук нового чата:</span>
                <input type="text" id="chatSound" value="${getCustomSound('chat')}" style="width: 100%; margin-bottom: 6px; padding: 4px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555;"/>
                <select id="chatLibrary" style="width: 100%; margin-bottom: 6px; padding: 4px; background: #333; color: #fff; border: 1px solid #555;">${customOptions}</select>
                <div style="display: flex; gap: 5px;">
                    <button id="btn-chat-select" style="flex: 1; padding: 4px; cursor: pointer; background: #444; color: #fff; border: none; border-radius: 3px;">Выбрать</button>
                    <button id="btn-chat-play" style="padding: 4px; cursor: pointer; width: 40px; background: #444; border: none; border-radius: 3px;">▶️</button>
                    <button id="btn-chat-del" style="padding: 4px; cursor: pointer; width: 40px; background: #444; border: none; border-radius: 3px;">🗑️</button>
                </div>
            </label>

            <label style="display: block; margin-bottom: 15px;">
                <span style="display: block; margin-bottom: 5px; color: #ccc;">Звук сообщения:</span>
                <input type="text" id="msgSound" value="${getCustomSound('message')}" style="width: 100%; margin-bottom: 6px; padding: 4px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555;"/>
                <select id="msgLibrary" style="width: 100%; margin-bottom: 6px; padding: 4px; background: #333; color: #fff; border: 1px solid #555;">${customOptions}</select>
                <div style="display: flex; gap: 5px;">
                    <button id="btn-msg-select" style="flex: 1; padding: 4px; cursor: pointer; background: #444; color: #fff; border: none; border-radius: 3px;">Выбрать</button>
                    <button id="btn-msg-play" style="padding: 4px; cursor: pointer; width: 40px; background: #444; border: none; border-radius: 3px;">▶️</button>
                    <button id="btn-msg-del" style="padding: 4px; cursor: pointer; width: 40px; background: #444; border: none; border-radius: 3px;">🗑️</button>
                </div>
            </label>

            <hr style="border: 0; border-top: 1px solid #444; margin: 15px 0;">

            <span style="display: block; margin-bottom: 5px; color: #ccc;">Загрузить свой звук (mp3/wav):</span>
            <input type="file" id="uploadFile" accept="audio/*" style="margin-bottom: 5px; width: 100%;"><br>
            <input type="text" id="soundName" placeholder="Название звука (необязательно)" style="width: 100%; margin-bottom: 15px; background: #333; color: white; padding: 6px; border: 1px solid #555; box-sizing: border-box;">

            <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                <button id="saveSound" style="flex: 1; padding: 6px; background: #4caf50; color: white; border: none; cursor: pointer; border-radius: 4px;">Сохранить</button>
                <button id="resetSound" style="flex: 1; padding: 6px; background: #f44336; color: white; border: none; cursor: pointer; border-radius: 4px;">Сброс</button>
                <button id="closeSound" style="width: 100%; padding: 6px; background: #555; color: white; border: none; cursor: pointer; border-radius: 4px; margin-top: 5px;">Закрыть</button>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('btn-chat-select').addEventListener('click', () => {
            document.getElementById('chatSound').value = document.getElementById('chatLibrary').value;
        });
        document.getElementById('btn-chat-play').addEventListener('click', () => {
            playSound(document.getElementById('chatSound').value);
        });
        document.getElementById('btn-chat-del').addEventListener('click', () => {
            deleteCustomSound('chatLibrary');
        });

        document.getElementById('btn-msg-select').addEventListener('click', () => {
            document.getElementById('msgSound').value = document.getElementById('msgLibrary').value;
        });
        document.getElementById('btn-msg-play').addEventListener('click', () => {
            playSound(document.getElementById('msgSound').value);
        });
        document.getElementById('btn-msg-del').addEventListener('click', () => {
            deleteCustomSound('msgLibrary');
        });

        document.getElementById('saveSound').addEventListener('click', () => {
            localStorage.setItem(localKeys.chat, document.getElementById('chatSound').value);
            localStorage.setItem(localKeys.message, document.getElementById('msgSound').value);
            alert("Настройки звука сохранены! Обновите страницу (F5), чтобы они заработали.");
            panel.remove();
        });

        document.getElementById('resetSound').addEventListener('click', () => {
            localStorage.removeItem(localKeys.chat);
            localStorage.removeItem(localKeys.message);
            document.getElementById('chatSound').value = defaultSounds.chat;
            document.getElementById('msgSound').value = defaultSounds.message;
        });

        document.getElementById('closeSound').addEventListener('click', () => {
            panel.remove();
        });

        document.getElementById('uploadFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result;
                const name = document.getElementById('soundName').value.trim() || `Свой звук ${Math.floor(Date.now() / 1000)}`;
                const sounds = JSON.parse(localStorage.getItem(localKeys.uploads) || '{}');
                sounds[name] = base64;
                localStorage.setItem(localKeys.uploads, JSON.stringify(sounds));
                panel.remove();
                showSettingsPanel();
            };
            reader.readAsDataURL(file);
        });
    }

    addSidebarButton();
})();
