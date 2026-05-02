const {
    LEGACY_COMPRESSION_MODE_ALIASES,
    LOCAL_QUALITY_MAX,
    LOCAL_QUALITY_MIN,
    VALID_RULE_MODES,
} = require("./constants");
const { getImageBuffer, parseSizeValue } = require("./utils");

let customPipelineSharpPromise;

const VALID_CONDITION_KEYS = new Set([
    "ext",
    "height",
    "mode",
    "png_lossy",
    "quality",
    "size",
    "width",
]);
const VALID_ACTION_KEYS = new Set([
    "crop",
    "convert",
    "kernel",
    "mode",
    "on_failed",
    "png_lossy",
    "quality",
    "resize",
]);

const VALID_CONVERT_ACTION_VALUES = new Set([
    "off",
    "avif",
    "jpeg",
    "jpg",
    "jxl",
    "png",
    "webp",
]);

const VALID_RESIZE_KERNEL_VALUES = new Set([
    "nearest",
    "linear",
    "cubic",
    "mitchell",
    "lanczos2",
    "lanczos3",
    "mks2013",
    "mks2021",
]);

const normalizeModeValue = (value) => {
    const normalizedValue = String(value).trim().toLowerCase();
    return LEGACY_COMPRESSION_MODE_ALIASES[normalizedValue] || normalizedValue;
};

const normalizeConvertValue = (value) => {
    const normalizedValue = String(value).trim().toLowerCase();
    if (normalizedValue === "jpg") {
        return "jpeg";
    }

    return normalizedValue;
};

const parseListValue = (value) => {
    return String(value)
        .split("|")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
};

const parseRuleToken = (token) => {
    const match = token.match(/^([a-z_]+)\s*(<=|>=|!=|=|<|>)\s*(.+)$/i);
    if (!match) {
        return null;
    }

    return {
        key: match[1].toLowerCase(),
        operator: match[2],
        value: match[3].trim(),
    };
};

const getCustomPipelineSharp = async () => {
    if (!customPipelineSharpPromise) {
        customPipelineSharpPromise = import("sharp")
            .then((sharpModule) => sharpModule.default || sharpModule)
            .catch((error) => {
                customPipelineSharpPromise = null;
                throw error;
            });
    }

    return customPipelineSharpPromise;
};

const parsePixelValue = (value) => {
    const pixels = Number.parseInt(String(value).trim(), 10);
    return Number.isNaN(pixels) ? Number.NaN : pixels;
};

const parseCropValue = (value) => {
    const normalizedValue = String(value).trim();
    const singleMatch = normalizedValue.match(/^(\d+)$/i);
    const fullMatch = normalizedValue.match(/^(\d+):(\d+):(\d+):(\d+)$/i);
    const shortMatch = normalizedValue.match(/^(\d+):(\d+)$/i);
    if (!singleMatch && !fullMatch && !shortMatch) {
        return null;
    }

    const left = fullMatch ? Number.parseInt(fullMatch[1], 10) : 0;
    const top = fullMatch ? Number.parseInt(fullMatch[2], 10) : 0;
    const width = Number.parseInt(
        fullMatch ? fullMatch[3] : singleMatch ? singleMatch[1] : shortMatch[1],
        10,
    );
    const height = Number.parseInt(
        fullMatch ? fullMatch[4] : singleMatch ? singleMatch[1] : shortMatch[2],
        10,
    );

    if (width <= 0 || height <= 0) {
        return null;
    }

    return {
        left,
        top,
        width,
        height,
    };
};

const VALID_RESIZE_FIT_VALUES = new Set([
    "cover",
    "contain",
    "fill",
    "inside",
    "outside",
]);

const parseResizeValue = (value) => {
    const match = String(value)
        .trim()
        .match(
            /^(\d+|auto):(\d+|auto)(?::(cover|contain|fill|inside|outside))?$/i,
        );
    if (!match) {
        return null;
    }

    const width =
        match[1].toLowerCase() === "auto"
            ? null
            : Number.parseInt(match[1], 10);
    const height =
        match[2].toLowerCase() === "auto"
            ? null
            : Number.parseInt(match[2], 10);
    const fit = match[3] ? match[3].toLowerCase() : "inside";

    if ((!width && !height) || !VALID_RESIZE_FIT_VALUES.has(fit)) {
        return null;
    }

    return {
        width,
        height,
        fit,
    };
};

const validateConditionToken = (token) => {
    if (!token) {
        return "invalid condition syntax";
    }

    if (!VALID_CONDITION_KEYS.has(token.key)) {
        return `unsupported condition: ${token.key}`;
    }

    if (
        ["ext", "mode", "png_lossy"].includes(token.key) &&
        !["=", "!="].includes(token.operator)
    ) {
        return `condition ${token.key} only supports = or !=`;
    }

    if (
        token.key === "png_lossy" &&
        !["true", "false"].includes(token.value.toLowerCase())
    ) {
        return `invalid png_lossy value: ${token.value}`;
    }

    if (token.key === "size" && Number.isNaN(parseSizeValue(token.value))) {
        return `invalid size value: ${token.value}`;
    }

    if (
        ["width", "height"].includes(token.key) &&
        Number.isNaN(parsePixelValue(token.value))
    ) {
        return `invalid ${token.key} value: ${token.value}`;
    }

    if (
        token.key === "quality" &&
        Number.isNaN(Number.parseInt(token.value, 10))
    ) {
        return `invalid quality value: ${token.value}`;
    }

    return null;
};

const validateActionToken = (token) => {
    if (!token) {
        return "invalid action syntax";
    }

    if (!VALID_ACTION_KEYS.has(token.key)) {
        return `unsupported action: ${token.key}`;
    }

    if (token.operator !== "=") {
        return `action ${token.key} only supports =`;
    }

    if (
        token.key === "mode" &&
        !VALID_RULE_MODES.has(normalizeModeValue(token.value))
    ) {
        return `invalid mode value: ${token.value}`;
    }

    if (token.key === "on_failed" && token.value.toLowerCase() !== "break") {
        return `invalid on_failed value: ${token.value}`;
    }

    if (
        token.key === "kernel" &&
        !VALID_RESIZE_KERNEL_VALUES.has(token.value.toLowerCase())
    ) {
        return `invalid kernel value: ${token.value}`;
    }

    if (token.key === "crop" && !parseCropValue(token.value)) {
        return `invalid crop value: ${token.value}`;
    }

    if (token.key === "resize" && !parseResizeValue(token.value)) {
        return `invalid resize value: ${token.value}`;
    }

    if (
        token.key === "convert" &&
        !VALID_CONVERT_ACTION_VALUES.has(token.value.toLowerCase())
    ) {
        return `invalid convert value: ${token.value}`;
    }

    if (token.key === "quality") {
        const quality = Number.parseInt(token.value, 10);
        if (
            quality !== 0 &&
            (Number.isNaN(quality) ||
                quality < LOCAL_QUALITY_MIN ||
                quality > LOCAL_QUALITY_MAX)
        ) {
            return `invalid quality value: ${token.value}`;
        }
    }

    if (
        token.key === "png_lossy" &&
        !["true", "false"].includes(token.value.toLowerCase())
    ) {
        return `invalid png_lossy value: ${token.value}`;
    }

    return null;
};

const splitRuleLines = (pipelineText) => {
    return String(pipelineText || "")
        .split(/\r?\n|;/)
        .map((line, index) => ({
            index: index + 1,
            source: line.trim(),
        }))
        .filter(({ source }) => source && !source.startsWith("#"));
};

const parseRuleTokens = (text) => {
    return text
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map(parseRuleToken);
};

const parseCustomPipelineDetailed = (pipelineText) => {
    const rules = [];
    const errors = [];

    for (const line of splitRuleLines(pipelineText)) {
        const parts = line.source.split(/\s*=>\s*/);
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            errors.push(
                `rule ${line.index} has invalid syntax: ${line.source}`,
            );
            continue;
        }

        const conditions = parseRuleTokens(parts[0]);
        const actions = parseRuleTokens(parts[1]);
        const conditionErrors = conditions
            .map(validateConditionToken)
            .filter(Boolean);
        const actionErrors = actions.map(validateActionToken).filter(Boolean);

        if (
            !conditions.length ||
            !actions.length ||
            conditionErrors.length ||
            actionErrors.length
        ) {
            errors.push(
                `rule ${line.index} is invalid: ${line.source} (${[
                    ...conditionErrors,
                    ...actionErrors,
                ].join("; ")})`,
            );
            continue;
        }

        rules.push({ conditions, actions, source: line.source });
    }

    return { errors, rules };
};

const parseCustomPipeline = (pipelineText) => {
    return parseCustomPipelineDetailed(pipelineText).rules;
};

const compareNumber = (actual, operator, expected) => {
    if (Number.isNaN(expected)) {
        return false;
    }

    if (operator === "=") {
        return actual === expected;
    }

    if (operator === "!=") {
        return actual !== expected;
    }

    if (operator === ">") {
        return actual > expected;
    }

    if (operator === ">=") {
        return actual >= expected;
    }

    if (operator === "<") {
        return actual < expected;
    }

    if (operator === "<=") {
        return actual <= expected;
    }

    return false;
};

const matchTextCondition = (actual, operator, value) => {
    const expectedValues = parseListValue(value);

    if (expectedValues.includes("*")) {
        return operator === "=";
    }

    const matched = expectedValues.includes(String(actual).toLowerCase());
    return operator === "!=" ? !matched : matched;
};

const getImageDimensions = async (img) => {
    if (img.__squeezeDimensions) {
        return img.__squeezeDimensions;
    }

    const width = Number.parseInt(img.width, 10);
    const height = Number.parseInt(img.height, 10);
    if (
        !Number.isNaN(width) &&
        !Number.isNaN(height) &&
        width > 0 &&
        height > 0
    ) {
        img.__squeezeDimensions = { width, height };
        return img.__squeezeDimensions;
    }

    const imgSrc = getImageBuffer(img);
    if (!imgSrc) {
        return null;
    }

    try {
        const sharp = await getCustomPipelineSharp();
        const extname = String(img.extname || "").toLowerCase();
        const metadata = await sharp(imgSrc, {
            animated: extname === ".gif" || extname === ".webp",
            limitInputPixels: false,
        }).metadata();

        img.__squeezeDimensions = {
            width: metadata.width || 0,
            height: metadata.pageHeight || metadata.height || 0,
        };
        return img.__squeezeDimensions;
    } catch (_) {
        return null;
    }
};

const matchRuleCondition = async (condition, img, options) => {
    const imgSrc = getImageBuffer(img);
    const extname = String(img.extname || "")
        .replace(/^\./, "")
        .toLowerCase();

    if (condition.key === "ext") {
        return matchTextCondition(extname, condition.operator, condition.value);
    }

    if (condition.key === "size") {
        return compareNumber(
            imgSrc ? imgSrc.length : 0,
            condition.operator,
            parseSizeValue(condition.value),
        );
    }

    if (condition.key === "width" || condition.key === "height") {
        const dimensions = await getImageDimensions(img);
        const actualValue = dimensions ? dimensions[condition.key] : 0;
        return compareNumber(
            actualValue,
            condition.operator,
            parsePixelValue(condition.value),
        );
    }

    if (condition.key === "mode") {
        return matchTextCondition(
            options.compressionMode,
            condition.operator,
            normalizeModeValue(condition.value),
        );
    }

    if (condition.key === "quality") {
        return compareNumber(
            options.jpegQuality,
            condition.operator,
            Number.parseInt(condition.value, 10),
        );
    }

    if (condition.key === "png_lossy") {
        return matchTextCondition(
            String(options.acceptLossy),
            condition.operator,
            condition.value,
        );
    }

    return false;
};

const parseBooleanAction = (value, defaultValue) => {
    const normalizedValue = String(value).trim().toLowerCase();

    if (normalizedValue === "true") {
        return true;
    }

    if (normalizedValue === "false") {
        return false;
    }

    return defaultValue;
};

const applyRuleActions = (baseOptions, actions) => {
    return actions.reduce(
        (result, action) => {
            if (action.operator !== "=") {
                return result;
            }

            if (action.key === "mode") {
                const mode = normalizeModeValue(action.value);
                if (VALID_RULE_MODES.has(mode)) {
                    result.compressionMode = mode;
                }
            }

            if (action.key === "convert") {
                result.convertTo = normalizeConvertValue(action.value);
            }

            if (action.key === "crop") {
                result.crop = parseCropValue(action.value);
            }

            if (action.key === "resize") {
                result.resize = parseResizeValue(action.value);
            }

            if (action.key === "kernel") {
                result.resizeKernel = action.value.toLowerCase();
            }

            if (action.key === "quality") {
                const quality = Number.parseInt(action.value, 10);
                if (
                    quality === 0 ||
                    (quality >= LOCAL_QUALITY_MIN &&
                        quality <= LOCAL_QUALITY_MAX)
                ) {
                    result.jpegQuality = quality;
                }
            }

            if (action.key === "png_lossy") {
                result.acceptLossy = parseBooleanAction(
                    action.value,
                    result.acceptLossy,
                );
            }

            if (action.key === "on_failed") {
                result.pipelineControl[action.key] = action.value.toLowerCase();
            }

            return result;
        },
        {
            ...baseOptions,
            pipelineControl: {
                on_failed: "continue",
            },
        },
    );
};

const findMatchingRule = async (img, options, customRules, startIndex = 0) => {
    let matchedRule = null;
    let matchedIndex = -1;

    for (let index = startIndex; index < customRules.length; index += 1) {
        const rule = customRules[index];
        let isMatched = true;
        for (const condition of rule.conditions) {
            if (!(await matchRuleCondition(condition, img, options))) {
                isMatched = false;
                break;
            }
        }

        if (isMatched) {
            matchedRule = rule;
            matchedIndex = index;
            break;
        }
    }

    if (!matchedRule) {
        return null;
    }

    return {
        index: matchedIndex,
        rule: matchedRule,
        options: applyRuleActions(options, matchedRule.actions),
    };
};

const resolveCustomOptions = async (img, options, customRules) => {
    const matchedRule = await findMatchingRule(img, options, customRules);
    if (!matchedRule) {
        return {
            ...options,
            compressionMode: "local",
            pipelineControl: {
                on_failed: "continue",
            },
        };
    }

    return matchedRule.options;
};

module.exports = {
    findMatchingRule,
    parseCustomPipeline,
    parseCustomPipelineDetailed,
    resolveCustomOptions,
};
