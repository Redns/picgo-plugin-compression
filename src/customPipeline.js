const {
    LOCAL_QUALITY_MAX,
    LOCAL_QUALITY_MIN,
    VALID_RULE_MODES,
} = require("./constants");
const { getImageBuffer, parseSizeValue } = require("./utils");

const VALID_CONDITION_KEYS = new Set([
    "ext",
    "mode",
    "png_lossy",
    "quality",
    "size",
]);
const VALID_ACTION_KEYS = new Set(["mode", "png_lossy", "quality"]);

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
        !VALID_RULE_MODES.has(token.value.toLowerCase())
    ) {
        return `invalid mode value: ${token.value}`;
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
            errors.push(`rule ${line.index} has invalid syntax: ${line.source}`);
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

const matchRuleCondition = (condition, img, options) => {
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

    if (condition.key === "mode") {
        return matchTextCondition(
            options.compressionMode,
            condition.operator,
            condition.value,
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
                const mode = action.value.toLowerCase();
                if (VALID_RULE_MODES.has(mode)) {
                    result.compressionMode = mode;
                }
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

            return result;
        },
        { ...baseOptions },
    );
};

const resolveCustomOptions = (img, options, customRules) => {
    const matchedRule = customRules.find((rule) =>
        rule.conditions.every((condition) =>
            matchRuleCondition(condition, img, options),
        ),
    );

    if (!matchedRule) {
        return {
            ...options,
            compressionMode: "local",
        };
    }

    return applyRuleActions(options, matchedRule.actions);
};

module.exports = {
    parseCustomPipeline,
    parseCustomPipelineDetailed,
    resolveCustomOptions,
};
