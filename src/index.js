const {
    DEFAULT_CUSTOM_PIPELINE,
    DEFAULT_CONFIG,
    HOOK_NAME,
    PLUGIN_NAME,
    ONLINE_COMPRESSIBLE_EXTENSIONS,
    TINYPNG_COMPRESSIBLE_EXTENSIONS,
} = require("./constants");
const {
    getPluginConfig,
    getUserConfig,
    getUserConfigDefault,
    pluginConfig,
    toggleCompressionMode,
} = require("./config");
const {
    findMatchingRule,
    parseCustomPipeline,
    parseCustomPipelineDetailed,
} = require("./customPipeline");
const { registerI18n, translate, translateMode } = require("./i18n");
const { compressImageLocally } = require("./localCompress");
const { compressImageOnline } = require("./onlineCompress");
const {
    applySharpCropResize,
    canSharpConvertOutput,
    convertImageWithSharp,
} = require("./sharpTransform");
const { compressImageWithTinyPng } = require("./tinypngCompress");
const { runWithConcurrency } = require("./utils");

const TOGGLE_COMMAND_LABEL = "TOGGLE_MODE";

const getRuntimeCustomRules = (ctx, pipelineText) => {
    const parsed = parseCustomPipelineDetailed(pipelineText);

    if (!parsed.errors.length && parsed.rules.length) {
        return parsed.rules;
    }

    parsed.errors.forEach((error) =>
        ctx.log.error(`Custom pipeline error: ${error}`),
    );
    if (!parsed.rules.length) {
        ctx.log.error("No valid rules were parsed from the custom pipeline");
    }
    ctx.log.warn(
        `Using the default custom pipeline for this run: ${DEFAULT_CUSTOM_PIPELINE}`,
    );

    return parseCustomPipeline(DEFAULT_CUSTOM_PIPELINE);
};

const validateCustomPipelineOnLoad = (ctx) => {
    const options = getUserConfig(ctx);
    if (options.compressionMode !== "custom") {
        return;
    }

    const parsed = parseCustomPipelineDetailed(options.customPipeline);
    if (!parsed.errors.length && parsed.rules.length) {
        return;
    }

    parsed.errors.forEach((error) =>
        ctx.log.error(`Custom pipeline configuration error: ${error}`),
    );
    if (!parsed.rules.length) {
        ctx.log.error(
            "No valid rules were parsed from the custom pipeline configuration",
        );
    }
    ctx.log.warn(
        `The local config will not be modified; the default rule will be used during upload: ${DEFAULT_CUSTOM_PIPELINE}`,
    );
};

const compressImageByMode = async (ctx, img, index, options) => {
    const mode = String(options.compressionMode || "").toLowerCase();
    if (mode === "off") {
        return { status: "skipped" };
    }

    if (mode !== "local") {
        await applySharpCropResize(ctx, img, index, options);
    }

    if (mode === "secaibi") {
        if (
            !ONLINE_COMPRESSIBLE_EXTENSIONS.has(
                String(img.extname || "").toLowerCase(),
            )
        ) {
            ctx.log.warn(
                `Image ${img.fileName || index + 1} format ${String(
                    img.extname || "",
                ).toLowerCase()} is not supported by secaibi mode, skipping compression`,
            );
            return { status: "error" };
        }

        const canUseSharpConvert =
            options.convertTo === "off" ||
            (await canSharpConvertOutput(img, options.convertTo));
        if (!canUseSharpConvert) {
            ctx.log.warn(
                `Image ${img.fileName || index + 1} target format ${options.convertTo} is not supported by the current sharp build after secaibi compression`,
            );
            return { status: "error" };
        }

        const result = await compressImageOnline(ctx, img, index, options);
        if (result.status !== "success" || options.convertTo === "off") {
            return result;
        }

        return convertImageWithSharp(ctx, img, index, options.convertTo);
    }

    if (mode === "tinypng") {
        if (
            !TINYPNG_COMPRESSIBLE_EXTENSIONS.has(
                String(img.extname || "").toLowerCase(),
            )
        ) {
            ctx.log.warn(
                `Image ${img.fileName || index + 1} format ${String(
                    img.extname || "",
                ).toLowerCase()} is not supported by TinyPNG mode, skipping compression`,
            );
            return { status: "error" };
        }

        return compressImageWithTinyPng(ctx, img, index, options);
    }

    return compressImageLocally(ctx, img, index, options);
};

const handleCustomImage = async (ctx, img, index, options, customRules) => {
    let nextRuleIndex = 0;
    let hasMatchedRule = false;

    while (nextRuleIndex < customRules.length) {
        const matchedRule = await findMatchingRule(
            img,
            options,
            customRules,
            nextRuleIndex,
        );

        if (!matchedRule) {
            break;
        }

        hasMatchedRule = true;
        const result = await compressImageByMode(
            ctx,
            img,
            index,
            matchedRule.options,
        );

        if (
            result.status === "success" ||
            result.status === "skipped" ||
            result.status === "break"
        ) {
            return;
        }

        const pipelineControl = matchedRule.options.pipelineControl || {};
        if (
            ["failed", "larger", "error"].includes(result.status) &&
            pipelineControl.on_failed !== "break"
        ) {
            nextRuleIndex = matchedRule.index + 1;
            continue;
        }

        return;
    }

    if (!hasMatchedRule) {
        await compressImageLocally(ctx, img, index, {
            ...options,
            compressionMode: "local",
        });
    }
};

const handleCustomMode = async (ctx, options) => {
    const customRules = getRuntimeCustomRules(ctx, options.customPipeline);

    await runWithConcurrency(
        ctx.output,
        options.onlineConcurrency,
        (img, index) =>
            handleCustomImage(ctx, img, index, options, customRules),
    );

    return ctx;
};

const handle = async (ctx) => {
    const userConfig = getPluginConfig(ctx);
    if (!userConfig) {
        throw new Error("Please configure the plugin first");
    }

    let options;
    try {
        options = getUserConfig(ctx);
    } catch (error) {
        ctx.log.error(
            `squeeze: failed to read config, using defaults: ${error.message}`,
        );
        options = getUserConfigDefault();
    }

    const mode = String(options.compressionMode || "").toLowerCase();

    if (mode === "off") {
        ctx.log.info("squeeze compression mode is off, skipping compression");
        return ctx;
    }

    if (!Array.isArray(ctx.output) || !ctx.output.length) {
        return ctx;
    }

    try {
        if (mode === "custom") {
            return await handleCustomMode(ctx, options);
        }

        if (mode === "secaibi") {
            const imgList = ctx.output.filter((img) =>
                ONLINE_COMPRESSIBLE_EXTENSIONS.has(
                    String(img.extname || "").toLowerCase(),
                ),
            );
            await runWithConcurrency(
                imgList,
                options.onlineConcurrency,
                (img, index) => compressImageByMode(ctx, img, index, options),
            );
            return ctx;
        }

        if (mode === "tinypng") {
            await runWithConcurrency(
                ctx.output,
                options.onlineConcurrency,
                (img, index) => compressImageByMode(ctx, img, index, options),
            );
            return ctx;
        }

        for (const [index, img] of ctx.output.entries()) {
            await compressImageLocally(ctx, img, index, options);
        }

        return ctx;
    } catch (error) {
        ctx.log.error(
            `squeeze: unexpected error during compression: ${error.message}`,
        );
        return ctx;
    }
};

const notifySuccess = (ctx, guiApi, message, shouldNotify = true) => {
    if (
        shouldNotify &&
        guiApi &&
        typeof guiApi.showNotification === "function"
    ) {
        guiApi.showNotification({
            title: "picgo-plugin-squeeze",
            body: message,
        });
    } else if (shouldNotify && ctx && typeof ctx.emit === "function") {
        ctx.emit("notification", {
            title: "picgo-plugin-squeeze",
            body: message,
        });
    }

    ctx.log.success(message);
};

const pluginCommands = (ctx) => {
    registerI18n(ctx);

    return [
        {
            label: TOGGLE_COMMAND_LABEL,
            key: "CommandOrControl+Shift+C",
            name: "toggle",
            async handle(commandCtx, guiApi) {
                const runtimeCtx = commandCtx || ctx;
                const compressionMode = toggleCompressionMode(runtimeCtx);
                const { shortcutToggleNotify } = getUserConfig(runtimeCtx);
                notifySuccess(
                    runtimeCtx,
                    guiApi,
                    translate(runtimeCtx, "SQUEEZE_NOTIFY_MODE_SWITCHED", {
                        mode: translateMode(runtimeCtx, compressionMode),
                    }),
                    shortcutToggleNotify,
                );
            },
        },
    ];
};

module.exports = (ctx) => {
    const register = () => {
        registerI18n(ctx);
        ctx.log.success("squeeze loaded successfully!");

        if (!getPluginConfig(ctx)) {
            ctx.saveConfig({
                [PLUGIN_NAME]: DEFAULT_CONFIG,
            });
        }
        validateCustomPipelineOnLoad(ctx);

        ctx.helper.beforeUploadPlugins.register(HOOK_NAME, {
            handle,
            config: pluginConfig,
        });
    };

    return {
        register,
        config: pluginConfig,
        commands: pluginCommands,
        beforeUploadPlugins: HOOK_NAME,
    };
};
