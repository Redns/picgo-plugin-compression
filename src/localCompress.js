const {
    LOCAL_QUALITY_DEFAULT,
    SHARP_LIMIT_INPUT_PIXELS,
} = require("./constants");
const {
    buildFilename,
    buildSuccessMessage,
    getImageBuffer,
    toBuffer,
    updateImageNameByExtension,
} = require("./utils");

let localSharpPromise;

const getEffectiveQuality = (jpegQuality) => {
    if (jpegQuality === 0) {
        return LOCAL_QUALITY_DEFAULT;
    }

    if (typeof jpegQuality !== "number" || !Number.isFinite(jpegQuality)) {
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

const getGifCompressionOptions = (jpegQuality) => {
    if (jpegQuality === 0) {
        return {
            colours: 192,
            interFrameMaxError: 6,
            interPaletteMaxError: 16,
        };
    }

    const quality = getEffectiveQuality(jpegQuality);

    if (quality >= 85) {
        return {
            colours: 256,
            interFrameMaxError: 4,
            interPaletteMaxError: 8,
        };
    }

    if (quality >= 75) {
        return {
            colours: 192,
            interFrameMaxError: 6,
            interPaletteMaxError: 16,
        };
    }

    if (quality >= 60) {
        return {
            colours: 128,
            interFrameMaxError: 8,
            interPaletteMaxError: 32,
        };
    }

    if (quality >= 40) {
        return {
            colours: 96,
            interFrameMaxError: 12,
            interPaletteMaxError: 64,
        };
    }

    if (quality >= 20) {
        return {
            colours: 64,
            interFrameMaxError: 16,
            interPaletteMaxError: 96,
        };
    }

    return {
        colours: 32,
        interFrameMaxError: 32,
        interPaletteMaxError: 160,
    };
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

const getSharpFormatName = (extname) => {
    const normalizedExtname = String(extname || "")
        .replace(/^\./, "")
        .toLowerCase();

    if (normalizedExtname === "jpg") {
        return "jpeg";
    }

    if (normalizedExtname === "avif") {
        return "heif";
    }

    return normalizedExtname;
};

const normalizeOutputExtension = (extname) => {
    const normalizedExtname = String(extname || "")
        .replace(/^\./, "")
        .toLowerCase();

    if (!normalizedExtname || normalizedExtname === "off") {
        return null;
    }

    if (normalizedExtname === "jpeg") {
        return ".jpg";
    }

    return `.${normalizedExtname}`;
};

const resolveOutputExtension = (inputExtname, convertTo) => {
    const normalizedInputExtname = String(inputExtname || "").toLowerCase();
    if (normalizedInputExtname === ".gif") {
        return normalizedInputExtname;
    }

    return normalizeOutputExtension(convertTo) || normalizedInputExtname;
};

const isSharpBufferFormatSupported = (sharp, extname, direction) => {
    const format = sharp.format[getSharpFormatName(extname)];

    return Boolean(format && format[direction] && format[direction].buffer);
};

const getSharpInputPixelCount = (metadata) => {
    if (!metadata || !metadata.width || !metadata.height) {
        return 0;
    }

    const frameHeight = metadata.pageHeight || metadata.height;
    return metadata.width * frameHeight;
};

const readMetadataWithoutPixelLimit = (sharp, imgSrc, extname) => {
    return sharp(imgSrc, {
        animated: extname === ".gif" || extname === ".webp",
        limitInputPixels: false,
    }).metadata();
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

    if (extname === ".avif") {
        return {
            quality,
            effort: 4,
            chromaSubsampling: quality >= 90 ? "4:4:4" : "4:2:0",
            compression: "av1",
        };
    }

    if (extname === ".gif") {
        const gifCompressionOptions = getGifCompressionOptions(jpegQuality);

        return {
            effort: 10,
            colours: gifCompressionOptions.colours,
            dither: 1,
            reuse: true,
            interFrameMaxError: gifCompressionOptions.interFrameMaxError,
            interPaletteMaxError: gifCompressionOptions.interPaletteMaxError,
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

    if (extname === ".avif") {
        return pipeline.heif(encodeOptions);
    }

    return pipeline.toFormat(getSharpFormatName(extname), encodeOptions);
};

const compressImageLocally = async (ctx, img, index, options) => {
    const safeOptions = {
        ...(options || {}),
        jpegQuality:
            typeof options?.jpegQuality === "number" && Number.isFinite(options.jpegQuality)
                ? options.jpegQuality
                : LOCAL_QUALITY_DEFAULT,
        acceptLossy: typeof options?.acceptLossy === "boolean"
            ? options.acceptLossy
            : true,
    };
    const extname = String(img.extname || "").toLowerCase();
    const outputExtname = resolveOutputExtension(extname, safeOptions.convertTo);
    const imgSrc = getImageBuffer(img);
    const imageLabel = img.fileName || buildFilename(img, index);

    if (!imgSrc) {
        ctx.log.warn(`Image ${imageLabel} has no available data, skipping compression`);
        return { status: "failed" };
    }

    try {
        const sharp = await getLocalSharp();
        if (!isSharpBufferFormatSupported(sharp, extname, "input")) {
            ctx.log.warn(
                `Image ${imageLabel} format ${extname} is not supported by the current sharp input capabilities, skipping local compression`,
            );
            return { status: "error" };
        }

        if (!isSharpBufferFormatSupported(sharp, outputExtname, "output")) {
            ctx.log.warn(
                `Image ${imageLabel} target format ${outputExtname} is not supported by the current sharp output capabilities, skipping local compression`,
            );
            return { status: "error" };
        }

        const metadata = await readMetadataWithoutPixelLimit(
            sharp,
            imgSrc,
            extname,
        );
        const inputPixels = getSharpInputPixelCount(metadata);
        if (inputPixels > SHARP_LIMIT_INPUT_PIXELS) {
            ctx.log.warn(
                `Image ${imageLabel} pixel count ${inputPixels} exceeds sharp's default input limit ${SHARP_LIMIT_INPUT_PIXELS}, skipping local compression`,
            );
            return { status: "error" };
        }

        const localEncodeOptions = buildLocalEncodeOptions(
            outputExtname,
            safeOptions.jpegQuality,
            safeOptions.acceptLossy,
        );
        const pipeline = sharp(imgSrc, {
            animated: extname === ".gif" || extname === ".webp",
        }).rotate();
        const resultBuffer = await applyLocalCompression(
            sharp,
            pipeline,
            outputExtname,
            localEncodeOptions,
        ).toBuffer();

        if (!resultBuffer) {
            ctx.log.info(`Image ${imageLabel} compression returned no result, keeping the original image`);
            return { status: "failed" };
        }

        if (resultBuffer.length >= imgSrc.length) {
            ctx.log.info(`Image ${imageLabel} is already compressed to its limit`);
            return { status: "larger" };
        }

        img.buffer = toBuffer(resultBuffer);
        updateImageNameByExtension(img, outputExtname);
        ctx.log.info(
            buildSuccessMessage(
                imageLabel,
                "local",
                imgSrc.length,
                img.buffer.length,
            ),
        );
        return { status: "success" };
    } catch (error) {
        ctx.log.error(`Local compression failed for image ${imageLabel}: ${error.message}`);
        return { status: "error" };
    }
};

module.exports = {
    compressImageLocally,
};
