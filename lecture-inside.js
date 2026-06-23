// ==UserScript==
// @name         Additional Lesson - Auto Lecture
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-fetch lecture from GitHub on additional lesson page, copy on click
// @author       You
// @match        https://emp.learnquraan.co.uk/employees/teacher/lesson_additional.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=learnquraan.co.uk
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var BASE = 'https://raw.githubusercontent.com/SaleemHafiz/additional-lesson-lectures/main/data';

    function toKebab(s) {
        return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function extractPageNum(text) {
        var m = text.match(/Page\s*(\d+)/i);
        return m ? m[1] : null;
    }

    var studentEl = document.querySelector('h2');
    var bookEl = document.querySelector('.fw-bolder.text-gray-900.fs-2');
    var pageEl = document.querySelector('.text-muted.fw-semibold');

    var badges = document.querySelectorAll('.badge');
    var courseEl = null;
    badges.forEach(function (b) {
        var t = b.textContent.trim();
        if (t.indexOf('Additional Course') !== -1 && t !== 'Additional Course') {
            courseEl = b;
        }
    });

    if (!studentEl || !bookEl || !pageEl || !courseEl) return;

    var studentName = studentEl.textContent.trim();
    var courseName = courseEl.textContent.trim();
    var bookName = bookEl.textContent.trim();
    var pageNum = extractPageNum(pageEl.textContent.trim());

    if (!pageNum) return;

    function toQuizUrl(name, book, page) {
        var n = name.trim().toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }).replace(/\s+/g, '%20');
        return 'https://lqaquiz.vercel.app/#/' + n + '/quiz/' + toKebab(book) + '/' + page;
    }

    pageEl.style.cursor = 'pointer';
    pageEl.title = 'Open quiz in new tab';
    pageEl.addEventListener('click', function (e) {
        e.stopPropagation();
        window.open(toQuizUrl(studentName, bookName, pageNum), '_blank');
    });

    var url = BASE + '/' + toKebab(courseName) + '/' + toKebab(bookName) + '/page-' + pageNum + '.md';
    var cached = null;

    function meta(d, b, p) {
        return d + ' | ' + b + ' | Page ' + p + '\n' + '\u2550'.repeat(50) + '\n\n';
    }

    fetch(url).then(function (r) {
        return r.ok ? r.text() : null;
    }).then(function (md) {
        cached = studentName + '\n' + meta(courseName, bookName, pageNum);
        cached += md || 'No content found for this page.';

        navigator.clipboard.writeText(cached).catch(function () {});

        studentEl.style.cursor = 'pointer';
        studentEl.title = 'Click to copy lecture again';
        studentEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (cached) navigator.clipboard.writeText(cached).catch(function () {});
        });
    }).catch(function () {});
})();
