// ==UserScript==
// @name         HBHelper
// @namespace    http://tampermonkey.net/
// @version      2.0
// @author       Calvin
// @match        *://*.fundist.org/*
// @match        *://backoffice.r7.casino/*
// @match        *://backoffice.catcasino.com/*
// @match        *://backoffice.gama.casino/*
// @match        *://backoffice.daddy.casino/*
// @match        *://backoffice.mers.casino/*
// @match        *://backoffice.kent.casino/*
// @match        *://backoffice.kometa.casino/*
// @match        *://backoffice.arkada.casino/*
// @match        *://*.boadmin.org/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HBHelper.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/HBHelper.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const RESTRICTED_TAGS = [
        'Cheater', 'Bonushunter', 'Streamer',
        'BonushunterFraudName', 'Full Restriction', 'Restriction NoDep'
    ];

    const r7Bonuses = {
        2: "Бонус: 50 FS в слотах Zeus vs Hades/Big Bass Bonanza/Big Bass Bonanza 1000\nВейджер: х35\nВремя на отыгрыш: 1 день\nМакс выигрыш: 1 500 RUB / 15 EUR\nТег: Birthday_2lvl\nПромокод: HAPPY2\nСтавка: 5 рублей\nBonus ID: 112028",
        3: "Бонус: 75 FS в слотах Zeus vs Hades/Big Bass Bonanza/Big Bass Bonanza 1000\nВейджер: х35\nВремя на отыгрыш: 2 дня\nМакс выигрыш: 2500 RUB / 25 EUR\nТег: Birthday_3lvl\nПромокод: HAPPY3\nСтавка: 5 рублей\nBonus ID: 112034",
        4: "Бонус: 100 FS в слотах The Dog House/Sweet Bonanza Super Scatter/Gates of Olympus Super Scatter\nВейджер: х35\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 3000 RUB / 30 EUR\nТег: Birthday_4lvl\nПромокод: HAPPY4\nСтавка: 10 рублей\nBonus ID: 112037",
        5: "Бонус: 125 FS в слотах The Dog House/Sweet Bonanza Super Scatter/Gates of Olympus Super Scatter\nВейджер: х30\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 5000 RUB / 50 EUR\nТег: Birthday_5lvl\nПромокод: HAPPY5\nСтавка: 20 рублей\nBonus ID: 112040",
        6: "Бонус: 5000 RUB / 50 EUR на бонусный баланс\nВейджер: х20\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 10 000 RUB / 100 EUR\nТег: Birthday_6lvl\nПромокод: HAPPY6\nBonus ID: 112058",
        7: "Бонус: 7 500 RUB / 75 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 15 000 RUB / 150 EUR\nТег: Birthday_7lvl\nПромокод: HAPPY7\nBonus ID: 112061",
        8: "Бонус: 10 000 RUB / 100 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 20 000 RUB / 200 EUR\nТег: Birthday_8lvl\nПромокод: HAPPY8\nBonus ID: 112064",
        9: "Бонус: 20 000 RUB / 200 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 40 000 RUB / 400 EUR\nТег: Birthday_9lvl\nПромокод: HAPPY9\nBonus ID: 112067",
        10: "Бонус: 35 000 RUB / 350 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 60 000 RUB / 600 EUR\nТег: Birthday_10lvl\nПромокод: HAPPY10\nBonus ID: 112709",
        11: "Бонус: 45 000 RUB / 450 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 70 000 RUB / 700 EUR\nТег: Birthday_11lvl\nПромокод: HAPPY11\nBonus ID: 112889",
        12: "Бонус: 55 000 RUB / 550 EUR на бонусный баланс\nВейджер: х5\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 80 000 RUB / 800 EUR\nТег: Birthday_12lvl\nПромокод: HAPPY12\nBonus ID: 112895",
        13: "Бонус: 65 000 RUB / 650 EUR на бонусный баланс\nВейджер: х5\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 90 000 RUB / 900 EUR\nТег: Birthday_13lvl\nПромокод: HAPPY13\nBonus ID: 112898",
        14: "Бонус: 85 000 RUB / 850 EUR на бонусный баланс\nВейджер: х5\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 100 000 RUB / 1000 EUR\nТег: Birthday_14lvl\nПромокод: HAPPY14\nBonus ID: 112892"
    };

    const gamaBonuses = {
        2: "Бонус: 1 000 RUB / 10 EUR на бонусный баланс\nВейджер: х45\nВремя на отыгрыш: 1 день\nМакс выигрыш: 5 000 RUB / 50 EUR / 175.00 BYN / 25000.00 KZT\nТег: RegularHPBonus\nBonus ID: 78554",
        3: "Бонус: 2 500 RUB / 25 EUR на бонусный баланс\nВейджер: х40\nВремя на отыгрыш: 2 дня\nМакс выигрыш: 10 000 RUB / 100 EUR / 360.00 BYN / 50000.00 KZT\nBonus ID: 78578",
        4: "Бонус: 10 000 RUB / 100 EUR на бонусный баланс + 100фс\nВейджер: х35\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 30 000 RUB / 300 EUR / 1090.00 BYN / 150000.00 KZT\nBonus ID: 78581",
        5: "Бонус: 30 000 RUB / 300 EUR на бонусный баланс + 300фс\nВейджер: х30\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 75 000 RUB / 750 EUR / 2730.00 BYN / 375000.00 KZT\nBonus ID: 78584"
    };

    const daddyBonuses = {
        2: "Цепочка бонусов:\n1) Бонус: 100 FS (Zeus vs Hades)\nВейджер: х25 | Время: 1 день | Макс вин: 2 000 RUB / 20 EUR\nТег: Birthday_2LVL | Bonus ID: 246007 | Ставка: 10 RUB\nПромо: HAPPYDAY2 (если трудности - вручную)\n\n2) Деп. бонус: 100 FS (Zeus vs Hades)\nМин. деп: 900 RUB\nВейджер: х15 | Время: 1 день | Макс вин: 3 500 RUB / 35 EUR\nТег: Birthday_2LVL | Bonus ID: 246019 | Ставка: 10 RUB",
        3: "Цепочка бонусов:\n1) Бонус: 150 FS (Sweet Powernudge)\nВейджер: х15 | Время: 1 день | Макс вин: 3 000 RUB / 30 EUR\nТег: Birthday_3LVL | Bonus ID: 246022 | Ставка: 10 RUB\nПромо: HAPPYDAY3 (если трудности - вручную)\n\n2) Деп. бонус: 100 FS (Zeus vs Hades)\nМин. деп: 900 RUB\nВейджер: х15 | Время: 1 день | Макс вин: 4 000 RUB / 40 EUR\nТег: Birthday_3LVL | Bonus ID: 246010 | Ставка: 20 RUB",
        4: "Цепочка бонусов:\n1) Бонус: 10 000 RUB / 100 EUR на баланс\nВейджер: х10 | Время: 1 день | Макс вин: 10 000 RUB / 100 EUR\nТег: Birthday_4LVL | Bonus ID: 246175\nПромо: HAPPYDAY4 (если трудности - вручную)\n\n2) Деп. бонус: 100 FS (Zeus vs Hades)\nМин. деп: 900 RUB\nВейджер: х10 | Время: 1 день | Макс вин: 10 000 RUB / 100 EUR\nТег: Birthday_4LVL | Bonus ID: 246013 | Ставка: 40 RUB",
        5: "Цепочка бонусов:\n1) Бонус: 20 000 RUB / 200 EUR на баланс\nВейджер: х5 | Время: 1 день | Макс вин: 20 000 RUB / 200 EUR\nТег: Birthday_5LVL | Bonus ID: 246382\nПромо: HAPPYDAY5 (если трудности - вручную)\n\n2) Деп. бонус: 100 FS (Zeus vs Hades)\nМин. деп: 900 RUB\nВейджер: х5 | Время: 1 день | Макс вин: 20 000 RUB / 200 EUR\nТег: Birthday_5LVL | Bonus ID: 246016 | Ставка: 50 RUB"
    };

    const kentBonuses = {
        2: "Бонус: 100 FS Oracle of Gold\nВейджер: х45\nВремя на отыгрыш: 1 день\nМакс выигрыш: 2 000 RUB / 20 EUR\nСтавка: 10 руб\nТег: BronzeHPBonus\nBonus ID: 86684",
        3: "Бонус: 200 FS Gem Elevator\nВейджер: х40\nВремя на отыгрыш: 2 дня\nМакс выигрыш: 4 000 RUB / 40 EUR\nСтавка: 10 руб\nBonus ID: 86687",
        4: "Бонус: 5 000 RUB / 50 EUR на бонусный баланс + 100фс\nВейджер: х35\nВремя на отыгрыш: 3 дня\nМакс выигрыш: х2\nСтавка ФС: 20 руб\nBonus ID: 86690",
        5: "Бонус: 10 000 RUB / 100 EUR на бонусный баланс + 200фс\nВейджер: х30\nВремя на отыгрыш: 3 дня\nМакс выигрыш: х2\nСтавка ФС: 20 руб\nBonus ID: 86693",
        6: "Бонус: 20 000 RUB / 200 EUR на бонусный баланс + 400фс\nВейджер: х30\nВремя на отыгрыш: 3 дня\nМакс выигрыш: х2\nСтавка ФС: 20 руб\nBonus ID: 86699",
        7: "Бонус: 100 000 RUB / 1 000 EUR на бонусный баланс\nВейджер: х20\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 200 000 RUB / 2 000 EUR\nBonus ID: 86702",
        8: "Бонус: 150 000 RUB / 1 500 EUR на бонусный баланс\nВейджер: х20\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 300 000 RUB / 3 000 EUR\nBonus ID: 86705",
        9: "Бонус: 200 000 RUB / 2 000 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 500 000 RUB / 5 000 EUR\nBonus ID: 86708",
        10: "Бонус: 500 000 RUB / 5 000 EUR на бонусный баланс\nВейджер: х3\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 1 000 000 RUB / 10 000 EUR\nBonus ID: 86714"
    };

    const kometaBonuses = {
        3: "Бонус: \"C Днем Рождения, Venus!\"\n1000 RUB / 10 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 1 день\nМакс ставка: 20 руб\nМакс выигрыш: х1\nBonus ID: 5748",
        4: "Бонус: \"C Днем Рождения, Mercury!\"\n2000 RUB / 20 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 1 день\nМакс ставка: 30 руб\nМакс выигрыш: х1\nBonus ID: 5751",
        5: "Бонус: \"C Днем Рождения, Mars!\"\n4000 RUB / 40 EUR на бонусный баланс\nВейджер: х15\nВремя на отыгрыш: 1 день\nМакс ставка: 50 руб\nМакс выигрыш: х1\nBonus ID: 5754",
        6: "Бонус: \"C Днем Рождения, Jupiter!\"\n8 000 RUB / 80 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 1 день\nМакс ставка: 100 руб\nМакс выигрыш: х1\nBonus ID: 5757",
        7: "Бонус: \"C Днем Рождения, Saturn!\"\n20 000 RUB / 200 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 1 день\nМакс ставка: 500 руб\nМакс выигрыш: х1\nBonus ID: 5760",
        8: "Бонус: \"C Днем Рождения, Uranus!\"\n40 000 RUB / 400 EUR на бонусный баланс\nВейджер: х10\nВремя на отыгрыш: 1 день\nМакс ставка: 1000 руб\nМакс выигрыш: х1\nBonus ID: 5763",
        9: "Personal бонусы начисляемые VIP отделом",
        10: "Personal бонусы начисляемые VIP отделом"
    };

    const arkadaBonuses = {
        3: "Бонус: 20 FS в слоте Ze Zeus\nВейджер: х45\nВремя на отыгрыш: 1 день\nМакс выигрыш: 600 RUB / 6 EUR / 20.00 BYN / 3000.00 KZT\nBonus ID: 15708",
        4: "Бонус: 50 FS в слоте The Dog House\nВейджер: х40\nВремя на отыгрыш: 1 день\nМакс выигрыш: 2 000 RUB / 20 EUR / 70.00 BYN / 10000.00 KZT\nBonus ID: 15711",
        5: "Бонус: 100 FS в слоте Sweet Bonanza 1000\nВейджер: х35\nВремя на отыгрыш: 1 день\nМакс выигрыш: 4 000 RUB / 40 EUR / 140.00 BYN / 20000.00 KZT\nBonus ID: 15714",
        6: "Бонус: 20 EUR\nВейджер: х30\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15717",
        7: "Бонус: 40 EUR\nВейджер: х30\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15720",
        8: "Бонус: 60 EUR\nВейджер: х20\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15723",
        9: "Бонус: 75 EUR\nВейджер: х20\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15726",
        10: "Бонус: 90 EUR\nВейджер: х15\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15729",
        11: "Бонус: 150 EUR\nВейджер: х10\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15732",
        12: "Бонус: 300 EUR\nВейджер: х10\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15735",
        13: "Бонус: 700 EUR\nВейджер: х5\nВремя на отыгрыш: 1 день\nМакс выигрыш: х2 от суммы бонуса\nBonus ID: 15738",
        14: "Secret level 1\nPersonal bonus\nВейджер: х3\nВремя на отыгрыш: 1 день\nМакс выигрыш: х10 от суммы бонуса",
        15: "Secret level 2\nPersonal bonus\nВейджер: х3\nВремя на отыгрыш: 1 день\nМакс выигрыш: х10 от суммы бонуса",
        16: "Secret level 3\nPersonal bonus\nВейджер: х3\nВремя на отыгрыш: 1 день\nМакс выигрыш: х10 от суммы бонуса"
    };

    function getCatBonus(tags) {
        if (tags.includes('VIP')) {
            return `Бонус: "Happy Birthday by CatCasino VIP"\nСумма: 10000 RUB + 100 FS (Wild Cash X9990)\nВейджер: x35\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 30000 RUB\nОтыгрыш: С реального и бонусного баланса\nBonus ID: 211312`;
        } else if (tags.includes('Privip')) {
            return `Бонус: "Happy Birthday by CatCasino Privip"\nСумма: 2500 RUB\nВейджер: x40\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 10000 RUB\nОтыгрыш: С реального и бонусного баланса\nBonus ID: 211306`;
        } else {
            return `Бонус: 1 000 RUB\nВейджер: x45\nВремя на отыгрыш: 3 дня\nМакс выигрыш: 5000 RUB\nОтыгрыш: С реального и бонусного баланса\nBonus ID: 211303`;
        }
    }

    function getProjectName() {
        const spanLogin = document.querySelector('#CurrentLogin');
        const divProject = document.querySelector('.project-name');

        let text = ((spanLogin ? spanLogin.innerText : '') + ' ' + (divProject ? divProject.innerText : '')).toLowerCase();

        if (text.includes('r7')) return 'R7';
        if (text.includes('catcasino')) return 'Catcasino';
        if (text.includes('gama')) return 'Gama';
        if (text.includes('daddy')) return 'Daddy';
        if (text.includes('kent')) return 'Kent';
        if (text.includes('kometa')) return 'Kometa';
        if (text.includes('arkada')) return 'Arkada';

        return 'Unknown';
    }

    function isBirthdayWindow(dobString, project) {
        if (!dobString) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dobMatch = dobString.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!dobMatch) return false;

        const bMonth = parseInt(dobMatch[2], 10) - 1;
        const bDay = parseInt(dobMatch[3], 10);

        const checkDates = [
            new Date(today.getFullYear() - 1, bMonth, bDay),
            new Date(today.getFullYear(), bMonth, bDay),
            new Date(today.getFullYear() + 1, bMonth, bDay)
        ];

        let minDiff = Infinity;
        for (let d of checkDates) {
            let diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            if (Math.abs(diffDays) < Math.abs(minDiff)) {
                minDiff = diffDays;
            }
        }

        if (project === 'R7') {
            return minDiff >= 0 && minDiff <= 4;
        } else if (['Catcasino', 'Gama', 'Daddy', 'Kent', 'Kometa', 'Arkada'].includes(project)) {
            return minDiff >= -1 && minDiff <= 3;
        }

        return false;
    }

    function parsePageData() {
        const dobElem = document.querySelector('[name="col-DateOfBirthDd"]');
        const levelElem = document.querySelector('#loyaltyBlockTbody [name="col-Level"]');

        if (!dobElem) return null;

        const dateOfBirth = dobElem.textContent.trim();
        const level = levelElem ? (parseInt(levelElem.textContent.trim(), 10) || 0) : 0;
        const project = getProjectName();

        const tagElements = document.querySelectorAll('.fun-page-header__statuses .name, #tags-wrapper .name');
        const tagsSet = new Set();
        tagElements.forEach(el => tagsSet.add(el.textContent.trim()));
        const tags = Array.from(tagsSet);
        const foundRestrictedTags = tags.filter(tag => RESTRICTED_TAGS.includes(tag));

        const exclusionElem = document.querySelector('#ExlusionStatusStr');
        const exclusionText = exclusionElem ? exclusionElem.textContent : '';
        const hasPhoneDuplication = exclusionText.includes('Телефон');

        const depositRows = document.querySelectorAll('#lastDepositsSucceededTable tbody tr');
        const now = new Date();
        const limitDate = new Date();
        limitDate.setDate(now.getDate() - 180);

        let depositsCount = 0;
        let depositsSum = 0;

        depositRows.forEach(row => {
            const dateElem = row.querySelector('[name="col-Date"]');
            const amountElem = row.querySelector('[name="col-AmountConverted"]');

            if (dateElem && amountElem) {
                const dateStr = dateElem.textContent.trim();
                const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);

                if (match) {
                    const rowDate = new Date(`${match[3]}-${match[2]}-${match[1]}`);
                    if (rowDate >= limitDate && rowDate <= now) {
                        depositsCount++;

                        let amountStr = amountElem.textContent.replace(/,/g, '').replace(/&nbsp;/g, '').replace(/\s/g, '');
                        let amountMatch = amountStr.match(/[\d.]+/);
                        if (amountMatch) {
                            depositsSum += parseFloat(amountMatch[0]);
                        }
                    }
                }
            }
        });

        return {
            dateOfBirth, level, project, tags, depositsCount, depositsSum,
            hasPhoneDuplication, foundRestrictedTags
        };
    }

    function injectUI(data) {
        if (document.querySelector('#hbhelper-widget-centered')) return;

        // Находим блок с тегами. Вставим наш виджет прямо ПЕРЕД ним.
        const tagsWrapper = document.querySelector('#tags-wrapper') || document.querySelector('.fun-page-header__statuses');
        const fallbackWrapper = document.querySelector('.wrapper-content');

        if (!tagsWrapper && !fallbackWrapper) return;

        let isSystemEligible = false;
        let bonusText = "";
        let checksHtml = "";
        let globalBlocksHtml = "";
        let isGloballyBlocked = false;

        if (data.hasPhoneDuplication) {
            globalBlocksHtml += `<span style="color: #dc3545; font-weight: bold;" title="Обнаружено дублирование по телефону!">Дубль: Телефон</span> | `;
            isGloballyBlocked = true;
        }
        if (data.foundRestrictedTags.length > 0) {
            globalBlocksHtml += `<span style="color: #dc3545; font-weight: bold;" title="Найдены запрещенные теги: ${data.foundRestrictedTags.join(', ')}">Блок-тег</span> | `;
            isGloballyBlocked = true;
        }

        let dateCheck = isBirthdayWindow(data.dateOfBirth, data.project);

        if (data.project === 'R7') {
            let levelCheck = data.level >= 2 && data.level <= 14;
            let depositCheck = true;
            if (data.level >= 2 && data.level <= 4) {
                depositCheck = data.depositsCount > 0;
            }

            isSystemEligible = levelCheck && depositCheck && dateCheck && !isGloballyBlocked;
            bonusText = r7Bonuses[data.level] || "Бонус не найден для этого уровня";

            checksHtml = `
                <span style="color: ${dateCheck ? '#28a745' : '#dc3545'};" title="Дата: ${data.dateOfBirth}">Дата</span> |
                <span style="color: ${levelCheck ? '#28a745' : '#dc3545'};" title="Уровень: ${data.level}">Уровень</span> |
                <span style="color: ${depositCheck ? '#28a745' : '#dc3545'};" title="Депозиты 180 дней: ${data.depositsCount}">Депы</span>
            `;

        } else if (data.project === 'Catcasino') {
            let tagCheck = data.tags.includes('HPBonus');
            let sumCheck = data.depositsSum >= 3000;

            isSystemEligible = tagCheck && sumCheck && dateCheck && !isGloballyBlocked;
            bonusText = getCatBonus(data.tags);

            checksHtml = `
                <span style="color: ${dateCheck ? '#28a745' : '#dc3545'};" title="Дата: ${data.dateOfBirth}">Дата</span> |
                <span style="color: ${sumCheck ? '#28a745' : '#dc3545'};" title="Сумма за 180 дней: ${data.depositsSum} RUB">Сумма (>=3000)</span> |
                <span style="color: ${tagCheck ? '#28a745' : '#dc3545'};" title="Текущие теги: ${data.tags.join(', ')}">Тег (HPBonus)</span>
            `;

        } else if (data.project === 'Gama' || data.project === 'Daddy' || data.project === 'Kent') {
            let maxLevel = data.project === 'Kent' ? 10 : 5;
            let levelCheck = data.level >= 2 && data.level <= maxLevel;
            let depositCheck = true;
            let depositText = "";

            if (data.level === 2) {
                depositCheck = data.depositsCount >= 3 && data.depositsSum >= 3000;
                depositText = `<span style="color: ${depositCheck ? '#28a745' : '#dc3545'};" title="Депозиты 180 дней: ${data.depositsCount} (нужно >=3), Сумма: ${data.depositsSum} RUB (нужно >=3000)">Депы (>=3, >=3000)</span>`;
            } else if (data.level >= 3 && data.level <= maxLevel) {
                depositText = `<span style="color: #28a745;" title="Для уровней 3-${maxLevel} депозиты за 180 дней не проверяются">Депы (Не нужны)</span>`;
            } else {
                depositCheck = false;
                depositText = `<span style="color: #dc3545;" title="Уровень не подходит">Депы</span>`;
            }

            isSystemEligible = levelCheck && depositCheck && dateCheck && !isGloballyBlocked;

            if (data.project === 'Gama') {
                bonusText = gamaBonuses[data.level] || "Бонус не найден для этого уровня";
            } else if (data.project === 'Daddy') {
                bonusText = daddyBonuses[data.level] || "Бонус не найден для этого уровня";
            } else if (data.project === 'Kent') {
                bonusText = kentBonuses[data.level] || "Бонус не найден для этого уровня";
            }

            checksHtml = `
                <span style="color: ${dateCheck ? '#28a745' : '#dc3545'};" title="Дата: ${data.dateOfBirth}">Дата</span> |
                <span style="color: ${levelCheck ? '#28a745' : '#dc3545'};" title="Уровень: ${data.level}">Уровень (2-${maxLevel})</span> |
                ${depositText}
            `;

        } else if (data.project === 'Kometa') {
            let levelCheck = data.level >= 3 && data.level <= 10;
            let depositCheck = true;
            let depositText = `<span style="color: #28a745;" title="Для данного проекта депозиты не проверяются">Депы (Не нужны)</span>`;

            isSystemEligible = levelCheck && depositCheck && dateCheck && !isGloballyBlocked;
            bonusText = kometaBonuses[data.level] || "Бонус не найден для этого уровня";

            checksHtml = `
                <span style="color: ${dateCheck ? '#28a745' : '#dc3545'};" title="Дата: ${data.dateOfBirth}">Дата</span> |
                <span style="color: ${levelCheck ? '#28a745' : '#dc3545'};" title="Уровень: ${data.level}">Уровень (3-10)</span> |
                ${depositText}
            `;

        } else if (data.project === 'Arkada') {
            let levelCheck = data.level >= 3 && data.level <= 16;
            let depositCheck = true;
            let depositText = `<span style="color: #28a745;" title="Для уровней 3 и выше депозиты не проверяются">Депы (Не нужны)</span>`;

            isSystemEligible = levelCheck && depositCheck && dateCheck && !isGloballyBlocked;
            bonusText = arkadaBonuses[data.level] || "Бонус не найден для этого уровня";

            checksHtml = `
                <span style="color: ${dateCheck ? '#28a745' : '#dc3545'};" title="Дата: ${data.dateOfBirth}">Дата</span> |
                <span style="color: ${levelCheck ? '#28a745' : '#dc3545'};" title="Уровень: ${data.level}">Уровень (3-16)</span> |
                ${depositText}
            `;

        } else {
            checksHtml = `<span style="color: #ffc107;">Проект "${data.project}" пока не настроен</span>`;
        }

        if (data.project !== 'Unknown') {
            let verifColor = isSystemEligible ? '#ffc107' : '#777';
            checksHtml += ` | <label style="cursor:${isSystemEligible ? 'pointer' : 'not-allowed'}; color:${verifColor}; margin-bottom:0; font-weight:bold;" title="Проверьте верификацию клиента вручную">
                <input type="checkbox" id="verif-check" ${!isSystemEligible ? 'disabled' : ''} style="vertical-align:middle; margin:0 5px 0 0; cursor:${isSystemEligible ? 'pointer' : 'not-allowed'}; transform: scale(1.2);">Вериф
            </label>`;
        }

        // Обновленная верстка: Блочный, центрированный, с отступами, на 100% ширины
        const widgetHtml = `
            <div id="hbhelper-widget-centered" style="display: block; clear: both; width: 100%; text-align: center; margin: 15px 0 25px 0; padding: 10px; border: 1px dashed #666; border-radius: 6px; font-size: 14px; background: #2a2a2a; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <strong style="margin-right: 10px; color: #fff; font-size: 15px;">🎁 HBHelper (${data.project}):</strong>
                ${globalBlocksHtml}${checksHtml}

                <div style="position: relative; display: inline-block; margin-left: 15px;">
                    ${data.project !== 'Unknown' ? (isSystemEligible ? `<button id="show-bonus-btn" style="display: none; padding: 4px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Выдать бонус</button>` : `<span style="color: #dc3545; font-weight: bold; padding: 4px 8px;">❌ Отказ</span>`) : ''}

                    <div id="bonus-info-dropdown" style="display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 8px; padding: 15px; border: 2px solid #28a745; border-radius: 6px; background: #333; z-index: 10000; box-shadow: 0 8px 16px rgba(0,0,0,0.5); text-align: left;">
                        <textarea readonly style="width: 350px; height: 180px; font-size: 12px; resize: none; border: 1px solid #555; background: #222; color: #fff; padding: 8px; margin-bottom: 10px; overflow-y: auto;">${bonusText}</textarea>
                        <br>
                        <div style="text-align: right;">
                            <button id="close-bonus-btn" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">Закрыть</button>
                            <button id="copy-bonus-btn" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Скопировать</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (tagsWrapper) {
            // Вставляем прямо перед блоком тегов
            tagsWrapper.insertAdjacentHTML('beforebegin', widgetHtml);
        } else if (fallbackWrapper) {
            // Запасной вариант вставки
            fallbackWrapper.insertAdjacentHTML('afterbegin', widgetHtml);
        }

        if (isSystemEligible && data.project !== 'Unknown') {
            const verifCheck = document.querySelector('#verif-check');
            const showBtn = document.querySelector('#show-bonus-btn');
            const dropdown = document.querySelector('#bonus-info-dropdown');

            verifCheck.addEventListener('change', (e) => {
                showBtn.style.display = e.target.checked ? 'inline-block' : 'none';
                if (!e.target.checked) {
                    dropdown.style.display = 'none';
                }
            });

            showBtn.addEventListener('click', () => {
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });

            document.querySelector('#close-bonus-btn').addEventListener('click', () => {
                dropdown.style.display = 'none';
            });

            document.querySelector('#copy-bonus-btn').addEventListener('click', (e) => {
                const ta = document.querySelector('#bonus-info-dropdown textarea');
                ta.select();
                document.execCommand('copy');
                e.target.innerText = 'Скопировано!';
                setTimeout(() => e.target.innerText = 'Скопировать', 2000);
            });
        }
    }

    function init() {
        const data = parsePageData();
        if (data) {
            injectUI(data);
        }
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('#lastDepositsSucceededTable')) {
            observer.disconnect();
            setTimeout(init, 500);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
