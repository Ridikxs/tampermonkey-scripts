// ==UserScript==
// @name         SmartScroll
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Кнопки для быстрого скролла.
// @author       Calvin
// @match        https://www2.fundist.org/ru/Users/Summary*
// @match        https://www7.fundist.org/ru/Users/Summary*
// @match        https://backoffice.r7.casino/ru/Users/Summary*
// @match        https://backoffice.catcasino.com/ru/Users/Summary*
// @match        https://backoffice.gama.casino/ru/Users/Summary*
// @match        https://backoffice.daddy.casino/ru/Users/Summary*
// @match        https://backoffice.spark.casino/ru/Users/Summary*
// @match        https://backoffice.mers.casino/ru/Users/Summary*
// @match        https://backoffice.kent.casino/ru/Users/Summary*
// @match        https://backoffice.kometa.casino/ru/Users/Summary*
// @match        https://www9.fundist.org/ru/Users/Summary*
// @match        https://backoffice.arkada.casino/ru/Users/Summary*
// @match        https://cc.boadmin.org/ru/Users/Summary*
// @match        https://gm.boadmin.org/ru/Users/Summary*
// @match        https://dy.boadmin.org/ru/Users/Summary*
// @match        https://mr.boadmin.org/ru/Users/Summary*
// @match        https://kn.boadmin.org/ru/Users/Summary*
// @match        https://rs.boadmin.org/ru/Users/Summary*
// @match        https://kt.boadmin.org/ru/Users/Summary*
// @match        https://ak.boadmin.org/ru/Users/Summary*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fundist.org
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SmartScroll.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/SmartScroll.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация кнопок с точными ID из HTML и иконками FontAwesome
    const navItems = [
        { text: 'Обороты/прибыль', icon: 'fa-money', id: 'TurnoverOutcomesDataHeader' },
        { text: 'Документы',       icon: 'fa-id-card-o', id: 'DocumentsHeader' },
        { text: 'Депозиты',        icon: 'fa-credit-card', id: 'LastDepositsContainer' },
        { text: 'Выводы',          icon: 'fa-bank', id: 'RequestsForWithdrawTitle' }, // Обновленный ID для выводов
        { text: 'Бонусы',          icon: 'fa-gift', id: 'BonusesTitleHeader' }
    ];

    function injectSidebarButtons() {
        const sideMenu = document.getElementById('side-menu');

        // Если боковое меню еще не прогрузилось - ждем
        if (!sideMenu) return false;

        // Защита от двойного добавления
        if (document.getElementById('custom-quick-nav')) return true;

        // Создаем визуальный разделитель/заголовок для наших кнопок
        const divider = document.createElement('li');
        divider.id = 'custom-quick-nav';
        divider.innerHTML = '<span style="color: rgba(255,255,255,0.4); font-weight: 600; padding: 15px 20px 5px 20px; display: block; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Быстрый переход</span>';
        sideMenu.appendChild(divider);

        // Добавляем сами кнопки
        navItems.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');

            // Используем #, чтобы курсор был как у ссылки, но переход блокируем через JS
            a.href = '#';
            a.title = item.text;
            // Копируем нативную структуру: иконка + текст
            a.innerHTML = `<i class="fa ${item.icon}"></i><span class="nav-label">${item.text}</span>`;

            a.addEventListener('click', (e) => {
                e.preventDefault(); // Отменяем переход по ссылке

                const targetElement = document.getElementById(item.id);

                if (targetElement) {
                    // Плавный скролл к центру
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Временная подсветка блока
                    const originalBg = targetElement.style.backgroundColor;
                    const originalTransition = targetElement.style.transition;

                    targetElement.style.transition = 'background-color 0.5s ease';
                    targetElement.style.backgroundColor = 'rgba(26, 179, 148, 0.4)';

                    setTimeout(() => {
                        targetElement.style.backgroundColor = originalBg;
                        setTimeout(() => {
                            targetElement.style.transition = originalTransition;
                        }, 500);
                    }, 1500);

                } else {
                    console.warn(`Блок для "${item.text}" (ID: ${item.id}) не найден на странице.`);
                }
            });

            li.appendChild(a);
            sideMenu.appendChild(li);
        });

        return true;
    }

    // Запускаем проверку каждые 500мс, пока боковое меню не появится в DOM (максимум 10 попыток)
    let attempts = 0;
    const interval = setInterval(() => {
        if (injectSidebarButtons() || attempts > 10) {
            clearInterval(interval);
        }
        attempts++;
    }, 500);

})();
