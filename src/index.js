const PLUGIN_NAME = "picgo-plugin-squeeze";
const LEGACY_PLUGIN_NAMES = [
    "picgo-plugin-compression",
];
const HOOK_NAME = "squeeze";
const DEFAULT_CONFIG = {
    compression_mode: "local",
    accept_lossy: true,
    jpeg_quality: "0",
};
const LOCAL_COMPRESSIBLE_EXTENSIONS = new Set([
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
const SECAIBI_ORIGIN = "https://www.secaibi.com";
const SECAIBI_REFERER = `${SECAIBI_ORIGIN}/designtools/media/pages/resizer.html`;
const MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
};
const LOCAL_QUALITY_DEFAULT = 85;
const LOCAL_QUALITY_MIN = 5;
const LOCAL_QUALITY_MAX = 100;

let localSharpPromise;

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
    ctx.log.info(`已迁移 ${legacyPluginName} 配置到 ${PLUGIN_NAME}`);

    return legacyConfig;
};

const getUserConfig = (ctx) => {
    const userConfig = getPluginConfig(ctx) || {};
    const compressionMode =
        userConfig.compression_mode === "online" ? "online" : "local";
    const acceptLossy =
        typeof userConfig.accept_lossy === "boolean"
            ? userConfig.accept_lossy
            : DEFAULT_CONFIG.accept_lossy;

    let jpegQuality = Number.parseInt(userConfig.jpeg_quality, 10);
    if (Number.isNaN(jpegQuality)) {
        jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10);
    }

    if (
        jpegQuality !== 0 &&
        (jpegQuality < LOCAL_QUALITY_MIN || jpegQuality > LOCAL_QUALITY_MAX)
    ) {
        jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10);
        ctx.saveConfig({
            [PLUGIN_NAME]: {
                compression_mode: compressionMode,
                accept_lossy: acceptLossy,
                jpeg_quality: DEFAULT_CONFIG.jpeg_quality,
            },
        });
    }

    return {
        compressionMode,
        acceptLossy,
        jpegQuality,
    };
};

const pluginConfig = (ctx) => {
    const userConfig = getPluginConfig(ctx) || DEFAULT_CONFIG;

    return [
        {
            name: "compression_mode",
            type: "list",
            alias: "压缩方式",
            choices: ["local", "online"],
            default: userConfig.compression_mode || DEFAULT_CONFIG.compression_mode,
            message: "请选择压缩方式",
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
            required: false,
        },
    ];
};

const uploadRequestConstruct = (filename, imgSrc) => {
    return {
        method: "post",
        url: `${SECAIBI_ORIGIN}/designtools/api/image.html`,
        params: {
            tag: "resizer",
            restful_override_method: "PUT",
            qqfile: filename,
        },
        headers: {
            Origin: SECAIBI_ORIGIN,
            "Content-Type": "application/octet-stream",
        },
        data: imgSrc,
    };
};

const compressRequestConstruct = (id, filename, acceptLossy, jpegQuality) => {
    const requestBody = new URLSearchParams({
        action: "compress",
        srcid: id,
        srcname: filename,
        param_limit_width: "origin",
        param_accept_lossy: String(acceptLossy),
        param_jpeg_quality: String(jpegQuality),
    }).toString();

    return {
        method: "post",
        url: `${SECAIBI_ORIGIN}/designtools/api/resizer-action`,
        headers: {
            Origin: SECAIBI_ORIGIN,
            Referer: SECAIBI_REFERER,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data: requestBody,
    };
};

const compressResultRequestConstruct = (dstid, filename) => {
    return {
        method: "get",
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        url: `${SECAIBI_ORIGIN}/designtools/api/image/${dstid}.bin`,
        params: {
            filename,
        },
        headers: {
            Referer: SECAIBI_REFERER,
        },
        responseType: "arraybuffer",
    };
};

const getImageBuffer = (img) => {
    if (img.buffer) {
        return img.buffer;
    }

    if (img.base64Image) {
        return Buffer.from(img.base64Image, "base64");
    }

    return null;
};

const buildFilename = (img, index) => {
    return `${Date.now()}-${index}${img.extname}`;
};

const toBuffer = (payload) => {
    if (Buffer.isBuffer(payload)) {
        return payload;
    }

    if (payload instanceof ArrayBuffer) {
        return Buffer.from(payload);
    }

    if (ArrayBuffer.isView(payload)) {
        return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    }

    return Buffer.from(payload);
};

const buildRequestErrorMessage = (error) => {
    if (!error) {
        return "未知错误";
    }

    const responseData = error.response && error.response.data;
    if (typeof responseData === "string" && responseData) {
        return `${error.message} - ${responseData}`;
    }

    if (responseData && typeof responseData === "object") {
        try {
            return `${error.message} - ${JSON.stringify(responseData)}`;
        } catch (_) {
            return error.message;
        }
    }

    return error.message;
};

const getMimeFromExtension = (extname) => {
    return MIME_BY_EXTENSION[extname];
};

const getEffectiveQuality = (jpegQuality) => {
    if (jpegQuality === 0) {
        return LOCAL_QUALITY_DEFAULT;
    }

    return jpegQuality;
};

const mapPngQualityToColours = (jpegQuality) => {
    if (jpegQuality === 0) {
        return 256;
    }

    const quality = getEffectiveQuality(jpegQuality);

    if (quality >= 85) {
        return 256;
    }

    if (quality >= 75) {
        return 192;
    }

    if (quality >= 60) {
        return 128;
    }

    if (quality >= 40) {
        return 96;
    }

    if (quality >= 20) {
        return 64;
    }

    return 32;
};

const getLocalSharp = async () => {
    if (!localSharpPromise) {
        localSharpPromise = import("sharp")
            .then((sharpModule) => sharpModule.default || sharpModule)
            .catch((error) => {
                localSharpPromise = null;
                throw error;
            });
    }

    return localSharpPromise;
};

const buildLocalEncodeOptions = (extname, jpegQuality, acceptLossy) => {
    const quality = getEffectiveQuality(jpegQuality);

    if (extname === ".jpg" || extname === ".jpeg") {
        return {
            quality,
            mozjpeg: true,
            progressive: true,
            chromaSubsampling: quality >= 90 ? "4:4:4" : "4:2:0",
        };
    }

    if (extname === ".png") {
        return {
            palette: acceptLossy,
            colours: acceptLossy ? mapPngQualityToColours(jpegQuality) : 256,
            compressionLevel: 9,
            effort: 10,
            adaptiveFiltering: true,
        };
    }

    if (extname === ".webp") {
        return {
            quality,
            alphaQuality: quality,
            effort: 6,
            smartSubsample: true,
        };
    }

    if (extname === ".gif") {
        return {
            effort: 10,
            colours: mapPngQualityToColours(jpegQuality),
            dither: 1,
            reuse: true,
        };
    }

    return undefined;
};

const applyLocalCompression = (sharp, pipeline, extname, encodeOptions) => {
    if (extname === ".jpg" || extname === ".jpeg") {
        return pipeline.jpeg(encodeOptions);
    }

    if (extname === ".png") {
        return pipeline.png(encodeOptions);
    }

    if (extname === ".webp") {
        return pipeline.webp(encodeOptions);
    }

    if (extname === ".gif") {
        return pipeline.gif(encodeOptions);
    }

    return pipeline.toFormat(sharp.format[extname.slice(1)], encodeOptions);
};

const compressImageLocally = async (ctx, img, index, options) => {
    const extname = img.extname;
    const mime = getMimeFromExtension(extname);
    const imgSrc = getImageBuffer(img);
    const imageLabel = img.fileName || buildFilename(img, index);

    if (!imgSrc) {
        ctx.log.warn(`图片 ${imageLabel} 缺少可用数据，跳过压缩`);
        return;
    }

    if (!mime) {
        ctx.log.warn(`图片 ${imageLabel} 的格式 ${extname} 暂不支持本地压缩`);
        return;
    }

    try {
        const sharp = await getLocalSharp();
        const localEncodeOptions = buildLocalEncodeOptions(
            extname,
            options.jpegQuality,
            options.acceptLossy,
        );
        const pipeline = sharp(imgSrc, {
            animated: extname === ".gif" || extname === ".webp",
        }).rotate();
        const resultBuffer = await applyLocalCompression(
            sharp,
            pipeline,
            extname,
            localEncodeOptions,
        ).toBuffer();

        if (!resultBuffer || resultBuffer.length >= imgSrc.length) {
            ctx.log.info(`图片 ${imageLabel} 已压缩至极限`);
            return;
        }

        img.buffer = toBuffer(resultBuffer);
        ctx.log.info(
            `图片 ${imageLabel} 本地压缩成功（${imgSrc.length}B --> ${img.buffer.length}B）`,
        );
    } catch (error) {
        ctx.log.error(`图片 ${imageLabel} 本地压缩失败，${error.message}`);
    }
};

const compressImageOnline = async (ctx, img, index, options) => {
    const imgSrc = getImageBuffer(img);
    if (!imgSrc) {
        ctx.log.warn(`图片 ${img.fileName || index + 1} 缺少可用数据，跳过压缩`);
        return;
    }

    const filename = buildFilename(img, index);
    img.filename = filename;

    try {
        const uploadResponse = await ctx.request(
            uploadRequestConstruct(filename, imgSrc),
        );
        const compressResponse = await ctx.request(
            compressRequestConstruct(
                uploadResponse.id,
                filename,
                options.acceptLossy,
                options.jpegQuality,
            ),
        );

        if (
            !compressResponse.success ||
            compressResponse.srcsize <= compressResponse.dstsize
        ) {
            ctx.log.info(`图片 ${filename} 已压缩至极限`);
            return;
        }

        const compressResultResponse = await ctx.request(
            compressResultRequestConstruct(compressResponse.dstid, filename),
        );

        img.buffer = toBuffer(compressResultResponse);
        ctx.log.info(
            `图片 ${filename} 在线压缩成功（${compressResponse.srcsizeReadable} --> ${compressResponse.dstsizeReadable}, ↓${compressResponse.reducePercent}%）`,
        );
    } catch (error) {
        ctx.log.error(
            `图片 ${filename} 在线压缩失败，${buildRequestErrorMessage(error)}`,
        );
    }
};

const handle = async (ctx) => {
    const userConfig = getPluginConfig(ctx);
    if (!userConfig) {
        throw new Error("请配置相关信息!");
    }

    const options = getUserConfig(ctx);
    const compressibleExtensions =
        options.compressionMode === "local"
            ? LOCAL_COMPRESSIBLE_EXTENSIONS
            : ONLINE_COMPRESSIBLE_EXTENSIONS;
    const imgList = ctx.output.filter((img) =>
        compressibleExtensions.has(img.extname),
    );

    for (const [index, img] of imgList.entries()) {
        if (options.compressionMode === "local") {
            await compressImageLocally(ctx, img, index, options);
        } else {
            await compressImageOnline(ctx, img, index, options);
        }
    }

    return ctx;
};

module.exports = (ctx) => {
    const register = () => {
        ctx.log.success("squeeze 加载成功!");

        if (!getPluginConfig(ctx)) {
            ctx.saveConfig({
                [PLUGIN_NAME]: DEFAULT_CONFIG,
            });
        }

        ctx.helper.beforeUploadPlugins.register(HOOK_NAME, {
            handle,
            config: pluginConfig,
        });
    };

    return {
        register,
        config: pluginConfig,
        beforeUploadPlugins: HOOK_NAME,
    };
};
