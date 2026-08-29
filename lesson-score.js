
// ==UserScript==
// @name         Additional Lesson - Score Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Score tracker for tajweed and student cards on lesson page
// @author       You
// @match        https://emp.learnquraan.co.uk/employees/teacher/lesson_additional.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=learnquraan.co.uk
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── Extract student name ──
    var studentEl = document.querySelector('h2');
    if (!studentEl) return;
    var studentName = studentEl.textContent.trim();
    if (!studentName) return;

    // ── Class key ──
    function getClassKey() {
        var now = new Date();
        var y = now.getFullYear();
        var mo = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var h = now.getHours();
        var m = now.getMinutes();
        var slotMin = m < 30 ? '00' : '30';
        var slotH = String(h).padStart(2, '0');
        return 'score:' + studentName + ':' + y + '-' + mo + '-' + d + ':' + slotH + ':' + slotMin;
    }

    // ── localStorage ──
    var LS_KEY = getClassKey();

    function loadEntry() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY));
        } catch (e) {
            return null;
        }
    }

    function saveEntry(entry) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(entry));
        } catch (e) {}
    }

    // ── State ──
    var score = 50;
    var batchDelta = 0;
    var batchSource = null;
    var batchTimer = null;
    var entry = loadEntry();
    if (entry && typeof entry.score === 'number') {
        score = entry.score;
    }

    // ── Inject CSS ──
    var style = document.createElement('style');
    style.textContent = [
        '/* ── Score Display ── */',
        '.ls-score-display {',
        '    position: fixed;',
        '    top: 18px;',
        '    right: 22px;',
        '    z-index: 2147483000;',
        '    font-size: 2.8rem;',
        '    font-weight: 800;',
        '    color: #06142f;',
        '    pointer-events: none;',
        '    user-select: none;',
        '    line-height: 1;',
        '}',
        '',
        '.ls-delta-float {',
        '    position: fixed;',
        '    top: 22px;',
        '    right: 26px;',
        '    z-index: 2147483001;',
        '    font-size: 1.4rem;',
        '    font-weight: 700;',
        '    pointer-events: none;',
        '    user-select: none;',
        '    opacity: 0;',
        '    animation: ls-delta-rise 1s ease-out forwards;',
        '}',
        '',
        '@keyframes ls-delta-rise {',
        '    0%   { opacity: 1; transform: translateY(0); }',
        '    70%  { opacity: 1; }',
        '    100% { opacity: 0; transform: translateY(-40px); }',
        '}',
        '',
        '/* ── Card Zones ── */',
        '.ls-card-zone {',
        '    position: fixed;',
        '    z-index: 2147483000;',
        '    transition: background 0.15s;',
        '}',
        '',
        '.ls-inc-zone {',
        '    left: 25%;',
        '    right: 0;',
        '    cursor: pointer;',
        '}',
        '',
        '.ls-dec-zone {',
        '    left: 0;',
        '    width: 25%;',
        '    cursor: pointer;',
        '}',
        '',
        '.ls-inc-zone:hover {',
        '    background: rgba(32, 201, 151, 0.25);',
        '}',
        '',
        '.ls-dec-zone:hover {',
        '    background: rgba(255, 99, 71, 0.25);',
        '}',
        '',
        '.ls-card-flash {',
        '    animation: ls-card-pulse 0.3s ease-out;',
        '}',
        '',
        '@keyframes ls-card-pulse {',
        '    0%   { transform: scale(1); }',
        '    50%  { transform: scale(1.04); }',
        '    100% { transform: scale(1); }',
        '}',
        '',
        '/* ── Toast ── */',
        '.ls-toast {',
        '    position: fixed;',
        '    top: 20px;',
        '    left: 50%;',
        '    transform: translateX(-50%);',
        '    z-index: 2147483002;',
        '    padding: 14px 32px;',
        '    border-radius: 14px;',
        '    font-size: 1.15rem;',
        '    font-weight: 600;',
        '    color: #fff;',
        '    pointer-events: none;',
        '    user-select: none;',
        '    opacity: 0;',
        '    animation: ls-toast-in 0.3s ease-out forwards;',
        '    box-shadow: 0 8px 32px rgba(0,0,0,0.18);',
        '    max-width: min(500px, calc(100vw - 40px));',
        '    text-align: center;',
        '}',
        '',
        '.ls-toast-inc {',
        '    background: linear-gradient(135deg, #20c997, #12b886);',
        '}',
        '',
        '.ls-toast-dec {',
        '    background: linear-gradient(135deg, #f59f00, #e67700);',
        '}',
        '',
        '.ls-toast-out {',
        '    animation: ls-toast-out 0.3s ease-in forwards;',
        '}',
        '',
        '@keyframes ls-toast-in {',
        '    0%   { opacity: 0; transform: translateX(-50%) translateY(-12px); }',
        '    100% { opacity: 1; transform: translateX(-50%) translateY(0); }',
        '}',
        '',
        '@keyframes ls-toast-out {',
        '    0%   { opacity: 1; transform: translateX(-50%) translateY(0); }',
        '    100% { opacity: 0; transform: translateX(-50%) translateY(-12px); }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // ── DOM: Score Display ──
    var scoreEl = document.createElement('div');
    scoreEl.className = 'ls-score-display';
    scoreEl.textContent = score;
    document.body.appendChild(scoreEl);

    // ── DOM: Card Zones ──
    function setupCardZone(cardEl) {
        if (!cardEl) return;

        // Override CSS pointer-events:none so card is interactive
        cardEl.style.pointerEvents = 'auto';
        cardEl.style.userSelect = 'none';

        // Create zone overlays as fixed-position (card is also fixed)
        var incZone = document.createElement('div');
        incZone.className = 'ls-card-zone ls-inc-zone';
        incZone.style.position = 'fixed';

        var decZone = document.createElement('div');
        decZone.className = 'ls-card-zone ls-dec-zone';
        decZone.style.position = 'fixed';

        document.body.appendChild(incZone);
        document.body.appendChild(decZone);

        function reposition() {
            var r = cardEl.getBoundingClientRect();
            var top = r.top + 'px';
            var h = r.height + 'px';
            // Increment zone: right 75%
            incZone.style.top = top;
            incZone.style.right = (window.innerWidth - r.right) + 'px';
            incZone.style.width = Math.round(r.width * 0.75) + 'px';
            incZone.style.height = h;
            // Decrement zone: left 25%
            decZone.style.top = top;
            decZone.style.left = r.left + 'px';
            decZone.style.width = Math.round(r.width * 0.25) + 'px';
            decZone.style.height = h;
        }

        reposition();
        window.addEventListener('resize', reposition);

        return { incZone: incZone, decZone: decZone, card: cardEl, reposition: reposition };
    }

    var tajweedCard = document.querySelector('.lesson-tajweed-watermark');
    var studentCard = document.querySelector('.lesson-student-watermark');

    var tajZones = setupCardZone(tajweedCard);
    var stuZones = setupCardZone(studentCard);

    // ── Floating Delta ──
    function showFloatingDelta(delta) {
        var el = document.createElement('div');
        el.className = 'ls-delta-float';
        el.textContent = delta > 0 ? '+' + delta : String(delta);
        el.style.color = delta > 0 ? '#12b886' : '#e67700';
        document.body.appendChild(el);
        el.addEventListener('animationend', function () {
            el.remove();
        });
    }

    // ── Toast Messages ──
    function getTajweedMsg(delta) {
        var abs = Math.abs(delta);
        if (delta > 0) {
            if (abs <= 3) return 'Good Tajweed awareness';
            if (abs <= 6) return 'Excellent Tajweed!';
            return 'Tajweed perfectly applied!';
        } else {
            if (abs <= 3) return 'Minor Tajweed slip';
            if (abs <= 6) return 'Tajweed needs attention';
            return 'Tajweed mistakes corrected';
        }
    }

    function getStudentMsg(delta) {
        var abs = Math.abs(delta);
        if (delta > 0) {
            if (abs <= 3) return 'Good!';
            if (abs <= 6) return 'Great work!';
            return 'Brilliant performance!';
        } else {
            if (abs <= 3) return 'Needs improvement';
            if (abs <= 6) return 'Struggling a bit';
            return 'Significant gaps found';
        }
    }

    // ── Toast System ──
    var activeToast = null;
    var toastCleanup = null;

    function showToast(text, isIncrement) {
        // Remove previous toast
        if (activeToast) {
            if (toastCleanup) toastCleanup();
            activeToast = null;
            toastCleanup = null;
        }

        var t = document.createElement('div');
        t.className = 'ls-toast ' + (isIncrement ? 'ls-toast-inc' : 'ls-toast-dec');
        t.textContent = text;
        document.body.appendChild(t);
        activeToast = t;

        var removed = false;
        function remove() {
            if (removed) return;
            removed = true;
            t.remove();
            if (activeToast === t) {
                activeToast = null;
                toastCleanup = null;
            }
        }

        // After entrance animation, start exit
        t.addEventListener('animationend', function handler() {
            t.removeEventListener('animationend', handler);
            t.classList.add('ls-toast-out');
            // After exit animation, remove
            t.addEventListener('animationend', function () {
                remove();
            });
        });

        toastCleanup = remove;
    }

    // ── Score Update ──
    function resolveBatch() {
        if (batchDelta === 0) return;

        score += batchDelta;
        var delta = batchDelta;
        var source = batchSource;
        batchDelta = 0;
        batchSource = null;

        // Persist to localStorage
        entry = loadEntry() || { score: 50, history: [] };
        entry.score = score;
        entry.history.push({
            delta: delta,
            source: source,
            ts: Date.now()
        });
        saveEntry(entry);

        // Update display
        scoreEl.textContent = score;
        showFloatingDelta(delta);

        // Show toast
        var msg = source === 'tajweed' ? getTajweedMsg(delta) : getStudentMsg(delta);
        showToast(msg, delta > 0);
    }

    function scheduleBatch(delta, source) {
        batchDelta += delta;
        batchSource = source;

        clearTimeout(batchTimer);
        batchTimer = setTimeout(resolveBatch, 500);
    }

    // ── Click Handlers ──
    function getDelta(isIncrement) {
        if (isIncrement) {
            return Math.floor(Math.random() * 9) + 1; // 1-9
        } else {
            return -(Math.floor(Math.random() * 9) + 1); // -1 to -9
        }
    }

    function flashCard(cardEl) {
        cardEl.classList.remove('ls-card-flash');
        void cardEl.offsetWidth; // reflow
        cardEl.classList.add('ls-card-flash');
    }

    function bindZones(zones, source) {
        if (!zones) return;

        zones.incZone.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            scheduleBatch(getDelta(true), source);
            flashCard(zones.card);
        });

        zones.decZone.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            scheduleBatch(getDelta(false), source);
            flashCard(zones.card);
        });
    }

    bindZones(tajZones, 'tajweed');
    bindZones(stuZones, 'student');
})();
