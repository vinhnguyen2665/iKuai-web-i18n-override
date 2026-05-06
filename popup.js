const enabledEl = document.getElementById("enabled");
const langCodeEl = document.getElementById("langCode");
const saveBtn = document.getElementById("save");

async function loadConfig() {
    const data = await chrome.storage.local.get({
        enabled: true,
        langCode: "en-US"
    });

    enabledEl.checked = data.enabled;
    langCodeEl.value = data.langCode;
}

async function saveConfig() {
    await chrome.storage.local.set({
        enabled: enabledEl.checked,
        langCode: langCodeEl.value
    });

    await chrome.runtime.sendMessage({
        type: "UPDATE_RULES"
    });

    saveBtn.textContent = "Saved";
    setTimeout(() => {
        saveBtn.textContent = "Save";
    }, 1000);
}

saveBtn.addEventListener("click", saveConfig);

loadConfig();