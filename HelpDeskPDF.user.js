// ==UserScript==
// @name         HelpDeskPDF
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Автоматически встраивает PDF прямо в сообщения с возможностью масштабирования, полноэкранного режима и сворачивания
// @author       Calvin
// @match        https://app.helpdesk.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=helpdesk.com
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HelpDeskPDF.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HelpDeskPDF.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // 1. Стили для встроенного блока и панели управления
    const styles = `
        .pdf-inline-container {
            margin: 12px 0;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            overflow: hidden;
            background: #f9fafb;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            transition: box-shadow 0.2s ease;
            max-width: 100%;
        }
        .pdf-inline-container:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        /* В полноэкранном режиме убираем рамки и делаем фон темным */
        .pdf-inline-container:fullscreen {
            border-radius: 0;
            border: none;
            background: #374151;
            display: flex;
            flex-direction: column;
        }
        .pdf-inline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #1f2937;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            user-select: none;
        }
        .pdf-inline-title {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .pdf-inline-actions {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
        }
        .pdf-action-btn {
            background: #374151;
            color: #e5e7eb;
            border: 1px solid #4b5563;
            border-radius: 4px;
            padding: 3px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            text-decoration: none !important;
        }
        .pdf-action-btn:hover {
            background: #4b5563;
            color: #ffffff;
            border-color: #6b7280;
        }
        .pdf-action-btn.btn-collapse {
            background: #3b82f6;
            border-color: #2563eb;
            color: white;
        }
        .pdf-action-btn.btn-collapse:hover {
            background: #2563eb;
        }
        /* Обертка для iframe с возможностью изменения высоты мышью */
        .pdf-iframe-wrapper {
            height: 480px;
            min-height: 200px;
            max-height: 85vh;
            resize: vertical;
            overflow: hidden;
            position: relative;
            background: #525659;
        }
        .pdf-inline-container:fullscreen .pdf-iframe-wrapper {
            height: 100% !important;
            max-height: none !important;
            flex-grow: 1;
            resize: none;
        }
        .pdf-inline-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
        .pdf-collapsed .pdf-iframe-wrapper {
            display: none;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // 2. Функция извлечения имени файла из ссылки
    function getFileName(url, fallbackText) {
        try {
            const cleanUrl = url.split('?')[0];
            const name = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
            return name.toLowerCase().endsWith('.pdf') ? decodeURIComponent(name) : fallbackText;
        } catch (e) {
            return fallbackText || 'Документ PDF';
        }
    }

    // 3. Основная функция обработки ссылок
    function processPdfLinks() {
        const links = document.querySelectorAll('a:not([data-pdf-tools-added])');

        links.forEach(link => {
            const href = link.getAttribute('href') || '';
            const text = link.innerText || '';

            if (href.toLowerCase().includes('.pdf') || text.toLowerCase().includes('.pdf')) {
                link.setAttribute('data-pdf-tools-added', 'true');

                const fileName = getFileName(href, text);

                // Создаем главный контейнер
                const container = document.createElement('div');
                container.className = 'pdf-inline-container';

                // Создаем шапку
                const header = document.createElement('div');
                header.className = 'pdf-inline-header';

                const title = document.createElement('div');
                title.className = 'pdf-inline-title';
                title.innerHTML = `<span>📄</span> <span>${fileName}</span>`;

                const actions = document.createElement('div');
                actions.className = 'pdf-inline-actions';

                // Кнопка: Свернуть / Развернуть
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'pdf-action-btn btn-collapse';
                toggleBtn.innerHTML = '▲ Свернуть';
                toggleBtn.title = 'Скрыть или показать документ';
                toggleBtn.onclick = (e) => {
                    e.preventDefault();
                    container.classList.toggle('pdf-collapsed');
                    const isCollapsed = container.classList.contains('pdf-collapsed');
                    toggleBtn.innerHTML = isCollapsed ? '▼ Развернуть' : '▲ Свернуть';
                    toggleBtn.style.background = isCollapsed ? '#10b981' : ''; // Зеленый, когда свернуто
                };

                // Кнопка: На весь экран
                const fullscreenBtn = document.createElement('button');
                fullscreenBtn.className = 'pdf-action-btn';
                fullscreenBtn.innerHTML = '⛶ На весь экран';
                fullscreenBtn.title = 'Развернуть документ на весь монитор';
                fullscreenBtn.onclick = (e) => {
                    e.preventDefault();
                    if (!document.fullscreenElement) {
                        container.requestFullscreen().catch(err => {
                            console.error(`Ошибка перевода в полноэкранный режим: ${err.message}`);
                        });
                        fullscreenBtn.innerHTML = '✕ Выйти из полноэкранного';
                    } else {
                        document.exitFullscreen();
                        fullscreenBtn.innerHTML = '⛶ На весь экран';
                    }
                };

                // Слушатель выхода из полноэкранного режима (по Escape)
                document.addEventListener('fullscreenchange', () => {
                    if (!document.fullscreenElement) {
                        fullscreenBtn.innerHTML = '⛶ На весь экран';
                    }
                });

                // Кнопка: Открыть в вкладке
                const openBtn = document.createElement('button');
                openBtn.className = 'pdf-action-btn';
                openBtn.innerHTML = '↗️ Вкладка';
                openBtn.title = 'Открыть документ в новой вкладке';
                openBtn.onclick = (e) => {
                    e.preventDefault();
                    window.open(href, '_blank');
                };

                // Кнопка: Копировать ссылку
                const copyBtn = document.createElement('button');
                copyBtn.className = 'pdf-action-btn';
                copyBtn.innerHTML = '📋 Копировать';
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(href).then(() => {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '✅ Скопировано!';
                        copyBtn.style.color = '#10b981';
                        copyBtn.style.borderColor = '#10b981';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                            copyBtn.style.color = '';
                            copyBtn.style.borderColor = '';
                        }, 1500);
                    });
                };

                // Сборка кнопок в шапку
                actions.appendChild(toggleBtn);
                actions.appendChild(fullscreenBtn);
                actions.appendChild(openBtn);
                actions.appendChild(copyBtn);

                header.appendChild(title);
                header.appendChild(actions);

                // Обертка с iframe для просмотра PDF
                const iframeWrapper = document.createElement('div');
                iframeWrapper.className = 'pdf-iframe-wrapper';
                iframeWrapper.title = 'Потяните за правый нижний угол, чтобы изменить высоту';

                const iframe = document.createElement('iframe');
                iframe.className = 'pdf-inline-iframe';
                iframe.src = href;
                iframe.setAttribute('allowfullscreen', 'true');

                iframeWrapper.appendChild(iframe);
                container.appendChild(header);
                container.appendChild(iframeWrapper);

                // Вставляем встроенный просмотрщик сразу под блоком ссылки (или прямо после ссылки)
                // Если ссылка лежит внутри параграфа (p, div), лучше вставить после этого параграфа для красивой верстки
                const parentBlock = link.closest('p, div, li') || link.parentNode;
                parentBlock.parentNode.insertBefore(container, parentBlock.nextSibling);
            }
        });
    }

    // 4. Наблюдатель за динамической загрузкой сообщений
    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldRun = true;
                break;
            }
        }
        if (shouldRun) {
            processPdfLinks();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Первичный запуск
    processPdfLinks();

})();
