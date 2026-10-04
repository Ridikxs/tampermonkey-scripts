
// ==UserScript==
// @name         Private Note AutoResize
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Автоматическое расширение приватной заметки в Helpdesk.
// @author       Will
// @match        https://hd.sparkmoth.com/*
// @match        https://sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/PrivateNote.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/PrivateNote.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const SELECTOR = 'textarea[name="privateNote"]';

    const MIN_HEIGHT = 180;
    const MAX_HEIGHT = 2000;

    const initialized = new WeakSet();

    // ========================================
    // CSS
    // ========================================

    const style = document.createElement('style');

    style.textContent = `
        ${SELECTOR} {
            display: block !important;
            width: 100% !important;
            min-height: ${MIN_HEIGHT}px !important;
            max-height: none !important;
            box-sizing: border-box !important;
            resize: vertical !important;
            overflow-x: hidden !important;
            line-height: 1.5 !important;
            transition: none !important;
        }

        ${SELECTOR}::-webkit-scrollbar {
            width: 8px;
        }

        ${SELECTOR}::-webkit-scrollbar-track {
            background: transparent;
        }

        ${SELECTOR}::-webkit-scrollbar-thumb {
            background: #64748b;
            border-radius: 8px;
        }
    `;

    (document.head || document.documentElement)
        .appendChild(style);

    // ========================================
    // DYNAMIC RESIZE
    // ========================================

    function resize(el) {
        if (!el || !el.isConnected) return;

        const previousScroll = el.scrollTop;

        // Сбрасываем высоту перед измерением.
        el.style.setProperty(
            'height',
            'auto',
            'important'
        );

        const fullHeight = el.scrollHeight + 2;

        const targetHeight = Math.min(
            Math.max(fullHeight, MIN_HEIGHT),
            MAX_HEIGHT
        );

        el.style.setProperty(
            'height',
            `${targetHeight}px`,
            'important'
        );

        el.style.setProperty(
            'overflow-y',
            fullHeight > MAX_HEIGHT ? 'auto' : 'hidden',
            'important'
        );

        if (fullHeight > MAX_HEIGHT) {
            el.scrollTop = previousScroll;
        }
    }

    // ========================================
    // REGISTER TEXTAREA
    // ========================================

    function register(el) {
        if (initialized.has(el)) return;

        initialized.add(el);

        let lastValue = el.value;

        resize(el);

        // Реагируем на ввод, удаление и вставку.
        el.addEventListener('input', () => {
            lastValue = el.value;
            resize(el);
        });

        el.addEventListener('paste', () => {
            requestAnimationFrame(() => resize(el));
            setTimeout(() => resize(el), 50);
        });

        // React может устанавливать value программно,
        // поэтому дополнительно отслеживаем изменения.
        const timer = setInterval(() => {
            if (!el.isConnected) {
                clearInterval(timer);
                return;
            }

            if (lastValue !== el.value) {
                lastValue = el.value;
                resize(el);
            }
        }, 250);
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function scan() {
        document.querySelectorAll(SELECTOR)
            .forEach(register);
    }

    // Поддержка динамически создаваемой формы.
    const observer = new MutationObserver(() => {
        scan();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.addEventListener('resize', () => {
        document.querySelectorAll(SELECTOR)
            .forEach(resize);
    });

    scan();

    console.log(
        '[Will] Private Note AutoResize v1.3 loaded:',
        location.origin
    );

})();
