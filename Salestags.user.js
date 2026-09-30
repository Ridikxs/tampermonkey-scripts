// ==UserScript==
// @name         Sales Tags Highlighter
// @namespace    https://cc.boadmin.org/
// @version      1.0
// @description  Анимированные теги продаж для Fundist
// @author       Will
// @match        https://cc.boadmin.org/*
// @match        https://cc.boadmin.org/*
// @match        https://gm.boadmin.org/*
// @match        https://dy.boadmin.org/*
// @match        https://kn.boadmin.org/*
// @match        https://rs.boadmin.org/*
// @match        https://kt.boadmin.org/*
// @match        https://ak.boadmin.org/*
// @updateURL    https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Salestags.user.js
// @downloadURL  https://raw.githubusercontent.com/Ridikxs/tampermonkey-scripts/main/Salestags.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// @require      https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/js/all.min.js
// ==/UserScript==

(function () {
    'use strict';

    const TAG_CLASSES = {

        /* ===== Старые SUPP ===== */

        Sales_SUPP_Other_1: 'sales-tag-other',
        Sales_SUPP_Other_2: 'sales-tag-other',
        Sales_SUPP_Other_3: 'sales-tag-other',

        Sales_SUPP_Previp_1: 'sales-tag-previp',
        Sales_SUPP_Previp_2: 'sales-tag-previp',
        Sales_SUPP_Previp_3: 'sales-tag-previp',

        Sales_SUPP_VIP_1: 'sales-tag-vip',
        Sales_SUPP_VIP_2: 'sales-tag-vip',
        Sales_SUPP_VIP_3: 'sales-tag-vip',

        /* ===== Новые Support ===== */

        Sales_Support_Other: 'sales-tag-other',
        Sales_Support_Previp: 'sales-tag-previp',
        Sales_Support_VIP: 'sales-tag-vip',

    };

    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css';
    document.head.appendChild(fa);

    GM_addStyle(`

		@keyframes luxuryShine {
			0% {
				transform: translateX(-250%) skewX(-25deg);
				opacity: 0;
			}
			8% {
				opacity: .9;
			}
			35% {
				opacity: .9;
			}
			50% {
				transform: translateX(250%) skewX(-25deg);
				opacity: 0;
			}
			100% {
				transform: translateX(250%) skewX(-25deg);
				opacity: 0;
			}
		}

		.sales-tag-other,
		.sales-tag-previp,
		.sales-tag-vip {
			position: relative;
			overflow: hidden;
			isolation: isolate;

			display: inline-flex;
			align-items: center;

			border-radius: 18px !important;
			border: 1px solid #b48a22 !important;

			background: linear-gradient(
				180deg,
				#392407 0%,
				#5c3d0d 35%,
				#8c6420 65%,
				#5c3d0d 100%
			) !important;

			color: #fff !important;

			box-shadow:
				inset 0 1px rgba(255,255,255,.18),
				inset 0 -1px rgba(0,0,0,.35),
				0 0 8px rgba(255,205,70,.18);
		}

		.sales-tag-other::before,
		.sales-tag-previp::before,
		.sales-tag-vip::before {
			content: "";

			position: absolute;

			top: -45%;
			left: -30%;

			width: 34%;
			height: 190%;

			transform: skewX(-25deg);

			background: linear-gradient(
				90deg,
				transparent,
				rgba(255,255,255,.08),
				rgba(255,255,255,.95),
				rgba(255,255,255,.08),
				transparent
			);

			filter: blur(.5px);

			animation: luxuryShine 4.5s ease-in-out infinite;

			pointer-events: none;
		}

		/* Текст */

		.sales-tag-other .name,
		.sales-tag-previp .name,
		.sales-tag-vip .name {

			position: relative;
			z-index: 2;

			color: #fff7d1 !important;

			font-weight: 600;

			text-shadow:
				0 1px 2px rgba(0,0,0,.95),
				0 0 3px rgba(0,0,0,.7);
		}

		/* Font Awesome */

		.sales-tag-other .name::before,
		.sales-tag-previp .name::before,
		.sales-tag-vip .name::before {

			font: var(--fa-font-solid);
			content: "\\f201"; /* fa-chart-line */

			margin-right: 3px;

			color: #ffd76b;

			font-size: 11px;

			text-shadow:
				0 0 5px rgba(255,215,0,.6);
		}

		/* Крестик */

		.sales-tag-other .icon,
		.sales-tag-previp .icon,
		.sales-tag-vip .icon {

			position: relative;
			z-index: 2;

			color: #ffe08a !important;

			text-shadow:
				0 0 4px rgba(255,215,0,.45);
		}

		/* Сделать бейдж компактнее */

		.sales-tag-other,
		.sales-tag-previp,
		.sales-tag-vip{
			padding-left: 2px !important;
			padding-right: 2px !important;
		}

		.sales-tag-other .name,
		.sales-tag-previp .name,
		.sales-tag-vip .name{
			padding-left: 5px !important;
			padding-right: 5px !important;
		}

		`);
    function paintTags() {
        document.querySelectorAll('.fun-page-header__status-btn').forEach(tag => {
            const name = tag.querySelector('.name')?.textContent.trim();

            if (!name) return;

            const className = TAG_CLASSES[name];
            if (!className) return;

            if (!tag.classList.contains(className)) {
                tag.classList.add(className);
            }
        });
    }

    paintTags();

    new MutationObserver(paintTags).observe(document.body, {
        childList: true,
        subtree: true
    });
})();