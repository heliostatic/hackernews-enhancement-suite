function expireOldEntries() {
  chrome.storage.local.get(null, items => {
    const now = Date.now();
    const keysToRemove = [];

    Object.keys(items).forEach(key => {
      const rawValue = items[key];
      let info = rawValue;

      if (typeof rawValue === 'string') {
        try {
          info = JSON.parse(rawValue);
        } catch (err) {
          info = null;
        }
      }

      if (info && typeof info === 'object' && typeof info.expire === 'number' && now > info.expire) {
        keysToRemove.push(key);
      }
    });

    if (keysToRemove.length) {
      chrome.storage.local.remove(keysToRemove);
    }
  });
}

function handleGetAllLocalStorage(sendResponse) {
  chrome.storage.local.get(null, items => {
    sendResponse({ data: items });
  });
}

function handleGetLocalStorage(key, sendResponse) {
  if (key === undefined || key === null) {
    sendResponse({ data: undefined });
    return;
  }

  const normalizedKey = String(key);

  chrome.storage.local.get([normalizedKey], items => {
    sendResponse({ data: items[normalizedKey] });
  });
}

function handleSetLocalStorage(key, value, sendResponse) {
  if (key === undefined || key === null) {
    sendResponse({});
    return;
  }

  const normalizedKey = String(key);
  const toStore = {};
  toStore[normalizedKey] = String(value);

  chrome.storage.local.set(toStore, () => {
    expireOldEntries();
    sendResponse({});
  });
}

function handleGetUserData(usernames, sendResponse) {
  const keys = Array.isArray(usernames) ? usernames : [];

  chrome.storage.local.get(keys, items => {
    const results = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      results[key] = items[key];
    }
    sendResponse({ data: results });
  });
}

// In-memory cache for GitHub stars (survives across page loads while service worker is alive)
const ghStarsCache = {};
const GH_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function handleFetchGithubStars(repos, sendResponse) {
  const results = {};
  const toFetch = [];
  const now = Date.now();

  for (const repo of repos) {
    const cached = ghStarsCache[repo];
    if (cached && now - cached.time < GH_CACHE_TTL) {
      results[repo] = cached.stars;
    } else {
      toFetch.push(repo);
    }
  }

  if (toFetch.length === 0) {
    sendResponse({ data: results });
    return;
  }

  Promise.all(toFetch.map(repo =>
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'HNES-Extension/1.6' }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && typeof data.stargazers_count === 'number') {
        const stars = data.stargazers_count;
        ghStarsCache[repo] = { stars, time: now };
        results[repo] = stars;
      }
    })
    .catch(() => {})
  )).then(() => sendResponse({ data: results }));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.method) {
    sendResponse({});
    return;
  }

  if (request.method === 'getAllLocalStorage') {
    handleGetAllLocalStorage(sendResponse);
    return true;
  }

  if (request.method === 'getLocalStorage') {
    handleGetLocalStorage(request.key, sendResponse);
    return true;
  }

  if (request.method === 'setLocalStorage') {
    handleSetLocalStorage(request.key, request.value, sendResponse);
    return true;
  }

  if (request.method === 'getUserData') {
    handleGetUserData(request.usernames, sendResponse);
    return true;
  }

  if (request.method === 'fetchGithubStars') {
    handleFetchGithubStars(request.repos, sendResponse);
    return true;
  }

  sendResponse({});
  return false;
});

expireOldEntries();
