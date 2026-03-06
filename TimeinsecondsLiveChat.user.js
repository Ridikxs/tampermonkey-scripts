// ==UserScript==
// @name         Time in seconds LiveChat
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Исправлены настройки и сохранение. Стабильная синхронизация.
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TimeInSecondsLiveChat.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TimeInSecondsLiveChat.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const audioUrl = "https://file.garden/aCHScVU4PCQNDvKD/soft-notice-146623.mp3";
    const alarm = new Audio(audioUrl);
    alarm.volume = 0.5;

    let alertTimes = JSON.parse(localStorage.getItem('river_times_v2') || "[30, 45, 110, 180, 360]");
    let alertCycles = parseInt(localStorage.getItem('river_cycles_v2') || "1");
    let isMuted = localStorage.getItem('river_muted') === 'true';

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    function parseTextToSeconds(text) {
        let s = 0;
        const mMatch = text.match(/(\d+)\s*m/);
        const sMatch = text.match(/(\d+)\s*s/);
        if (mMatch) s += parseInt(mMatch[1]) * 60;
        if (sMatch) s += parseInt(sMatch[1]);
        if (!mMatch && !sMatch && /^\d+$/.test(text.trim())) s = parseInt(text);
        return s;
    }

    async function playAlert() {
        if (isMuted) return;
        for (let i = 0; i < alertCycles; i++) {
            alarm.currentTime = 0;
            alarm.play().catch(() => {});
            if (i < alertCycles - 1) await new Promise(r => setTimeout(r, 1200));
        }
    }

    function processChats() {
        const now = Date.now();

        document.querySelectorAll('li[data-testid^="chat-item"]').forEach(chat => {
            const cid = chat.getAttribute('data-testid');
            if (!cid) return;

            const elements = chat.querySelectorAll('span, p, div');
            let nativeTimeEl = null;

            for (let el of elements) {
                if (!el.classList.contains('river-timer') && !el.closest('.river-container') && /^\d+[sm]$|^\d+\s*[sm]\s*\d*[sm]?$/.test(el.innerText.trim())) {
                    nativeTimeEl = el;
                    break;
                }
            }

            let container = chat.querySelector('.river-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'river-container';
                container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 2px; position: relative; width: fit-content; margin-left: auto; margin-right: auto;';

                const myDisplay = document.createElement('div');
                myDisplay.className = 'river-timer';
                myDisplay.style.cssText = 'font-size:16px; font-weight:900; color: currentColor; min-width: 38px; text-align: center;';

                const muteBtn = document.createElement('div');
                muteBtn.className = 'river-mute-btn';
                muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
                muteBtn.style.cssText = `cursor: pointer; font-size: 12px; transition: 0.2s; opacity: ${isMuted ? '1' : '0.2'}; color: ${isMuted ? '#FF3B30' : 'currentColor'};`;

                const settingsBtn = document.createElement('div');
                settingsBtn.className = 'river-settings-btn';
                settingsBtn.innerHTML = '⚙️';
                settingsBtn.style.cssText = 'cursor: pointer; font-size: 12px; opacity: 0.2; transition: 0.2s; color: currentColor;';

                const editWrapper = document.createElement('div');
                editWrapper.className = 'river-edit-wrapper';
                editWrapper.style.cssText = 'display:none; align-items: center; gap: 3px; position: absolute; left: 105%; top: 50%; transform: translateY(-50%); background: var(--colors-surface-primary, #fff); color: var(--colors-content-primary, #000); padding: 2px 4px; border: 1px solid var(--colors-border-primary, #ccc); border-radius: 4px; z-index: 9999; box-shadow: 0 4px 10px rgba(0,0,0,0.2); pointer-events: auto;';

                const saveBtn = document.createElement('div');
                saveBtn.innerHTML = '✅';
                saveBtn.style.cssText = 'cursor: pointer; font-size: 14px; line-height: 1; margin-right: 1px;';

                const inputTimes = document.createElement('input');
                inputTimes.style.cssText = 'width: 100px; font-size: 10px; font-weight: 700; border: 1px solid var(--colors-border-secondary, #999); border-radius: 2px; text-align: center; background: var(--colors-surface-secondary, #fff); color: inherit; padding: 1px;';

                const inputCycles = document.createElement('input');
                inputCycles.type = "number";
                inputCycles.min = "1";
                inputCycles.max = "5";
                inputCycles.style.cssText = 'width: 25px; font-size: 10px; font-weight: 700; border: 1px solid var(--colors-border-secondary, #999); border-radius: 2px; text-align: center; background: var(--colors-surface-secondary, #fff); color: inherit; padding: 1px;';

                const saveSettings = () => {
                    const times = inputTimes.value.split(',').map(v => parseInt(v.trim())).filter(n => !isNaN(n));
                    const cycles = Math.min(Math.max(parseInt(inputCycles.value) || 1, 1), 5);
                    if (times.length > 0) {
                        alertTimes = times;
                        alertCycles = cycles;
                        localStorage.setItem('river_times_v2', JSON.stringify(times));
                        localStorage.setItem('river_cycles_v2', cycles.toString());
                    }
                    editWrapper.style.display = 'none';
                };

                muteBtn.onclick = (e) => {
                    e.stopPropagation();
                    isMuted = !isMuted;
                    localStorage.setItem('river_muted', isMuted);
                    document.querySelectorAll('.river-mute-btn').forEach(btn => {
                        btn.innerHTML = isMuted ? '🔇' : '🔊';
                        btn.style.opacity = isMuted ? '1' : '0.2';
                        btn.style.color = isMuted ? '#FF3B30' : 'currentColor';
                    });
                };

                settingsBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (editWrapper.style.display === 'none') {
                        editWrapper.style.display = 'flex';
                        inputTimes.value = alertTimes.join(', ');
                        inputCycles.value = alertCycles;
                        inputTimes.focus();
                    } else {
                        saveSettings();
                    }
                };

                saveBtn.onclick = (e) => { e.stopPropagation(); saveSettings(); };

                // Чтобы при клике на инпуты не срабатывал клик по чату
                [inputTimes, inputCycles].forEach(el => {
                    el.onclick = (e) => e.stopPropagation();
                    el.onkeydown = (e) => { if (e.key === 'Enter') saveSettings(); e.stopPropagation(); };
                });

                editWrapper.appendChild(saveBtn);
                editWrapper.appendChild(inputTimes);
                editWrapper.appendChild(inputCycles);
                container.appendChild(myDisplay);
                container.appendChild(muteBtn);
                container.appendChild(settingsBtn);
                container.appendChild(editWrapper);
                chat.appendChild(container);
            }

            const myDisplay = container.querySelector('.river-timer');
            const storageKey = `river_start_${cid}`;
            const lastNativeKey = `river_last_native_${cid}`;

            if (nativeTimeEl) {
                const currentNativeSec = parseTextToSeconds(nativeTimeEl.innerText);
                nativeTimeEl.style.display = 'none';

                let storedStart = sessionStorage.getItem(storageKey);
                let lastNative = parseInt(sessionStorage.getItem(lastNativeKey) || "-1");

                if (lastNative === -1 || currentNativeSec < lastNative) {
                    storedStart = (now - (currentNativeSec * 1000)).toString();
                    sessionStorage.setItem(storageKey, storedStart);
                    sessionStorage.setItem(`lct_p_${cid}`, "[]");
                }

                sessionStorage.setItem(lastNativeKey, currentNativeSec.toString());

                const startTime = parseInt(storedStart);
                const exactSec = Math.floor((now - startTime) / 1000);

                myDisplay.innerText = formatTime(exactSec);

                const soundKey = `lct_p_${cid}`;
                let played = JSON.parse(sessionStorage.getItem(soundKey) || "[]");
                if (alertTimes.includes(exactSec) && !played.includes(exactSec)) {
                    playAlert();
                    played.push(exactSec);
                    sessionStorage.setItem(soundKey, JSON.stringify(played));
                }

                if (exactSec >= 180) myDisplay.style.color = '#FF3B30';
                else if (exactSec >= 45) myDisplay.style.color = '#FF9500';
                else myDisplay.style.color = '#34C759';
            }
        });
    }

    setInterval(processChats, 500);

})();

