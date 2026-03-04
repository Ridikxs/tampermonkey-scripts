// ==UserScript==
// @name         МСК-Time
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Показывает время по МСК рядом с UTC в навбаре
// @author       Calvin/River
// @match        https://www2.fundist.org/*
// @match        https://www7.fundist.org/*
// @match        https://backoffice.r7.casino/*
// @match        https://backoffice.catcasino.com/*
// @match        https://backoffice.gama.casino/*
// @match        https://backoffice.daddy.casino/*
// @match        https://backoffice.spark.casino/*
// @match        https://backoffice.mers.casino/*
// @match        https://backoffice.kent.casino/*
// @match        https://backoffice.kometa.casino/*
// @match        https://www9.fundist.org/*
// @match        https://backoffice.arkada.casino/*
// @match        https://cc.boadmin.org/*
// @match        https://gm.boadmin.org/*
// @match        https://dy.boadmin.org/*
// @match        https://mr.boadmin.org/*
// @match        https://kn.boadmin.org/*
// @match        https://rs.boadmin.org/*
// @match        https://kt.boadmin.org/*
// @match        https://ak.boadmin.org/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/MSK-Time.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/MSK-Time.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const MSK_OFFSET_HOURS = 3; // Moscow is UTC+3 (no DST considered)

    function formatTime(date) {
        const z = v => String(v).padStart(2, '0');
        return `${z(date.getHours())}:${z(date.getMinutes())}:${z(date.getSeconds())}`;
    }

    function getMSKDate(now = new Date()) {
        // Convert to UTC then add MSK offset
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + MSK_OFFSET_HOURS * 3600000);
    }

    function ensureMSKElement(parent) {
        // If element already exists, return it
        let el = parent.querySelector('#WelcomeTimeMSK');
        if (el) return el;

        // Create label and value spans similar to existing ones
        const wrapper = document.createElement('div');
        wrapper.className = 'fun-nav-msktime';
        wrapper.style.display = 'inline-block';
        wrapper.style.marginLeft = '8px';

        const label = document.createElement('span');
        label.id = 'WelcomeTimeLabelMSK';
        label.textContent = '\u00A0Время МСК:';
        label.style.marginRight = '4px';

        const value = document.createElement('span');
        value.id = 'WelcomeTimeMSK';
        value.className = 'text-highlight';
        value.textContent = '--:--:--';

        wrapper.appendChild(label);
        wrapper.appendChild(value);

        parent.appendChild(wrapper);
        return value;
    }

    function updateClock(el) {
        const msk = getMSKDate();
        el.textContent = formatTime(msk);
    }

    function startUpdating(el) {
        updateClock(el);
        return setInterval(() => updateClock(el), 1000);
    }

    function attachToContainer(container) {
        const targetParent = container.querySelector('.fun-nav-fundisttime');
        if (!targetParent) return null;
        const mskEl = ensureMSKElement(targetParent);
        // prevent multiple intervals
        if (mskEl.__mskInterval) return mskEl.__mskInterval;
        mskEl.__mskInterval = startUpdating(mskEl);
        return mskEl.__mskInterval;
    }

    // Try immediate attach
    let intervalHandle = attachToContainer(document);
    // If not found, observe DOM for the target (for SPA/dynamic pages)
    if (!intervalHandle) {
        const observer = new MutationObserver((mutations, obs) => {
            const attached = attachToContainer(document);
            if (attached) {
                obs.disconnect();
            }
        });
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
        // Also attempt after load (safe-guard)
        window.addEventListener('load', () => attachToContainer(document));
    }

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        const el = document.querySelector('#WelcomeTimeMSK');
        if (el && el.__mskInterval) clearInterval(el.__mskInterval);
    });

})();
