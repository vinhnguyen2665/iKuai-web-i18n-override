const RULE_ID_FORCE_X_LANG = 1001;

const LANG_MAP = {
    "zh-CN": "1",
    "en-US": "2",
    "zh-TW": "3"
};

async function getConfig() {
    const data = await chrome.storage.local.get({
        enabled: true,
        langCode: "en-US"
    });

    return data;
}

async function updateRules() {
    const { enabled, langCode } = await getConfig();

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [RULE_ID_FORCE_X_LANG],
        addRules: enabled
            ? [
                {
                    id: RULE_ID_FORCE_X_LANG,
                    priority: 1,
                    action: {
                        type: "modifyHeaders",
                        responseHeaders: [
                            {
                                header: "x-lang",
                                operation: "set",
                                value: LANG_MAP[langCode] || "2"
                            },
                            {
                                header: "x-support-i18n",
                                operation: "set",
                                value: "1"
                            }
                        ]
                    },
                    condition: {
                        urlFilter: "/static/js/first.json",
                        resourceTypes: ["xmlhttprequest", "main_frame", "sub_frame"]
                    }
                }
            ]
            : []
    });
}

chrome.runtime.onInstalled.addListener(updateRules);
chrome.runtime.onStartup.addListener(updateRules);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.enabled || changes.langCode)) {
        updateRules();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UPDATE_RULES") {
        updateRules().then(() => {
            sendResponse({ ok: true });
        });

        return true;
    }
});