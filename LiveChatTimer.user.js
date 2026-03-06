// ==UserScript==
// @name         LiveChatTimer
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Исправлено смещение таймера при переходе в настройки.
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatTimer.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/LiveChatTimer.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const audioUrl = "https://file.garden/aCHScVU4PCQNDvKD/soft-notice-146623.mp3";
    const alarm = new Audio(audioUrl);
    alarm.volume = localStorage.getItem('tb_volume') || 0.5;

    const getReps = () => {
        const r = localStorage.getItem('lct_reps');
        return r ? parseInt(r) : 3;
    };

    const defaultTimes = [30, 90, 170, 280, 410];
    const colors = ['#607D8B', '#9C27B0', '#4CAF50', '#2196F3', '#FF5722', '#E91E63', '#00BCD4', '#8BC34A'];
    let editMode = false;

    function getSavedTimes() {
        const saved = localStorage.getItem('lct_config_times');
        return saved ? JSON.parse(saved) : defaultTimes;
    }

    async function playAlarm() {
        const reps = getReps();
        for (let i = 0; i < reps; i++) {
            const tempAlarm = new Audio(audioUrl);
            tempAlarm.volume = alarm.volume;
            try { await tempAlarm.play(); } catch(e) {}
            if (i < reps - 1) await new Promise(r => setTimeout(r, 850));
        }
    }

    const getChatId = (el) => el.closest('li[data-testid^="chat-item"]')?.getAttribute('data-testid');

    const workerCode = `setInterval(() => { self.postMessage('tick'); }, 1000);`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    function formatTimeLabel(s) {
        if (s < 60) return s + 's';
        const m = Math.floor(s / 60);
        const rs = s % 60;
        return rs === 0 ? m + 'm' : `${m}m${rs}s`;
    }

    function injectButtons() {
        const times = getSavedTimes();
        const reps = getReps();

        document.querySelectorAll('li[data-testid^="chat-item"]').forEach(chat => {
            let wrapper = chat.querySelector('.timer-wrapper');
            const version = JSON.stringify(times) + editMode + reps;

            if (wrapper && wrapper.dataset.version !== version) {
                wrapper.remove();
                wrapper = null;
            }

            if (wrapper) return;

            // Чтобы таймер не улетал, родителю даем relative
            chat.style.position = 'relative';

            wrapper = document.createElement('div');
            wrapper.className = 'timer-wrapper';
            wrapper.dataset.version = version;
            wrapper.style.cssText = 'margin-top:4px; display:flex; flex-direction:column; gap:2px; width: 100%; padding-bottom: 4px;';

            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display:flex; gap:3px; flex-wrap:wrap; align-items:flex-end; padding-right: 45px;'; // Отступ справа под таймер

            const bStyle = 'padding:2px 4px; color:white; border:none; border-radius:3px; cursor:pointer; font-size:10px; font-weight:bold; height: 18px; line-height: 1;';

            times.forEach((sec, i) => {
                const group = document.createElement('div');
                group.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:1px;';

                if (editMode) {
                    const deleteBtn = document.createElement('span');
                    deleteBtn.textContent = '✖';
                    deleteBtn.style.cssText = 'font-size:8px; cursor:pointer; color: #ff4d4d; font-weight: bold; line-height: 1;';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        const current = getSavedTimes();
                        current.splice(i, 1);
                        localStorage.setItem('lct_config_times', JSON.stringify(current));
                        injectButtons();
                    };
                    group.appendChild(deleteBtn);
                }

                const btn = document.createElement('button');
                btn.textContent = formatTimeLabel(sec);
                btn.style.cssText = bStyle + `background-color:${colors[i % colors.length]}; min-width:34px;`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    alarm.play().then(() => { alarm.pause(); alarm.currentTime = 0; }).catch(() => {});
                    const cid = getChatId(chat);
                    localStorage.setItem(`lct_${cid}`, Date.now() + (sec * 1000));
                    localStorage.setItem(`lct_sounds_${cid}`, JSON.stringify([]));
                    updateTimers();
                };
                group.appendChild(btn);
                btnContainer.appendChild(group);
            });

            if (editMode) {
                const addBtn = document.createElement('button');
                addBtn.textContent = '+';
                addBtn.style.cssText = bStyle + 'background-color:#4CAF50;';
                addBtn.onclick = (e) => {
                    e.stopPropagation();
                    const newSec = prompt("Введите время в секундах:");
                    const val = parseInt(newSec);
                    if (!isNaN(val) && val > 0) {
                        const current = getSavedTimes();
                        current.push(val);
                        localStorage.setItem('lct_config_times', JSON.stringify(current));
                        injectButtons();
                    }
                };
                btnContainer.appendChild(addBtn);

                const repsBtn = document.createElement('button');
                repsBtn.textContent = `R:${reps}`;
                repsBtn.style.cssText = bStyle + 'background-color:#E91E63;';
                repsBtn.onclick = (e) => {
                    e.stopPropagation();
                    let next = reps >= 5 ? 1 : reps + 1;
                    localStorage.setItem('lct_reps', next);
                    injectButtons();
                };
                btnContainer.appendChild(repsBtn);
            }

            const offBtn = document.createElement('button');
            offBtn.textContent = 'Off';
            offBtn.style.cssText = bStyle + 'background-color:#555;';
            offBtn.onclick = (e) => {
                e.stopPropagation();
                const cid = getChatId(chat);
                localStorage.removeItem(`lct_${cid}`);
                localStorage.removeItem(`lct_sounds_${cid}`);
                updateTimers();
            };
            btnContainer.appendChild(offBtn);

            const cfgBtn = document.createElement('span');
            cfgBtn.textContent = '⚙️';
            cfgBtn.style.cssText = 'cursor:pointer; font-size:12px; align-self: center; opacity:' + (editMode ? '1' : '0.6') + ';';
            cfgBtn.onclick = (e) => {
                e.stopPropagation();
                editMode = !editMode;
                injectButtons();
            };
            btnContainer.appendChild(cfgBtn);

            // Таймер теперь позиционируется абсолютно в углу своего чат-блока
            const display = document.createElement('div');
            display.className = 'timer-display';
            display.style.cssText = 'font-size:11px; font-weight:bold; border-radius:3px; padding: 2px 4px; color:white; display:none; position: absolute; right: 10px; bottom: 10px; z-index: 10; white-space: nowrap;';

            wrapper.appendChild(btnContainer);
            chat.appendChild(wrapper);
            chat.appendChild(display);
        });
    }

    function updateTimers() {
        const now = Date.now();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('lct_') && !key.startsWith('lct_sounds_') && !key.startsWith('lct_config') && !key.startsWith('lct_reps')) {
                const cid = key.replace('lct_', '');
                const endTime = parseInt(localStorage.getItem(key));
                if (isNaN(endTime)) return;
                const remain = Math.round((endTime - now) / 1000);

                if (remain > 0) {
                    const soundKey = `lct_sounds_${cid}`;
                    let playedSounds = JSON.parse(localStorage.getItem(soundKey) || "[]");
                    if ([60, 15, 5].includes(remain) && !playedSounds.includes(remain)) {
                        playAlarm();
                        playedSounds.push(remain);
                        localStorage.setItem(soundKey, JSON.stringify(playedSounds));
                    }
                } else if (remain < -5) {
                    localStorage.removeItem(key);
                    localStorage.removeItem(`lct_sounds_${cid}`);
                }
            }
        });

        document.querySelectorAll('li[data-testid^="chat-item"]').forEach(chat => {
            const cid = getChatId(chat);
            const endTime = localStorage.getItem(`lct_${cid}`);
            const display = chat.querySelector('.timer-display');
            if (!endTime || !display) { if (display) display.style.display = 'none'; return; }

            const remain = Math.round((parseInt(endTime) - now) / 1000);
            display.style.display = 'block';
            if (remain > 0) {
                display.textContent = `T: ${remain}s`;
                display.style.backgroundColor = remain <= 15 ? '#FF0000' : (remain <= 60 ? '#FFA500' : '#4CAF50');
            } else {
                display.textContent = "UP!";
                display.style.backgroundColor = '#808080';
            }
        });
    }

    worker.onmessage = updateTimers;
    window.addEventListener('focus', updateTimers);
    const obs = new MutationObserver(() => injectButtons());
    obs.observe(document.body, { childList: true, subtree: true });
    injectButtons();

})();


