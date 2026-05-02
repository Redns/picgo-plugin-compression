const {
    LOCAL_QUALITY_DEFAULT,
    SHARP_LIMIT_INPUT_PIXELS,
} = require("./constants");
const {
    applySharpOutputFormat,
    createSharpPipeline,
    formatCropOption,
    formatResizeOption,
    getSharp,
    getSharpInputPixelCount,
    isSharpBufferFormatSupported,
    readMetadataWithoutPixelLimit,
    resolveOutputExtension,
} = require("./sharpTransform");
const {
    buildFilename,
    buildSuccessMessage,
    getImageBuffer,
    toBuffer,
    updateImageNameByExtension,
} = require("./utils");

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

const isCropInsideImage = (crop, metadata) => {
    if (!crop || !metadata || !metadata.width || !metadata.height) {
        return false;
    }

    return (
        crop.left >= 0 &&
        crop.top >= 0 &&
        crop.width > 0 &&
        crop.height > 0 &&
        crop.left + crop.width <= metadata.width &&
        crop.top + crop.height <= (metadata.pageHeight || metadata.height)
    );
};

const applyLocalSharpOperations = (pipeline, options) => {
    if (options.crop) {
        pipeline.extract(options.crop);
    }

    if (options.resize) {
        pipeline.resize({
            width: options.resize.width || null,
            height: options.resize.height || null,
            fit: options.resize.fit || "inside",
            withoutEnlargement: Boolean(options.resize.withoutEnlargement),
            kernel: options.resizeKernel || "lanczos3",
        });
    }

    return pipeline;
};

const compressImageLocally = async (ctx, img, index, options) => {
    const safeOptions = {
        ...(options || {}),
        jpegQuality:
            typeof options?.jpegQuality === "number" &&
            Number.isFinite(options.jpegQuality)
                ? options.jpegQuality
                : LOCAL_QUALITY_DEFAULT,
        acceptLossy:
            typeof options?.acceptLossy === "boolean"
                ? options.acceptLossy
                : true,
    };
    const extname = String(img.extname || "").toLowerCase();
    const outputExtname = resolveOutputExtension(
        extname,
        safeOptions.convertTo,
    );
    const imgSrc = getImageBuffer(img);
    const imageLabel = img.fileName || buildFilename(img, index);

    if (!imgSrc) {
        ctx.log.warn(
            `Image ${imageLabel} has no available data, skipping compression`,
        );
        return { status: "failed" };
    }

    try {
        const sharp = await getSharp();
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
        const shouldSkipTransforms =
            safeOptions.crop && !isCropInsideImage(safeOptions.crop, metadata);
        const transformOptions = shouldSkipTransforms
            ? {
                  ...safeOptions,
                  crop: null,
                  resize: null,
              }
            : safeOptions;

        if (shouldSkipTransforms) {
            ctx.log.warn(
                `Image ${imageLabel} crop area is outside the image bounds, continuing with compression only`,
            );
        }

        let resultBuffer;
        try {
            if (safeOptions.crop || safeOptions.resize) {
                ctx.log.info(
                    `Image ${imageLabel} applying local sharp pipeline (crop=${formatCropOption(
                        transformOptions.crop,
                    )}, resize=${formatResizeOption(
                        transformOptions.resize,
                        transformOptions.resizeKernel,
                    )})`,
                );
            }
            const pipeline = applyLocalSharpOperations(
                createSharpPipeline(sharp, imgSrc, extname),
                transformOptions,
            );
            resultBuffer = await applySharpOutputFormat(
                pipeline,
                outputExtname,
                localEncodeOptions,
            ).toBuffer();
        } catch (transformError) {
            if (!safeOptions.crop && !safeOptions.resize) {
                throw transformError;
            }

            ctx.log.warn(
                `Image ${imageLabel} crop or resize failed, continuing with compression only: ${transformError.message}`,
            );
            resultBuffer = await applySharpOutputFormat(
                createSharpPipeline(sharp, imgSrc, extname),
                outputExtname,
                localEncodeOptions,
            ).toBuffer();
        }

        if (!resultBuffer) {
            ctx.log.info(
                `Image ${imageLabel} compression returned no result, keeping the original image`,
            );
            return { status: "failed" };
        }

        if (resultBuffer.length >= imgSrc.length) {
            ctx.log.info(
                `Image ${imageLabel} is already compressed to its limit`,
            );
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
        ctx.log.error(
            `Local compression failed for image ${imageLabel}: ${error.message}`,
        );
        return { status: "error" };
    }
};

module.exports = {
    compressImageLocally,
};
