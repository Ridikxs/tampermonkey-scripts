// ==UserScript==
// @name         DialogueCategories
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @author       calvin
// @description  Умный подбор тегов с исключениями и быстрым ручным поиском
// @match        https://sparkmoth.com/*
// @match        https://blueripple.xyz/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/DialogueCategories.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/DialogueCategories.user.js
// ==/UserScript==

(function() {
    'use strict';

    const CHAT_MESSAGES_SELECTOR = '.justify-start';
    const SESSION_HIDDEN_KEY = 'sparkmoth_hidden_per_chat';

    // ==========================================
    // АДАПТЕР ТЕГОВ ПОД РАЗНЫЕ ДОМЕНЫ
    // ==========================================
    function adaptTag(tag) {
        if (!window.location.hostname.includes('blueripple.xyz')) {
            return tag;
        }

        const customMap = {
            'вывод-х3_оборот': 'деп_консультация_по_обороту_депозита_х3',
            'кб-вопросы_по_кб': 'бон_вопросы_по_кб',
            'кб-неправильный_кб': 'бон_неправильный_кб',
            'тех-технические_трудности_в_игре': 'другое_технические_трудности_в_игре',
            'тех-не_загружается_слот': 'другое_технические_трудности_в_игре',
            'тех-не_загружается_сайт': 'другое_технические_трудности_на_сайте'
        };

        if (customMap[tag]) return customMap[tag];

        return tag
            .replace(/^выводы?-/, 'выводы_')
            .replace(/^(аккаунт|бон|деп|жалобы|другое|маркетинг|по_сайту|турнир)-/, '$1_')
            .replace('-', '_');
    }

    function getDefaultTag() {
        const nameEl = document.querySelector('div.text-sm.font-medium.leading-4.truncate.text-n-slate-12');
        let name = 'calvin';
        if (nameEl && nameEl.textContent) {
            name = nameEl.textContent.trim().toLowerCase();
        }
        return adaptTag(`${name}-продажа`);
    }

    // ==========================================
    // СПИСОК ПРАВИЛ С СИСТЕМОЙ ИСКЛЮЧЕНИЙ (EXCLUDE)
    // ==========================================
    const INTENT_RULES = [
        {
            // СУТЬ: Блокировка аккаунта / Удаление профиля / Бан
            check: (t) => /(заблокиров|блокировк|заблок.*ак|блок.*ак|удал.*ак|закр.*ак|бан\b|огранич.*ак)/i.test(t),
            tags: ['аккаунт-блокировка_аккаунта']
        },
        {
            // СУТЬ: Запрос на вывод заблокирован / Обратиться в поддержку
            check: (t) => /(вывод|запрос).*(заблок|поддерж|служб|обратитесь)/i.test(t),
            tags: ['вывод-не_может_оформить_заявку']
        },
        {
            // СУТЬ: Промокод из письма / Ошибка активации
            check: (t) => /(письмо|почт|мэйл|mail).*(бонус|код|пром|актив)/i.test(t) ||
                          (/(промокод|код|промик|купон)/i.test(t) && /(ошибк|не верн|не под|не раб|ввест|ввод)/i.test(t)),
            tags: ['бон-не_могу_активировать_промокод', 'бон-получил_письмо_бонуса_нет']
        },
        {
            // СУТЬ: Мультиаккаунт
            check: (t) => /(дублирующ|дубль|снят.*ограничен|два аккаунт|второй аккаунт|мультиакк|мульт\b|блок.*за.*мульт|удалить.*старый)/i.test(t),
            tags: ['аккаунт-мульт']
        },
        {
            // СУТЬ: Приложение (бонус за установку)
            check: (t) => /(установил.*приложени|скачал.*приложени|приложени.*бонус|забрать.*бонус|где.*бонус.*прилож)/i.test(t),
            tags: ['бон-другое']
        },
        {
            // СУТЬ: Подарок на ДР
            check: (t) => /(подарок|др\b|рождени|днюх)/i.test(t),
            tags: ['бон-подарок_на_др']
        },
        {
            // СУТЬ: Кэшбэк
            check: (t) => /(кб|кешб|кэшб|возврат|луз)/i.test(t),
            tags: ['кб-вопросы_по_кб', 'кб-неправильный_кб']
        },
        {
            // СУТЬ: Оборот X3 / Вейджер
            check: (t) => /(оборот|х3|x3|икс 3|отмыв|вагер|вейджер|отыгр)/i.test(t),
            tags: ['вывод-х3_оборот', 'бон-как_отыграть_бонус']
        },
        {
            // СУТЬ: Верификация
            check: (t) => /(вериф|паспорт|документ|селфи|лицо|прописк|фото|паспорт|права)/i.test(t),
            tags: ['аккаунт-верификация']
        },
        {
            // СУТЬ: Проблемы с Депозитом (ДОБАВЛЕНО ИСКЛЮЧЕНИЕ СЛОВ ВЫВОДА)
            check: (t) => /(деп|пополн|баланс|карт|крипт|перевод|счет|счёт|киви|пиаз|сбп|p2p)/i.test(t) &&
                          /(не|нет|пусто|где|когда|долго|ошибк|списал|пропал|завис|чек|что с|узнать|статус|средств)/i.test(t),
            exclude: /(вывод|выве|выплат|снять|вывест)/i, // Если говорят про вывод - это НЕ депозит!
            tags: ['деп-не_зачислился_депозит', 'деп-статус_начисления_депозита']
        },
        {
            // СУТЬ: Статус Вывода (ИСПРАВЛЕН КОРЕНЬ НА "ВЫВЕ" И ДОБАВЛЕНО ИСКЛЮЧЕНИЕ ДЕПОЗИТА)
            check: (t) => /(вывод|выве|выплат|снят|снять|вывест|заявк)/i.test(t) &&
                          /(отмен|отказ|вернул|ошибк|почему|реджект|долго|когда|где|висит|статус|что с|не вывели|средств|до сих пор)/i.test(t),
            exclude: /(депоз|пополн|зачисл)/i, // Если говорят строго про пополнение - это НЕ вывод
            tags: ['вывод-статус_вывода', 'выводы-причина_отмены_заявки']
        },
        {
            // СУТЬ: Касса и Реквизиты
            check: (t) => /(реквизит|банк|оплат|касс|минимум|лимит|кнопк|сумм)/i.test(t) &&
                          /(не выдал|нет|ошибк|не грузит|превышен|другой|проблем)/i.test(t),
            tags: ['деп-не_выдало_реквизиты', 'деп-превышен_лимит', 'деп-нет_нужного_банка']
        },
        {
            // СУТЬ: Технические ошибки (50X и 40X)
            check: (t) => /(завис|вылет|ошибк|баг|сломал|пуст|черный экран|не грузит|зеркал|50\d|40\d)/i.test(t),
            tags: ['тех-технические_трудности_в_игре', 'тех-не_загружается_слот', 'тех-не_загружается_сайт']
        },
        {
            // СУТЬ: Вложения файлов
            check: (t, h) => h.includes('.pdf') || h.includes('<img') || /(pdf|png|jpg|jpeg|скрин|чек|квитанц|файл)/i.test(t),
            tags: ['деп-не_зачислился_депозит', 'аккаунт-верификация']
        }
    ];

    // ==========================================
    // ЛОГИКА UI И АВТОКЛИКЕРА
    // ==========================================
    function getHiddenTagsForCurrentChat() {
        try {
            const allHidden = JSON.parse(sessionStorage.getItem(SESSION_HIDDEN_KEY) || '{}');
            return new Set(allHidden[window.location.pathname] || []);
        } catch (e) { return new Set(); }
    }

    function hideTagForCurrentChat(tagName) {
        try {
            const allHidden = JSON.parse(sessionStorage.getItem(SESSION_HIDDEN_KEY) || '{}');
            const chatId = window.location.pathname;
            if (!allHidden[chatId]) allHidden[chatId] = [];
            if (!allHidden[chatId].includes(tagName)) allHidden[chatId].push(tagName);
            sessionStorage.setItem(SESSION_HIDDEN_KEY, JSON.stringify(allHidden));
        } catch (e) {}
    }

    function assignTag(tagName) {
        const buttons = Array.from(document.querySelectorAll('button'));
        const openBtn = buttons.find(b => b.textContent.toLowerCase().includes('добавить метки') && b.offsetParent !== null);
        if (!openBtn) return;

        openBtn.click();

        setTimeout(() => {
            const searchInput = document.querySelector('input.search-input');
            if (searchInput) {
                searchInput.value = tagName;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                    const tagSpan = document.querySelector(`span[title="${tagName}"]`);
                    if (tagSpan && tagSpan.closest('button')) {
                        tagSpan.closest('button').click();
                        return;
                    }

                    const dropdownButtons = document.querySelectorAll('.dropdown-menu__item button, ul.dropdown li button');
                    for (const btn of dropdownButtons) {
                        if (btn.textContent.trim() === tagName || btn.textContent.includes(tagName)) {
                            btn.click();
                            break;
                        }
                    }
                }, 250);
            }
        }, 100);
    }

    function analyzeIntent(fullText, fullHtml) {
        const hiddenInThisChat = getHiddenTagsForCurrentChat();
        const dynamicDefaultTag = getDefaultTag();

        let activeTags = new Set();
        activeTags.add(dynamicDefaultTag);

        if (fullText) {
            INTENT_RULES.forEach(rule => {
                // Проверяем исключения (если слово из exclude есть, правило сбрасывается)
                if (rule.exclude && rule.exclude.test(fullText)) {
                    return;
                }
                if (rule.check(fullText, fullHtml)) {
                    rule.tags.forEach(tag => activeTags.add(adaptTag(tag)));
                }
            });
        }

        return Array.from(activeTags).filter(t => !hiddenInThisChat.has(t)).slice(0, 8);
    }

    let currentChatText = '';
    let currentUrl = '';

    function renderButtons() {
        const buttons = Array.from(document.querySelectorAll('button'));
        const openBtn = buttons.find(b => b.textContent.toLowerCase().includes('добавить метки') && b.offsetParent !== null);
        if (!openBtn || !openBtn.parentNode) return;

        const messages = document.querySelectorAll(CHAT_MESSAGES_SELECTOR);
        let text = '';
        let html = '';
        messages.forEach(msg => {
            text += (msg.textContent || '').toLowerCase() + ' ';
            html += (msg.innerHTML || '').toLowerCase() + ' ';
        });

        if (text !== currentChatText || window.location.pathname !== currentUrl) {
            currentChatText = text;
            currentUrl = window.location.pathname;
        }

        const currentTags = analyzeIntent(currentChatText, html);
        const currentTagsStr = currentTags.join(',');

        let container = openBtn.parentNode.querySelector('.custom-quick-tags-container');

        if (container) {
            if (container.dataset.tags === currentTagsStr) return;
            container.innerHTML = '';
        } else {
            container = document.createElement('div');
            container.className = 'custom-quick-tags-container';
            container.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 12px;';
            openBtn.parentNode.insertBefore(container, openBtn);
        }

        container.dataset.tags = currentTagsStr;

        // 1. Отрисовка предложенных ИИ тегов
        currentTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.textContent = tag;
            const isDefault = tag === getDefaultTag();

            btn.style.cssText = `
                padding: 4px 8px; font-size: 11px; border-radius: 6px; border: 1px solid currentColor;
                background: ${isDefault ? 'rgba(50, 200, 100, 0.15)' : 'transparent'};
                color: ${isDefault ? 'var(--n-blue-text)' : 'inherit'};
                opacity: ${isDefault ? '1' : '0.7'}; cursor: pointer; transition: all 0.1s ease-out;
            `;

            btn.onclick = (e) => { e.preventDefault(); assignTag(tag); };
            btn.oncontextmenu = (e) => { e.preventDefault(); hideTagForCurrentChat(tag); renderButtons(); };
            container.appendChild(btn);
        });

        // 2. Отрисовка мини-поиска для мгновенного ручного добавления (Киллер-фича)
        const quickInput = document.createElement('input');
        quickInput.type = 'text';
        quickInput.placeholder = '+ тег...';
        quickInput.style.cssText = `
            padding: 3px 6px; font-size: 11px; border-radius: 6px; border: 1px dashed var(--n-strong, #666);
            background: transparent; color: inherit; width: 65px; outline: none; transition: width 0.2s;
        `;
        quickInput.onfocus = () => { quickInput.style.width = '130px'; };
        quickInput.onblur = () => { quickInput.style.width = '65px'; };

        quickInput.onkeydown = (e) => {
            if (e.key === 'Enter' && quickInput.value.trim()) {
                e.preventDefault();
                // Находим все теги в системе через временный клик и выбираем первый похожий
                const val = quickInput.value.trim().toLowerCase();
                assignTag(adaptTag(val));
                quickInput.value = '';
                quickInput.blur();
            }
        };

        container.appendChild(quickInput);
    }

    let renderTimeout;
    const observer = new MutationObserver(() => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(renderButtons, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
