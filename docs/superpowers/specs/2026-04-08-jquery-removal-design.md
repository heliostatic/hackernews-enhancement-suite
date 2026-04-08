# jQuery Removal & HACKERSMACKER Compatibility

## Goal

Remove jQuery 3.2.1 (which has known prototype pollution CVEs) from HNES by converting all ~262 jQuery call sites in `js/hn.js` to vanilla JS. Replace the jQuery linkify plugin with a small vanilla function. Add compatibility with the HACKERSMACKER extension. Drop dead code.

## Approach

**Incremental module-by-module migration (Approach B).** Each logical module is converted in a separate commit. jQuery remains loaded until the final commit removes it. This keeps each step reviewable, manually testable, and git-bisectable.

## Browser Targets

Modern Chrome and Firefox (Manifest V3). Vanilla APIs used freely: `querySelectorAll`, `closest()`, `classList`, `append()`, `remove()`, `replaceWith()`, `matches()`, arrow functions, template literals, etc.

## Migration Modules (in order)

### Module 1: Utility / storage wrappers (~6 jQuery calls)

Lines 910-924. `getLocalStorage`, `setLocalStorage`, `getUserData` are thin wrappers around `chrome.runtime.sendMessage`. Minimal jQuery usage -- mostly just callback patterns.

### Module 2: Keyboard shortcuts (~25 jQuery calls)

Lines 1881-2008. `init_keys`, `next_or_prev_story`, `open_story`, `view_comments`. Event binding (`$(document).keydown`) and class toggling (`.addClass('on_story')`). Convert to `document.addEventListener('keydown', ...)` and `classList` operations. `$.animate` for smooth scrolling replaced with `element.scrollIntoView({ behavior: 'smooth' })` or `window.scrollTo` with smooth behavior.

### Module 3: Score / heat map (~30 jQuery calls)

Lines 1445-1516, 1982-2001. `formatScore`, `getAndRateStories`, `enableLinkHighlighting`. Reads score text, applies heat classes, restructures subtext elements. Heavy use of `$('<span/>')` element creation -- convert to `document.createElement` or template literals parsed via a helper.

### Module 4: Navigation rewrite (~60 jQuery calls)

Lines 1610-1860. `rewriteNavigation`, `rewriteUserNav`, HNES settings dropdown, `setTopColor`. Builds dropdown menus, rewrites the top bar. Most complex DOM construction. Convert jQuery element builders (`$('<a/>').text(...).attr(...)`) to vanilla `createElement` + property assignment, or small helper if the pattern repeats enough.

### Module 5: Post list page (~15 jQuery calls)

Lines 1001-1021, 1527-1608. `doPostsList`, `formatURL`, `showGithubStars`, `moveMoreLink`. Orchestrates the post list and formats URL display. `showGithubStars` and `_fetchAndDisplayStars` use `chrome.runtime.sendMessage` and jQuery selectors -- convert selectors to `querySelectorAll`.

### Module 6: User profile (~40 jQuery calls)

Lines 1088-1186. `doUserProfile`. Adds karma milestone messages, formatting help toggle, default value hints. Isolated to `/user` page. Lots of element construction and `.append()` chains.

### Module 7: Login page (~35 jQuery calls)

Lines 933-998. `doLogin`, `doCreateAccount`. Heaviest DOM surgery -- tears apart and rebuilds the login form layout. **Flagged as removal candidate** but converting for now. Convert the element construction and DOM rearrangement to vanilla equivalents.

### Module 8: Comment system + HACKERSMACKER compat (~30 jQuery calls)

Lines 132-262 (`CommentTracker`), 1029-1086 (`doCommentsList`). The `HNComments` class (266-689) is already vanilla JS and needs no conversion.

**HACKERSMACKER compatibility:** After HNES renders `#hnes-comments`, add classes so HACKERSMACKER's selectors work:

- Add class `commtext` to `.hnes-comment .text` elements (HACKERSMACKER queries `.commtext` for comment body text)
- Add class `comtr` to `.hnes-comment` elements (HACKERSMACKER's fallback uses `closest()` with a `.commtext` check)
- `.author a` already uses `a[href="user?id=..."]` format, which matches HACKERSMACKER's `a[href^=user]` selector -- **verify this is the case, fix if not**
- `.age.permalink` already has an href -- matches HACKERSMACKER's `.age a` selector
- `.pagetop` is untouched by HNES -- HACKERSMACKER's logged-in user detection works as-is
- `.subtext a[href^=user]` on post list pages is untouched -- HACKERSMACKER's post list orbs work as-is

### Module 9: Vanilla linkify function

Replace the jQuery linkify plugin (`js/linkify/jquery.linkify-1.0.js`) with a ~20-line vanilla JS function. The core logic is two regex replacements: one for `www.` URLs without protocol, one for `http(s)://` and `mailto:` URLs. Apply it by walking text nodes in a container element.

Used in exactly 2 places:
- Self-post text linkification (hn.js:1057)
- User "about" section on profile page (hn.js:1100)

**Drop the Twitter linkify plugin entirely** (`js/linkify/plugins/jquery.linkify-1.0-twitter.js` and its minified variant). It converts @mentions and #hashtags to twitter.com links -- unwanted behavior for HN content.

### Module 10: Init / glue / cleanup

Lines 700-900 (`HN.init`, `initElements`), 2010-2062 (hckrnews.com support, expired link redirect, document ready).

- Convert remaining `$()` calls in `init`, `initElements`, and the hckrnews.com block
- Remove `InlineReply` (lines 18-130) -- already disabled (commented out at line 1030), dead code
- Delete files: `js/jquery-3.2.1.min.js`, `js/jquery-3.2.1.js`, `js/linkify/jquery.linkify-1.0.js`, `js/linkify/jquery.linkify-1.0-min.js`, `js/linkify/plugins/jquery.linkify-1.0-twitter.js`, `js/linkify/plugins/jquery.linkify-1.0-twitter-min.js`
- Update `manifest.json`: remove jQuery and linkify from `content_scripts.js` arrays
- Bump version in `manifest.json`

## Removals

| Item | Reason |
|------|--------|
| jQuery 3.2.1 (`js/jquery-3.2.1.min.js`, `js/jquery-3.2.1.js`) | Known CVEs (prototype pollution), the entire motivation for this work |
| jQuery linkify plugin (`js/linkify/`) | jQuery dependency, replaced by vanilla function |
| Twitter linkify plugin (`js/linkify/plugins/`) | Unwanted behavior (linkifies #hashtags as Twitter searches) |
| `InlineReply` (hn.js:18-130) | Dead code, already commented out |

## Kept but Flagged

| Item | Reason to keep | Reason it might be dropped later |
|------|---------------|----------------------------------|
| Login page restyling | Small conversion effort, some users may rely on it | Heaviest DOM surgery for purely cosmetic benefit |
| hckrnews.com integration | ~16 lines, trivial to convert | Unknown user base, adds manifest entry |

## Testing

### Automated unit tests

Use Node's built-in `node:test` runner. No additional dependencies. Test these pure functions:

- `_formatStarCount`: 999 -> "999", 1000 -> "1k", 1500 -> "1.5k", 1000000 -> "1M"
- `prettyPrintDaysAgo`: 0 -> "", 1 -> "1 day", 45 -> "1 month 15 days", 400 -> "1 year 1 month 5 days"
- `getAndRateStories` threshold logic: <50 -> no-heat, <75 -> mild, <99 -> medium, >=99 -> hot
- Vanilla linkify function: plain URLs, www. URLs, mailto: links, edge cases (URLs at start/end of text, adjacent punctuation)
- `CommentTracker.process`: expiration calculation, last_comment_id update logic

### Manual testing checklist

Run after each module conversion, in both Chrome and Firefox:

**Post list (/, /news, /newest, /best, /show, /ask, /jobs):**
- [ ] Score numbers display with heat coloring
- [ ] Comment count badges show (with new/total split when applicable)
- [ ] GitHub star badges appear on repo links
- [ ] Keyboard shortcuts: j/k navigate, o opens story, l opens in new tab, p opens comments, c comments in new tab, b opens both
- [ ] Clicked links get highlight class
- [ ] Vote arrows display and function
- [ ] "More" link works

**Comments (/item):**
- [ ] Comments render with HNES styling
- [ ] Collapse/expand works via collapser click
- [ ] New comment highlighting (visit a thread, wait for new comments, revisit)
- [ ] User tags: click tag icon, type tag, press Enter -- tag persists across page loads
- [ ] User upvote scores display and update on vote
- [ ] Upvote/downvote/unvote via HNES buttons (AJAX, no page reload)
- [ ] "More" pagination loads additional comments
- [ ] Reply count shows in parentheses

**Navigation:**
- [ ] Top bar links (top, new, best, submit) render and highlight active
- [ ] "More" dropdown toggles with correct links
- [ ] User dropdown toggles (profile, comments, submitted, upvoted, favorites, logout)
- [ ] HNES settings dropdown toggles
- [ ] GitHub stars toggle in HNES settings works
- [ ] Custom top colors display

**User profile (/user):**
- [ ] Own profile: karma milestones, default hints, formatting help toggle
- [ ] Other user profile: submitted link, about section linkified
- [ ] Profile update redirects correctly

**Login (/login):**
- [ ] Login form renders with HNES styling
- [ ] Error messages display ("Bad login.")
- [ ] Create account form renders
- [ ] Password recovery link present

**HACKERSMACKER compatibility:**
- [ ] Install both extensions simultaneously
- [ ] On comment pages: friend/foe orbs appear next to comment authors
- [ ] Clicking orbs saves friend/foe relationship
- [ ] On post list: orbs appear next to submitter names
- [ ] HACKERSMACKER's welcome/verify banner appears for new users

**Other:**
- [ ] hckrnews.com: unread comment counts display
- [ ] Expired link redirect works (visit expired link, get redirected with alert)
- [ ] Mourning mode (if testable): black header detected and styled

## jQuery-to-Vanilla Conversion Patterns

Common conversions that will be used throughout:

| jQuery | Vanilla |
|--------|---------|
| `$(selector)` | `document.querySelectorAll(selector)` or `document.querySelector(selector)` |
| `$(el).find(sel)` | `el.querySelectorAll(sel)` or `el.querySelector(sel)` |
| `$(el).addClass('x')` | `el.classList.add('x')` |
| `$(el).removeClass('x')` | `el.classList.remove('x')` |
| `$(el).toggleClass('x')` | `el.classList.toggle('x')` |
| `$(el).hasClass('x')` | `el.classList.contains('x')` |
| `$(el).attr('k', 'v')` | `el.setAttribute('k', 'v')` |
| `$(el).text('t')` | `el.textContent = 't'` |
| `$(el).val()` | `el.value` |
| `$(el).css('k', 'v')` | `el.style.k = 'v'` |
| `$(el).show()` / `.hide()` | `el.style.display = ''` / `el.style.display = 'none'` |
| `$(el).toggle()` | Toggle `display` style or use `hidden` attribute |
| `$(el).append(child)` | `el.append(child)` |
| `$(el).prepend(child)` | `el.prepend(child)` |
| `$(el).after(sibling)` | `el.after(sibling)` |
| `$(el).before(sibling)` | `el.before(sibling)` |
| `$(el).remove()` | `el.remove()` |
| `$(el).empty()` | `el.replaceChildren()` |
| `$(el).parent()` | `el.parentElement` |
| `$(el).next()` / `.prev()` | `el.nextElementSibling` / `el.previousElementSibling` |
| `$(el).closest(sel)` | `el.closest(sel)` |
| `$(el).siblings()` | `[...el.parentElement.children].filter(c => c !== el)` |
| `$('<tag/>')` | `document.createElement('tag')` |
| `$(el).click(fn)` | `el.addEventListener('click', fn)` |
| `$(el).on('event', sel, fn)` | Event delegation: listener on parent, check `e.target.matches(sel)` |
| `$(document).ready(fn)` | `document.addEventListener('DOMContentLoaded', fn)` or run at `document_end` |
| `$.ajax({url, ...})` | `fetch(url, {...})` |
| `$.post(url, data)` | `fetch(url, { method: 'POST', body: new URLSearchParams(data) })` |
| `$(el).load(url + ' sel', fn)` | `fetch(url).then(r => r.text()).then(html => { parse and extract })` |
| `$(el).animate({scrollTop: y}, ms)` | `window.scrollTo({ top: y, behavior: 'smooth' })` |
| `$(el).wrap(wrapper)` | Manual: `wrapper.append(el); original_parent.append(wrapper)` |
| `$.each(arr, fn)` | `arr.forEach(fn)` |
| `$(el).contents()` | `el.childNodes` |
