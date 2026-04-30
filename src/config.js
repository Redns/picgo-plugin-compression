const {
    DEFAULT_CONFIG,
    LEGACY_COMPRESSION_MODE_ALIASES,
    LEGACY_PLUGIN_NAMES,
    LOCAL_QUALITY_MAX,
    LOCAL_QUALITY_MIN,
    ONLINE_CONCURRENCY_MAX,
    ONLINE_CONCURRENCY_MIN,
    PLUGIN_NAME,
    TOGGLEABLE_COMPRESSION_MODES,
    VALID_COMPRESSION_MODES,
    VALID_GLOBAL_CONVERT_TO,
} = require("./constants");
const { getTinyPngKeyId } = require("./utils");
const { registerI18n, translate } = require("./i18n");

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
        const normalizedConfig = normalizeStoredConfig(userConfig);
        if (JSON.stringify(normalizedConfig) !== JSON.stringify(userConfig)) {
            saveNormalizedConfig(ctx, normalizedConfig);
            ctx.log.info(`Normalized config for ${PLUGIN_NAME}`);
        }
        return normalizedConfig;
    }

    const legacyPluginName = LEGACY_PLUGIN_NAMES.find((pluginName) =>
        ctx.getConfig(pluginName),
    );
    if (!legacyPluginName) {
        return null;
    }

    const legacyConfig = normalizeStoredConfig(ctx.getConfig(legacyPluginName));
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

const normalizeTinyPngResetSchedule = (schedule, apiKeys, enabled) => {
    if (!enabled) {
        return {};
    }

    const validKeyIds = new Set((apiKeys || []).map(getTinyPngKeyId));
    const entries = Object.entries(schedule || {}).filter(
        ([keyId, resetAt]) => {
            if (!validKeyIds.has(keyId)) {
                return false;
            }

            const timestamp = Date.parse(resetAt);
            return Number.isFinite(timestamp);
        },
    );

    return entries.reduce((result, [keyId, resetAt]) => {
        result[keyId] = resetAt;
        return result;
    }, {});
};

const parseTinyPngApiKeys = (value) => {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const getDefaultUserConfig = () => {
    return {
        compressionMode: DEFAULT_CONFIG.compression_mode,
        acceptLossy: DEFAULT_CONFIG.accept_lossy,
        convertTo: DEFAULT_CONFIG.convert_to || "off",
        jpegQuality: Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10),
        onlineConcurrency: Number.parseInt(
            DEFAULT_CONFIG.online_concurrency,
            10,
        ),
        shortcutToggleNotify: DEFAULT_CONFIG.shortcut_toggle_notify,
        tinyPngApiKeys: parseTinyPngApiKeys(DEFAULT_CONFIG.tinypng_api_keys),
        tinyPngApiKeysRaw: DEFAULT_CONFIG.tinypng_api_keys,
        tinyPngCacheResetTime: DEFAULT_CONFIG.tinypng_cache_reset_time,
        tinyPngKeyResetSchedule: normalizeTinyPngResetSchedule(
            DEFAULT_CONFIG.tinypng_key_reset_schedule,
            parseTinyPngApiKeys(DEFAULT_CONFIG.tinypng_api_keys),
            DEFAULT_CONFIG.tinypng_cache_reset_time,
        ),
        customPipeline: DEFAULT_CONFIG.custom_pipeline,
    };
};

const normalizeConvertTo = (value) => {
    const normalizedValue = String(value || "")
        .trim()
        .toLowerCase();

    if (!normalizedValue) {
        return DEFAULT_CONFIG.convert_to;
    }

    if (normalizedValue === "jpg") {
        return "jpeg";
    }

    return VALID_GLOBAL_CONVERT_TO.has(normalizedValue)
        ? normalizedValue
        : DEFAULT_CONFIG.convert_to;
};

const normalizeCompressionMode = (value) => {
    const normalizedValue = String(value || "")
        .trim()
        .toLowerCase();
    return LEGACY_COMPRESSION_MODE_ALIASES[normalizedValue] || normalizedValue;
};

const migratePipelineModeNames = (pipelineText) => {
    return String(pipelineText || "").replace(
        /\bmode\s*([=!]=?)\s*online\b/gi,
        "mode$1secaibi",
    );
};

const normalizeStoredConfig = (config) => {
    const nextConfig = {
        ...(config || {}),
    };
    const tinyPngApiKeys = parseTinyPngApiKeys(nextConfig.tinypng_api_keys);

    nextConfig.compression_mode = VALID_COMPRESSION_MODES.has(
        normalizeCompressionMode(nextConfig.compression_mode),
    )
        ? normalizeCompressionMode(nextConfig.compression_mode)
        : DEFAULT_CONFIG.compression_mode;
    nextConfig.previous_compression_mode = normalizeCompressionMode(
        nextConfig.previous_compression_mode,
    );
    nextConfig.convert_to = normalizeConvertTo(nextConfig.convert_to);
    nextConfig.tinypng_cache_reset_time =
        typeof nextConfig.tinypng_cache_reset_time === "boolean"
            ? nextConfig.tinypng_cache_reset_time
            : DEFAULT_CONFIG.tinypng_cache_reset_time;
    nextConfig.tinypng_key_reset_schedule = normalizeTinyPngResetSchedule(
        nextConfig.tinypng_key_reset_schedule,
        tinyPngApiKeys,
        nextConfig.tinypng_cache_reset_time,
    );
    nextConfig.custom_pipeline = migratePipelineModeNames(
        nextConfig.custom_pipeline || DEFAULT_CONFIG.custom_pipeline,
    );

    return nextConfig;
};

const getUserConfig = (ctx) => {
    const defaultUserConfig = getDefaultUserConfig();
    const userConfig = getPluginConfig(ctx) || {};
    const compressionMode = VALID_COMPRESSION_MODES.has(
        normalizeCompressionMode(userConfig.compression_mode),
    )
        ? normalizeCompressionMode(userConfig.compression_mode)
        : defaultUserConfig.compressionMode;
    const acceptLossy =
        typeof userConfig.accept_lossy === "boolean"
            ? userConfig.accept_lossy
            : defaultUserConfig.acceptLossy;
    const shortcutToggleNotify =
        typeof userConfig.shortcut_toggle_notify === "boolean"
            ? userConfig.shortcut_toggle_notify
            : defaultUserConfig.shortcutToggleNotify;
    const tinyPngCacheResetTime =
        typeof userConfig.tinypng_cache_reset_time === "boolean"
            ? userConfig.tinypng_cache_reset_time
            : defaultUserConfig.tinyPngCacheResetTime;
    const tinyPngApiKeysRaw =
        typeof userConfig.tinypng_api_keys === "string"
            ? userConfig.tinypng_api_keys
            : defaultUserConfig.tinyPngApiKeysRaw;
    const convertTo = normalizeConvertTo(userConfig.convert_to);

    let jpegQuality = Number.parseInt(userConfig.jpeg_quality, 10);
    if (Number.isNaN(jpegQuality)) {
        jpegQuality = defaultUserConfig.jpegQuality;
    }

    let onlineConcurrency = Number.parseInt(userConfig.online_concurrency, 10);
    if (Number.isNaN(onlineConcurrency)) {
        onlineConcurrency = defaultUserConfig.onlineConcurrency;
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
        convertTo,
        jpegQuality,
        onlineConcurrency,
        shortcutToggleNotify,
        tinyPngApiKeys: parseTinyPngApiKeys(tinyPngApiKeysRaw),
        tinyPngApiKeysRaw,
        tinyPngCacheResetTime,
        tinyPngKeyResetSchedule: normalizeTinyPngResetSchedule(
            userConfig.tinypng_key_reset_schedule,
            parseTinyPngApiKeys(tinyPngApiKeysRaw),
            tinyPngCacheResetTime,
        ),
        customPipeline:
            userConfig.custom_pipeline || defaultUserConfig.customPipeline,
    };
};

const updateTinyPngKeyResetTime = (ctx, apiKey, resetAt) => {
    const userConfig = getPluginConfig(ctx) || DEFAULT_CONFIG;
    const keyId = getTinyPngKeyId(apiKey);
    const nextSchedule = {
        ...(userConfig.tinypng_key_reset_schedule || {}),
    };

    if (resetAt) {
        nextSchedule[keyId] = resetAt;
    } else {
        delete nextSchedule[keyId];
    }

    saveNormalizedConfig(ctx, {
        ...userConfig,
        tinypng_key_reset_schedule: nextSchedule,
    });
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
    registerI18n(ctx);
    const userConfig = getPluginConfig(ctx) || DEFAULT_CONFIG;

    return [
        {
            name: "compression_mode",
            type: "list",
            alias: translate(ctx, "SQUEEZE_CONFIG_MODE_ALIAS"),
            choices: ["off", "local", "secaibi", "tinypng", "custom"],
            default:
                userConfig.compression_mode || DEFAULT_CONFIG.compression_mode,
            message: translate(ctx, "SQUEEZE_CONFIG_MODE_MESSAGE"),
            required: true,
        },
        {
            name: "jpeg_quality",
            type: "input",
            alias: translate(ctx, "SQUEEZE_CONFIG_QUALITY_ALIAS"),
            default: userConfig.jpeg_quality || DEFAULT_CONFIG.jpeg_quality,
            message: translate(ctx, "SQUEEZE_CONFIG_QUALITY_MESSAGE"),
            required: true,
        },
        {
            name: "accept_lossy",
            type: "list",
            alias: translate(ctx, "SQUEEZE_CONFIG_PNG_LOSSY_ALIAS"),
            choices: [true, false],
            default:
                typeof userConfig.accept_lossy === "boolean"
                    ? userConfig.accept_lossy
                    : DEFAULT_CONFIG.accept_lossy,
            message: translate(ctx, "SQUEEZE_CONFIG_PNG_LOSSY_MESSAGE"),
            required: true,
        },
        {
            name: "convert_to",
            type: "list",
            alias: translate(ctx, "SQUEEZE_CONFIG_CONVERT_ALIAS"),
            choices: ["off", "avif", "webp", "jpeg", "png", "jxl"],
            default: userConfig.convert_to || DEFAULT_CONFIG.convert_to,
            message: translate(ctx, "SQUEEZE_CONFIG_CONVERT_MESSAGE"),
            required: true,
        },
        {
            name: "shortcut_toggle_notify",
            type: "list",
            alias: translate(ctx, "SQUEEZE_CONFIG_SHORTCUT_NOTIFY_ALIAS"),
            choices: [true, false],
            default:
                typeof userConfig.shortcut_toggle_notify === "boolean"
                    ? userConfig.shortcut_toggle_notify
                    : DEFAULT_CONFIG.shortcut_toggle_notify,
            message: translate(ctx, "SQUEEZE_CONFIG_SHORTCUT_NOTIFY_MESSAGE"),
            required: true,
        },
        {
            name: "tinypng_cache_reset_time",
            type: "list",
            alias: translate(ctx, "SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_ALIAS"),
            choices: [true, false],
            default:
                typeof userConfig.tinypng_cache_reset_time === "boolean"
                    ? userConfig.tinypng_cache_reset_time
                    : DEFAULT_CONFIG.tinypng_cache_reset_time,
            message: translate(
                ctx,
                "SQUEEZE_CONFIG_TINYPNG_CACHE_RESET_MESSAGE",
            ),
            required: true,
        },
        {
            name: "online_concurrency",
            type: "input",
            alias: translate(ctx, "SQUEEZE_CONFIG_CONCURRENCY_ALIAS"),
            default:
                userConfig.online_concurrency ||
                DEFAULT_CONFIG.online_concurrency,
            message: translate(ctx, "SQUEEZE_CONFIG_CONCURRENCY_MESSAGE"),
            required: false,
        },
        {
            name: "tinypng_api_keys",
            type: "input",
            alias: translate(ctx, "SQUEEZE_CONFIG_TINYPNG_KEYS_ALIAS"),
            default:
                userConfig.tinypng_api_keys || DEFAULT_CONFIG.tinypng_api_keys,
            message: translate(ctx, "SQUEEZE_CONFIG_TINYPNG_KEYS_MESSAGE"),
            required: false,
        },
        {
            name: "custom_pipeline",
            type: "input",
            alias: translate(ctx, "SQUEEZE_CONFIG_PIPELINE_ALIAS"),
            default:
                userConfig.custom_pipeline || DEFAULT_CONFIG.custom_pipeline,
            message: translate(ctx, "SQUEEZE_CONFIG_PIPELINE_MESSAGE"),
            required: false,
        },
    ];
};

module.exports = {
    getPluginConfig,
    getUserConfig,
    getUserConfigDefault: getDefaultUserConfig,
    pluginConfig,
    toggleCompressionMode,
    updateCompressionMode,
    updateTinyPngKeyResetTime,
};
