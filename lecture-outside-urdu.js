// ==UserScript==
// @name         Daily Classes - Additional Lesson Lookup (Urdu)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Fetch Urdu additional course lectures from GitHub, copy to clipboard on click
// @author       You
// @match        https://emp.learnquraan.co.uk/employees/teacher/daily-classes.php
// @icon         https://www.google.com/s2/favicons?sz=64&domain=learnquraan.co.uk
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var BASE = 'https://raw.githubusercontent.com/SaleemHafiz/additional-lesson-lectures/main';
    var STUDENT_LIST = 'https://emp.learnquraan.co.uk/employees/teacher/student-list.php';
    var ID_RE = /\(ID:(\d+)\)/;
    var cache = {};
    var ready = false;

    function toKebab(s) {
        return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function fetchStudentList() {
        return fetch(STUDENT_LIST).then(function (r) { return r.text(); });
    }

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
            var pageText = pageEl.textContent.trim();
            var pageNum = pageText.match(/\d+/);
            if (!pageNum) return;

            entries.push({
                sid: sid,
                dept: dept,
                book: book,
                page: pageNum[0],
                url: BASE + '/data-urdu/' + toKebab(dept) + '/' + toKebab(book) + '/page-' + pageNum[0] + '.md'
            });
        });

        return entries;
    }

    function fetchLecture(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) return null;
            return r.text();
        }).catch(function () { return null; });
    }

    function buildMeta(dept, book, page) {
        return dept + ' | ' + book + ' | Page ' + page + '\n' + '\u2550'.repeat(50) + '\n\n';
    }

    function attachHandlers() {
        var spans = document.querySelectorAll('.fw-bold.text-gray-900.text-truncate');
        spans.forEach(function (s) {
            if (s.getAttribute('data-al')) return;
            s.setAttribute('data-al', '1');
            s.style.cursor = 'pointer';
            s.title = 'Click to copy lecture to clipboard';
            s.addEventListener('click', function (e) {
                e.stopPropagation();
                var text = this.textContent.trim();
                var m = text.match(ID_RE);
                if (!m) return;
                var name = text.replace(/\(ID:\d+\)/, '').trim();
                var content = cache[m[1]];
                if (!content) return;
                navigator.clipboard.writeText(name + '\n' + content).catch(function () {});
            });
        });
    }

    function main() {
        fetchStudentList().then(function (html) {
            var entries = parseStudents(html);
            var seen = {};
            var fetches = [];

            entries.forEach(function (e) {
                if (!seen[e.url]) {
                    seen[e.url] = true;
                    fetches.push(
                        fetchLecture(e.url).then(function (md) {
                            seen[e.url] = md;
                        })
                    );
                }
            });

            return Promise.all(fetches).then(function () {
                entries.forEach(function (e) {
                    var md = seen[e.url];
                    if (md) {
                        cache[e.sid] = buildMeta(e.dept, e.book, e.page) + md;
                    } else {
                        cache[e.sid] = buildMeta(e.dept, e.book, e.page) + 'No content found for this page.';
                    }
                });
                ready = true;
                attachHandlers();
            });
        }).catch(function () {});

        new MutationObserver(function () {
            if (ready) attachHandlers();
        }).observe(document.body, { childList: true, subtree: true });
    }

    main();
})();
