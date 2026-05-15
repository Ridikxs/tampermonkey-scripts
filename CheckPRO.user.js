// ==UserScript==
// @name         CheckPRO
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Предпросмотр PDF с зумом, полноэкранный режим, часы МСК, копирование ссылки
// @author       Calvin
// @match        https://sparkmoth.com/app/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CheckPRO.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/CheckPRO.user.js
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function processDocumentBlocks() {
        const downloadLinks = document.querySelectorAll('a[href]:not([data-enhanced])');

        downloadLinks.forEach(link => {
            if (link.textContent.trim() === 'Скачать' || link.classList.contains('bg-n-solid-3')) {

                const url = link.href.split('#')[0]; // Очищаем URL от старых параметров
                const fileContainer = link.closest('.grid.gap-4');

                // Проверяем, что это PDF
                const isPdfUrl = url.toLowerCase().includes('.pdf');
                let isPdfDom = false;

                if (fileContainer) {
                    const fileNameEl = fileContainer.querySelector('.text-n-slate-11');
                    if (fileNameEl && fileNameEl.textContent.toLowerCase().includes('.pdf')) {
                        isPdfDom = true;
                    }
                }

                if (!isPdfUrl && !isPdfDom) {
                    link.setAttribute('data-enhanced', 'ignored');
                    return;
                }

                link.setAttribute('data-enhanced', 'true');

                if (link.textContent.trim() === 'Скачать') {
                    link.textContent = 'Открыть';
                }

                const buttonContainer = link.parentElement;
                const mainContainer = fileContainer || buttonContainer;

                if (!buttonContainer) return;

                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(url, '_blank');
                });

                const btnStyle = `
                    display: block;
                    width: 100%;
                    margin-top: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    text-align: center;
                    cursor: pointer;
                    border: 1px solid var(--n-container, #3f3f46);
                    background-color: #202024;
                    color: #ffffff;
                    transition: all 0.2s;
                `;

                // --- Кнопка "Скопировать ссылку" ---
                const copyBtn = document.createElement('button');
                copyBtn.textContent = 'Скопировать ссылку';
                copyBtn.style.cssText = btnStyle;

                copyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const showSuccess = () => {
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = 'Скопировано!';
                        copyBtn.style.backgroundColor = '#4ade80';
                        copyBtn.style.color = '#000000';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                            copyBtn.style.backgroundColor = '#202024';
                            copyBtn.style.color = '#ffffff';
                        }, 1500);
                    };

                    navigator.clipboard.writeText(url).then(showSuccess).catch(() => {
                        GM_setClipboard(url);
                        showSuccess();
                    });
                });

                // --- Кнопка "Предпросмотр чека" ---
                const previewBtn = document.createElement('button');
                previewBtn.textContent = '👁 Предпросмотр чека';
                previewBtn.style.cssText = btnStyle;

                let previewContainer = null;
                let isPseudoFullscreen = false;

                previewBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (!previewContainer) {
                        previewContainer = document.createElement('div');
                        previewContainer.style.marginTop = '12px';
                        previewContainer.style.width = '100%';
                        previewContainer.style.border = '1px solid #3f3f46';
                        previewContainer.style.borderRadius = '8px';
                        previewContainer.style.overflow = 'hidden';
                        previewContainer.style.backgroundColor = '#202024';
                        previewContainer.style.display = 'flex';
                        previewContainer.style.flexDirection = 'column';

                        // Панель инструментов
                        const toolbar = document.createElement('div');
                        toolbar.style.display = 'flex';
                        toolbar.style.justifyContent = 'space-between';
                        toolbar.style.alignItems = 'center';
                        toolbar.style.padding = '8px 12px';
                        toolbar.style.backgroundColor = '#202024';
                        toolbar.style.borderBottom = '1px solid #3f3f46';

                        // Левый блок (Часы МСК)
                        const timeDisplay = document.createElement('div');
                        timeDisplay.style.color = '#a1a1aa';
                        timeDisplay.style.fontSize = '14px';
                        timeDisplay.style.fontWeight = '500';

                        const updateClock = () => {
                            const mskTime = new Intl.DateTimeFormat('ru-RU', {
                                timeZone: 'Europe/Moscow',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            }).format(new Date());
                            timeDisplay.textContent = `МСК: ${mskTime}`;
                        };
                        updateClock();
                        setInterval(updateClock, 1000);

                        // Центральный блок (Качественный Зум)
                        const zoomControls = document.createElement('div');
                        zoomControls.style.display = 'flex';
                        zoomControls.style.alignItems = 'center';
                        zoomControls.style.gap = '8px';

                        let currentZoom = 100; // Стартовый зум в процентах

                        const btnCtrlStyle = `
                            background-color: #3f3f46;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 10px;
                            cursor: pointer;
                            font-weight: bold;
                            transition: background-color 0.2s;
                        `;

                        const zoomOutBtn = document.createElement('button');
                        zoomOutBtn.textContent = '➖';
                        zoomOutBtn.style.cssText = btnCtrlStyle;

                        const zoomLabel = document.createElement('span');
                        zoomLabel.textContent = `${currentZoom}%`;
                        zoomLabel.style.color = '#fff';
                        zoomLabel.style.fontSize = '13px';
                        zoomLabel.style.minWidth = '40px';
                        zoomLabel.style.textAlign = 'center';

                        const zoomInBtn = document.createElement('button');
                        zoomInBtn.textContent = '➕';
                        zoomInBtn.style.cssText = btnCtrlStyle;

                        const iframe = document.createElement('iframe');
                        iframe.src = `${url}#zoom=${currentZoom}`;
                        iframe.style.width = '100%';
                        iframe.style.height = '100%';
                        iframe.style.border = 'none';
                        iframe.style.backgroundColor = '#ffffff';

                        // Функция зума через URL-параметр (сохраняет векторное качество PDF)
                        const updateZoom = () => {
                            zoomLabel.textContent = `${currentZoom}%`;
                            iframe.src = `${url}#zoom=${currentZoom}`;
                        };

                        zoomInBtn.onclick = (ev) => { ev.preventDefault(); currentZoom += 25; updateZoom(); };
                        zoomOutBtn.onclick = (ev) => { ev.preventDefault(); if (currentZoom > 25) currentZoom -= 25; updateZoom(); };

                        zoomControls.appendChild(zoomOutBtn);
                        zoomControls.appendChild(zoomLabel);
                        zoomControls.appendChild(zoomInBtn);

                        // Правый блок (На весь экран)
                        const fullscreenBtn = document.createElement('button');
                        fullscreenBtn.textContent = '⛶ На весь экран';
                        fullscreenBtn.style.cssText = btnCtrlStyle;
                        fullscreenBtn.style.fontSize = '13px';

                        // Обертка для iframe
                        const iframeWrapper = document.createElement('div');
                        iframeWrapper.style.width = '100%';
                        iframeWrapper.style.height = '450px';
                        iframeWrapper.style.resize = 'vertical';
                        iframeWrapper.style.overflow = 'hidden';

                        // Логика фулскрина
                        fullscreenBtn.onclick = (ev) => {
                            ev.preventDefault();
                            isPseudoFullscreen = !isPseudoFullscreen;

                            if (isPseudoFullscreen) {
                                previewContainer.style.position = 'fixed';
                                previewContainer.style.top = '0';
                                previewContainer.style.left = '0';
                                previewContainer.style.width = '100vw';
                                previewContainer.style.height = '100vh';
                                previewContainer.style.zIndex = '999999';
                                previewContainer.style.borderRadius = '0';
                                previewContainer.style.marginTop = '0';
                                iframeWrapper.style.height = 'calc(100vh - 44px)';
                                iframeWrapper.style.resize = 'none';
                                fullscreenBtn.textContent = '✖ Закрыть';
                            } else {
                                previewContainer.style.position = 'static';
                                previewContainer.style.width = '100%';
                                previewContainer.style.height = 'auto';
                                previewContainer.style.zIndex = 'auto';
                                previewContainer.style.borderRadius = '8px';
                                previewContainer.style.marginTop = '12px';
                                iframeWrapper.style.height = '450px';
                                iframeWrapper.style.resize = 'vertical';
                                fullscreenBtn.textContent = '⛶ На весь экран';
                            }
                        };

                        toolbar.appendChild(timeDisplay);
                        toolbar.appendChild(zoomControls);
                        toolbar.appendChild(fullscreenBtn);

                        iframeWrapper.appendChild(iframe);
                        previewContainer.appendChild(toolbar);
                        previewContainer.appendChild(iframeWrapper);

                        mainContainer.appendChild(previewContainer);
                        previewBtn.textContent = 'Скрыть предпросмотр';
                    } else {
                        if (previewContainer.style.display === 'none') {
                            previewContainer.style.display = 'flex';
                            previewBtn.textContent = 'Скрыть предпросмотр';
                        } else {
                            if (isPseudoFullscreen) fullscreenBtn.click();
                            previewContainer.style.display = 'none';
                            previewBtn.textContent = '👁 Предпросмотр чека';
                        }
                    }
                });

                buttonContainer.appendChild(copyBtn);
                buttonContainer.appendChild(previewBtn);
            }
        });
    }

    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                shouldProcess = true;
                break;
            }
        }
        if (shouldProcess) {
            processDocumentBlocks();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    processDocumentBlocks();
})();
