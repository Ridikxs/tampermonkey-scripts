// ==UserScript==
// @name         Alarmclock
// @namespace    http://tampermonkey.net/
// @version      2.0
// @author       River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Alarmclock.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Alarmclock.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let lastAlertedTime = "";
    const audioUrl = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
    const alarm = new Audio(audioUrl);

    let savedVolume = localStorage.getItem('tb_volume') || 0.5;
    alarm.volume = savedVolume;

    async function playTriple() {
        for (let i = 0; i < 3; i++) {
            alarm.currentTime = 0;
            try { await alarm.play(); } catch(e) {}
            await new Promise(r => setTimeout(r, 1200));
        }
    }

    function formatTime(input) {
        let t = input.replace(/\D/g, '');
        if (t.length < 4) return null;
        let h = t.substring(0, 2).padStart(2, '0');
        let m = t.substring(2, 4).padStart(2, '0');
        if (parseInt(h) > 23) h = "23";
        if (parseInt(m) > 59) m = "59";
        return `${h}:${m}`;
    }

    function processInput(input) {
        let matches = input.match(/\d{4}/g) || [];
        return matches.map(t => formatTime(t)).filter(t => t !== null);
    }

    function applyTheme(isDark) {
        const box = document.getElementById('tb-main-box');
        const menu = document.getElementById('tb-settings-menu');
        if (!box || !menu) return;
        if (isDark) {
            box.style.background = "#1e1e1e"; box.style.border = "1px solid #4384f5"; box.style.color = "white";
            menu.style.background = "#252525"; menu.style.border = "1px solid #444";
        } else {
            box.style.background = "#ffffff"; box.style.border = "2px solid #4384f5"; box.style.color = "#333";
            menu.style.background = "#ffffff"; menu.style.border = "1px solid #ddd";
        }
        localStorage.setItem('tb_dark_mode', isDark);
    }

    function updateMenuContent() {
        const listContainer = document.getElementById('tb-menu-list');
        if (!listContainer) return;
        let schedule = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
        let isDark = localStorage.getItem('tb_dark_mode') === 'true';

        let html = `
            <button id="tb-toggle-theme" style="width: 100%; margin-bottom: 10px; cursor: pointer; font-size: 10px; padding: 4px; border-radius: 4px; border: 1px solid #4384f5; background: transparent; color: #4384f5;">СМЕНИТЬ ТЕМУ</button>
            <div style="margin-bottom: 12px; font-size: 10px; color: ${isDark ? '#aaa' : '#666'}; text-align: center;">
                ГРОМКОСТЬ: <span id="vol-val">${Math.round(alarm.volume * 100)}%</span>
                <input type="range" id="tb-volume-mixer" min="0" max="1" step="0.05" value="${alarm.volume}" style="width: 100%; cursor: pointer; margin-top: 4px;">
            </div>
            <div style="border-top: 1px solid #444; margin: 8px 0;"></div>
        `;

        if (schedule.length === 0) {
            html += '<div style="color: #888; font-size: 11px; text-align: center; padding: 5px;">Пусто</div>';
        } else {
            html += schedule.map((time, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; background: ${isDark ? '#333' : '#f5f5f5'}; padding: 4px 8px; border-radius: 4px;">
                    <span style="color: ${isDark ? '#fff' : '#333'}; font-size: 12px; font-weight: bold;">${time}</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span class="edit-tb" data-idx="${idx}" style="cursor: pointer; font-size: 12px; filter: grayscale(1);">✏️</span>
                        <span class="del-tb" data-idx="${idx}" style="color: #ff4d4d; cursor: pointer; font-weight: bold; font-size: 14px;">✕</span>
                    </div>
                </div>
            `).join('');
        }
        listContainer.innerHTML = html;

        // Редактирование (через prompt, как ты просил — чтобы не ломать старую логику)
        listContainer.querySelectorAll('.edit-tb').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let idx = e.target.getAttribute('data-idx');
                let current = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
                let newVal = prompt("Изменить время (ЧЧММ):", current[idx].replace(':', ''));
                if (newVal) {
                    let formatted = formatTime(newVal);
                    if (formatted) {
                        current[idx] = formatted;
                        localStorage.setItem('tb_schedule', JSON.stringify(current.sort()));
                        updateMenuContent();
                        document.getElementById('tb-val').innerText = JSON.parse(localStorage.getItem('tb_schedule'))[0];
                    }
                }
            };
        });

        listContainer.querySelectorAll('.del-tb').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let idx = e.target.getAttribute('data-idx');
                let current = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
                current.splice(idx, 1);
                localStorage.setItem('tb_schedule', JSON.stringify(current));
                updateMenuContent();
                document.getElementById('tb-val').innerText = current.length > 0 ? current[0] : '--:--';
            };
        });

        document.getElementById('tb-volume-mixer').oninput = (e) => {
            alarm.volume = e.target.value;
            localStorage.setItem('tb_volume', e.target.value);
            document.getElementById('vol-val').innerText = Math.round(e.target.value * 100) + "%";
        };

        document.getElementById('tb-toggle-theme').onclick = (e) => {
            e.stopPropagation();
            applyTheme(localStorage.getItem('tb_dark_mode') !== 'true');
            updateMenuContent();
        };
    }

    function inject() {
        if (document.getElementById('tb-main-box')) return;
        const box = document.createElement('div');
        box.id = 'tb-main-box';
        box.style.cssText = `position: fixed; top: 20px; left: 80px; z-index: 99999; border-radius: 8px; padding: 8px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 10px; font-family: sans-serif; cursor: move; user-select: none;`;

        let schedule = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
        box.innerHTML = `
            <div id="tb-edit" style="cursor:pointer; font-weight:bold; color:#4384f5; font-size:13px;">
                ТБ: <span id="tb-val" style="border-bottom: 1px dashed #4384f5;">${schedule.length > 0 ? schedule[0] : '--:--'}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <span id="tb-sound-test" style="cursor:pointer; font-size:16px;">🔊</span>
                <span id="tb-manage" style="cursor:pointer; font-size:16px;">⚙️</span>
            </div>
            <div id="tb-settings-menu" style="display:none; position:absolute; top:40px; left:0; width:150px; border-radius:6px; padding:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.4); cursor:default;">
                <div id="tb-menu-list"></div>
            </div>
        `;
        document.body.appendChild(box);
        applyTheme(localStorage.getItem('tb_dark_mode') === 'true');

        let pos1=0, pos2=0, pos3=0, pos4=0;
        const savedPos = JSON.parse(localStorage.getItem('tb_pos'));
        if (savedPos) { box.style.top = savedPos.t; box.style.left = savedPos.l; }

        box.onmousedown = (e) => {
            if (e.target.closest('#tb-edit') || e.target.id === 'tb-sound-test' || e.target.id === 'tb-manage' || e.target.closest('#tb-settings-menu')) return;
            document.body.style.userSelect = 'none';
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmousemove = (ev) => {
                pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
                pos3 = ev.clientX; pos4 = ev.clientY;
                box.style.top = (box.offsetTop - pos2) + "px";
                box.style.left = (box.offsetLeft - pos1) + "px";
                localStorage.setItem('tb_pos', JSON.stringify({t: box.style.top, l: box.style.left}));
            };
            document.onmouseup = () => { document.onmousemove = null; document.body.style.userSelect = 'auto'; };
        };

        document.getElementById('tb-edit').onclick = () => {
            let input = prompt("Добавить будильники (ЧЧММ)\nПример: 0023 0256 0954 1020\n(обязательно через пробел):", "");
            if (input) {
                let current = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
                let updated = [...new Set([...current, ...processInput(input)])].sort();
                localStorage.setItem('tb_schedule', JSON.stringify(updated));
                document.getElementById('tb-val').innerText = updated[0];
            }
        };

        const menu = document.getElementById('tb-settings-menu');
        document.getElementById('tb-manage').onclick = (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            if (menu.style.display === 'block') updateMenuContent();
        };
        document.addEventListener('click', (e) => { if (!box.contains(e.target)) menu.style.display = 'none'; });
        document.getElementById('tb-sound-test').onclick = () => playTriple();
    }

    function check() {
        let schedule = JSON.parse(localStorage.getItem('tb_schedule') || "[]");
        if (schedule.length === 0) return;
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (currentTime === schedule[0] && lastAlertedTime !== schedule[0]) {
            lastAlertedTime = schedule[0];
            playTriple().then(() => {
                schedule.shift();
                localStorage.setItem('tb_schedule', JSON.stringify(schedule));
                document.getElementById('tb-val').innerText = schedule.length > 0 ? schedule[0] : '--:--';
                lastAlertedTime = "";
            });
        }
    }

    setInterval(inject, 3000);
    setInterval(check, 5000);

})();

