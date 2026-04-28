const PLUGIN_NAME = "picgo-plugin-squeeze";
const LEGACY_PLUGIN_NAMES = ["picgo-plugin-compression"];
const HOOK_NAME = "squeeze";
const DEFAULT_CUSTOM_PIPELINE = "ext=* => mode=local";

const DEFAULT_CONFIG = {
    compression_mode: "local",
    accept_lossy: true,
    jpeg_quality: "0",
    online_concurrency: "1",
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

const MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
};

const LOCAL_QUALITY_DEFAULT = 85;
const LOCAL_QUALITY_MIN = 5;
const LOCAL_QUALITY_MAX = 100;
const ONLINE_CONCURRENCY_MIN = 1;
const ONLINE_CONCURRENCY_MAX = 5;
const ONLINE_MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SHARP_LIMIT_INPUT_PIXELS = 268402689;
const VALID_COMPRESSION_MODES = new Set(["off", "local", "online", "custom"]);
const TOGGLEABLE_COMPRESSION_MODES = new Set(["local", "online", "custom"]);
const VALID_RULE_MODES = new Set(["local", "online", "skip"]);

module.exports = {
    DEFAULT_CUSTOM_PIPELINE,
    DEFAULT_CONFIG,
    HOOK_NAME,
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
    TOGGLEABLE_COMPRESSION_MODES,
    VALID_COMPRESSION_MODES,
    VALID_RULE_MODES,
};
