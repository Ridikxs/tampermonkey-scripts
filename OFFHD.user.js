// ==UserScript==
// @name         OFFHD
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  снимает галочку "Включить историю чата"
// @author       Calvin
// @match        https://sparkmoth.com/app/*
// @match        https://hd.sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @match        https://hd.blueripple.xyz/*
// @match        *://*.blueripple.xyz/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=sparkmoth.com
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OFFHD.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/OFFHD.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function forceUncheck() {
        // Теперь скрипт, загрузившись внутри iframe, сможет найти этот элемент
        const checkbox = document.getElementById('includeHistory');

        if (checkbox && checkbox.checked) {
            checkbox.click();

            if (checkbox.checked) {
                const nativeCheckboxSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
                nativeCheckboxSetter.call(checkbox, false);

                checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    const intervalId = setInterval(() => {
        forceUncheck();
    }, 300);

    setTimeout(() => {
        clearInterval(intervalId);
    }, 10000);

    const observer = new MutationObserver(() => {
        forceUncheck();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
