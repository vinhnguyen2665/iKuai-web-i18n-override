(function () {
    const CONFIG_EVENT = "ikuai-force-language-config";
    const LANG_MAP = {
        "": "",
        "zh-CN": "1",
        "en-US": "2",
        "zh-TW": "3"
    };

    const state = {
        enabled: true,
        langCode: "en-US",
        supportI18nOverride: true
    };

    function getForcedLangHeader() {
        return LANG_MAP[state.langCode] || "";
    }

    function shouldOverrideLang() {
        return state.enabled && Boolean(getForcedLangHeader());
    }

    function upsertResponseHeader(headers, name, value) {
        const lowerName = name.toLowerCase();
        const lines = String(headers || "")
            .split(/\r?\n/)
            .filter((line) => {
                const separatorIndex = line.indexOf(":");

                if (separatorIndex === -1) return Boolean(line.trim());

                return line.slice(0, separatorIndex).trim().toLowerCase() !== lowerName;
            });

        lines.push(`${name}: ${value}`);

        return `${lines.join("\n")}\n`;
    }

    function applyConfig(config) {
        if (!config || typeof config !== "object") return;

        if (typeof config.enabled === "boolean") {
            state.enabled = config.enabled;
        }

        if (
            typeof config.langCode === "string" &&
            Object.prototype.hasOwnProperty.call(LANG_MAP, config.langCode)
        ) {
            state.langCode = config.langCode;
        }

        if (typeof config.supportI18nOverride === "boolean") {
            state.supportI18nOverride = config.supportI18nOverride;
        }

        console.log(
            "[iKuai Force Language] Config updated:",
            state.enabled ? state.langCode : "disabled"
        );
    }

    function patchHeadersObject(headers) {
        if (!headers || typeof headers !== "object") return headers;

        try {
            let originalLang = headers.xLang;
            let originalSupportI18n = headers.xSupportI18n;

            Object.defineProperty(headers, "xLang", {
                configurable: true,
                enumerable: true,
                get() {
                    return shouldOverrideLang() ? state.langCode : originalLang;
                },
                set(value) {
                    originalLang = value;
                }
            });

            Object.defineProperty(headers, "xSupportI18n", {
                configurable: true,
                enumerable: true,
                get() {
                    return state.enabled && state.supportI18nOverride
                        ? 1
                        : originalSupportI18n;
                },
                set(value) {
                    originalSupportI18n = value;
                }
            });
        } catch (err) {
            console.warn("[iKuai Force Language] Cannot patch window.headers:", err);
        }

        return headers;
    }

    window.addEventListener(CONFIG_EVENT, (event) => {
        applyConfig(event.detail);
    });

    try {
        if (window.headers && typeof window.headers === "object") {
            patchHeadersObject(window.headers);
        }

        let internalHeaders = window.headers;

        Object.defineProperty(window, "headers", {
            configurable: true,
            enumerable: true,
            get() {
                return internalHeaders;
            },
            set(value) {
                internalHeaders = patchHeadersObject(value);
            }
        });

        console.log("[iKuai Force Language] window.headers hook installed");
    } catch (err) {
        console.warn("[iKuai Force Language] Failed to hook window.headers:", err);
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalGetResponseHeader = XMLHttpRequest.prototype.getResponseHeader;
    const originalGetAllResponseHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        this.__ikuai_force_lang_url = String(url || "");
        return originalOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.getResponseHeader = function (name) {
        const key = String(name || "").toLowerCase();
        const isFirstJson = this.__ikuai_force_lang_url.includes("/static/js/first.json");

        if (shouldOverrideLang() && isFirstJson && key === "x-lang") {
            return getForcedLangHeader();
        }

        if (
            state.enabled &&
            state.supportI18nOverride &&
            isFirstJson &&
            key === "x-support-i18n"
        ) {
            return "1";
        }

        return originalGetResponseHeader.call(this, name);
    };

    XMLHttpRequest.prototype.getAllResponseHeaders = function () {
        const headers = originalGetAllResponseHeaders.call(this);
        const isFirstJson = this.__ikuai_force_lang_url.includes("/static/js/first.json");

        if (state.enabled && isFirstJson) {
            let forcedHeaders = headers;

            if (shouldOverrideLang()) {
                forcedHeaders = upsertResponseHeader(
                    forcedHeaders,
                    "x-lang",
                    getForcedLangHeader()
                );
            }

            if (state.supportI18nOverride) {
                forcedHeaders = upsertResponseHeader(
                    forcedHeaders,
                    "x-support-i18n",
                    "1"
                );
            }

            if (forcedHeaders !== headers) {
                return forcedHeaders;
            }
        }

        return headers;
    };

    if (window.fetch) {
        const originalFetch = window.fetch;

        window.fetch = async function (...args) {
            const response = await originalFetch.apply(this, args);
            const url = String(args[0]?.url || args[0] || "");

            if (!state.enabled || !url.includes("/static/js/first.json")) {
                return response;
            }

            const originalHeaders = response.headers;

            const patchedHeaders = new Proxy(originalHeaders, {
                get(target, prop) {
                    if (prop === "get") {
                        return function (name) {
                            const key = String(name || "").toLowerCase();

                            if (key === "x-lang" && shouldOverrideLang()) {
                                return getForcedLangHeader();
                            }
                            if (key === "x-support-i18n" && state.supportI18nOverride) {
                                return "1";
                            }

                            return target.get.call(target, name);
                        };
                    }

                    return Reflect.get(target, prop);
                }
            });

            return new Proxy(response, {
                get(target, prop) {
                    if (prop === "headers") return patchedHeaders;
                    return Reflect.get(target, prop);
                }
            });
        };
    }
})();
