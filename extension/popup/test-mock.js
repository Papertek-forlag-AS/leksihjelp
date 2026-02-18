window.chrome = {
    runtime: {
        getURL: (path) => {
            // We are running from /extension/popup/test.html
            // path argument is like 'data/es.json'
            // valid relative path from popup folder is '../data/es.json'
            return '../' + path;
        },
        sendMessage: (msg) => {
            console.log('Mock: chrome.runtime.sendMessage', msg);
            return Promise.resolve();
        }
    },
    storage: {
        local: {
            get: (keys, callback) => {
                let result = {};
                if (typeof keys === 'string') {
                    const val = localStorage.getItem('mock_' + keys);
                    if (val) result[keys] = JSON.parse(val);
                } else if (Array.isArray(keys)) {
                    keys.forEach(k => {
                        const val = localStorage.getItem('mock_' + k);
                        if (val) result[k] = JSON.parse(val);
                    });
                } else if (typeof keys === 'object' && keys !== null) {
                    for (const [k, v] of Object.entries(keys)) {
                        const val = localStorage.getItem('mock_' + k);
                        result[k] = val ? JSON.parse(val) : v;
                    }
                }

                if (callback) setTimeout(() => callback(result), 0);
                return result;
            },
            set: (items, callback) => {
                for (const [k, v] of Object.entries(items)) {
                    localStorage.setItem('mock_' + k, JSON.stringify(v));
                }
                console.log('Mock: Saved to storage', items);
                if (callback) setTimeout(callback, 0);
            }
        }
    },
    tabs: {
        query: (queryInfo, callback) => {
            if (callback) setTimeout(() => callback([{ id: 1, url: 'http://example.com' }]), 0);
        },
        sendMessage: (tabId, msg) => {
            console.log('Mock: chrome.tabs.sendMessage', tabId, msg);
            return Promise.resolve();
        }
    }
};
