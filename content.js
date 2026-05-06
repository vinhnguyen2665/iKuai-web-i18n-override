(function () {
    const CONFIG_EVENT = "ikuai-force-language-config";

    function pushConfig(config) {
        window.dispatchEvent(
            new CustomEvent(CONFIG_EVENT, {
                detail: config
            })
        );
    }

    async function loadAndPushConfig() {
        const config = await chrome.storage.local.get({
            enabled: true,
            langCode: "en-US"
        });

        pushConfig(config);
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = async function () {
        this.remove();
        await loadAndPushConfig();
    };

    document.documentElement.appendChild(script);

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (!changes.enabled && !changes.langCode) return;

        loadAndPushConfig();
    });
})();
