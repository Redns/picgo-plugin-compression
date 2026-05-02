const { SHARP_LIMIT_INPUT_PIXELS } = require("./constants");
const {
    buildFilename,
    buildSuccessMessage,
    getImageBuffer,
    toBuffer,
    updateImageNameByExtension,
} = require("./utils");

let sharpPromise;

const getSharp = async () => {
    if (!sharpPromise) {
        sharpPromise = import("sharp")
            .then((sharpModule) => sharpModule.default || sharpModule)
            .catch((error) => {
                sharpPromise = null;
                throw error;
            });
    }

    return sharpPromise;
};

const formatCropOption = (crop) => {
    if (!crop) {
        return "off";
    }

    return `${crop.left}:${crop.top}:${crop.width}:${crop.height}`;
};

const formatResizeOption = (resize, resizeKernel) => {
    if (!resize) {
        return "off";
    }

    const width = resize.width || "auto";
    const height = resize.height || "auto";
    return `${width}:${height}:${resize.fit || "inside"}:${resizeKernel || "lanczos3"}`;
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

const createSharpPipeline = (sharp, imgSrc, extname) => {
    return sharp(imgSrc, {
        animated: extname === ".gif" || extname === ".webp",
    }).rotate();
};

const readMetadataWithoutPixelLimit = (sharp, imgSrc, extname) => {
    return sharp(imgSrc, {
        animated: extname === ".gif" || extname === ".webp",
        limitInputPixels: false,
    }).metadata();
};

const getSharpInputPixelCount = (metadata) => {
    if (!metadata || !metadata.width || !metadata.height) {
        return 0;
    }

    const frameHeight = metadata.pageHeight || metadata.height;
    return metadata.width * frameHeight;
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

const buildTransformEncodeOptions = (extname) => {
    if (extname === ".jpg" || extname === ".jpeg") {
        return {
            quality: 100,
            chromaSubsampling: "4:4:4",
            progressive: true,
        };
    }

    if (extname === ".png") {
        return {
            compressionLevel: 9,
            adaptiveFiltering: true,
            palette: false,
        };
    }

    if (extname === ".webp") {
        return {
            quality: 100,
            alphaQuality: 100,
            effort: 6,
            lossless: true,
        };
    }

    if (extname === ".avif") {
        return {
            quality: 100,
            effort: 4,
            chromaSubsampling: "4:4:4",
        };
    }

    if (extname === ".gif") {
        return {
            effort: 10,
            colours: 256,
            reuse: true,
            dither: 0,
        };
    }

    return undefined;
};

const applySharpOutputFormat = (pipeline, extname, encodeOptions) => {
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

const applySharpCropResizeOptions = (pipeline, options) => {
    const nextPipeline = pipeline;

    if (options.crop) {
        nextPipeline.extract(options.crop);
    }

    if (options.resize) {
        nextPipeline.resize({
            width: options.resize.width || null,
            height: options.resize.height || null,
            fit: options.resize.fit || "inside",
            withoutEnlargement: Boolean(options.resize.withoutEnlargement),
            kernel: options.resizeKernel || "lanczos3",
        });
    }

    return nextPipeline;
};

const updateImageMetaAfterSharp = (img, info) => {
    if (!info) {
        return;
    }

    if (info.width) {
        img.width = info.width;
    }

    if (info.pageHeight || info.height) {
        img.height = info.pageHeight || info.height;
    }

    img.__squeezeDimensions = {
        width: info.width || img.width || 0,
        height: info.pageHeight || info.height || img.height || 0,
    };
};

const canSharpConvertOutput = async (img, convertTo) => {
    const extname = String(img.extname || "").toLowerCase();
    const outputExtname = resolveOutputExtension(extname, convertTo);

    if (!outputExtname || outputExtname === extname) {
        return true;
    }

    try {
        const sharp = await getSharp();
        return (
            isSharpBufferFormatSupported(sharp, extname, "input") &&
            isSharpBufferFormatSupported(sharp, outputExtname, "output")
        );
    } catch (_) {
        return false;
    }
};

const applySharpCropResize = async (ctx, img, index, options) => {
    if (!options || (!options.crop && !options.resize)) {
        return { status: "skipped" };
    }

    const extname = String(img.extname || "").toLowerCase();
    const imageLabel = img.fileName || buildFilename(img, index);
    const imgSrc = getImageBuffer(img);
    if (!imgSrc) {
        return { status: "skipped" };
    }

    try {
        const sharp = await getSharp();
        if (
            !isSharpBufferFormatSupported(sharp, extname, "input") ||
            !isSharpBufferFormatSupported(sharp, extname, "output")
        ) {
            ctx.log.info(
                `Image ${imageLabel} cannot be cropped or resized by the current sharp build, continuing without crop or resize`,
            );
            return { status: "skipped" };
        }

        const metadata = await readMetadataWithoutPixelLimit(
            sharp,
            imgSrc,
            extname,
        );
        const inputPixels = getSharpInputPixelCount(metadata);
        if (inputPixels > SHARP_LIMIT_INPUT_PIXELS) {
            ctx.log.info(
                `Image ${imageLabel} exceeds sharp's input limit for crop or resize, continuing without crop or resize`,
            );
            return { status: "skipped" };
        }

        if (options.crop && !isCropInsideImage(options.crop, metadata)) {
            ctx.log.warn(
                `Image ${imageLabel} crop area is outside the image bounds, continuing without crop or resize`,
            );
            return { status: "skipped" };
        }

        ctx.log.info(
            `Image ${imageLabel} applying sharp crop/resize before compression (crop=${formatCropOption(
                options.crop,
            )}, resize=${formatResizeOption(
                options.resize,
                options.resizeKernel,
            )})`,
        );

        const pipeline = applySharpCropResizeOptions(
            createSharpPipeline(sharp, imgSrc, extname),
            options,
        );
        const transformed = applySharpOutputFormat(
            pipeline,
            extname,
            buildTransformEncodeOptions(extname),
        );
        const result = await transformed.toBuffer({ resolveWithObject: true });
        if (!result || !result.data || !result.data.length) {
            return { status: "skipped" };
        }

        img.buffer = toBuffer(result.data);
        updateImageMetaAfterSharp(img, result.info);
        ctx.log.info(
            `Image ${imageLabel} sharp crop/resize succeeded (${formatCropOption(
                options.crop,
            )}, ${formatResizeOption(options.resize, options.resizeKernel)})`,
        );
        return { status: "success" };
    } catch (error) {
        ctx.log.warn(
            `Image ${imageLabel} crop or resize failed, continuing without crop or resize: ${error.message}`,
        );
        return { status: "skipped" };
    }
};

const convertImageWithSharp = async (ctx, img, index, convertTo) => {
    const extname = String(img.extname || "").toLowerCase();
    const outputExtname = resolveOutputExtension(extname, convertTo);
    const imageLabel = img.fileName || buildFilename(img, index);
    const imgSrc = getImageBuffer(img);

    if (!imgSrc || !outputExtname || outputExtname === extname) {
        return { status: "skipped" };
    }

    try {
        const sharp = await getSharp();
        if (
            !isSharpBufferFormatSupported(sharp, extname, "input") ||
            !isSharpBufferFormatSupported(sharp, outputExtname, "output")
        ) {
            ctx.log.warn(
                `Image ${imageLabel} target format ${outputExtname} is not supported by the current sharp build`,
            );
            return { status: "error" };
        }

        const pipeline = createSharpPipeline(sharp, imgSrc, extname);
        const result = await applySharpOutputFormat(
            pipeline,
            outputExtname,
            undefined,
        ).toBuffer({ resolveWithObject: true });
        if (!result || !result.data || !result.data.length) {
            return { status: "error" };
        }

        img.buffer = toBuffer(result.data);
        updateImageNameByExtension(img, outputExtname);
        updateImageMetaAfterSharp(img, result.info);
        ctx.log.info(
            buildSuccessMessage(
                imageLabel,
                "sharp format conversion",
                imgSrc.length,
                img.buffer.length,
            ),
        );
        return { status: "success" };
    } catch (error) {
        ctx.log.error(
            `Sharp format conversion failed for image ${imageLabel}: ${error.message}`,
        );
        return { status: "error" };
    }
};

module.exports = {
    applySharpCropResize,
    canSharpConvertOutput,
    convertImageWithSharp,
    createSharpPipeline,
    formatCropOption,
    formatResizeOption,
    getSharp,
    getSharpFormatName,
    getSharpInputPixelCount,
    isSharpBufferFormatSupported,
    normalizeOutputExtension,
    readMetadataWithoutPixelLimit,
    resolveOutputExtension,
    applySharpOutputFormat,
};
