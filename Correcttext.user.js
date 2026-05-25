// ==UserScript==
// @name         Correcttext
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Корректор грамматики
// @author       Calvin
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Correcttext.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Correcttext.user.js
// @connect      api.languagetool.org
// ==/UserScript==

(function() {
    'use strict';

    const CRITICAL_WORDS = /money|error|problem|ошибка|проблема|не могу|деньги|не хочу|проигрыш/gi;

    let debounceTimer;
    let uiContainer = null;
    let badge = null;
    let tooltip = null;
    let activeElement = null;
    let isExpanded = false;
    let currentErrorsList = [];

    const style = document.createElement('style');
    style.textContent = `
        ::highlight(lt-grammar) {
            text-decoration: underline wavy #eab308;
            background-color: rgba(234, 179, 8, 0.15);
        }
        ::highlight(lt-critical) {
            text-decoration: underline wavy #ef4444;
            background-color: rgba(239, 68, 68, 0.15);
        }

        #global-lt-badge {
            position: absolute; z-index: 2147483647; width: 24px; height: 24px;
            border-radius: 12px; background-color: #475569; color: #ffffff;
            font-size: 12px; font-weight: bold; font-family: system-ui, sans-serif;
            display: none; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease; user-select: none;
        }
        #global-lt-badge:hover { transform: scale(1.1); }
        #global-lt-badge.lt-error { background-color: #ef4444; }
        #global-lt-badge.lt-clean { background-color: #22c55e; }
        #global-lt-badge.lt-checking { background-color: #eab308; }

        #global-lt-checker {
            position: absolute; z-index: 2147483646; padding: 10px 14px; font-size: 13px;
            background-color: #1e293b; color: #cbd5e1; border: 1px solid #334155;
            border-radius: 8px; box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.5);
            display: none; flex-direction: column; gap: 8px;
            max-height: 200px; max-width: 450px; overflow-y: auto;
            font-family: system-ui, sans-serif;
            transform: translateY(-100%);
        }

        #global-lt-tooltip {
            position: absolute; z-index: 2147483648; padding: 8px;
            background-color: #0f172a; border: 1px solid #475569;
            border-radius: 6px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
            display: none; flex-direction: column; gap: 6px;
            font-family: system-ui, sans-serif; pointer-events: auto;
            max-width: 300px; /* Чтобы длинные замены не ломали верстку */
        }

        .lt-fix-btn {
            background: rgba(163, 230, 53, 0.15); color: #a3e635;
            border: 1px solid rgba(163, 230, 53, 0.3); border-radius: 4px;
            padding: 6px 10px; cursor: pointer; font-size: 13px; font-weight: 500;
            transition: all 0.1s; text-align: left; white-space: pre-wrap; word-break: break-word;
        }
        .lt-fix-btn:hover { background: rgba(163, 230, 53, 0.3); transform: scale(1.02); }
        .lt-fix-btn.delete-btn { background: rgba(248, 113, 113, 0.15); color: #f87171; border-color: rgba(248, 113, 113, 0.3); }
        .lt-fix-btn.delete-btn:hover { background: rgba(248, 113, 113, 0.3); }
    `;
    document.head.appendChild(style);

    function initUI() {
        if (uiContainer && badge && tooltip) return;

        uiContainer = document.createElement('div');
        uiContainer.id = 'global-lt-checker';
        document.body.appendChild(uiContainer);

        badge = document.createElement('div');
        badge.id = 'global-lt-badge';
        document.body.appendChild(badge);

        tooltip = document.createElement('div');
        tooltip.id = 'global-lt-tooltip';
        document.body.appendChild(tooltip);

        const preventFocusLoss = (e) => e.preventDefault();
        uiContainer.addEventListener('mousedown', preventFocusLoss);
        badge.addEventListener('mousedown', preventFocusLoss);
        tooltip.addEventListener('mousedown', preventFocusLoss);

        badge.addEventListener('click', togglePanel);

        tooltip.addEventListener('click', (e) => {
            const btn = e.target.closest('.lt-fix-btn');
            if (!btn || !activeElement) return;
            const offset = parseInt(btn.dataset.offset, 10);
            const length = parseInt(btn.dataset.length, 10);
            const value = btn.dataset.value;
            applyUniversalFix(offset, length, value);
        });
    }

    function togglePanel() {
        if (badge.classList.contains('lt-clean') || badge.classList.contains('lt-checking')) return;
        isExpanded = !isExpanded;
        uiContainer.style.display = isExpanded ? 'flex' : 'none';
    }

    document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text') || el.isContentEditable) {
            initUI();
            activeElement = el;

            const text = extractText(el);
            if (isTextMeaningful(text)) {
                positionUI(el);
                analyzeText(text);
            }

            el.addEventListener('input', handleInput, { once: false });
            // Используем pointerup для гарантии того, что браузер обновил курсор
            el.addEventListener('pointerup', handleEditorClick, { once: false });
            el.addEventListener('keyup', handleKeyboardNav, { once: false });
        }
    });

    document.addEventListener('focusout', (e) => {
        setTimeout(() => {
            if (activeElement && !activeElement.contains(document.activeElement) && document.activeElement.id !== 'global-lt-tooltip') {
                hideAllUI();
                activeElement.removeEventListener('input', handleInput);
                activeElement.removeEventListener('pointerup', handleEditorClick);
                activeElement.removeEventListener('keyup', handleKeyboardNav);
                activeElement = null;
            }
        }, 100);
    });

    function hideAllUI() {
        if(badge) badge.style.display = 'none';
        if(uiContainer) uiContainer.style.display = 'none';
        if(tooltip) tooltip.style.display = 'none';
        isExpanded = false;
        clearHighlights();
    }

    function isTextMeaningful(text) {
        return text.replace(/[\u200B-\u200D\uFEFF\s]/g, '').length > 0;
    }

    function handleInput(e) {
        clearTimeout(debounceTimer);
        const text = extractText(e.target);
        if(tooltip) tooltip.style.display = 'none';

        if (!isTextMeaningful(text)) {
            hideAllUI();
            return;
        }

        positionUI(e.target);
        setBadgeState('checking', '...');

        debounceTimer = setTimeout(() => analyzeText(text), 800);
    }

    // Скрываем меню, если пользователь двигает курсор стрелочками
    function handleKeyboardNav(e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (tooltip) tooltip.style.display = 'none';
        }
    }

    function handleEditorClick(e) {
        // Даем браузеру 10мс на установку курсора после клика
        setTimeout(() => {
            if (!activeElement || currentErrorsList.length === 0) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            let caretOffset = getCaretOffset(activeElement);
            // Ищем ошибку, в которую попал курсор
            const clickedError = currentErrorsList.find(err => caretOffset >= err.offset && caretOffset <= err.offset + err.length);

            if (clickedError) {
                showTooltip(e, clickedError);
            } else {
                tooltip.style.display = 'none';
            }
        }, 10);
    }

    function getCaretOffset(el) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.selectionStart;
        if (el.isContentEditable) {
            let caret = 0;
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(el);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                caret = preCaretRange.toString().length;
            }
            return caret;
        }
        return 0;
    }

    function showTooltip(e, error) {
        tooltip.innerHTML = '';
        let buttonsHTML = '';

        if (error.type === 'grammar' && error.replacements && error.replacements.length > 0) {
            buttonsHTML = error.replacements.slice(0, 3).map(r => {
                let val = r.value, displayVal = val, btnClass = "lt-fix-btn";
                // Показываем видимый пробел, только если предлагают заменить ТОЛЬКО на пробел
                if (!val.trim() && val.length > 0) displayVal = val.replace(/ /g, '·');
                else if (val === "") { displayVal = '🗑️ Удалить лишнее'; btnClass += " delete-btn"; }

                return `<button class="${btnClass}" data-offset="${error.offset}" data-length="${error.length}" data-value="${val}">${displayVal}</button>`;
            }).join('');
        } else if (error.type === 'critical') {
            buttonsHTML = `<button class="lt-fix-btn delete-btn" data-offset="${error.offset}" data-length="${error.length}" data-value="">🗑️ Удалить слово</button>`;
        }

        if (buttonsHTML) {
            tooltip.innerHTML = buttonsHTML;
            tooltip.style.display = 'flex';

            // Вычисляем координаты, чтобы меню не улетало за правый край экрана
            let posX = e.pageX - 20;
            const rect = tooltip.getBoundingClientRect();
            if (posX + rect.width > window.innerWidth) {
                posX = window.innerWidth - rect.width - 20;
            }

            tooltip.style.left = Math.max(10, posX) + 'px';
            tooltip.style.top = (e.pageY + 15) + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    }

    function extractText(el) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
        if (el.isContentEditable) return el.textContent;
        return '';
    }

    function positionUI(el) {
        if (!badge || !uiContainer) return;
        const rect = el.getBoundingClientRect();

        badge.style.top = (rect.bottom + window.scrollY - 12) + 'px';
        badge.style.left = (rect.right + window.scrollX - 12) + 'px';
        badge.style.display = 'flex';

        uiContainer.style.top = (rect.top + window.scrollY - 10) + 'px';
        uiContainer.style.left = (rect.left + window.scrollX) + 'px';
        uiContainer.style.width = Math.max(rect.width, 300) + 'px';
    }

    function setBadgeState(state, text) {
        badge.className = '';
        badge.classList.add(`lt-${state}`);
        badge.textContent = text;
        badge.style.display = 'flex';
    }

    function analyzeText(text) {
        let localAlerts = [];
        let match;
        CRITICAL_WORDS.lastIndex = 0;
        while ((match = CRITICAL_WORDS.exec(text)) !== null) {
            localAlerts.push({ type: 'critical', word: match[0], offset: match.index, length: match[0].length });
        }

        // МАГИЯ ДЛЯ СЛИПШИХСЯ СЛОВ: Принудительно ставим русский язык, если есть кириллица
        const detectedLang = /[а-яА-ЯёЁ]/.test(text) ? 'ru' : 'auto';

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.languagetool.org/v2/check",
            data: `language=${detectedLang}&text=` + encodeURIComponent(text),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            onload: function(response) {
                try {
                    if (!activeElement || extractText(activeElement) !== text) return;
                    renderResults(localAlerts, JSON.parse(response.responseText).matches);
                } catch (e) {
                    if (activeElement && extractText(activeElement) === text) setBadgeState('error', '!');
                }
            }
        });
    }

    function getRangeFromOffset(rootNode, offset, length) {
        let charCount = 0;
        let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            let nodeLength = node.nodeValue.length;
            if (!startNode && charCount + nodeLength > offset) {
                startNode = node;
                startOffset = offset - charCount;
            }
            if (startNode && !endNode && charCount + nodeLength >= offset + length) {
                endNode = node;
                endOffset = (offset + length) - charCount;
                break;
            }
            charCount += nodeLength;
        }
        if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            return range;
        }
        return null;
    }

    function clearHighlights() {
        if ('highlights' in CSS) CSS.highlights.clear();
        currentErrorsList = [];
    }

    function renderResults(localAlerts, apiMatches) {
        uiContainer.innerHTML = '';
        clearHighlights();

        const totalErrors = localAlerts.length + (apiMatches ? apiMatches.length : 0);

        if (totalErrors === 0) {
            setBadgeState('clean', '✓');
            uiContainer.style.display = 'none';
            if(tooltip) tooltip.style.display = 'none';
            isExpanded = false;
            setTimeout(() => { if (badge.classList.contains('lt-clean')) badge.style.display = 'none'; }, 2000);
            return;
        }

        setBadgeState('error', totalErrors > 9 ? '9+' : totalErrors);

        const grammarRanges = [];
        const criticalRanges = [];

        if (localAlerts.length > 0) {
            const alertDiv = document.createElement('div');
            alertDiv.style.cssText = 'color: #fca5a5; background: rgba(239, 68, 68, 0.1); padding: 6px 10px; border-radius: 6px; border-left: 3px solid #ef4444;';
            const wordsList = localAlerts.map(a => a.word).join(', ');
            alertDiv.innerHTML = `⚠️ <b>Запрещенные слова:</b> <span style="text-decoration: underline;">${wordsList}</span> (кликните по ним в тексте для удаления)`;
            uiContainer.appendChild(alertDiv);

            localAlerts.forEach(alert => {
                currentErrorsList.push(alert);
                if (activeElement.isContentEditable) {
                    const r = getRangeFromOffset(activeElement, alert.offset, alert.length);
                    if (r) criticalRanges.push(r);
                }
            });
        }

        if (apiMatches && apiMatches.length > 0) {
            apiMatches.forEach(match => {
                const errDiv = document.createElement('div');
                errDiv.style.cssText = 'background: rgba(255, 255, 255, 0.03); padding: 6px 10px; border-radius: 6px; border-left: 3px solid #eab308; display: flex; flex-direction: column; gap: 4px;';

                const ctx = match.context;
                const prefix = ctx.text.substring(Math.max(0, ctx.offset - 15), ctx.offset);
                const suffix = ctx.text.substring(ctx.offset + ctx.length, Math.min(ctx.text.length, ctx.offset + ctx.length + 15));
                let badWord = ctx.text.substring(ctx.offset, ctx.offset + ctx.length);
                if (!badWord.trim()) badWord = badWord.replace(/ /g, '·');

                const contextHTML = `<span style="color: #64748b;">...${prefix}</span><span style="color: #fde047; text-decoration: underline wavy; text-decoration-color: #eab308; text-underline-offset: 3px;">${badWord}</span><span style="color: #64748b;">${suffix}...</span>`;

                errDiv.innerHTML = `<div>${contextHTML}</div><div style="font-size: 11px; color: #94a3b8;">💡 ${match.message}</div>`;
                uiContainer.appendChild(errDiv);

                currentErrorsList.push({ type: 'grammar', offset: match.offset, length: match.length, replacements: match.replacements });
                if (activeElement.isContentEditable) {
                    const r = getRangeFromOffset(activeElement, match.offset, match.length);
                    if (r) grammarRanges.push(r);
                }
            });
        }

        if (activeElement.isContentEditable && 'highlights' in CSS) {
            if (grammarRanges.length > 0) CSS.highlights.set('lt-grammar', new Highlight(...grammarRanges));
            if (criticalRanges.length > 0) CSS.highlights.set('lt-critical', new Highlight(...criticalRanges));
        }
    }

    function applyUniversalFix(offset, length, newText) {
        if (!activeElement) return;

        tooltip.style.display = 'none';

        if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            activeElement.setRangeText(newText, offset, offset + length, 'end');
            activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            analyzeText(extractText(activeElement));

        } else if (activeElement.isContentEditable) {
            const range = getRangeFromOffset(activeElement, offset, length);
            if (range) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('insertText', false, newText);
                analyzeText(extractText(activeElement));
            }
        }
    }
})();