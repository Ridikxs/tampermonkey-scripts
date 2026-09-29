// ==UserScript==
// @name         CheckPRO + Image Collapse
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  CheckPRO: предпросмотр чеков/PDF, копирование ссылки, зум, полноэкранный режим и часы МСК. Image Collapse: сворачивание и раскрытие изображений в Chatwoot.
// @author       Calvin/Will
// @match        https://sparkmoth.com/app/*
// @match        https://blueripple.xyz/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CheckPRO.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CheckPRO.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';


    // =========================================================
    // CONFIG
    // =========================================================

    const IS_CHATWOOT =
        location.hostname === 'sparkmoth.com';

    const IS_BLUERIPPLE =
        location.hostname === 'blueripple.xyz';



    // =========================================================
    // STYLES
    // =========================================================

    GM_addStyle(`

        /* =====================================================
           IMAGE COLLAPSE
        ===================================================== */

        .cw-image-wrapper {
            position: relative;
            overflow: hidden;
            max-height: 80px;
            border-radius: 8px;
            transition: max-height 0.25s ease;
        }

        .cw-image-wrapper.cw-open {
            max-height: 5000px;
        }

        .cw-image-wrapper::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 42px;

            background:
                linear-gradient(
                    rgba(0, 0, 0, 0),
                    rgba(0, 0, 0, 0.55)
                );

            pointer-events: none;
            transition: opacity 0.2s;
        }

        .cw-image-wrapper.cw-open::after {
            opacity: 0;
        }

        .cw-image-toggle {
            margin-top: 8px;

            display: flex;
            align-items: center;
            justify-content: center;

            width: 100%;

            padding: 8px 10px;

            cursor: pointer;
            user-select: none;

            border-radius: 8px;

            background: #334155;
            color: #ffffff;

            font-size: 13px;
            font-weight: 600;

            transition: background-color 0.2s;
        }

        .cw-image-toggle:hover {
            background: #475569;
        }


        /* =====================================================
           CHECKPRO
        ===================================================== */

        .checkpro-button {
            display: block;

            width: 100%;

            margin-top: 8px;

            padding: 8px 16px;

            border-radius: 8px;

            font-size: 14px;

            text-align: center;

            cursor: pointer;

            border:
                1px solid var(
                    --n-container,
                    #3f3f46
                );

            background-color: #202024;
            color: #ffffff;

            transition:
                background-color 0.2s,
                color 0.2s,
                border-color 0.2s;
        }

        .checkpro-button:hover {
            background-color: #2d2d32;
        }

        .checkpro-preview {
            margin-top: 12px;

            width: 100%;

            border: 1px solid #3f3f46;
            border-radius: 8px;

            overflow: hidden;

            background-color: #202024;

            display: flex;
            flex-direction: column;
        }

        .checkpro-toolbar {
            display: flex;

            justify-content: space-between;
            align-items: center;

            gap: 10px;

            padding: 8px 12px;

            background-color: #202024;

            border-bottom: 1px solid #3f3f46;
        }

        .checkpro-clock {
            color: #a1a1aa;

            font-size: 14px;
            font-weight: 500;

            white-space: nowrap;
        }

        .checkpro-zoom-controls {
            display: flex;

            align-items: center;

            gap: 8px;
        }

        .checkpro-control {
            background-color: #3f3f46;
            color: #ffffff;

            border: none;

            border-radius: 4px;

            padding: 4px 10px;

            cursor: pointer;

            font-weight: bold;

            transition: background-color 0.2s;
        }

        .checkpro-control:hover {
            background-color: #52525b;
        }

        .checkpro-zoom-label {
            color: #ffffff;

            font-size: 13px;

            min-width: 40px;

            text-align: center;
        }

        .checkpro-iframe-wrapper {
            width: 100%;
            height: 450px;

            resize: vertical;

            overflow: hidden;
        }

        .checkpro-iframe {
            width: 100%;
            height: 100%;

            border: none;

            background-color: #ffffff;
        }

        .checkpro-preview.checkpro-fullscreen {
            position: fixed !important;

            top: 0 !important;
            left: 0 !important;

            width: 100vw !important;
            height: 100vh !important;

            z-index: 999999 !important;

            border-radius: 0 !important;

            margin-top: 0 !important;
        }

        .checkpro-preview.checkpro-fullscreen
        .checkpro-iframe-wrapper {
            height: calc(100vh - 52px);
            resize: none;
        }

    `);



    // =========================================================
    // COMMON EVENT BLOCK
    // =========================================================

    function stopEvents(e) {

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }



    // =========================================================
    // MODULE 1
    // CHECKPRO
    //
    // Чеки / PDF:
    //
    // - открыть PDF
    // - скопировать ссылку
    // - предпросмотр
    // - zoom
    // - fullscreen
    // - часы МСК
    // =========================================================

    function processDocumentBlocks() {

        const downloadLinks =
            document.querySelectorAll(
                'a[href]:not([data-checkpro-enhanced])'
            );


        downloadLinks.forEach(link => {

            const text =
                link.textContent.trim();


            const possibleDownload =
                text === 'Скачать' ||
                link.classList.contains(
                    'bg-n-solid-3'
                );


            if (!possibleDownload) {

                return;
            }


            /*
             * Всегда получаем актуальную ссылку,
             * потому что Chatwoot может менять DOM.
             */

            const getActualUrl = () => {

                return (
                    link.href || ''
                ).split('#')[0];
            };


            const fileContainer =
                link.closest(
                    '.grid.gap-4'
                );


            const isPdfUrl =
                getActualUrl()
                    .toLowerCase()
                    .includes('.pdf');


            let isPdfDom = false;


            if (fileContainer) {

                const fileNameEl =
                    fileContainer.querySelector(
                        '.text-n-slate-11'
                    );


                if (
                    fileNameEl &&
                    fileNameEl.textContent
                        .toLowerCase()
                        .includes('.pdf')
                ) {

                    isPdfDom = true;
                }
            }


            /*
             * Если это не PDF —
             * CheckPRO его не трогает.
             */

            if (
                !isPdfUrl &&
                !isPdfDom
            ) {

                link.setAttribute(
                    'data-checkpro-enhanced',
                    'ignored'
                );

                return;
            }


            link.setAttribute(
                'data-checkpro-enhanced',
                'true'
            );


            /*
             * Переименовываем Скачать → Открыть
             */

            if (
                link.textContent.trim() ===
                'Скачать'
            ) {

                link.textContent =
                    'Открыть';
            }


            const buttonContainer =
                link.parentElement;


            const mainContainer =
                fileContainer ||
                buttonContainer;


            if (
                !buttonContainer ||
                !mainContainer
            ) {

                return;
            }



            // =================================================
            // ORIGINAL OPEN BUTTON
            // =================================================

            link.addEventListener(
                'click',
                (e) => {

                    e.preventDefault();
                    e.stopPropagation();


                    window.open(
                        getActualUrl(),
                        '_blank'
                    );

                }
            );



            // =================================================
            // COPY LINK BUTTON
            // =================================================

            const copyBtn =
                document.createElement(
                    'button'
                );


            copyBtn.type =
                'button';


            copyBtn.className =
                'checkpro-button';


            copyBtn.textContent =
                'Скопировать ссылку';



            copyBtn.addEventListener(
                'click',
                async (e) => {

                    e.preventDefault();
                    e.stopPropagation();


                    const currentUrl =
                        getActualUrl();


                    const originalText =
                        copyBtn.textContent;



                    const showSuccess = () => {

                        copyBtn.textContent =
                            'Скопировано!';


                        copyBtn.style.backgroundColor =
                            '#4ade80';


                        copyBtn.style.color =
                            '#000000';


                        setTimeout(() => {

                            copyBtn.textContent =
                                originalText;


                            copyBtn.style.backgroundColor =
                                '';


                            copyBtn.style.color =
                                '';

                        }, 1500);
                    };



                    try {

                        if (
                            navigator.clipboard &&
                            navigator.clipboard.writeText
                        ) {

                            await navigator.clipboard.writeText(
                                currentUrl
                            );

                        } else {

                            GM_setClipboard(
                                currentUrl
                            );
                        }


                        showSuccess();

                    } catch {

                        GM_setClipboard(
                            currentUrl
                        );


                        showSuccess();
                    }

                }
            );



            // =================================================
            // PREVIEW BUTTON
            // =================================================

            const previewBtn =
                document.createElement(
                    'button'
                );


            previewBtn.type =
                'button';


            previewBtn.className =
                'checkpro-button';


            previewBtn.textContent =
                '👁 Предпросмотр чека';



            let previewContainer =
                null;


            let iframe =
                null;


            let currentZoom =
                100;


            let clockInterval =
                null;



            previewBtn.addEventListener(
                'click',
                (e) => {

                    e.preventDefault();
                    e.stopPropagation();


                    /*
                     * Создаём предпросмотр
                     * только при первом клике.
                     */

                    if (!previewContainer) {

                        previewContainer =
                            createPreview();


                        mainContainer.appendChild(
                            previewContainer
                        );


                        previewBtn.textContent =
                            'Скрыть предпросмотр';


                        return;
                    }


                    /*
                     * Если был скрыт —
                     * показываем снова.
                     */

                    if (
                        previewContainer.style.display ===
                        'none'
                    ) {

                        iframe.src =
                            `${getActualUrl()}#zoom=${currentZoom}`;


                        previewContainer.style.display =
                            'flex';


                        previewBtn.textContent =
                            'Скрыть предпросмотр';


                        return;
                    }


                    /*
                     * Если fullscreen —
                     * сначала выходим из него.
                     */

                    previewContainer.classList.remove(
                        'checkpro-fullscreen'
                    );


                    previewContainer.style.display =
                        'none';


                    previewBtn.textContent =
                        '👁 Предпросмотр чека';

                }
            );



            // =================================================
            // CREATE PREVIEW
            // =================================================

            function createPreview() {

                const container =
                    document.createElement(
                        'div'
                    );


                container.className =
                    'checkpro-preview';



                // =============================================
                // TOOLBAR
                // =============================================

                const toolbar =
                    document.createElement(
                        'div'
                    );


                toolbar.className =
                    'checkpro-toolbar';



                // =============================================
                // MOSCOW CLOCK
                // =============================================

                const timeDisplay =
                    document.createElement(
                        'div'
                    );


                timeDisplay.className =
                    'checkpro-clock';



                const updateClock = () => {

                    const mskTime =
                        new Intl.DateTimeFormat(
                            'ru-RU',
                            {
                                timeZone:
                                    'Europe/Moscow',

                                hour:
                                    '2-digit',

                                minute:
                                    '2-digit',

                                second:
                                    '2-digit'
                            }
                        ).format(
                            new Date()
                        );


                    timeDisplay.textContent =
                        `МСК: ${mskTime}`;
                };


                updateClock();


                clockInterval =
                    setInterval(
                        updateClock,
                        1000
                    );



                // =============================================
                // ZOOM
                // =============================================

                const zoomControls =
                    document.createElement(
                        'div'
                    );


                zoomControls.className =
                    'checkpro-zoom-controls';



                const zoomOutBtn =
                    document.createElement(
                        'button'
                    );


                zoomOutBtn.type =
                    'button';


                zoomOutBtn.className =
                    'checkpro-control';


                zoomOutBtn.textContent =
                    '➖';



                const zoomLabel =
                    document.createElement(
                        'span'
                    );


                zoomLabel.className =
                    'checkpro-zoom-label';


                zoomLabel.textContent =
                    `${currentZoom}%`;



                const zoomInBtn =
                    document.createElement(
                        'button'
                    );


                zoomInBtn.type =
                    'button';


                zoomInBtn.className =
                    'checkpro-control';


                zoomInBtn.textContent =
                    '➕';



                const updateZoom = () => {

                    zoomLabel.textContent =
                        `${currentZoom}%`;


                    iframe.src =
                        `${getActualUrl()}#zoom=${currentZoom}`;
                };



                zoomInBtn.addEventListener(
                    'click',
                    (e) => {

                        e.preventDefault();
                        e.stopPropagation();


                        currentZoom +=
                            25;


                        updateZoom();

                    }
                );



                zoomOutBtn.addEventListener(
                    'click',
                    (e) => {

                        e.preventDefault();
                        e.stopPropagation();


                        if (
                            currentZoom >
                            25
                        ) {

                            currentZoom -=
                                25;


                            updateZoom();
                        }

                    }
                );



                zoomControls.appendChild(
                    zoomOutBtn
                );


                zoomControls.appendChild(
                    zoomLabel
                );


                zoomControls.appendChild(
                    zoomInBtn
                );



                // =============================================
                // FULLSCREEN
                // =============================================

                const fullscreenBtn =
                    document.createElement(
                        'button'
                    );


                fullscreenBtn.type =
                    'button';


                fullscreenBtn.className =
                    'checkpro-control';


                fullscreenBtn.textContent =
                    '⛶ На весь экран';



                fullscreenBtn.addEventListener(
                    'click',
                    (e) => {

                        e.preventDefault();
                        e.stopPropagation();


                        const isFullscreen =
                            container.classList.toggle(
                                'checkpro-fullscreen'
                            );


                        fullscreenBtn.textContent =
                            isFullscreen
                                ? '✖ Закрыть'
                                : '⛶ На весь экран';

                    }
                );



                // =============================================
                // IFRAME
                // =============================================

                const iframeWrapper =
                    document.createElement(
                        'div'
                    );


                iframeWrapper.className =
                    'checkpro-iframe-wrapper';



                iframe =
                    document.createElement(
                        'iframe'
                    );


                iframe.className =
                    'checkpro-iframe';


                iframe.src =
                    `${getActualUrl()}#zoom=${currentZoom}`;



                iframeWrapper.appendChild(
                    iframe
                );



                // =============================================
                // BUILD
                // =============================================

                toolbar.appendChild(
                    timeDisplay
                );


                toolbar.appendChild(
                    zoomControls
                );


                toolbar.appendChild(
                    fullscreenBtn
                );


                container.appendChild(
                    toolbar
                );


                container.appendChild(
                    iframeWrapper
                );


                return container;
            }



            buttonContainer.appendChild(
                copyBtn
            );


            buttonContainer.appendChild(
                previewBtn
            );

        });
    }



    // =========================================================
    // MODULE 2
    // CHATWOOT IMAGE COLLAPSE
    //
    // Только sparkmoth.com
    //
    // - автоматически сворачивает изображения
    // - показывает первые 80px
    // - кнопка показать / скрыть
    // - кнопка не открывает fullscreen Chatwoot
    // =========================================================

    function processImageBubble(
        bubble
    ) {

        if (
            bubble.dataset.cwReady ===
            '1'
        ) {

            return;
        }


        const wrapper =
            bubble.querySelector(
                '.relative.group'
            );


        if (!wrapper) {

            return;
        }


        /*
         * Защита от повторной обработки.
         */

        bubble.dataset.cwReady =
            '1';


        wrapper.classList.add(
            'cw-image-wrapper'
        );



        const btn =
            document.createElement(
                'div'
            );


        btn.className =
            'cw-image-toggle';


        btn.textContent =
            '🖼 Показать изображение';



        /*
         * Не даём Chatwoot перехватить
         * события кнопки и открыть
         * встроенный fullscreen.
         */

        const blockEventsList = [

            'mousedown',
            'mouseup',
            'dblclick',
            'pointerdown',
            'pointerup'

        ];


        blockEventsList.forEach(
            eventName => {

                btn.addEventListener(
                    eventName,
                    stopEvents,
                    true
                );

            }
        );



        btn.addEventListener(
            'click',
            (e) => {

                stopEvents(e);


                const isOpen =
                    wrapper.classList.toggle(
                        'cw-open'
                    );


                btn.textContent =
                    isOpen
                        ? '🙈 Скрыть изображение'
                        : '🖼 Показать изображение';

            },
            true
        );



        wrapper.after(
            btn
        );
    }



    // =========================================================
    // IMAGE SCAN
    // =========================================================

    function scanImages(
        rootNode
    ) {

        if (
            !IS_CHATWOOT ||
            !rootNode
        ) {

            return;
        }


        /*
         * Если rootNode сам является bubble.
         */

        if (
            rootNode.matches?.(
                '[data-bubble-name="image"]'
            )
        ) {

            processImageBubble(
                rootNode
            );
        }


        /*
         * Все bubbles внутри.
         */

        const bubbles =
            rootNode.querySelectorAll?.(
                '[data-bubble-name="image"]'
            ) || [];


        bubbles.forEach(
            processImageBubble
        );


        /*
         * Поддержка Shadow DOM,
         * если Chatwoot где-либо его использует.
         */

        const allElements =
            rootNode.querySelectorAll?.(
                '*'
            ) || [];


        for (
            const el of allElements
        ) {

            if (
                el.shadowRoot
            ) {

                scanImages(
                    el.shadowRoot
                );
            }
        }
    }



    // =========================================================
    // GLOBAL SCAN
    // =========================================================

    function scanPage() {

        /*
         * CheckPRO работает:
         *
         * sparkmoth.com
         * blueripple.xyz
         */

        processDocumentBlocks();


        /*
         * Image Collapse работает
         * только в Chatwoot.
         */

        if (IS_CHATWOOT) {

            scanImages(
                document.body
            );
        }
    }



    // =========================================================
    // INITIAL SCAN
    // =========================================================

    scanPage();



    // =========================================================
    // SINGLE MUTATION OBSERVER
    //
    // Один observer вместо двух отдельных —
    // меньше лишней нагрузки.
    // =========================================================

    let scanTimer =
        null;


    const observer =
        new MutationObserver(
            mutations => {

                const hasAdditions =
                    mutations.some(
                        mutation =>
                            mutation
                                .addedNodes
                                .length > 0
                    );


                if (!hasAdditions) {

                    return;
                }


                if (scanTimer) {

                    clearTimeout(
                        scanTimer
                    );
                }


                scanTimer =
                    setTimeout(
                        () => {

                            scanPage();

                        },
                        150
                    );
            }
        );



    observer.observe(
        document.documentElement,
        {
            childList:
                true,

            subtree:
                true
        }
    );

})();