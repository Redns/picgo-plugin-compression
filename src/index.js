const {
    DEFAULT_CUSTOM_PIPELINE,
    DEFAULT_CONFIG,
    HOOK_NAME,
    ONLINE_COMPRESSIBLE_EXTENSIONS,
    PLUGIN_NAME,
} = require("./constants");
const {
    getPluginConfig,
    getUserConfig,
    pluginConfig,
    toggleCompressionMode,
} = require("./config");
const {
    parseCustomPipeline,
    parseCustomPipelineDetailed,
    resolveCustomOptions,
} = require("./customPipeline");
const { compressImageLocally } = require("./localCompress");
const { compressImageOnline } = require("./onlineCompress");
const { runWithConcurrency } = require("./utils");

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

const handleCustomMode = async (ctx, options) => {
    const customRules = getRuntimeCustomRules(ctx, options.customPipeline);
    const localTasks = [];
    const onlineTasks = [];

    for (const [index, img] of ctx.output.entries()) {
        const customOptions = resolveCustomOptions(img, options, customRules);

        if (customOptions.compressionMode === "local") {
            localTasks.push({ img, index, options: customOptions });
            continue;
        }

        if (customOptions.compressionMode === "online") {
            if (
                ONLINE_COMPRESSIBLE_EXTENSIONS.has(
                    String(img.extname || "").toLowerCase(),
                )
            ) {
                onlineTasks.push({ img, index, options: customOptions });
            }
        }
    }

    for (const task of localTasks) {
        await compressImageLocally(ctx, task.img, task.index, task.options);
    }

    await runWithConcurrency(onlineTasks, options.onlineConcurrency, (task) =>
        compressImageOnline(ctx, task.img, task.index, task.options),
    );

    return ctx;
};

const handle = async (ctx) => {
    const userConfig = getPluginConfig(ctx);
    if (!userConfig) {
        throw new Error("Please configure the plugin first");
    }

    const options = getUserConfig(ctx);

    if (options.compressionMode === "off") {
        ctx.log.info("squeeze compression mode is off, skipping compression");
        return ctx;
    }

    if (options.compressionMode === "custom") {
        return handleCustomMode(ctx, options);
    }

    if (options.compressionMode === "online") {
        const imgList = ctx.output.filter((img) =>
            ONLINE_COMPRESSIBLE_EXTENSIONS.has(
                String(img.extname || "").toLowerCase(),
            ),
        );
        await runWithConcurrency(
            imgList,
            options.onlineConcurrency,
            (img, index) => compressImageOnline(ctx, img, index, options),
        );
        return ctx;
    }

    for (const [index, img] of ctx.output.entries()) {
        await compressImageLocally(ctx, img, index, options);
    }

    return ctx;
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

const pluginCommands = (ctx) => [
    {
        label: "Toggle squeeze compression",
        key: "CommandOrControl+Shift+C",
        name: "toggle",
        async handle(commandCtx, guiApi) {
            const runtimeCtx = commandCtx || ctx;
            const compressionMode = toggleCompressionMode(runtimeCtx);
            const { shortcutToggleNotify } = getUserConfig(runtimeCtx);
            notifySuccess(
                runtimeCtx,
                guiApi,
                `squeeze compression mode switched to ${compressionMode}`,
                shortcutToggleNotify,
            );
        },
    },
];

module.exports = (ctx) => {
    const register = () => {
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
