// ==UserScript==
// @name         Helpdesk: Дубль и Чек
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Автоматизация рутинных задач в Helpdesk
// @author       Calvin
// @match        https://app.helpdesk.com/tickets/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Helpdeskcheck.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Helpdeskcheck.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Вспомогательная функция для пауз
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Функция определения названия проекта
    function getProjectName() {
        let casinoName = "";
        const teamElement = document.querySelector('[data-testid="assigned-team"] p');

        if (teamElement) {
            const teamText = teamElement.textContent.trim();
            const projects = ['Kent', 'Gama', 'R7', 'Kometa', 'Mers', 'Daddy', 'Arkada'];

            for (let proj of projects) {
                if (teamText.includes(proj)) {
                    casinoName = proj;
                    break;
                }
            }

            if (teamText.includes('CatCasino') || teamText.includes('Cat')) {
                casinoName = 'Cat';
            }
        }

        return casinoName || "[Название не определено]";
    }

    // Управление приватным режимом
    async function setPrivateMode(isPrivate) {
        if (isPrivate) {
            // Включаем приват (ищем switch-off и кликаем)
            const switchOff = document.querySelector('[data-testid="switch-off"]');
            if (switchOff) {
                switchOff.click();
                await sleep(300);
            }
        } else {
            // Выключаем приват (ищем switch-on и кликаем)
            const switchOn = document.querySelector('[data-testid="switch-on"]');
            if (switchOn) {
                switchOn.click();
                await sleep(300);
            }
        }
    }

    // Умное ожидание появления активной кнопки Submit
    async function waitForActiveSubmit(timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitBtn = buttons.find(b =>
                b.textContent.trim() === 'Submit' &&
                b.getAttribute('aria-disabled') !== 'true' &&
                !b.disabled
            );
            if (submitBtn) return submitBtn;
            await sleep(200);
        }
        return null;
    }

    // Функция для клика и вставки текста в редактор
    async function pasteTextToEditor(text) {
        const editor = document.getElementById('rich-text-area');
        if (!editor) {
            alert('Не найдено поле для ввода текста!');
            return false;
        }

        // 1. Сначала кликаем по строке ввода текста
        editor.click();
        await sleep(100);
        editor.focus();
        await sleep(100);

        // 2. Имитируем вставку текста (Ctrl+V)
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        editor.dispatchEvent(pasteEvent);

        await sleep(200);

        // Резервный вариант, если paste не сработал
        if (editor.textContent.trim() === '') {
            document.execCommand('insertText', false, text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return true;
    }

    // Универсальная функция для смены статуса тикета
    async function changeTicketStatus(desiredStatus) {
        const statusLabels = Array.from(document.querySelectorAll('p')).filter(p => p.textContent.includes('Ticket status'));
        if (statusLabels.length > 0) {
            const statusButtonContainer = statusLabels[0].nextElementSibling;
            if (!statusButtonContainer) return;
            const statusBtn = statusButtonContainer.querySelector('button');

            if (statusBtn) {
                statusBtn.click(); // Открываем меню
                await sleep(500);

                // Ищем нужный статус в выпадающем списке
                const option = Array.from(document.querySelectorAll('div, span, button')).find(
                    el => el.textContent.trim() === desiredStatus
                );

                if (option) {
                    option.click();
                    await sleep(1000);
                }
            }
        }
    }

    // Функция для создания кнопок интерфейса
    function injectButtons() {
        if (document.getElementById('custom-helpdesk-tools')) return;

        const container = document.createElement('div');
        container.id = 'custom-helpdesk-tools';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '10px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.width = '80px'; // Чуть расширил, чтобы влезло длинное слово

        const createBtn = (text, color, handler) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.padding = '8px';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = color;
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.onclick = handler;
            return btn;
        };

        const btnDouble = createBtn('Дубль', '#4CAF50', handleDouble);       // Зеленый
        const btnCheck = createBtn('чек', '#2196F3', handleCheck);         // Синий
        const btnPragmatic = createBtn('Pragmatic', '#FF9800', handlePragmatic); // Оранжевый

        container.appendChild(btnDouble);
        container.appendChild(btnCheck);
        container.appendChild(btnPragmatic);
        document.body.appendChild(container);
    }

    setInterval(injectButtons, 2000);

    // Логика "Pragmatic"
    async function handlePragmatic() {
        try {
            const casinoName = getProjectName();
            const messageText = `Сообщаем вам, что на данный момент у провайдера Pragmatic Play ведутся технические работы.\n\nПриносим свои извинения от лица проекта за предоставленные неудобства.\n\nДля получения мгновенных ответов на ваши вопросы, обращайтесь в службу поддержки на сайте!\nС уважением, команда ${casinoName} Casino!`;

            await setPrivateMode(false); // Выключаем приват (публичный ответ)
            await pasteTextToEditor(messageText);
            await changeTicketStatus('Closed');

        } catch (err) {
            console.error('Ошибка в скрипте (кнопка Pragmatic):', err);
            alert('Произошла ошибка, загляни в консоль (F12)');
        }
    }

    // Логика "чек"
    async function handleCheck() {
        try {
            const casinoName = getProjectName();
            const messageText = `Для дальнейшего рассмотрения вашего запроса, предоставьте, пожалуйста, следующую информацию:\n\nСправку/чек/квитанцию из банка с финальным (успешным) статусом платежа в ФОРМАТЕ PDF. Квитанцию вы можете найти в разделе "История операций". Она должна содержать:\n- дату и время платежа;\n- сумму;\n- реквизиты отправителя и получателя.\n\nС уважением, команда ${casinoName} Casino.`;

            await setPrivateMode(false); // Выключаем приват
            await pasteTextToEditor(messageText);
            await changeTicketStatus('On hold');

        } catch (err) {
            console.error('Ошибка в скрипте (кнопка чек):', err);
            alert('Произошла ошибка, загляни в консоль (F12)');
        }
    }

    // Логика "Дубль"
    async function handleDouble() {
        try {
            const textToPaste = await navigator.clipboard.readText();

            await setPrivateMode(true); // Включаем приват

            const isPasted = await pasteTextToEditor(textToPaste);
            if (!isPasted) return;

            let submitBtn = await waitForActiveSubmit(5000);
            if (submitBtn) {
                submitBtn.click();
                await sleep(2000);
            } else {
                alert('Кнопка Submit так и не стала активной.');
                return;
            }

            await setPrivateMode(false); // Снова выключаем приват для статуса
            await changeTicketStatus('Closed');

            submitBtn = await waitForActiveSubmit(3000);
            if (submitBtn) {
                submitBtn.click();
            }

        } catch (err) {
            console.error('Ошибка в скрипте (кнопка Дубль):', err);
            alert('Произошла ошибка, загляни в консоль (F12)');
        }
    }
})();
