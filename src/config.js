const {
    DEFAULT_CONFIG,
    LEGACY_PLUGIN_NAMES,
    LOCAL_QUALITY_MAX,
    LOCAL_QUALITY_MIN,
    ONLINE_CONCURRENCY_MAX,
    ONLINE_CONCURRENCY_MIN,
    PLUGIN_NAME,
    TOGGLEABLE_COMPRESSION_MODES,
    VALID_COMPRESSION_MODES,
} = require("./constants");

const omitConfigKeys = (config, keys) => {
    const keySet = new Set(keys);

    return Object.keys(config || {}).reduce((result, configKey) => {
        if (!keySet.has(configKey)) {
            result[configKey] = config[configKey];
        }

        return result;
    }, {});
};

const getPluginConfig = (ctx) => {
    const userConfig = ctx.getConfig(PLUGIN_NAME);
    if (userConfig) {
        return userConfig;
    }

    const legacyPluginName = LEGACY_PLUGIN_NAMES.find((pluginName) =>
        ctx.getConfig(pluginName),
    );
    if (!legacyPluginName) {
        return null;
    }

    const legacyConfig = ctx.getConfig(legacyPluginName);
    const allConfig = ctx.getConfig() || {};
    ctx.saveConfig({
        ...omitConfigKeys(allConfig, LEGACY_PLUGIN_NAMES),
        [PLUGIN_NAME]: legacyConfig,
    });
    ctx.log.info(`Migrated config from ${legacyPluginName} to ${PLUGIN_NAME}`);

    return legacyConfig;
};

const saveNormalizedConfig = (ctx, config) => {
    ctx.saveConfig({
        [PLUGIN_NAME]: config,
    });
};

const getUserConfig = (ctx) => {
    const userConfig = getPluginConfig(ctx) || {};
    const compressionMode = VALID_COMPRESSION_MODES.has(
        userConfig.compression_mode,
    )
        ? userConfig.compression_mode
        : DEFAULT_CONFIG.compression_mode;
    const acceptLossy =
        typeof userConfig.accept_lossy === "boolean"
            ? userConfig.accept_lossy
            : DEFAULT_CONFIG.accept_lossy;
    const shortcutToggleNotify =
        typeof userConfig.shortcut_toggle_notify === "boolean"
            ? userConfig.shortcut_toggle_notify
            : DEFAULT_CONFIG.shortcut_toggle_notify;

    let jpegQuality = Number.parseInt(userConfig.jpeg_quality, 10);
    if (Number.isNaN(jpegQuality)) {
        jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10);
    }

    let onlineConcurrency = Number.parseInt(userConfig.online_concurrency, 10);
    if (Number.isNaN(onlineConcurrency)) {
        onlineConcurrency = Number.parseInt(
            DEFAULT_CONFIG.online_concurrency,
            10,
        );
    }

    if (
        jpegQuality !== 0 &&
        (jpegQuality < LOCAL_QUALITY_MIN || jpegQuality > LOCAL_QUALITY_MAX)
    ) {
        jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10);
        saveNormalizedConfig(ctx, {
            ...userConfig,
            compression_mode: compressionMode,
            accept_lossy: acceptLossy,
            jpeg_quality: DEFAULT_CONFIG.jpeg_quality,
            online_concurrency: String(onlineConcurrency),
        });
    }

    if (
        onlineConcurrency < ONLINE_CONCURRENCY_MIN ||
        onlineConcurrency > ONLINE_CONCURRENCY_MAX
    ) {
        onlineConcurrency = Number.parseInt(
            DEFAULT_CONFIG.online_concurrency,
            10,
        );
        saveNormalizedConfig(ctx, {
            ...userConfig,
            compression_mode: compressionMode,
            accept_lossy: acceptLossy,
            jpeg_quality: String(jpegQuality),
            online_concurrency: DEFAULT_CONFIG.online_concurrency,
        });
    }

    return {
        compressionMode,
        acceptLossy,
        jpegQuality,
        onlineConcurrency,
        shortcutToggleNotify,
        customPipeline:
            userConfig.custom_pipeline || DEFAULT_CONFIG.custom_pipeline,
    };
};

const updateCompressionMode = (ctx, compressionMode) => {
    const userConfig = getPluginConfig(ctx) || {};
    ctx.saveConfig({
        [PLUGIN_NAME]: {
            ...DEFAULT_CONFIG,
            ...userConfig,
            compression_mode: compressionMode,
        },
    });
};

const toggleCompressionMode = (ctx) => {
    const userConfig = getPluginConfig(ctx) || {};
    const currentMode = VALID_COMPRESSION_MODES.has(userConfig.compression_mode)
        ? userConfig.compression_mode
        : DEFAULT_CONFIG.compression_mode;

    if (currentMode === "off") {
        const previousMode = TOGGLEABLE_COMPRESSION_MODES.has(
            userConfig.previous_compression_mode,
        )
            ? userConfig.previous_compression_mode
            : DEFAULT_CONFIG.compression_mode;

        updateCompressionMode(ctx, previousMode);
        return previousMode;
    }

    ctx.saveConfig({
        [PLUGIN_NAME]: {
            ...DEFAULT_CONFIG,
            ...userConfig,
            compression_mode: "off",
            previous_compression_mode: currentMode,
        },
    });

    return "off";
};

const pluginConfig = (ctx) => {
    const userConfig = getPluginConfig(ctx) || DEFAULT_CONFIG;

    return [
        {
            name: "compression_mode",
            type: "list",
            alias: "压缩方式",
            choices: ["off", "local", "online", "custom"],
            default:
                userConfig.compression_mode || DEFAULT_CONFIG.compression_mode,
            message: "请选择压缩方式（off 为关闭压缩）",
            required: true,
        },
        {
            name: "jpeg_quality",
            type: "input",
            alias: "图片质量",
            default: userConfig.jpeg_quality || DEFAULT_CONFIG.jpeg_quality,
            message: "0 或 5~100（数字越大图像质量越高）",
            required: true,
        },
        {
            name: "accept_lossy",
            type: "list",
            alias: "允许 png 质量下降",
            choices: [true, false],
            default:
                typeof userConfig.accept_lossy === "boolean"
                    ? userConfig.accept_lossy
                    : DEFAULT_CONFIG.accept_lossy,
            message: "开启后将以轻微质量下降获取更大压缩比",
            required: true,
        },
        {
            name: "online_concurrency",
            type: "input",
            alias: "在线压缩并发数",
            default:
                userConfig.online_concurrency ||
                DEFAULT_CONFIG.online_concurrency,
            message: "1~5（数字越大多图在线压缩越快但接口压力越高）",
            required: true,
        },
        {
            name: "shortcut_toggle_notify",
            type: "list",
            alias: "快捷键切换时提醒",
            choices: [true, false],
            default:
                typeof userConfig.shortcut_toggle_notify === "boolean"
                    ? userConfig.shortcut_toggle_notify
                    : DEFAULT_CONFIG.shortcut_toggle_notify,
            message: "控制快捷键切换压缩模式时是否弹出提醒",
            required: true,
        },
        {
            name: "custom_pipeline",
            type: "input",
            alias: "自定义压缩流程",
            default:
                userConfig.custom_pipeline || DEFAULT_CONFIG.custom_pipeline,
            message: "多条规则用英文分号分隔",
            required: false,
        },
    ];
};

module.exports = {
    getPluginConfig,
    getUserConfig,
    pluginConfig,
    toggleCompressionMode,
    updateCompressionMode,
};
