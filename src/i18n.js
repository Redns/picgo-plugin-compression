const LOCALES = {
    "zh-CN": {
        SQUEEZE_CONFIG_MODE_ALIAS: "压缩方式",
        SQUEEZE_CONFIG_MODE_MESSAGE: "请选择压缩方式（off 为关闭压缩）",
        SQUEEZE_CONFIG_QUALITY_ALIAS: "图片质量",
        SQUEEZE_CONFIG_QUALITY_MESSAGE: "0 或 5~100（数字越大图像质量越高）",
        SQUEEZE_CONFIG_PNG_LOSSY_ALIAS: "允许 png 质量下降",
        SQUEEZE_CONFIG_PNG_LOSSY_MESSAGE:
            "开启后将以轻微质量下降获取更大压缩比",
        SQUEEZE_CONFIG_CONCURRENCY_ALIAS: "在线压缩并发数",
        SQUEEZE_CONFIG_CONCURRENCY_MESSAGE:
            "1~5（数字越大多图在线压缩越快但接口压力越高）",
        SQUEEZE_CONFIG_TINYPNG_KEYS_ALIAS: "TinyPNG API Keys",
        SQUEEZE_CONFIG_TINYPNG_KEYS_MESSAGE: "多个 key 用英文逗号分隔",
        SQUEEZE_CONFIG_CONVERT_ALIAS: "图片格式自动转换",
        SQUEEZE_CONFIG_CONVERT_MESSAGE:
            "off/avif/webp/jpeg/png/jxl（任何 gif 输入都会忽略转换）",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_ALIAS: "快捷键切换时提醒",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_MESSAGE:
            "控制快捷键切换压缩模式时是否弹出提醒",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_ALIAS:
            "记录 TinyPNG API Key 刷新时间",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_MESSAGE:
            "开启后会在额度用尽时记录下个月可重试时间，以便后续上传直接跳过无额度的 key",
        SQUEEZE_CONFIG_PIPELINE_ALIAS: "自定义压缩流程",
        SQUEEZE_CONFIG_PIPELINE_MESSAGE: "多条规则用英文分号分隔",
        SQUEEZE_COMMAND_TOGGLE_LABEL: "切换 squeeze 压缩开关",
        SQUEEZE_NOTIFY_MODE_SWITCHED: "squeeze 压缩模式已切换为 ${mode}",
        SQUEEZE_MODE_OFF_LABEL: "off",
        SQUEEZE_MODE_LOCAL_LABEL: "local",
        SQUEEZE_MODE_SECAIBI_LABEL: "secaibi",
        SQUEEZE_MODE_TINYPNG_LABEL: "tinypng",
        SQUEEZE_MODE_CUSTOM_LABEL: "custom",
    },
    "zh-TW": {
        SQUEEZE_CONFIG_MODE_ALIAS: "壓縮方式",
        SQUEEZE_CONFIG_MODE_MESSAGE: "請選擇壓縮方式（off 為關閉壓縮）",
        SQUEEZE_CONFIG_QUALITY_ALIAS: "圖片品質",
        SQUEEZE_CONFIG_QUALITY_MESSAGE: "0 或 5~100（數字越大圖像品質越高）",
        SQUEEZE_CONFIG_PNG_LOSSY_ALIAS: "允許 png 品質下降",
        SQUEEZE_CONFIG_PNG_LOSSY_MESSAGE:
            "開啟後將以輕微品質下降取得更大壓縮比",
        SQUEEZE_CONFIG_CONCURRENCY_ALIAS: "線上壓縮並發數",
        SQUEEZE_CONFIG_CONCURRENCY_MESSAGE:
            "1~5（數字越大多圖線上壓縮越快但介面壓力越高）",
        SQUEEZE_CONFIG_TINYPNG_KEYS_ALIAS: "TinyPNG API Keys",
        SQUEEZE_CONFIG_TINYPNG_KEYS_MESSAGE: "多個 key 用英文逗號分隔",
        SQUEEZE_CONFIG_CONVERT_ALIAS: "圖片格式自動轉換",
        SQUEEZE_CONFIG_CONVERT_MESSAGE:
            "off/avif/webp/jpeg/png/jxl（任何 gif 輸入都會忽略轉換）",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_ALIAS: "快捷鍵切換時提醒",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_MESSAGE:
            "控制透過快捷鍵切換壓縮模式時是否彈出提醒",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_ALIAS:
            "記錄 TinyPNG API Key 更新時間",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_MESSAGE:
            "開啟後會在額度用盡時記錄下個月可重試時間，讓後續上傳直接跳過無額度的 key",
        SQUEEZE_CONFIG_PIPELINE_ALIAS: "自訂壓縮流程",
        SQUEEZE_CONFIG_PIPELINE_MESSAGE: "多條規則用英文分號分隔",
        SQUEEZE_COMMAND_TOGGLE_LABEL: "切換 squeeze 壓縮開關",
        SQUEEZE_NOTIFY_MODE_SWITCHED: "squeeze 壓縮模式已切換為 ${mode}",
        SQUEEZE_MODE_OFF_LABEL: "off",
        SQUEEZE_MODE_LOCAL_LABEL: "local",
        SQUEEZE_MODE_SECAIBI_LABEL: "secaibi",
        SQUEEZE_MODE_TINYPNG_LABEL: "tinypng",
        SQUEEZE_MODE_CUSTOM_LABEL: "custom",
    },
    en: {
        SQUEEZE_CONFIG_MODE_ALIAS: "Compression Mode",
        SQUEEZE_CONFIG_MODE_MESSAGE:
            "Choose a compression mode (off disables compression)",
        SQUEEZE_CONFIG_QUALITY_ALIAS: "Image Quality",
        SQUEEZE_CONFIG_QUALITY_MESSAGE:
            "0 or 5~100 (higher values keep better image quality)",
        SQUEEZE_CONFIG_PNG_LOSSY_ALIAS: "Allow PNG Quality Loss",
        SQUEEZE_CONFIG_PNG_LOSSY_MESSAGE:
            "Enable this to trade a small amount of quality for a higher compression ratio",
        SQUEEZE_CONFIG_CONCURRENCY_ALIAS: "Online Compression Concurrency",
        SQUEEZE_CONFIG_CONCURRENCY_MESSAGE:
            "1~5 (higher values are faster for batches but put more pressure on the API)",
        SQUEEZE_CONFIG_TINYPNG_KEYS_ALIAS: "TinyPNG API Keys",
        SQUEEZE_CONFIG_TINYPNG_KEYS_MESSAGE:
            "Separate multiple keys with English commas; the next key will be tried when the previous one is exhausted",
        SQUEEZE_CONFIG_CONVERT_ALIAS: "Auto Format Conversion",
        SQUEEZE_CONFIG_CONVERT_MESSAGE:
            "off/avif/webp/jpeg/png/jxl (conversion is ignored for any GIF input)",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_ALIAS: "Notify on Shortcut Toggle",
        SQUEEZE_CONFIG_SHORTCUT_NOTIFY_MESSAGE:
            "Control whether switching modes by shortcut shows a notification",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_ALIAS:
            "Remember TinyPNG Key Reset Time",
        SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_MESSAGE:
            "When enabled, the plugin records the next retry month after a key reaches its monthly limit and skips that key until then",
        SQUEEZE_CONFIG_PIPELINE_ALIAS: "Custom Compression Pipeline",
        SQUEEZE_CONFIG_PIPELINE_MESSAGE:
            "Separate multiple rules with English semicolons",
        SQUEEZE_COMMAND_TOGGLE_LABEL: "Toggle squeeze compression",
        SQUEEZE_NOTIFY_MODE_SWITCHED:
            "squeeze compression mode switched to ${mode}",
        SQUEEZE_MODE_OFF_LABEL: "off",
        SQUEEZE_MODE_LOCAL_LABEL: "local",
        SQUEEZE_MODE_SECAIBI_LABEL: "secaibi",
        SQUEEZE_MODE_TINYPNG_LABEL: "tinypng",
        SQUEEZE_MODE_CUSTOM_LABEL: "custom",
    },
};

const registerI18n = (ctx) => {
    if (!ctx.i18n || typeof ctx.i18n.addLocale !== "function") {
        return;
    }

    Object.entries(LOCALES).forEach(([language, locale]) => {
        ctx.i18n.addLocale(language, locale);
    });
};

const translate = (ctx, key, args) => {
    if (!ctx.i18n || typeof ctx.i18n.translate !== "function") {
        const fallback = LOCALES.en[key] || key;
        if (!args) {
            return fallback;
        }

        return Object.keys(args).reduce(
            (text, argKey) => text.replace(`\${${argKey}}`, args[argKey]),
            fallback,
        );
    }

    return ctx.i18n.translate(key, args);
};

const translateMode = (ctx, mode) => {
    const modeKeyMap = {
        off: "SQUEEZE_MODE_OFF_LABEL",
        local: "SQUEEZE_MODE_LOCAL_LABEL",
        secaibi: "SQUEEZE_MODE_SECAIBI_LABEL",
        tinypng: "SQUEEZE_MODE_TINYPNG_LABEL",
        custom: "SQUEEZE_MODE_CUSTOM_LABEL",
    };

    return translate(ctx, modeKeyMap[mode] || "SQUEEZE_MODE_LOCAL_LABEL");
};

module.exports = {
    registerI18n,
    translate,
    translateMode,
};
