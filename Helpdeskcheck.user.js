// ==UserScript==
// @name         Helpdesk: Дубль и Чек
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    // Умное ожидание появления активной кнопки Submit (до 5 секунд)
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

    // Функция для вставки текста в редактор
    async function pasteTextToEditor(text) {
        const editor = document.getElementById('rich-text-area');
        if (!editor) {
            alert('Не найдено поле для ввода текста!');
            return false;
        }

        editor.focus();

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        editor.dispatchEvent(pasteEvent);

        await sleep(200);

        if (editor.textContent.trim() === '') {
            document.execCommand('insertText', false, text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return true;
    }

    // Универсальная функция для смены статуса тикета
    async function changeTicketStatus(desiredStatus) {
        // Ищем текст 'Ticket status', затем берем кнопку рядом с ним
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
                    await sleep(1000); // Ждем применения статуса
                } else {
                    console.warn(`Статус "${desiredStatus}" не найден в списке!`);
                }
            }
        }
    }

    // Функция для создания наших кнопок
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
        container.style.width = '60px';

        const btnDouble = document.createElement('button');
        btnDouble.innerText = 'Дубль';
        btnDouble.style.padding = '8px';
        btnDouble.style.cursor = 'pointer';
        btnDouble.style.backgroundColor = '#4CAF50';
        btnDouble.style.color = 'white';
        btnDouble.style.border = 'none';
        btnDouble.style.borderRadius = '4px';
        btnDouble.onclick = handleDouble;

        const btnCheck = document.createElement('button');
        btnCheck.innerText = 'чек';
        btnCheck.style.padding = '8px';
        btnCheck.style.cursor = 'pointer';
        btnCheck.style.backgroundColor = '#2196F3';
        btnCheck.style.color = 'white';
        btnCheck.style.border = 'none';
        btnCheck.style.borderRadius = '4px';
        btnCheck.onclick = handleCheck;

        container.appendChild(btnDouble);
        container.appendChild(btnCheck);
        document.body.appendChild(container);
    }

    setInterval(injectButtons, 2000);

    // Логика для кнопки "чек"
    async function handleCheck() {
        try {
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

            if (!casinoName) {
                casinoName = "[Название не определено]";
            }

            const messageText = `Для дальнейшего рассмотрения вашего запроса, предоставьте, пожалуйста, следующую информацию:

Справку/чек/квитанцию из банка с финальным (успешным) статусом платежа в ФОРМАТЕ PDF. Квитанцию вы можете найти в разделе "История операций". Она должна содержать:
- дату и время платежа;
- сумму;
- реквизиты отправителя и получателя.

С уважением, команда ${casinoName} Casino.`;

            // 1. Вставляем текст
            await pasteTextToEditor(messageText);

            // 2. Меняем статус на On hold
            await changeTicketStatus('On hold');

        } catch (err) {
            console.error('Ошибка в скрипте (кнопка чек):', err);
            alert('Произошла ошибка, загляни в консоль (F12)');
        }
    }

    // Логика для кнопки "Дубль"
    async function handleDouble() {
        try {
            const textToPaste = await navigator.clipboard.readText();

            const switchOff = document.querySelector('[data-testid="switch-off"]');
            if (switchOff) {
                switchOff.click();
                await sleep(500);
            }

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

            const switchOn = document.querySelector('[data-testid="switch-on"]');
            if (switchOn) {
                switchOn.click();
                await sleep(500);
            }

            // Меняем статус на Closed (используем нашу новую общую функцию)
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
