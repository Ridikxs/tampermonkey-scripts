// ==UserScript==
// @name         TransferChattoVIP
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Полу-автоматический перевод чатов (с сохранением структуры). Добавлены TG группы.
// @author       Calvin/River
// @match        https://my.livechatinc.com/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TransferChatToVIP.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/TransferChatToVIP.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const allowedGroups = [
        "Gama VIP Support",
        "VIP-Gama",
        "Cat VIP Support",
        "Daddy VIP Support",
        "Mers VIP Support",
        "Arkada VIP Support",
        "Go4Win VIP Support",
        "Kent VIP Support",
        "Kometa VIP Support",
        "R7 VIP Support",
        "Cat Privip Support",
        "Arkada Privip Support",
        "Daddy Privip Support",
        "Gama Privip Support",
        "Kent Privip Support",
        "Kometa Privip Support",
        "Mers Privip Support",
        "R7 Privip Support"
    ];

    const activeGroups = [
        "Gama Support",
        "Cat Support",
        "Daddy Support",
        "Mers Support",
        "Arkada Support",
        "Go4Win Support",
        "Kent Support",
        "Kometa Support",
        "R7 Support",
        "Arkada TG",
        "Daddy TG",
        "Gama TG",
        "Kent TG",
        "Kometa TG",
        "Mers TG",
        "R7 TG",
        "Cat TG",
        ...allowedGroups
    ];

    const groupMapping = {
        "Gama Support": "Gama VIP Support",
        "Gama Privip Support": "Gama VIP Support",
        "Gama TG": "Gama VIP Support",
        "Cat Support": "Cat VIP Support",
        "Cat Privip Support": "Cat VIP Support",
        "Cat TG": "Cat VIP Support",
        "Daddy Support": "Daddy VIP Support",
        "Daddy Privip Support": "Daddy VIP Support",
        "Daddy TG": "Daddy VIP Support",
        "Mers Support": "Mers VIP Support",
        "Mers Privip Support": "Mers VIP Support",
        "Mers TG": "Mers VIP Support",
        "Arkada Support": "Arkada VIP Support",
        "Arkada Privip Support": "Arkada VIP Support",
        "Arkada TG": "Arkada VIP Support",
        "Go4Win Support": "Go4Win VIP Support",
        "Kent Support": "Kent VIP Support",
        "Kent Privip Support": "Kent VIP Support",
        "Kent TG": "Kent VIP Support",
        "Kometa Support": "Kometa VIP Support",
        "Kometa Privip Support": "Kometa VIP Support",
        "Kometa TG": "Kometa VIP Support",
        "R7 Support": "R7 VIP Support",
        "R7 Privip Support": "R7 VIP Support",
        "R7 TG": "R7 VIP Support"
    };

    // Функция ожидания элемента
    function waitForElement(selector, timeout = 2500) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
                }
            }, 50);
        });
    }

    // Функция для определения активного чата
    function getActiveChatGroup() {
        const activeChat = document.querySelector('li.css-19u39ph');
        if (!activeChat) {
            console.error("Active chat not found");
            return null;
        }

        const chatGroup = activeChat.querySelector('[data-testid="chat-list-details"]');
        if (!chatGroup) {
            console.error("Chat group details not found in active chat");
            return null;
        }

        console.log("Active chat group:", chatGroup.textContent.trim());
        return chatGroup.textContent.trim();
    }

    // Функция для выбора вкладки "Group"
    function selectGroupTab() {
        return waitForElement('button[data-testid="tab-to-select-group"]')
            .then((groupTabButton) => {
                groupTabButton.click();
                console.log("Group tab selected");
                return true;
            })
            .catch((error) => {
                console.error(error.message);
                return false;
            });
    }

    // Функция для выбора группы
    function selectGroup(groupName) {
        const groupListItems = Array.from(document.querySelectorAll('[data-testid="group-transfer-list-item"]'));
        if (!groupListItems.length) {
            console.error("Group list items not found");
            return false;
        }

        const targetGroup = groupListItems.find(item => {
            const nameElement = item.querySelector('[data-testid="group-name"]');
            return nameElement && nameElement.textContent.trim() === groupName;
        });

        if (targetGroup) {
            targetGroup.click();
            console.log(`Group "${groupName}" selected`);
            return true;
        }

        console.error(`Group "${groupName}" not found`);
        return false;
    }

    // Основная функция
    function openTransferMenu() {
        waitForElement('button[data-testid="0"]')
            .then((transferButton) => {
                transferButton.click();
                console.log("Transfer button clicked");

                setTimeout(() => {
                    selectGroupTab()
                        .then((tabSelected) => {
                            if (!tabSelected) {
                                alert("Failed to select Group tab");
                                return;
                            }

                            setTimeout(() => {
                                let activeGroup = getActiveChatGroup();
                                if (!activeGroup) {
                                    alert("No active group found");
                                    return;
                                }

                                // Если чат в обычной, Privip или TG группе — мапим его в VIP
                                if (groupMapping[activeGroup]) {
                                    activeGroup = groupMapping[activeGroup];
                                }

                                if (!activeGroup) {
                                    alert("No valid group mapping found");
                                    return;
                                }

                                setTimeout(() => {
                                    if (!selectGroup(activeGroup)) {
                                        alert(`Group "${activeGroup}" not found`);
                                    }
                                }, 250);
                            }, 500);
                        });
                }, 250);
            })
            .catch((error) => {
                console.error(error.message);
            });
    }

    // Добавляем кнопку в меню
    function addCustomButton(menu) {
        if (menu.querySelector('.custom-action-button')) return;

        const newButton = document.createElement('li');
        newButton.setAttribute('role', 'none');
        newButton.className = "custom-action-button";
        newButton.innerHTML = `
            <button tabindex="-1" role="menuitem" class="lc-ActionMenu-module__action-menu__list__item___PhQbO">
                <div class="lc-ActionMenuItem-module__action-menu-item___tGD5A">
                    <div class="lc-ActionMenuItem-module__action-menu-item__left-node___USShV">
                        <div class="css-ws51r0">
                            <span class="lc-Icon-module__icon___J5RH5">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="20" height="20">
                                    <path stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16M4 12h16"></path>
                                </svg>
                            </span>
                        </div>
                    </div>
                    <div class="lc-Typography-module__paragraph-md___Ogs8k lc-ActionMenuItem-module__action-menu-item__label___gLDgg">
                        Transfer to VIP
                    </div>
                </div>
            </button>
        `;

        const button = newButton.querySelector('button');
        button.addEventListener('click', () => {
            console.log("Custom action button clicked");
            openTransferMenu();
        });

        menu.prepend(newButton);
    }

    // Наблюдатель
    function observeMenu() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const menu = document.querySelector('ul[data-testid="action-menu"]');
                    if (menu) {
                        addCustomButton(menu);
                    }
                }
            }
        });

        const targetNode = document.body;
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    observeMenu();

})();


