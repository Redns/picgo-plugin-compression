const { LOCAL_QUALITY_DEFAULT, ONLINE_MAX_IMAGE_SIZE } = require("./constants");
const {
    buildFilename,
    buildRequestErrorMessage,
    buildSuccessMessage,
    formatFileSize,
    getImageBuffer,
    toBuffer,
} = require("./utils");

const SECAIBI_ORIGIN = "https://www.secaibi.com";
const SECAIBI_REFERER = `${SECAIBI_ORIGIN}/designtools/media/pages/resizer.html`;

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

const compressImageOnline = async (ctx, img, index, options) => {
    const imgSrc = getImageBuffer(img);
    const imageLabel = img.fileName || index + 1;
    const safeOptions = {
        ...options,
        acceptLossy: typeof options.acceptLossy === "boolean"
            ? options.acceptLossy
            : true,
        jpegQuality:
            typeof options.jpegQuality === "number" && Number.isFinite(options.jpegQuality)
                ? options.jpegQuality
                : LOCAL_QUALITY_DEFAULT,
    };
    if (!imgSrc) {
        ctx.log.warn(`Image ${imageLabel} has no available data, skipping compression`);
        return { status: "failed" };
    }

    if (imgSrc.length > ONLINE_MAX_IMAGE_SIZE) {
        ctx.log.info(
            `Image ${imageLabel} exceeds the secaibi compression size limit (${formatFileSize(
                imgSrc.length,
            )} > ${formatFileSize(ONLINE_MAX_IMAGE_SIZE)}), skipping compression`,
        );
        return { status: "error" };
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
                safeOptions.acceptLossy,
                safeOptions.jpegQuality,
            ),
        );

        if (!compressResponse.success) {
            ctx.log.info(`Secaibi compression failed for image ${filename}, keeping the original image`);
            return { status: "failed" };
        }

        if (compressResponse.srcsize <= compressResponse.dstsize) {
            ctx.log.info(`Image ${filename} is already compressed to its limit`);
            return { status: "larger" };
        }

        const compressResultResponse = await ctx.request(
            compressResultRequestConstruct(compressResponse.dstid, filename),
        );

        img.buffer = toBuffer(compressResultResponse);
        ctx.log.info(
            buildSuccessMessage(
                filename,
                "secaibi",
                compressResponse.srcsize,
                compressResponse.dstsize,
            ),
        );
        return { status: "success" };
    } catch (error) {
        ctx.log.error(
            `Secaibi compression failed for image ${filename}: ${buildRequestErrorMessage(error)}`,
        );
        return { status: "error" };
    }
};

module.exports = {
    compressImageOnline,
};
