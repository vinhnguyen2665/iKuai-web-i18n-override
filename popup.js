const enabledEl = document.getElementById("enabled");
const langCodeEl = document.getElementById("langCode");
const supportI18nOverrideEl = document.getElementById("supportI18nOverride");
const saveBtn = document.getElementById("save");

async function loadConfig() {
    const data = await chrome.storage.local.get({
        enabled: true,
        langCode: "en-US",
        supportI18nOverride: true
    });

    enabledEl.checked = data.enabled;
    langCodeEl.value = data.langCode;
    supportI18nOverrideEl.checked = data.supportI18nOverride;
}

async function reloadActiveTab() {
    try {
        await chrome.tabs.reload();
    } catch (err) {
        console.warn("[iKuai Force Language] Cannot reload active tab:", err);
    }
}

async function saveConfig() {
    await chrome.storage.local.set({
        enabled: enabledEl.checked,
        langCode: langCodeEl.value,
        supportI18nOverride: supportI18nOverrideEl.checked
    });

    await chrome.runtime.sendMessage({
        type: "UPDATE_RULES"
    });

    await reloadActiveTab();

    saveBtn.textContent = "Saved";
    setTimeout(() => {
        saveBtn.textContent = "Save";
    }, 1000);
}

saveBtn.addEventListener("click", saveConfig);

loadConfig();
