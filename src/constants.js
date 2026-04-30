const PLUGIN_NAME = "picgo-plugin-squeeze";
const LEGACY_PLUGIN_NAMES = ["picgo-plugin-compression"];
const HOOK_NAME = "squeeze";
const DEFAULT_CUSTOM_PIPELINE = "ext=* => mode=local";

const DEFAULT_CONFIG = {
    compression_mode: "local",
    accept_lossy: true,
    jpeg_quality: "0",
    online_concurrency: "1",
    tinypng_api_keys: "",
    convert_to: "off",
    tinypng_cache_reset_time: true,
    tinypng_key_reset_schedule: {},
    custom_pipeline: DEFAULT_CUSTOM_PIPELINE,
    shortcut_toggle_notify: true,
};

const LOCAL_COMPRESSIBLE_EXTENSIONS = new Set([
    ".avif",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".png",
]);

const ONLINE_COMPRESSIBLE_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".gif",
    ".png",
]);

const TINYPNG_COMPRESSIBLE_EXTENSIONS = new Set([
    ".avif",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
]);

const MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".jxl": "image/jxl",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
};

const EXTENSION_BY_MIME = {
    "image/avif": ".avif",
    "image/jpeg": ".jpg",
    "image/jxl": ".jxl",
    "image/png": ".png",
    "image/webp": ".webp",
};

const LOCAL_QUALITY_DEFAULT = 85;
const LOCAL_QUALITY_MIN = 5;
const LOCAL_QUALITY_MAX = 100;
const ONLINE_CONCURRENCY_MIN = 1;
const ONLINE_CONCURRENCY_MAX = 5;
const ONLINE_MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SHARP_LIMIT_INPUT_PIXELS = 268402689;
const LEGACY_COMPRESSION_MODE_ALIASES = {
    online: "secaibi",
};

const VALID_COMPRESSION_MODES = new Set([
    "off",
    "local",
    "secaibi",
    "tinypng",
    "custom",
]);
const TOGGLEABLE_COMPRESSION_MODES = new Set([
    "local",
    "secaibi",
    "tinypng",
    "custom",
]);
const VALID_RULE_MODES = new Set(["off", "local", "secaibi", "tinypng"]);
const VALID_TINYPNG_CONVERT_TO = new Set([
    "off",
    "avif",
    "jxl",
    "webp",
    "jpeg",
    "png",
]);
const VALID_GLOBAL_CONVERT_TO = new Set([
    "off",
    "avif",
    "jpeg",
    "jxl",
    "png",
    "webp",
]);

module.exports = {
    DEFAULT_CUSTOM_PIPELINE,
    DEFAULT_CONFIG,
    EXTENSION_BY_MIME,
    HOOK_NAME,
    LEGACY_COMPRESSION_MODE_ALIASES,
    LEGACY_PLUGIN_NAMES,
    LOCAL_COMPRESSIBLE_EXTENSIONS,
    LOCAL_QUALITY_DEFAULT,
    LOCAL_QUALITY_MAX,
    LOCAL_QUALITY_MIN,
    MIME_BY_EXTENSION,
    ONLINE_COMPRESSIBLE_EXTENSIONS,
    ONLINE_CONCURRENCY_MAX,
    ONLINE_CONCURRENCY_MIN,
    ONLINE_MAX_IMAGE_SIZE,
    PLUGIN_NAME,
    SHARP_LIMIT_INPUT_PIXELS,
    TINYPNG_COMPRESSIBLE_EXTENSIONS,
    TOGGLEABLE_COMPRESSION_MODES,
    VALID_COMPRESSION_MODES,
    VALID_GLOBAL_CONVERT_TO,
    VALID_RULE_MODES,
    VALID_TINYPNG_CONVERT_TO,
};
