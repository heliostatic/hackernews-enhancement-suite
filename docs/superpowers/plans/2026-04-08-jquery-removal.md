# jQuery Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove jQuery 3.2.1 from HNES, replace linkify with vanilla JS, add HACKERSMACKER compatibility, drop dead code.

**Architecture:** Incremental module-by-module conversion. Each of 10 modules converts one logical area of `js/hn.js` from jQuery to vanilla JS in a separate commit. jQuery remains loaded until the final commit removes it.

**Tech Stack:** Vanilla JS (modern browser APIs), Chrome Extension Manifest V3, Node `node:test` for unit tests.

---

### Task 0: Unit test infrastructure and tests for existing pure functions

**Files:**
- Create: `tests/unit.test.js`
- Create: `package.json` (minimal, for `npm test` script only)

- [ ] **Step 1: Create minimal `package.json`**

```json
{
  "private": true,
  "scripts": {
    "test": "node --test tests/unit.test.js"
  }
}
```

- [ ] **Step 2: Create test file with tests for existing pure functions**

Extract the pure functions from `js/hn.js` so they can be tested. Since `hn.js` is not a module, the test file will copy the function bodies directly and test them. Later, when the migration is complete, these can be refactored to imports if desired.

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// === Extracted pure functions ===

function _formatStarCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function prettyPrintDaysAgo(days) {
  var str = '';
  var values = {
    ' year': 365,
    ' month': 30,
    ' day': 1
  };
  for (var x in values) {
    var amount = Math.floor(days / values[x]);
    if (amount >= 1) {
      str += amount + x + (amount > 1 ? 's' : '');
      if (x != ' day') {
        str += ' ';
      }
      days -= amount * values[x];
    }
  }
  return str;
}

function classifyScore(score) {
  var NO_HEAT = 50;
  var MILD    = 75;
  var MEDIUM  = 99;
  if (score < NO_HEAT) return 'no-heat';
  if (score < MILD) return 'mild';
  if (score < MEDIUM) return 'medium';
  return 'hot';
}

// CommentTracker.process extracted logic
function processCommentData(existingData, request) {
  var new_info = {
    id: request.id,
    expire: new Date().getTime() + 432000000
  };
  var info = existingData ? JSON.parse(existingData) : new_info;
  if (request.num) { info.num = request.num; }
  var last_comment_id = info.last_comment_id;
  if (request.last_comment_id)
    info.last_comment_id = request.last_comment_id;
  return { info: JSON.stringify(info), last_comment_id };
}

// === Tests ===

describe('_formatStarCount', () => {
  it('returns plain number below 1000', () => {
    assert.equal(_formatStarCount(0), '0');
    assert.equal(_formatStarCount(1), '1');
    assert.equal(_formatStarCount(999), '999');
  });
  it('formats thousands with k suffix', () => {
    assert.equal(_formatStarCount(1000), '1k');
    assert.equal(_formatStarCount(1500), '1.5k');
    assert.equal(_formatStarCount(9999), '10k');
    assert.equal(_formatStarCount(23400), '23.4k');
  });
  it('formats millions with M suffix', () => {
    assert.equal(_formatStarCount(1000000), '1M');
    assert.equal(_formatStarCount(1500000), '1.5M');
    assert.equal(_formatStarCount(10000000), '10M');
  });
});

describe('prettyPrintDaysAgo', () => {
  it('returns empty string for 0 days', () => {
    assert.equal(prettyPrintDaysAgo(0), '');
  });
  it('formats single day', () => {
    assert.equal(prettyPrintDaysAgo(1), '1 day');
  });
  it('formats plural days', () => {
    assert.equal(prettyPrintDaysAgo(5), '5 days');
  });
  it('formats months and days', () => {
    assert.equal(prettyPrintDaysAgo(45), '1 month 15 days');
  });
  it('formats years, months, and days', () => {
    assert.equal(prettyPrintDaysAgo(400), '1 year 1 month 5 days');
  });
  it('formats exactly one year', () => {
    assert.equal(prettyPrintDaysAgo(365), '1 year ');
  });
});

describe('classifyScore (getAndRateStories threshold logic)', () => {
  it('returns no-heat for scores below 50', () => {
    assert.equal(classifyScore(0), 'no-heat');
    assert.equal(classifyScore(49), 'no-heat');
  });
  it('returns mild for scores 50-74', () => {
    assert.equal(classifyScore(50), 'mild');
    assert.equal(classifyScore(74), 'mild');
  });
  it('returns medium for scores 75-98', () => {
    assert.equal(classifyScore(75), 'medium');
    assert.equal(classifyScore(98), 'medium');
  });
  it('returns hot for scores >= 99', () => {
    assert.equal(classifyScore(99), 'hot');
    assert.equal(classifyScore(500), 'hot');
  });
});

describe('CommentTracker.process logic', () => {
  it('creates new info when no existing data', () => {
    const result = processCommentData(null, { id: 123, num: 5, last_comment_id: 999 });
    const info = JSON.parse(result.info);
    assert.equal(info.id, 123);
    assert.equal(info.num, 5);
    assert.equal(info.last_comment_id, 999);
    assert.equal(result.last_comment_id, undefined);
    assert.ok(info.expire > Date.now());
  });
  it('preserves last_comment_id from existing data', () => {
    const existing = JSON.stringify({ id: 123, expire: Date.now() + 99999, last_comment_id: 500 });
    const result = processCommentData(existing, { id: 123, num: 10, last_comment_id: 800 });
    assert.equal(result.last_comment_id, 500);
    const info = JSON.parse(result.info);
    assert.equal(info.last_comment_id, 800);
    assert.equal(info.num, 10);
  });
  it('does not overwrite num when request.num is falsy', () => {
    const existing = JSON.stringify({ id: 123, expire: Date.now() + 99999, num: 42 });
    const result = processCommentData(existing, { id: 123, last_comment_id: 100 });
    const info = JSON.parse(result.info);
    assert.equal(info.num, 42);
  });
});
```

- [ ] **Step 3: Run tests and verify they pass**

```
npm test
```

- [ ] **Step 4: Commit**

```
git add package.json tests/unit.test.js
git commit -m "Add unit test infrastructure with tests for pure functions"
```

---

### Task 1: Utility / storage wrappers (~6 jQuery calls)

**Files:**
- Modify: `js/hn.js:906-931`

These functions have minimal jQuery usage. `injectCSS` uses `$('head').append(...)`. `getLocalStorage`, `setLocalStorage`, and `getUserData` are pure `chrome.runtime.sendMessage` wrappers with no jQuery. The only jQuery call is in `injectCSS`.

- [ ] **Step 1: Convert `injectCSS` (line 906-908)**

```js
// Before:
injectCSS: function() {
  $('head').append('<link rel="stylesheet" type="text/css" href="news.css">');
},

// After:
injectCSS: function() {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'news.css';
  document.head.appendChild(link);
},
```

- [ ] **Step 2: Verify `getLocalStorage`, `setLocalStorage`, `getUserData` have no jQuery**

Lines 910-931 are already vanilla JS (they use `chrome.runtime.sendMessage`). No changes needed.

- [ ] **Step 3: Commit**

```
git add js/hn.js
git commit -m "Convert utility/storage wrappers from jQuery to vanilla JS (module 1)"
```

---

### Task 2: Keyboard shortcuts (~25 jQuery calls)

**Files:**
- Modify: `js/hn.js:1881-2008`

- [ ] **Step 1: Convert `init_keys` (lines 1881-1914)**

```js
// Before:
init_keys: function(){
    var j = 74, k = 75, o = 79, p = 80, h = 72, l = 76, c = 67, b = 66, shiftKey = 16;
    $(document).keydown(function(e){
      if (!HN.searchInputFocused && !e.ctrlKey) {
        // ...key handling...
      }
    })
},

// After:
init_keys: function(){
    var j = 74, k = 75, o = 79, p = 80, h = 72, l = 76, c = 67, b = 66, shiftKey = 16;
    document.addEventListener('keydown', function(e){
      if (!HN.searchInputFocused && !e.ctrlKey) {
        if (e.which == j) {
          HN.next_story();
        } else if (e.which == k) {
          HN.previous_story();
        } else if (e.which == l) {
          HN.open_story_in_new_tab();
        } else if (e.which == o) {
          HN.open_story_in_current_tab();
        } else if (e.which == p) {
          HN.open_comments_in_current_tab();
        } else if (e.which == c) {
          HN.open_comments_in_new_tab();
        } else if (e.which == h) {
          //HN.open_help();
        } else if (e.which == b) {
          HN.open_comments_in_new_tab();
          HN.open_story_in_new_tab();
        }
      }
    });
},
```

- [ ] **Step 2: Convert `next_or_prev_story` (lines 1936-1956)**

```js
// Before:
next_or_prev_story: function(next){
  if ($('.on_story').length == 0) {
    if (next)
      $('#content tr:first').addClass("on_story");
  } else {
    var current = $('.on_story');
    var next_lem;
    if (next)
      next_lem = current.next();
    else
      next_lem = current.prev();
    if (next_lem.length) {
      next_lem.addClass("on_story");
      $('html, body').stop();
      $('html, body').animate({
        scrollTop: next_lem.offset().top - 10
        }, 200);
      current.removeClass("on_story");
    }
  }
},

// After:
next_or_prev_story: function(next){
  var current = document.querySelector('.on_story');
  if (!current) {
    if (next) {
      var firstRow = document.querySelector('#content tr');
      if (firstRow) firstRow.classList.add('on_story');
    }
  } else {
    var next_lem = next ? current.nextElementSibling : current.previousElementSibling;
    if (next_lem) {
      next_lem.classList.add('on_story');
      window.scrollTo({
        top: next_lem.getBoundingClientRect().top + window.scrollY - 10,
        behavior: 'smooth'
      });
      current.classList.remove('on_story');
    }
  }
},
```

- [ ] **Step 3: Convert `open_story` (lines 1958-1968)**

```js
// Before:
open_story: function(new_tab){
  if ($('.on_story').length != 0) {
    var story = $('.on_story .title .titleline > a');
    if (new_tab) {
      $('.on_story .title').addClass("link-highlight");
      window.open(story.attr("href"));
    }
    else
      window.location = story.attr("href");
  }
},

// After:
open_story: function(new_tab){
  var onStory = document.querySelector('.on_story');
  if (onStory) {
    var story = onStory.querySelector('.title .titleline > a');
    if (story) {
      if (new_tab) {
        var titleEl = onStory.querySelector('.title');
        if (titleEl) titleEl.classList.add('link-highlight');
        window.open(story.href);
      } else {
        window.location = story.href;
      }
    }
  }
},
```

- [ ] **Step 4: Convert `view_comments` (lines 1970-1980)**

```js
// Before:
view_comments: function(new_tab){
  if ($('.on_story').length != 0) {
    var comments = $('.on_story .comments');
    if (comments.length != 0) {
      if (new_tab)
        window.open(comments.attr("href"));
      else
        window.location = comments.attr("href");
    }
  }
},

// After:
view_comments: function(new_tab){
  var onStory = document.querySelector('.on_story');
  if (onStory) {
    var comments = onStory.querySelector('.comments');
    if (comments) {
      if (new_tab)
        window.open(comments.href);
      else
        window.location = comments.href;
    }
  }
},
```

- [ ] **Step 5: Convert `getAndRateStories` (lines 1982-2001)**

```js
// Before:
getAndRateStories: function() {
  var NO_HEAT = 50;
  var MILD    = 75;
  var MEDIUM  = 99;
  $('.score').each(function(i){
    var score = $(this).html();
    score = score.replace(/[a-z]/g, '');
    if (score < NO_HEAT) {
      $(this).addClass('no-heat');
    } else if (score < MILD) {
      $(this).addClass('mild');
    } else if (score < MEDIUM) {
      $(this).addClass('medium');
    } else {
      $(this).addClass('hot');
    };
  });
},

// After:
getAndRateStories: function() {
  var NO_HEAT = 50;
  var MILD    = 75;
  var MEDIUM  = 99;
  document.querySelectorAll('.score').forEach(function(el){
    var score = el.innerHTML.replace(/[a-z]/g, '');
    if (score < NO_HEAT) {
      el.classList.add('no-heat');
    } else if (score < MILD) {
      el.classList.add('mild');
    } else if (score < MEDIUM) {
      el.classList.add('medium');
    } else {
      el.classList.add('hot');
    }
  });
},
```

- [ ] **Step 6: Convert `enableLinkHighlighting` (lines 2003-2007)**

```js
// Before:
enableLinkHighlighting: function() {
  $('.title a:link').click(function() {
      $(this).closest('td').addClass('link-highlight');
  });
}

// After:
enableLinkHighlighting: function() {
  document.querySelectorAll('.title a:link').forEach(function(a) {
    a.addEventListener('click', function() {
      this.closest('td').classList.add('link-highlight');
    });
  });
}
```

- [ ] **Step 7: Commit**

```
git add js/hn.js
git commit -m "Convert keyboard shortcuts and score/link highlighting to vanilla JS (module 2)"
```

---

### Task 3: Score / heat map (~30 jQuery calls)

**Files:**
- Modify: `js/hn.js:1445-1516, 1518-1525`

- [ ] **Step 1: Convert `formatScore` (lines 1445-1516)**

This is the heaviest function in this module. It restructures the `.subtext` row, creating score/comments `<td>` elements and moving them to the previous row.

```js
// After:
formatScore: function() {
  document.querySelectorAll('.subtext').forEach(function(subtext){
    var scoreSpan = subtext.querySelector('span');
    var as = subtext.querySelectorAll('a');
    var by = as[0];
    var at = as[1];
    var comments;

    var score;
    if (!scoreSpan || scoreSpan.classList.contains('hnuser') ||
        !scoreSpan.textContent.includes('point')) {
      score = document.createElement('span');
      score.textContent = '0';
    } else {
      score = scoreSpan;
      score.textContent = parseInt(score.textContent);
    }
    score.classList.add('score');
    score.title = 'Points';

    var lastA = as[as.length - 1];
    if (lastA && lastA.textContent !== 'web') {
      comments = lastA;
    } else {
      comments = document.createElement('a');
      comments.textContent = '-';
    }

    var comments_link = at ? at.getAttribute('href') : '';

    if (comments.textContent === 'discuss' || /ago$/.test(comments.textContent)) {
      var newComments = document.createElement('a');
      newComments.innerHTML = '0';
      newComments.href = comments.getAttribute('href') || '';
      comments = newComments;
    } else if (comments.textContent === 'comments') {
      var newComments = document.createElement('a');
      newComments.innerHTML = '?';
      newComments.href = comments.getAttribute('href') || '';
      comments = newComments;
    } else if (comments.textContent === '') {
      score.textContent = '';
    } else {
      comments.textContent = parseInt(comments.textContent) || '-';
    }

    if (comments_link) comments.setAttribute('href', comments_link);
    comments.classList.add('comments');
    comments.title = 'Comments';

    var by_el;
    if (!by) {
      by_el = document.createElement('span');
    } else {
      by_el = document.createElement('span');
      by_el.classList.add('submitter');
      by_el.textContent = 'by ';
      by.title = 'View profile';
      by_el.appendChild(by);
    }

    var score_td = document.createElement('td');
    score_td.appendChild(score);
    var comments_td = document.createElement('td');
    comments_td.appendChild(comments);

    var prevRow = subtext.parentElement.previousElementSibling;
    prevRow.prepend(score_td);
    prevRow.prepend(comments_td);
    var titleEl = prevRow.querySelector('.title');
    if (titleEl) titleEl.appendChild(by_el);

    // Remove spacer row after subtext
    var nextRow = subtext.parentElement.nextElementSibling;
    if (nextRow) nextRow.remove();
    subtext.parentElement.remove();

    // Build hnes-actions span
    var actions = document.createElement('span');
    actions.classList.add('hnes-actions');
    var actionSels = [
      'a[href^=flag]', 'a[href^=vouch]',
      'a[href^="https://hn.algolia.com/?query="]',
      'a[href^=hide]',
      'a[href^="https://www.google.com/search?q="]'
    ];
    actionSels.forEach(function(sel) {
      var el = subtext.querySelector(sel);
      if (el) actions.appendChild(el);
    });
    by_el.after(actions);

    // Build hnes-age span
    var ageSpan = document.createElement('span');
    ageSpan.classList.add('hnes-age');
    ageSpan.textContent = at ? at.textContent : '';
    by_el.after(ageSpan);
  });
},
```

- [ ] **Step 2: Convert `highlightCommentsLink` and `highlightScoreLink` (lines 1518-1525)**

```js
// Before:
highlightCommentsLink: function(e) {
  $(this).toggleClass('hover-comments-score')
  $(this).next().toggleClass('hover-comments-score');
},
highlightScoreLink: function(e) {
  $(this).toggleClass('hover-comments-score')
  $(this).prev().toggleClass('hover-comments-score');
},

// After:
highlightCommentsLink: function(e) {
  this.classList.toggle('hover-comments-score');
  if (this.nextElementSibling)
    this.nextElementSibling.classList.toggle('hover-comments-score');
},
highlightScoreLink: function(e) {
  this.classList.toggle('hover-comments-score');
  if (this.previousElementSibling)
    this.previousElementSibling.classList.toggle('hover-comments-score');
},
```

Note: These functions use `this` binding and are called via event handlers. The vanilla conversion preserves the `this` context since `addEventListener` sets `this` to the element.

- [ ] **Step 3: Commit**

```
git add js/hn.js
git commit -m "Convert formatScore and score highlighting to vanilla JS (module 3)"
```

---

### Task 4: Navigation rewrite (~60 jQuery calls)

**Files:**
- Modify: `js/hn.js:1610-1860`

This is the largest module. It builds the navigation dropdowns and rewrites the top bar.

- [ ] **Step 1: Convert `rewriteUserNav` (lines 1610-1752)**

```js
// After:
rewriteUserNav: function(pagetop) {
  var user_links = document.createElement('span');
  user_links.classList.add('nav-links');

  var as = pagetop.querySelectorAll('a');
  var user_profile = as[0];
  var logout = as[1];
  var user_name = user_profile.textContent;

  var user_drop_a = document.createElement('a');
  user_drop_a.textContent = user_name;
  user_drop_a.href = '#';
  var user_drop = document.createElement('span');
  user_drop.appendChild(user_drop_a);
  user_drop.title = 'Toggle user links';
  user_drop.id = 'my-more-link';
  user_drop.classList.add('more-arrow');

  logout.remove();
  user_profile.remove();
  var score_str = pagetop.textContent;
  var regex = /\(([^)]+)\)/;
  var matches = regex.exec(score_str);
  var score = matches[1];

  var score_inner = document.createElement('span');
  score_inner.textContent = score;
  score_inner.id = 'my-karma';
  score_inner.title = 'Your karma';
  var score_elem = document.createElement('span');
  score_elem.textContent = '|';
  score_elem.appendChild(score_inner);

  user_links.appendChild(score_elem);
  pagetop.replaceChildren();
  user_links.prepend(user_drop);
  pagetop.appendChild(user_links);

  var hidden_div = document.createElement('div');
  hidden_div.id = 'user-hidden';
  hidden_div.classList.add('nav-drop-down');

  var user_pages = [
    ['profile', '/user', 'Your profile and settings'],
    ['comments', '/threads', 'Your comments and replies'],
    ['submitted', '/submitted', "Stories you've submitted"],
    ['upvoted', '/upvoted', "Stories you've voted for"],
    ['favorites', '/favorites', "Stories you've favorited"]
  ];
  var new_active = false;
  for (var i = 0; i < user_pages.length; i++) {
    var link_text = user_pages[i][0];
    var link_href = user_pages[i][1];
    var link_title = user_pages[i][2];
    var link = document.createElement('a');
    link.textContent = link_text;
    link.href = link_href + '?id=' + user_name;
    link.title = link_title;

    if (window.location.pathname == link_href) {
      new_active = link.cloneNode(true);
      new_active.classList.add('nav-active-link', 'new-active-link');
    }

    hidden_div.appendChild(link);
  }
  if (new_active) {
    if (window.location.pathname != '/upvoted' ||
        window.location.pathname != '/favorites') {
      var user_id = window.location.search.match(/id=(\w+)/)[1];
      if (user_id == user_name)
        user_id = 'Your';
      else
        user_id = user_id + "'s";
      new_active.textContent = user_id + " " + new_active.textContent;
    }
    var active_wrapper = document.createElement('span');
    active_wrapper.textContent = '|';
    active_wrapper.appendChild(new_active);
    var navLinks = document.querySelector('#top-navigation .nav-links');
    if (navLinks) navLinks.appendChild(active_wrapper);
  }

  logout.id = 'user-logout';
  logout.title = 'Logout';
  hidden_div.appendChild(logout);
  user_links.appendChild(hidden_div);

  var user_drop_toggle = function() {
    user_drop.querySelector('a').classList.toggle('active');
    hidden_div.style.display =
      hidden_div.style.display === 'none' ? '' : 'none';
  };
  user_drop.addEventListener('click', user_drop_toggle);
  hidden_div.addEventListener('click', user_drop_toggle);
  hidden_div.style.display = 'none';

  // HNES settings dropdown
  var hnes_drop_a = document.createElement('a');
  hnes_drop_a.textContent = 'HNES';
  hnes_drop_a.href = '#';
  var hnes_drop = document.createElement('span');
  hnes_drop.appendChild(hnes_drop_a);
  hnes_drop.title = 'HNES settings';
  hnes_drop.id = 'hnes-settings-link';
  hnes_drop.classList.add('more-arrow');

  var hnes_div = document.createElement('div');
  hnes_div.id = 'hnes-settings';
  hnes_div.classList.add('nav-drop-down');

  // GitHub stars toggle
  var ghToggle = document.createElement('a');
  ghToggle.href = '#';
  ghToggle.classList.add('hnes-gh-toggle');
  chrome.runtime.sendMessage(
    { method: 'getLocalStorage', key: 'hnes_show_github_stars' },
    function(response) {
      var enabled = !(response && response.data === 'false');
      ghToggle.textContent =
        enabled ? '\u2605 GitHub stars' : '\u2606 GitHub stars';
      ghToggle.classList.toggle('hnes-gh-toggle-off', !enabled);
    }
  );
  ghToggle.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage(
      { method: 'getLocalStorage', key: 'hnes_show_github_stars' },
      function(response) {
        var wasEnabled = !(response && response.data === 'false');
        var newVal = wasEnabled ? 'false' : 'true';
        chrome.runtime.sendMessage(
          { method: 'setLocalStorage',
            key: 'hnes_show_github_stars',
            value: newVal },
          function() {
            ghToggle.textContent =
              wasEnabled ? '\u2606 GitHub stars' : '\u2605 GitHub stars';
            ghToggle.classList.toggle('hnes-gh-toggle-off', wasEnabled);
            if (!wasEnabled) {
              HN._fetchAndDisplayStars();
            } else {
              document.querySelectorAll('.hnes-gh-stars').forEach(
                function(el) { el.remove(); }
              );
            }
          }
        );
      }
    );
  });
  hnes_div.appendChild(ghToggle);

  var hnes_sep = document.createElement('span');
  hnes_sep.textContent = '|';
  var hnes_wrapper = document.createElement('span');
  hnes_wrapper.id = 'hnes-wrapper';
  hnes_wrapper.appendChild(hnes_drop);
  hnes_wrapper.appendChild(hnes_div);
  user_links.prepend(hnes_sep);
  user_links.prepend(hnes_wrapper);

  var hnes_toggle = function() {
    hnes_drop.querySelector('a').classList.toggle('active');
    hnes_div.style.display =
      hnes_div.style.display === 'none' ? '' : 'none';
  };
  hnes_drop.addEventListener('click', hnes_toggle);
  hnes_div.addEventListener('click', hnes_toggle);
  hnes_div.style.display = 'none';

  HN.setTopColor();
},
```

- [ ] **Step 2: Convert `rewriteNavigation` (lines 1753-1846)**

```js
// After:
rewriteNavigation: function() {
    var topsel = document.querySelector('.topsel');
    var navigation = document.querySelector('td:nth-child(2) .pagetop');
    navigation.id = 'top-navigation';

    var visible_pages = [
      ['top', '/news', 'Top stories'],
      ['new', '/newest', 'Newest stories'],
      ['best', '/best', 'Best stories'],
      ['submit', '/submit', 'Submit a story'],
    ];

    var hidden_pages = [
      ['show', '/show', 'Show HN'],
      ['shownew', '/shownew', 'New Show HN posts'],
      ['classic', '/classic',
       'Only count votes from accounts older than one year'],
      ['active', '/active', 'Active stories'],
      ['ask', '/ask', 'Ask Hacker News'],
      ['jobs', '/jobs', 'Sponsored job postings'],
      ['bestcomments', '/bestcomments', 'Best comments'],
      ['newcomments', '/newcomments', 'New comments'],
      ['noobstories', '/noobstories', 'Stories by new users'],
      ['noobcomments', '/noobcomments', 'Comments by new users']
    ];

    if (!topsel) {
      topsel = document.createElement('span');
      topsel.classList.add('nav-links');
      navigation.appendChild(topsel);
    } else {
      topsel.classList.remove('topsel');
      topsel.classList.add('nav-links');
      topsel.replaceChildren();
    }

    for (var i = 0; i < visible_pages.length; i++) {
      var link_text = visible_pages[i][0];
      var link_href = visible_pages[i][1];

      var span = document.createElement('span');
      span.textContent = '|';
      var new_link = document.createElement('a');
      new_link.href = link_href;
      new_link.textContent = link_text;
      new_link.classList.add(link_text);
      new_link.title = visible_pages[i][2];

      if (window.location.pathname == link_href)
        new_link.classList.add('nav-active-link');

      span.prepend(new_link);
      topsel.appendChild(span);
    }
    if (window.location.pathname == '/') {
      var topLink = document.querySelector('.top');
      if (topLink) topLink.classList.add('nav-active-link');
    }

    var more_link_a = document.createElement('a');
    more_link_a.textContent = 'more';
    more_link_a.href = '#';
    var more_link = document.createElement('span');
    more_link.appendChild(more_link_a);
    more_link.title = 'Toggle more links';
    more_link.id = 'nav-more-link';
    more_link.classList.add('more-arrow');

    var hidden_div = document.createElement('div');
    hidden_div.id = 'nav-others';
    hidden_div.classList.add('nav-drop-down');

    var new_active = false;
    for (var i = 0; i < hidden_pages.length; i++) {
      var link_text = hidden_pages[i][0];
      var link_href = hidden_pages[i][1];

      var new_link = document.createElement('a');
      new_link.href = link_href;
      new_link.title = hidden_pages[i][2];
      new_link.textContent = link_text;
      new_link.classList.add(link_text);

      if (window.location.pathname == link_href) {
        new_active = new_link.cloneNode(true);
        new_active.classList.add('nav-active-link', 'new-active-link');
      }

      hidden_div.appendChild(new_link);
    }

    topsel.appendChild(more_link);
    topsel.appendChild(hidden_div);

    if (new_active) {
      var wrapper = document.createElement('span');
      wrapper.textContent = '|';
      wrapper.appendChild(new_active);
      topsel.appendChild(wrapper);
    }

    navigation.replaceChildren();
    navigation.appendChild(topsel);

    var toggle_more_link = function() {
      more_link.querySelector('a').classList.toggle('active');
      hidden_div.style.display =
        hidden_div.style.display === 'none' ? '' : 'none';
    };
    more_link.addEventListener('click', toggle_more_link);
    hidden_div.addEventListener('click', toggle_more_link);

    hidden_div.style.left = more_link.offsetLeft + 'px';
    hidden_div.style.display = 'none';
},
```

- [ ] **Step 3: Convert `toggleMoreNavLinks` (line 1848-1851)**

```js
// After:
toggleMoreNavLinks: function(e) {
  var others = document.getElementById('nav-others');
  if (others) {
    others.style.display =
      others.style.display === 'none' ? '' : 'none';
  }
},
```

- [ ] **Step 4: Convert `setTopColor` (lines 1853-1860)**

```js
// Before:
setTopColor: function(){
  var topcolor = document.getElementById("header").children[0]
                   .getAttribute("bgcolor");
  if(topcolor.toLowerCase() != '#ff6600') {
    $('#header').css('background-color', topcolor);
    $('.nav-drop-down').css('background-color', topcolor);
    $('.nav-drop-down a:hover').css('background-color', topcolor);
  }
},

// After:
setTopColor: function(){
  var headerEl = document.getElementById("header");
  if (!headerEl || !headerEl.children[0]) return;
  var topcolor = headerEl.children[0].getAttribute("bgcolor");
  if (topcolor && topcolor.toLowerCase() != '#ff6600') {
    headerEl.style.backgroundColor = topcolor;
    document.querySelectorAll('.nav-drop-down').forEach(function(el) {
      el.style.backgroundColor = topcolor;
    });
    // For hover styles, inject a dynamic rule
    var style = document.createElement('style');
    style.textContent =
      '.nav-drop-down a:hover { background-color: ' +
      topcolor + ' !important; }';
    document.head.appendChild(style);
  }
},
```

- [ ] **Step 5: Convert `setSearchInput` (lines 1862-1877)**

```js
// Before:
setSearchInput: function(el, domain) {
  var text = "Search on " + domain;
  $("input[name='q']").val(text);
  el.focus(function(){ ... });
  el.blur(function(){ ... });
},

// After:
setSearchInput: function(el, domain) {
  var text = "Search on " + domain;
  if (!el) return;
  el.value = text;
  el.addEventListener('focus', function(){
    HN.searchInputFocused = true;
    if (el.value == text) { el.value = ""; }
  });
  el.addEventListener('blur', function(){
    HN.searchInputFocused = false;
    if (el.value == "") { el.value = text; }
  });
},
```

Also update the caller in `initElements` (line 899) since `setSearchInput` now expects a native element:

```js
// Change:
HN.setSearchInput($('input[name="q"]'), search_domain);
// To:
HN.setSearchInput(document.querySelector('input[name="q"]'), search_domain);
```

- [ ] **Step 6: Commit**

```
git add js/hn.js
git commit -m "Convert navigation rewrite and dropdowns to vanilla JS (module 4)"
```

---

### Task 5: Post list page (~15 jQuery calls)

**Files:**
- Modify: `js/hn.js:1001-1021, 1527-1608`

- [ ] **Step 1: Convert `formatURL` (lines 1527-1541)**

```js
// Before:
formatURL: function() {
    $('.comhead').each(function() {
      var url_el = $('<span/>').text(
                     $(this).text().substring(2, $(this).text().length - 1)
                   );
      var left_paren = $('<span/>').addClass('paren').text('(');
      var right_paren = $('<span/>').addClass('paren').text(')');
      $(this).text('');
      $(this).append(left_paren).append(url_el).append(right_paren);
    });
},

// After:
formatURL: function() {
    document.querySelectorAll('.comhead').forEach(function(el) {
      var text = el.textContent;
      var url_text = text.substring(2, text.length - 1);

      var url_el = document.createElement('span');
      url_el.textContent = url_text;
      var left_paren = document.createElement('span');
      left_paren.classList.add('paren');
      left_paren.textContent = '(';
      var right_paren = document.createElement('span');
      right_paren.classList.add('paren');
      right_paren.textContent = ')';

      el.textContent = '';
      el.appendChild(left_paren);
      el.appendChild(url_el);
      el.appendChild(right_paren);
    });
},
```

- [ ] **Step 2: Convert `_fetchAndDisplayStars` (lines 1553-1591)**

```js
// After:
_fetchAndDisplayStars: function() {
  var ghLinks = {};
  var ghPattern = /^https?:\/\/github\.com\/([^\/]+\/[^\/]+)\/?/;

  document.querySelectorAll('.title a:not(.comments)').forEach(function(el) {
    var href = el.getAttribute('href');
    if (!href) return;
    var match = ghPattern.exec(href);
    if (match) {
      var repo = match[1].replace(/\.git$/, '');
      ghLinks[repo] = ghLinks[repo] || [];
      ghLinks[repo].push(el);
    }
  });

  var repos = Object.keys(ghLinks);
  if (repos.length === 0) return;

  chrome.runtime.sendMessage(
    { method: 'fetchGithubStars', repos: repos },
    function(response) {
      if (!response || !response.data) return;
      for (var repo in response.data) {
        var stars = response.data[repo];
        var els = ghLinks[repo];
        if (!els) continue;
        for (var i = 0; i < els.length; i++) {
          var badge = document.createElement('a');
          badge.classList.add('hnes-gh-stars');
          badge.href = 'https://github.com/' + repo;
          badge.target = '_blank';
          badge.title = stars.toLocaleString() + ' stars on GitHub';
          badge.innerHTML =
            '<svg class="hnes-gh-icon" viewBox="0 0 16 16"' +
            ' width="12" height="12"><path fill="currentColor"' +
            ' d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47' +
            ' 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01' +
            '.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15' +
            '-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87' +
            '.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89' +
            '-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08' +
            '-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0' +
            ' 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16' +
            ' 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87' +
            ' 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01' +
            ' 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016' +
            ' 8c0-4.42-3.58-8-8-8z"/></svg> ' +
            HN._formatStarCount(stars);
          var comhead = els[i].closest('td').querySelector('.comhead');
          if (comhead) comhead.after(badge);
        }
      }
    }
  );
},
```

- [ ] **Step 3: Convert `moveMoreLink` and `removeUpvotes` (lines 1599-1608)**

```js
// After:
moveMoreLink: function() {
  var more = document.getElementById('more');
  if (more && more.previousElementSibling) {
    more.previousElementSibling.setAttribute('colspan', '3');
  }
},
removeUpvotes: function() {
  var titles = document.querySelectorAll('.title');
  var lastTitle = titles[titles.length - 1];
  var slice = lastTitle && lastTitle.id === 'more'
    ? Array.from(titles).slice(0, -1)
    : Array.from(titles);
  slice.forEach(function(t) {
    var siblings = Array.from(t.parentElement.children).filter(
      function(c) { return c !== t; }
    );
    siblings.forEach(function(s) { s.remove(); });
  });
},
```

- [ ] **Step 4: Convert `doPostsList` (lines 1001-1021)**

`doPostsList` has one jQuery call:

```js
// Line 1002, change:
$("body").attr("id", "index-body");
// To:
document.body.id = 'index-body';
```

The rest of the function calls other HN methods with no jQuery.

- [ ] **Step 5: Commit**

```
git add js/hn.js
git commit -m "Convert post list page functions to vanilla JS (module 5)"
```

---

### Task 6: User profile (~40 jQuery calls)

**Files:**
- Modify: `js/hn.js:1088-1196`

- [ ] **Step 1: Convert `doUserProfile` (lines 1088-1186)**

```js
// After:
doUserProfile: function() {
  var contentTd = document.querySelector('#content > td');
  if (contentTd) contentTd.id = 'user-profile';

  var options = document.querySelectorAll('tr > td[valign="top"]');
  var user = options[0];
  var created = options[1];
  var karma = options[2];
  var about = options[3];

  if (options.length === 4) {
    // other user pages
    var submittedLink =
      document.querySelector('#user-profile a[href^="submitted"]');
    if (submittedLink && submittedLink.parentElement) {
      submittedLink.parentElement.id = 'others-profile-submitted';
    }
    // linkify about section (uses jQuery .linkify() for now;
    // replaced with vanilla linkifyElement in Task 9)
    if (about && about.nextElementSibling) {
      $(about.nextElementSibling).linkify();
    }
  }
  else {
    // your user page
    var userProfile = document.getElementById('user-profile');
    if (userProfile) userProfile.classList.add('your-profile');

    var email = options[4];
    var showdead = options[5];
    var noprocrast = options[6];
    var maxvisit = options[7];
    var minaway = options[8];
    var delay;

    // Check if topcolor option exists
    var hasTopcolor = false;
    for (var i = 0; i < options.length; i++) {
      if (options[i].textContent.includes('topcolor:')) {
        hasTopcolor = true;
        break;
      }
    }

    if (hasTopcolor) {
      var topcolor = options[9];
      topcolor.classList.add('select-option');
      var defaultSpan = document.createElement('span');
      defaultSpan.textContent = 'Default: ff6600';
      topcolor.nextElementSibling.appendChild(defaultSpan);
      delay = options[10];
    } else {
      delay = options[11];
    }

    // fix spacing
    [email, showdead, noprocrast, maxvisit, minaway, delay].forEach(
      function(el) { if (el) el.classList.add('select-option'); }
    );
    var changePwLink =
      document.querySelector('#user-profile a[href="changepw"]');
    if (changePwLink && changePwLink.parentElement) {
      changePwLink.parentElement.id = 'your-profile-change-password';
    }

    var current_karma = parseInt(karma.nextElementSibling.textContent);
    var karma_for_flag = 21;
    var karma_for_polls = 201;
    var karma_for_downvotes = 501;

    function makeP(html) {
      var p = document.createElement('p');
      p.innerHTML = html;
      return p;
    }

    var can_flag_msg = current_karma < karma_for_flag
      ? makeP('You need ' + (karma_for_flag - current_karma) +
              ' more karma until you can flag posts.')
      : makeP('You can flag posts.');

    var can_create_polls_msg = current_karma < karma_for_polls
      ? makeP('You need ' + (karma_for_polls - current_karma) +
              ' more karma until you can create a poll.')
      : makeP('You can <a href="//news.ycombinator.com/newpoll">' +
              'create a poll</a>.');

    var can_downvote_msg = current_karma < karma_for_downvotes
      ? makeP('You need ' + (karma_for_downvotes - current_karma) +
              ' more karma until you can downvote comments.')
      : makeP('You can downvote comments.');

    karma.nextElementSibling.appendChild(can_flag_msg);
    karma.nextElementSibling.appendChild(can_create_polls_msg);
    karma.nextElementSibling.appendChild(can_downvote_msg);

    var about_help =
      about.nextElementSibling.querySelector('a[href="formatdoc"]');
    if (about_help) {
      about_help.addEventListener('click', function(e) {
        e.preventDefault();
        var input_help =
          about.nextElementSibling.querySelector('.input-help');
        if (input_help) {
          input_help.remove();
        } else {
          about.nextElementSibling.appendChild(
            HN.getFormattingHelp(false)
          );
        }
      });
    }

    function appendSpanAndP(el, defaultText, explanationText) {
      if (!el) return;
      var span = document.createElement('span');
      span.textContent = defaultText;
      el.nextElementSibling.appendChild(span);
      if (explanationText) {
        var p = document.createElement('p');
        p.textContent = explanationText;
        el.nextElementSibling.appendChild(p);
      }
    }

    appendSpanAndP(showdead, 'Default: no',
      'Showdead allows you to see all the submissions and comments ' +
      'that have been killed by the editors.');
    appendSpanAndP(noprocrast, 'Default: no',
      "Noprocast is a way to prevent yourself from spending too " +
      "much time on Hacker News. If you turn it on you'll only be " +
      "allowed to visit the site for maxvisit minutes at a time, " +
      "with gaps of minaway minutes in between.");
    appendSpanAndP(maxvisit, 'Default: 20', null);
    appendSpanAndP(minaway, 'Default: 180', null);
    appendSpanAndP(delay, 'Default: 0',
      'Delay allows you to delay the public posting of comments ' +
      'you make for delay minutes.');

    // redirect to profile page after updating
    var updateBtn = document.querySelector('input[value="update"]');
    if (updateBtn) {
      updateBtn.addEventListener('click', function() {
        HN.setLocalStorage('update_profile', window.location.href);
      });
    }
  }
},
```

- [ ] **Step 2: Convert `getFormattingHelp` (lines 1188-1196)**

```js
// Before:
getFormattingHelp: function(links_work) {
  help = '<p>Blank lines separate paragraphs.</p>' + ...;
  return $('<div class="input-help">').append($(help));
},

// After:
getFormattingHelp: function(links_work) {
  var help =
    '<p>Blank lines separate paragraphs.</p>' +
    '<p>Text after a blank line that is indented by two or more ' +
    'spaces is reproduced verbatim (this is intended for code).</p>' +
    '<p>Text surrounded by asterisks is italicized, if the ' +
    "character after the first asterisk isn't whitespace.</p>";
  if (links_work)
    help += '<p>Urls become links.</p>';
  var div = document.createElement('div');
  div.classList.add('input-help');
  div.innerHTML = help;
  return div;
},
```

- [ ] **Step 3: Commit**

```
git add js/hn.js
git commit -m "Convert user profile page to vanilla JS (module 6)"
```

---

### Task 7: Login page (~35 jQuery calls)

**Files:**
- Modify: `js/hn.js:933-999, 852-863`

- [ ] **Step 1: Convert `doLogin` (lines 933-978)**

```js
// After:
doLogin: function() {
  document.body.id = 'login-body';
  document.title = "Login | Hacker News";

  HN.injectCSS();

  // save and remove rogue text nodes (e.g. "Bad login.")
  var message = '';
  Array.from(document.body.childNodes).forEach(function(node) {
    if (node.nodeType === 3) {
      message += node.textContent;
      node.remove();
    }
  });
  message = message.trim();

  var recover_password_link = document.querySelector('body > a');
  if (recover_password_link) recover_password_link.remove();

  // remove login header bold
  var firstB = document.querySelector('body > b');
  if (firstB) firstB.remove();

  // save and remove submit button
  var submitBtn = document.querySelector('form input[type="submit"]');
  var buttonHtml = submitBtn ? submitBtn.outerHTML : '';
  if (submitBtn) submitBtn.remove();

  var headerHtml =
    '<tr id="header"><td bgcolor="#ff6600">' +
    '<table border="0" cellpadding="0" cellspacing="0" width="100%"' +
    ' style="padding:2px"><tbody><tr><td>' +
    '<a href="http://ycombinator.com">' +
    '<img src="y18.gif" width="18" height="18"' +
    ' style="border:1px #ffffff solid;"></a></td><td>' +
    '<span class="pagetop" id="top-navigation">' +
    '<span class="nav-links">' +
    '<span><a href="/news" class="top" title="Top stories">' +
    'top</a>|</span>' +
    '<span><a href="/newest" class="new" title="Newest stories">' +
    'new</a>|</span>' +
    '<span><a href="/best" class="best" title="Best stories">' +
    'best</a></span>' +
    '</span></span></td></tr></tbody></table></td></tr>';

  // wrap content into a table
  var form = document.querySelector('body > form');
  if (form) form.id = 'login-form';
  var loginForm = document.getElementById('login-form');

  // Build wrapping structure
  var td = document.createElement('td');
  td.appendChild(loginForm);
  var tr = document.createElement('tr');
  tr.id = 'content';
  tr.appendChild(td);
  var table = document.createElement('table');
  table.setAttribute('border', '0');
  table.setAttribute('cellpadding', '0');
  table.setAttribute('cellspacing', '0');
  table.setAttribute('width', '85%');
  var tbody = document.createElement('tbody');
  tbody.innerHTML = headerHtml;
  tbody.appendChild(tr);
  table.appendChild(tbody);
  var center = document.createElement('center');
  center.appendChild(table);
  document.body.appendChild(center);

  // add submit button row
  var lastTr = loginForm.querySelector('tr:last-child');
  if (lastTr) {
    var btnRow = document.createElement('tr');
    var btnTd1 = document.createElement('td');
    var btnTd2 = document.createElement('td');
    btnTd2.innerHTML = buttonHtml;
    btnRow.appendChild(btnTd1);
    btnRow.appendChild(btnTd2);
    lastTr.after(btnRow);
  }

  var h1 = document.createElement('h1');
  h1.textContent = 'Login';
  loginForm.before(h1);

  if (recover_password_link) {
    loginForm.before(recover_password_link);
  }

  // re-add rogue messages
  if (message) {
    var msgP = document.createElement('p');
    msgP.id = 'login-msg';
    msgP.textContent = message;
    var contentH1 = document.querySelector('tr#content > td > h1');
    if (contentH1) contentH1.before(msgP);
  }

  // register?
  var createB = document.querySelector('b');
  if (createB && createB.textContent.includes('Create Account')) {
    HN.doCreateAccount();
  }
},
```

- [ ] **Step 2: Convert `doCreateAccount` (lines 980-999)**

```js
// After:
doCreateAccount: function() {
  if (document.body.id !== 'login-body') return;
  var bodyForm = document.querySelector('body > form');
  if (!bodyForm) return;

  // save and remove title
  var formTitleB = document.querySelector('body > b');
  if (formTitleB) formTitleB.remove();

  bodyForm.id = 'register-form';
  var formContent = bodyForm.outerHTML;
  bodyForm.remove();

  // rebuild inside existing table
  var contentTd = document.querySelector('tr#content > td');
  if (contentTd) {
    contentTd.insertAdjacentHTML('beforeend', formContent);
  }

  var registerForm = document.getElementById('register-form');
  var regSubmit = registerForm
    ? registerForm.querySelector('input[type="submit"]')
    : null;
  var regButtonHtml = regSubmit ? regSubmit.outerHTML : '';
  if (regSubmit) regSubmit.remove();

  var lastTr = registerForm
    ? registerForm.querySelector('tr:last-child')
    : null;
  if (lastTr) {
    var btnRow = document.createElement('tr');
    var btnTd1 = document.createElement('td');
    var btnTd2 = document.createElement('td');
    btnTd2.innerHTML = regButtonHtml;
    btnRow.appendChild(btnTd1);
    btnRow.appendChild(btnTd2);
    lastTr.after(btnRow);
  }

  var h1 = document.createElement('h1');
  h1.textContent = 'Create Account';
  if (registerForm) registerForm.before(h1);
},
```

- [ ] **Step 3: Convert `isLoginPage` (line 856-858)**

```js
// Before:
isLoginPage: function() {
  return ($("b:contains('Login')").length > 0);
},

// After:
isLoginPage: function() {
  var bolds = document.querySelectorAll('b');
  for (var i = 0; i < bolds.length; i++) {
    if (bolds[i].textContent.includes('Login')) return true;
  }
  return false;
},
```

- [ ] **Step 4: Convert `isLoggedIn` (lines 860-863)**

```js
// Before:
isLoggedIn: function() {
  var logout_elem = $('.pagetop a:contains(logout)');
  return (logout_elem.length > 0 ? true : false);
},

// After:
isLoggedIn: function() {
  var links = document.querySelectorAll('.pagetop a');
  for (var i = 0; i < links.length; i++) {
    if (links[i].textContent.includes('logout')) return true;
  }
  return false;
},
```

- [ ] **Step 5: Commit**

```
git add js/hn.js
git commit -m "Convert login page and auth helpers to vanilla JS (module 7)"
```

---

### Task 8: Comment system + HACKERSMACKER compat (~30 jQuery calls)

**Files:**
- Modify: `js/hn.js:226-261` (CommentTracker.checkIndexPage)
- Modify: `js/hn.js:1029-1086` (doCommentsList)
- Modify: `js/hn.js:1222-1289` (graphPoll, loadMoreLink, replaceVoteButtons)
- Modify: `js/hn.js:1291-1439` (user info/tag functions)
- Modify: `js/hn.js:447-597` (HNComments.renderComment -- add HACKERSMACKER classes)

- [ ] **Step 1: Convert `CommentTracker.checkIndexPage` (lines 226-261)**

```js
// After:
checkIndexPage: function() {
  document.querySelectorAll('.comments').forEach(function(el) {
    var href = el.getAttribute('href');
    if (href) {
      var id = href.match(/id=(\d+)/);
      if (id) {
        id = Number(id[1]);
      } else {
        return;
      }
      HN.getLocalStorage(id, function(response) {
        if (response.data) {
          var data = JSON.parse(response.data);
          var num = Number(el.textContent);
          var diff = num - data.num;
          if (diff > 0) {
            var newcomm = document.createElement('span');
            newcomm.classList.add('newcomments');
            newcomm.title = 'New Comments';
            newcomm.textContent = diff + ' / ';
            var totalcomm = document.createElement('span');
            totalcomm.textContent = el.textContent;
            totalcomm.classList.add('totalcomments');
            totalcomm.title = 'Total Comments';
            el.textContent = '';
            el.appendChild(newcomm);
            el.appendChild(totalcomm);
          }
        }
      });
    }
  });
}
```

- [ ] **Step 2: Convert `doCommentsList` (lines 1029-1086)**

```js
// After:
doCommentsList: function(pathname, track_comments) {
  var itemIdResults = /id=(\w+)/.exec(window.location.search);
  var itemId = false;
  if (itemIdResults) {
    itemId = itemIdResults[1];
  }

  var contentEl = document.getElementById('content');
  var below_header = contentEl
    ? contentEl.querySelectorAll('table')
    : [];

  var loadingP = document.createElement('p');
  loadingP.id = 'loading_comments';
  loadingP.textContent = 'Loading comments';
  if (below_header[1]) below_header[1].before(loadingP);

  if (pathname == "/item") {
    document.body.id = 'item-body';
    if (below_header[0]) below_header[0].classList.add('item-header');

    var comments = below_header[1];
    if (comments) comments.classList.add('comments-table');

    var poll = document.querySelector('.item-header table');
    if (poll) HN.graphPoll(poll);

    // linkify self-post text
    // (uses jQuery .linkify() until Task 9 replaces it)
    var selfPostRow =
      document.querySelector('.item-header tr:nth-child(3)');
    if (selfPostRow) {
      selfPostRow.classList.add('self-post-text');
      $(selfPostRow).linkify();
    }

    // fix spacing issue #86
    document.querySelectorAll('.item-header td').forEach(function(td) {
      td.removeAttribute('colspan');
    });

    // fixes issue #121
    document.querySelectorAll('.item-header td.ind').forEach(
      function(td) { td.remove(); }
    );

    // move reply button to new line
    var replyBtn =
      document.querySelector('.item-header input[type="submit"]');
    if (replyBtn) replyBtn.style.display = 'block';

    var more = document.querySelector('.morelink');
    if (more) HN.loadMoreLink(more);
  }
  else {
    document.body.id = 'threads-body';
    var comments = below_header[0];
    if (comments) comments.classList.add('comment-tree');
    HN.doAfterCommentsLoad();
  }
},
```

- [ ] **Step 3: Convert `graphPoll` (lines 1222-1240)**

```js
// After:
graphPoll: function(poll) {
  var poll_max_width = 500;
  var totalscore = 0;
  var poll_scores = poll.querySelectorAll('.default');
  poll_scores.forEach(function(el) {
    var score = Number(el.textContent.split(' ')[0]);
    totalscore += score;
  });
  poll_scores.forEach(function(el) {
    var score = Number(el.textContent.split(' ')[0]);
    if (score > 0) {
      var width = Math.max(1, score / totalscore * poll_max_width);
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var td2 = document.createElement('td');
      var div = document.createElement('div');
      div.classList.add('poll-graph');
      div.style.width = width + 'px';
      td2.appendChild(div);
      tr.appendChild(td1);
      tr.appendChild(td2);
      el.parentElement.after(tr);
    }
  });
},
```

- [ ] **Step 4: Convert `loadMoreLink` (lines 1242-1263)**

The original uses `$.load()` which fetches HTML and inserts it. Replace with `fetch` + `DOMParser`.

```js
// After:
loadMoreLink: function(elem) {
  if (!elem) {
    HN.doAfterCommentsLoad();
    return;
  }

  var loading_comments = document.getElementById('loading_comments');
  if (loading_comments) {
    loading_comments.textContent += '.';
  }

  var moreurl = elem.getAttribute
    ? elem.getAttribute('href')
    : elem.href;
  if (!moreurl) {
    HN.doAfterCommentsLoad();
    return;
  }

  fetch(moreurl)
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var rows = doc.querySelectorAll(
        'center > table > tbody > tr:nth-child(3)' +
        ' > td > table > tbody > tr'
      );
      var tbody = document.querySelector('.comments-table > tbody');
      if (tbody) {
        rows.forEach(function(row) {
          tbody.appendChild(document.adoptNode(row));
        });
      }
      document.querySelectorAll('.morelink').forEach(function(el) {
        el.remove();
      });
      var nextMore = document.querySelector(
        '.title a[rel="nofollow"]'
      );
      if (nextMore && nextMore.textContent.includes('More')) {
        HN.loadMoreLink(nextMore);
      } else {
        HN.doAfterCommentsLoad();
      }
    })
    .catch(function() {
      HN.doAfterCommentsLoad();
    });
},
```

- [ ] **Step 5: Convert `replaceVoteButtons` (lines 1273-1289)**

```js
// After:
replaceVoteButtons: function(isPostList) {
  document.querySelectorAll('img[src$="grayarrow.gif"]').forEach(
    function(img) {
      var div = document.createElement('div');
      div.classList.add('up-arrow');
      img.replaceWith(div);
    }
  );
  document.querySelectorAll('img[src$="graydown.gif"]').forEach(
    function(img) {
      var div = document.createElement('div');
      div.classList.add('down-arrow', 'last-arrow');
      img.replaceWith(div);
    }
  );
  if (isPostList) {
    document.querySelectorAll('div.up-arrow').forEach(function(el) {
      el.classList.add('postlist-arrow');
    });
  } else {
    document.querySelectorAll('div.up-arrow').forEach(function(el) {
      var center = el.closest('center');
      if (center) {
        var numbuttons = center.querySelectorAll('a').length;
        if (numbuttons == 1) {
          el.classList.add('last-arrow');
        }
      }
    });
  }
},
```

- [ ] **Step 6: Convert `addInfoToUsers` event delegation (lines 1333-1355)**

```js
// Before (jQuery delegated events):
$(document).on('click', '.hnes-tag, .hnes-tagText', function(e) {
  HN.editUserTag(e);
});
$(document).on('keyup', '.hnes-tagEdit', function(e) { ... });

// After (vanilla delegation):
document.addEventListener('click', function(e) {
  if (e.target.matches('.hnes-tag, .hnes-tagText')) {
    HN.editUserTag(e);
  }
});
document.addEventListener('keyup', function(e) {
  if (e.target.matches('.hnes-tagEdit')) {
    var code = e.keyCode || e.which;
    var parent = e.target.parentElement;
    var gp = parent.parentElement;
    if (code === 13) { // Enter
      var author = gp.querySelector('a').textContent;
      var tagEdit = parent.querySelector('.hnes-tagEdit');
      HN.setUserTag(author, tagEdit.value);
      parent.classList.remove('edit');
    }
    if (code === 27) { // Escape
      var tagText = parent.querySelector('.hnes-tagText');
      var tagEdit = parent.querySelector('.hnes-tagEdit');
      tagEdit.value = tagText.textContent;
      parent.classList.remove('edit');
    }
  }
});
```

- [ ] **Step 7: Convert `upvoteUserData` (lines 1358-1378)**

Remove unused jQuery selector on line 1359:

```js
// Before:
upvoteUserData: function(author, value) {
  var commenter = $('.author:contains('+author+')');  // unused
  HN.getLocalStorage(author, function(response) { ... });
},

// After:
upvoteUserData: function(author, value) {
  HN.getLocalStorage(author, function(response) {
    var userInfo = {};
    var new_upvote_total = value;
    if (response.data) {
      userInfo = JSON.parse(response.data);
    }
    if (userInfo.votes) {
      new_upvote_total += userInfo.votes;
    }
    userInfo.votes = new_upvote_total;
    if (new_upvote_total === 0) {
      delete userInfo.votes;
    }
    HN.setLocalStorage(author, JSON.stringify(userInfo));
    HN.showNewUserScore(author, new_upvote_total);
  });
},
```

- [ ] **Step 8: Convert `showNewUserScore` (lines 1380-1392)**

```js
// Before:
showNewUserScore: function(author, value) {
  var author_els = $('.author:contains('+author+')');
  ...
},

// After:
showNewUserScore: function(author, value) {
  document.querySelectorAll('.author').forEach(function(author_el) {
    if (author_el.textContent.includes(author)) {
      var score_el = author_el.querySelector('.hnes-user-score');
      if (score_el) {
        if (value !== 0) {
          score_el.textContent = value;
          score_el.parentElement.classList.remove('noscore');
        } else {
          score_el.parentElement.classList.add('noscore');
        }
      }
    }
  });
},
```

- [ ] **Step 9: Convert `editUserTag` (lines 1407-1413)**

```js
// Before:
editUserTag: function(e) {
  var parent = $(e.target).parent(),
      tagEdit = parent.find('.hnes-tagEdit'),
      tagText = parent.find('.hnes-tagText');
  parent.addClass('edit');
  tagEdit.focus();
},

// After:
editUserTag: function(e) {
  var parent = e.target.parentElement;
  var tagEdit = parent.querySelector('.hnes-tagEdit');
  parent.classList.add('edit');
  tagEdit.focus();
},
```

- [ ] **Step 10: Convert `setUserTag` (lines 1415-1439)**

```js
// After:
setUserTag: function(author, tag) {
  HN.getLocalStorage(author, function(response) {
    var userInfo = {};
    if (response.data)
      userInfo = JSON.parse(response.data);
    if (tag !== '')
      userInfo.tag = tag;
    else
      delete userInfo.tag;
    HN.setLocalStorage(author, JSON.stringify(userInfo));
  });
  document.querySelectorAll('.author').forEach(function(el) {
    if (el.textContent.includes(author)) {
      var tagText = el.parentElement.querySelector('.hnes-tagText');
      var tagEdit = el.parentElement.querySelector('.hnes-tagEdit');
      if (tagText) tagText.textContent = tag;
      if (tagEdit) tagEdit.value = tag;
    }
  });
},
```

- [ ] **Step 11: Convert `removeNumbers` (line 1441-1443)**

```js
// Before:
removeNumbers: function() {
  $('td[align="right"]').remove();
},

// After:
removeNumbers: function() {
  document.querySelectorAll('td[align="right"]').forEach(
    function(el) { el.remove(); }
  );
},
```

- [ ] **Step 12: Add HACKERSMACKER compatibility classes**

In `HNComments.renderComment` (around lines 447-597), add the compatibility classes so HACKERSMACKER's selectors match HNES-rendered comment markup.

After `c.el = commentEl;` (line 463), add:
```js
commentEl.classList.add('comtr');
```

After the text content loop (around line 544, after the `for` loop that appends `textParts`), add:
```js
commentEl.querySelector('.text').classList.add('commtext');
```

Fix the author link href to use a relative URL so HACKERSMACKER's `a[href^=user]` selector matches. Change line 480 from:
```js
authorEl.href = c.userUrl;
```
To:
```js
authorEl.setAttribute('href', 'user?id=' + c.username);
```

This preserves navigation (browsers resolve relative URLs) and matches HACKERSMACKER's attribute selector `a[href^=user]`.

- [ ] **Step 13: Commit**

```
git add js/hn.js
git commit -m "Convert comment system to vanilla JS, add HACKERSMACKER compat classes (module 8)"
```

---

### Task 9: Vanilla linkify function

**Files:**
- Create: `js/linkify.js`
- Modify: `js/hn.js` (replace `.linkify()` calls with `linkifyElement()`)
- Modify: `tests/unit.test.js` (add linkify tests)

- [ ] **Step 1: Create vanilla linkify function**

Create `js/linkify.js`:

```js
/**
 * Vanilla JS replacement for jQuery linkify plugin.
 * Walks text nodes in a container and converts URLs to <a> links.
 */
function linkifyElement(container) {
  var noProtocolUrl =
    /(^|[\s(])(www\..+?\..+?)((?:[:.]+)?(?=[\s).,;!?]|$))/g;
  var httpOrMailtoUrl =
    /(^|[\s(])((?:https?:\/\/|mailto:)\S+?)((?:[:.]+)?(?=[\s).,;!?]|$))/g;

  var walker = document.createTreeWalker(
    container, NodeFilter.SHOW_TEXT, null
  );
  var textNodes = [];
  var node;
  while ((node = walker.nextNode())) {
    if (node.parentElement &&
        /^(a|button|textarea|script|style)$/i.test(
          node.parentElement.tagName)) {
      continue;
    }
    if (node.nodeValue.length > 1 && /\S/.test(node.nodeValue)) {
      textNodes.push(node);
    }
  }

  for (var i = 0; i < textNodes.length; i++) {
    var tn = textNodes[i];
    var html = tn.nodeValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    var replaced = html
      .replace(noProtocolUrl, '$1<a href="http://$2">$2</a>$3')
      .replace(httpOrMailtoUrl, '$1<a href="$2">$2</a>$3');

    if (replaced !== html) {
      var span = document.createElement('span');
      span.innerHTML = replaced;
      while (span.firstChild) {
        tn.parentNode.insertBefore(span.firstChild, tn);
      }
      tn.remove();
    }
  }
}
```

- [ ] **Step 2: Replace `.linkify()` calls in `hn.js`**

In `doCommentsList` (self-post text linkification), replace:
```js
// Before (from Task 8 conversion):
$(selfPostRow).linkify();

// After:
linkifyElement(selfPostRow);
```

In `doUserProfile` (about section on other user pages), replace:
```js
// Before (from Task 6 conversion):
$(about.nextElementSibling).linkify();

// After:
linkifyElement(about.nextElementSibling);
```

- [ ] **Step 3: Add linkify tests to `tests/unit.test.js`**

Since `linkifyElement` needs a DOM, test the regex logic directly:

```js
function linkifyText(text) {
  var noProtocolUrl =
    /(^|[\s(])(www\..+?\..+?)((?:[:.]+)?(?=[\s).,;!?]|$))/g;
  var httpOrMailtoUrl =
    /(^|[\s(])((?:https?:\/\/|mailto:)\S+?)((?:[:.]+)?(?=[\s).,;!?]|$))/g;
  var html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return html
    .replace(noProtocolUrl, '$1<a href="http://$2">$2</a>$3')
    .replace(httpOrMailtoUrl, '$1<a href="$2">$2</a>$3');
}

describe('linkifyText', () => {
  it('converts http URLs to links', () => {
    assert.equal(
      linkifyText('visit http://example.com today'),
      'visit <a href="http://example.com">http://example.com</a> today'
    );
  });
  it('converts https URLs to links', () => {
    assert.equal(
      linkifyText('see https://example.com/path'),
      'see <a href="https://example.com/path">https://example.com/path</a>'
    );
  });
  it('converts www URLs to links with http prefix', () => {
    assert.equal(
      linkifyText('go to www.example.com now'),
      'go to <a href="http://www.example.com">www.example.com</a> now'
    );
  });
  it('converts mailto URLs to links', () => {
    assert.equal(
      linkifyText('email mailto:test@example.com'),
      'email <a href="mailto:test@example.com">mailto:test@example.com</a>'
    );
  });
  it('leaves plain text unchanged', () => {
    assert.equal(linkifyText('no links here'), 'no links here');
  });
  it('handles URL at start of string', () => {
    assert.equal(
      linkifyText('http://example.com is great'),
      '<a href="http://example.com">http://example.com</a> is great'
    );
  });
  it('handles URL at end of string', () => {
    assert.equal(
      linkifyText('visit http://example.com'),
      'visit <a href="http://example.com">http://example.com</a>'
    );
  });
  it('escapes HTML entities in text', () => {
    assert.equal(
      linkifyText('a < b & c > d'),
      'a &lt; b &amp; c &gt; d'
    );
  });
});
```

- [ ] **Step 4: Run tests**

```
npm test
```

- [ ] **Step 5: Commit**

```
git add js/linkify.js js/hn.js tests/unit.test.js
git commit -m "Replace jQuery linkify plugin with vanilla JS function (module 9)"
```

---

### Task 10: Init / glue / cleanup

**Files:**
- Modify: `js/hn.js:1-130` (remove InlineReply)
- Modify: `js/hn.js:700-900` (init, initElements)
- Modify: `js/hn.js:2010-2062` (hckrnews.com, document ready)
- Modify: `manifest.json`
- Delete: `js/jquery-3.2.1.min.js`
- Delete: `js/jquery-3.2.1.js`
- Delete: `js/linkify/jquery.linkify-1.0.js`
- Delete: `js/linkify/jquery.linkify-1.0-min.js`
- Delete: `js/linkify/plugins/jquery.linkify-1.0-twitter.js`
- Delete: `js/linkify/plugins/jquery.linkify-1.0-twitter-min.js`

- [ ] **Step 1: Remove `InlineReply` (lines 18-130)**

Delete the entire `var InlineReply = { ... }` block (lines 18-130). It is dead code -- the call at line 1030 is commented out.

- [ ] **Step 2: Convert `initElements` (lines 865-904)**

```js
// After:
initElements: function() {
  var rows = document.querySelectorAll(
    'body > center > table > tbody > tr'
  );
  var header = rows[0];
  if (!header) return;

  var headerTd = header.querySelector('td');
  if (headerTd && headerTd.getAttribute('bgcolor') === '#000000') {
    // mourning mode
    var mourningRow = header;
    header = rows[1];
    mourningRow.remove();
    document.body.classList.add('mourning');
  }
  header.id = 'header';

  // Re-query rows after potential removal
  var freshRows = document.querySelectorAll(
    'body > center > table > tbody > tr'
  );
  var contentIndex = 2;
  if (freshRows[1] && freshRows[1].querySelector('.pagetop')) {
    // Announcement row present underneath header
    contentIndex++;
  }

  if (freshRows[contentIndex]) {
    freshRows[contentIndex].id = 'content';
  }

  // Remove empty tr between header and content
  if (freshRows[contentIndex - 1]) {
    freshRows[contentIndex - 1].remove();
  }

  // Remove inline style from header td
  var headerTableTd = document.querySelector('#header table td');
  if (headerTableTd) headerTableTd.removeAttribute('style');

  // Set id on More link
  var lastTitle = document.querySelector('tr:last-child .title');
  if (lastTitle) lastTitle.id = 'more';

  // Remove spacing rows
  document.querySelectorAll('tr[style="height:7px"]').forEach(
    function(el) { el.remove(); }
  );
  document.querySelectorAll('tr[style="height:2px"]').forEach(
    function(el) { el.remove(); }
  );

  // yclinks width
  var yclinks = document.querySelector('.yclinks');
  if (yclinks) {
    var centerEl = yclinks.closest('center');
    if (centerEl) centerEl.style.width = '100%';
  }

  var search_domain = "hn.algolia.com";
  HN.setSearchInput(
    document.querySelector('input[name="q"]'),
    search_domain
  );

  var icon = document.querySelector('img[src="y18.gif"]');
  if (icon) {
    if (icon.parentElement) {
      icon.parentElement.href = 'http://news.ycombinator.com/';
    }
    icon.title = 'Hacker News';
  }
},
```

- [ ] **Step 3: Convert remaining jQuery calls in `HN.init` (lines 702-850)**

Each jQuery call in the routing logic:

```js
// Line 713-715 (logout detection):
// Before:
var logout_elem = $('.pagetop a:contains(logout)');
if (logout_elem.length)
  HN.rewriteUserNav(logout_elem.parent());

// After:
var logout_elem = null;
document.querySelectorAll('.pagetop a').forEach(function(a) {
  if (a.textContent.includes('logout')) logout_elem = a;
});
if (logout_elem)
  HN.rewriteUserNav(logout_elem.parentElement);
```

```js
// Line 762-763 (remove_first_tr):
// Before:
function remove_first_tr() {
  $("body #content td table tbody tr").filter(":first").remove();
}

// After:
function remove_first_tr() {
  var first = document.querySelector('#content td table tbody tr');
  if (first) first.remove();
}
```

```js
// Line 764-765 (jobs body):
// Before:
$("body").attr("id", "jobs-body");

// After:
document.body.id = 'jobs-body';
```

```js
// Lines 767-773 (show/jobs blurb):
// Before:
remove_first_tr();
var blurbRow = $("body #content td table tbody tr:not(.athing):first"),
    blurb = blurbRow.find("td:last").html();
blurbRow.remove();
$("body #content table").before($("<p>").addClass("blurb").html(blurb));

// After:
remove_first_tr();
var blurbRow = document.querySelector(
  '#content td table tbody tr:not(.athing)'
);
var blurb = '';
if (blurbRow) {
  var tds = blurbRow.querySelectorAll('td');
  var lastTd = tds[tds.length - 1];
  if (lastTd) blurb = lastTd.innerHTML;
  blurbRow.remove();
}
var blurbP = document.createElement('p');
blurbP.classList.add('blurb');
blurbP.innerHTML = blurb;
var contentTable = document.querySelector('#content table');
if (contentTable) contentTable.before(blurbP);
```

```js
// Lines 775-778 (edit body):
// Before:
$("body").attr("id", "edit-body");
$("tr:nth-child(3) td td:first-child").remove();

// After:
document.body.id = 'edit-body';
var editTd = document.querySelector(
  'tr:nth-child(3) td td:first-child'
);
if (editTd) editTd.remove();
```

```js
// Lines 787-789 (morelink after content):
// Before:
$('#content').after(morelink);

// After:
var contentEl = document.getElementById('content');
if (contentEl) contentEl.after(morelink);
```

```js
// Lines 799-804 (favorites/upvoted):
// Before:
$("td[colspan='2']").hide();
$(".votelinks").hide();
$(".ind").hide();

// After:
document.querySelectorAll("td[colspan='2']").forEach(
  function(el) { el.style.display = 'none'; }
);
document.querySelectorAll('.votelinks').forEach(
  function(el) { el.style.display = 'none'; }
);
document.querySelectorAll('.ind').forEach(
  function(el) { el.style.display = 'none'; }
);
```

```js
// Lines 806-823 (threads body):
// Before:
$("body").attr("id", "threads-body");
var trs = $('body > center > table > tbody > tr');
var comments = trs.slice(2, -1);
var newtable = $("<table/>").append($('<tbody/>').append(comments));
$(trs[1]).find('td').append(newtable);
// ...
newtable.parent().append(morelink);

// After:
document.body.id = 'threads-body';
var allTrs = document.querySelectorAll(
  'body > center > table > tbody > tr'
);
var trsArray = Array.from(allTrs);
var commentRows = trsArray.slice(2, -1);
var newtable = document.createElement('table');
var newtbody = document.createElement('tbody');
commentRows.forEach(function(row) { newtbody.appendChild(row); });
newtable.appendChild(newtbody);
var secondRowTd = trsArray[1]
  ? trsArray[1].querySelector('td')
  : null;
if (secondRowTd) secondRowTd.appendChild(newtable);

var morelink = document.querySelector('.morelink');
if (morelink && newtable.parentElement) {
  newtable.parentElement.appendChild(morelink);
}
```

```js
// Line 848 (More link colspan):
// Before:
$('.title:contains(More)').prev().attr('colspan', '1');

// After:
document.querySelectorAll('.title').forEach(function(el) {
  if (el.textContent.includes('More') &&
      el.previousElementSibling) {
    el.previousElementSibling.setAttribute('colspan', '1');
  }
});
```

```js
// Line 853 (doPoll):
// Before:
doPoll: function() {
  $('body').attr('id', 'poll-body');
},

// After:
doPoll: function() {
  document.body.id = 'poll-body';
},
```

- [ ] **Step 4: Convert hckrnews.com block (lines 2012-2027)**

```js
// After:
if (window.location.host == "hckrnews.com") {
  document.querySelectorAll('ul.entries li').forEach(function(li) {
    var liId = li.getAttribute('id');
    chrome.runtime.sendMessage(
      {method: "getLocalStorage", key: Number(liId)},
      function(response) {
        if (response.data != undefined) {
          var data = JSON.parse(response.data);
          var id = data.id;
          var num = data.num ? data.num : 0;
          var el = document.getElementById(String(id));
          if (!el) return;
          var commentsLink = el.querySelector('.comments');
          if (!commentsLink) return;
          var now = Number(commentsLink.textContent);
          var unread = Math.max(now - num, 0);
          var prepend = unread == 0
            ? "" + unread + " / "
            : "<span>" + unread + "</span> / ";
          commentsLink.insertAdjacentHTML('afterbegin', prepend);
        }
      }
    );
  });
}
```

- [ ] **Step 5: Convert document ready / expired link block (lines 2029-2062)**

```js
// After:
else {
  HN.init();

  // Script runs at document_end so DOM is parsed.
  // Use helper for safety:
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function(){
    if ("Unknown or expired link." == document.body.innerHTML) {
      HN.setLocalStorage('expired', true);
      window.location.replace("/");
      return;
    }
    else {
      HN.getLocalStorage('expired', function(response) {
        if (response.data != undefined) {
          var expired = JSON.parse(response.data);
          if (expired) {
            var alertP = document.createElement('p');
            alertP.id = 'alert';
            alertP.innerHTML =
              'You reached an <a href="//news.ycombinator.com/' +
              'item?id=17705" title="what?">expired page</a>' +
              ' and have been redirected back to the front page.';
            var header = document.getElementById('header');
            if (header) header.after(alertP);
            HN.setLocalStorage('expired', false);
          }
        }
      });
    }

    // redirect to profile page after updating it
    if (window.location.pathname == "/x") {
      HN.getLocalStorage('update_profile', function(response) {
        if (response.data != undefined && response.data != "false") {
          HN.setLocalStorage('update_profile', false);
          window.location.replace(response.data);
        }
      });
    }

    document.body.style.visibility = 'visible';
  });
}
```

- [ ] **Step 6: Update `manifest.json`**

```json
{
    "name": "Hacker News Enhancement Suite",
    "short_name": "HNES",
    "version": "1.7.0",
    "description": "Enhance Hacker News with collapsible comments, GitHub star counts, keyboard shortcuts, user tags, new comment tracking, and a modern UI.",
    "manifest_version": 3,
    "homepage_url": "https://testy.cool/tools/hnes",
    "background": {
      "service_worker": "background.js"
    },
    "permissions": [
      "storage",
      "unlimitedStorage"
    ],
    "host_permissions": [
      "https://api.github.com/*"
    ],
    "icons": {
        "16" : "images/icon-16.png",
        "48" : "images/icon-48.png",
        "128" : "images/icon-128.png"
    },
    "content_scripts": [
      { "run_at": "document_start",
        "css": [ "style.css" ],
        "matches": [
          "http://news.ycombinator.com/*",
          "https://news.ycombinator.com/*",
          "http://news.ycombinator.net/*",
          "https://news.ycombinator.net/*",
          "http://hackerne.ws/*",
          "https://hackerne.ws/*",
          "http://news.ycombinator.org/*",
          "https://news.ycombinator.org/*"]
      },
      {
        "run_at": "document_end",
        "all_frames": true,
        "css": [ "style.css" ],
        "js": [
          "js/linkify.js",
          "js/hn.js"],
        "matches": [
          "http://news.ycombinator.com/*",
          "https://news.ycombinator.com/*",
          "http://news.ycombinator.net/*",
          "https://news.ycombinator.net/*",
          "http://hackerne.ws/*",
          "https://hackerne.ws/*",
          "http://news.ycombinator.org/*",
          "https://news.ycombinator.org/*"]
      },
      {
        "matches": ["http://hckrnews.com/*"],
        "run_at": "document_end",
        "js": ["js/hn.js"]
      }
    ],
    "web_accessible_resources": [
      {
        "resources": [
          "images/spin.gif",
          "images/unvote.gif",
          "images/tag.svg",
          "templates/comment.html"
        ],
        "matches": [
          "http://news.ycombinator.com/*",
          "https://news.ycombinator.com/*",
          "http://news.ycombinator.net/*",
          "https://news.ycombinator.net/*",
          "http://news.ycombinator.org/*",
          "https://news.ycombinator.org/*",
          "http://hackerne.ws/*",
          "https://hackerne.ws/*",
          "http://hckrnews.com/*",
          "https://hckrnews.com/*"
        ]
      }
    ]
}
```

Key manifest changes:
- Version bumped: `1.6.0.4` -> `1.7.0`
- Removed: `js/jquery-3.2.1.min.js` (from both HN and hckrnews entries)
- Removed: `js/linkify/jquery.linkify-1.0.js`
- Removed: `js/linkify/plugins/jquery.linkify-1.0-twitter.js`
- Added: `js/linkify.js` (before `js/hn.js` in HN entry)
- hckrnews.com entry: only loads `js/hn.js` (no jQuery, no linkify needed)

- [ ] **Step 7: Delete jQuery and linkify plugin files**

```
git rm js/jquery-3.2.1.min.js
git rm js/jquery-3.2.1.js
git rm js/linkify/jquery.linkify-1.0.js
git rm js/linkify/jquery.linkify-1.0-min.js
git rm js/linkify/plugins/jquery.linkify-1.0-twitter.js
git rm js/linkify/plugins/jquery.linkify-1.0-twitter-min.js
```

- [ ] **Step 8: Verify no remaining `$()` or jQuery references in `js/hn.js`**

Search for any remaining `$(` calls. There should be zero. If any are found, convert them.

- [ ] **Step 9: Run unit tests**

```
npm test
```

- [ ] **Step 10: Commit**

```
git add -A
git commit -m "Remove jQuery and linkify plugins, complete vanilla JS migration (module 10)"
```
