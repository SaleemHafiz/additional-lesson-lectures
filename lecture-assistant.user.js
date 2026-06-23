// ==UserScript==
// @name         Lecture Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-fetch lecture content from GitHub for additional lessons. Click student name to copy.
// @author       You
// @match        https://emp.learnquraan.co.uk/employees/teacher/daily-classes.php*
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

    function buildMeta(dept, book, page) {
        return dept + ' | ' + book + ' | Page ' + page + '\n' + '\u2550'.repeat(50) + '\n\n';
    }

    function copy(text) {
        navigator.clipboard.writeText(text).catch(function () {});
    }

    var path = window.location.pathname;

    // ==================== DAILY CLASSES PAGE ====================
    if (path.indexOf('daily-classes.php') !== -1) {
        var STUDENT_LIST = 'https://emp.learnquraan.co.uk/employees/teacher/student-list.php';
        var cache = {};
        var ready = false;

        function parseStudents(html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var rows = doc.querySelectorAll('#kt_customers_table tbody tr');
            var entries = [];
            rows.forEach(function (row) {
                var btn = row.querySelector('button[data-sid]');
                if (!btn) return;
                var sid = btn.getAttribute('data-sid');
                var cells = row.querySelectorAll('td');
                var addCell = cells[3];
                if (!addCell) return;
                var deptEl = addCell.querySelector('.fw-bold.text-gray-900.fs-4');
                var bookEl = addCell.querySelector('.text-muted.fs-6.fw-semibold');
                var pageEl = addCell.querySelector('.badge.badge-light-warning');
                if (!deptEl || !pageEl) return;
                var dept = deptEl.textContent.trim();
                var book = bookEl ? bookEl.textContent.trim() : 'unknown';
                var pageM = pageEl.textContent.trim().match(/\d+/);
                if (!pageM) return;
                entries.push({
                    sid: sid,
                    dept: dept,
                    book: book,
                    page: pageM[0],
                    url: BASE + '/' + toKebab(dept) + '/' + toKebab(book) + '/page-' + pageM[0] + '.md'
                });
            });
            return entries;
        }

        function attachHandlers() {
            var spans = document.querySelectorAll('.fw-bold.text-gray-900.text-truncate');
            spans.forEach(function (s) {
                if (s.getAttribute('data-al')) return;
                s.setAttribute('data-al', '1');
                s.style.cursor = 'pointer';
                s.title = 'Click to copy lecture';
                s.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var text = this.textContent.trim();
                    var m = text.match(/\(ID:(\d+)\)/);
                    if (!m) return;
                    var name = text.replace(/\(ID:\d+\)/, '').trim();
                    var content = cache[m[1]];
                    if (!content) return;
                    copy(name + '\n' + content);
                });
            });
        }

        fetch(STUDENT_LIST).then(function (r) { return r.text(); }).then(function (html) {
            var entries = parseStudents(html);
            var seen = {};
            var fetches = [];
            entries.forEach(function (e) {
                if (!seen[e.url]) {
                    seen[e.url] = true;
                    fetches.push(fetch(e.url).then(function (r) { return r.ok ? r.text() : null; }).then(function (md) { seen[e.url] = md; }));
                }
            });
            return Promise.all(fetches).then(function () {
                entries.forEach(function (e) {
                    var md = seen[e.url];
                    cache[e.sid] = buildMeta(e.dept, e.book, e.page) + (md || 'No content found for this page.');
                });
                ready = true;
                attachHandlers();
            });
        }).catch(function () {});

        new MutationObserver(function () { if (ready) attachHandlers(); }).observe(document.body, { childList: true, subtree: true });

    // ==================== LESSON ADDITIONAL PAGE ====================
    } else if (path.indexOf('lesson_additional.php') !== -1) {
        var studentEl = document.querySelector('h2');
        var bookEl = document.querySelector('.fw-bolder.text-gray-900.fs-2');
        var pageEl = document.querySelector('.text-muted.fw-semibold');
        var badges = document.querySelectorAll('.badge');
        var courseEl = null;
        badges.forEach(function (b) {
            var t = b.textContent.trim();
            if (t.indexOf('Additional Course') !== -1 && t !== 'Additional Course') courseEl = b;
        });

        if (!studentEl || !bookEl || !pageEl || !courseEl) return;

        var studentName = studentEl.textContent.trim();
        var courseName = courseEl.textContent.trim();
        var bookName = bookEl.textContent.trim();
        var pageM = pageEl.textContent.trim().match(/Page\s*(\d+)/i);
        if (!pageM) return;

        var pageNum = pageM[1];

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

        fetch(url).then(function (r) { return r.ok ? r.text() : null; }).then(function (md) {
            cached = studentName + '\n' + buildMeta(courseName, bookName, pageNum) + (md || 'No content found for this page.');
            copy(cached);
            studentEl.style.cursor = 'pointer';
            studentEl.title = 'Click to copy lecture again';
            studentEl.addEventListener('click', function (e) {
                e.stopPropagation();
                if (cached) copy(cached);
            });
        }).catch(function () {});
    }
})();
