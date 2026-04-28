const { ONLINE_MAX_IMAGE_SIZE } = require("./constants");
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
    if (!imgSrc) {
        ctx.log.warn(`Image ${imageLabel} has no available data, skipping compression`);
        return;
    }

    if (imgSrc.length > ONLINE_MAX_IMAGE_SIZE) {
        ctx.log.info(
            `Image ${imageLabel} exceeds the online compression size limit (${formatFileSize(
                imgSrc.length,
            )} > ${formatFileSize(ONLINE_MAX_IMAGE_SIZE)}), skipping compression`,
        );
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

        if (!compressResponse.success) {
            ctx.log.info(`Online compression failed for image ${filename}, keeping the original image`);
            return;
        }

        if (compressResponse.srcsize <= compressResponse.dstsize) {
            ctx.log.info(`Image ${filename} is already compressed to its limit`);
            return;
        }

        const compressResultResponse = await ctx.request(
            compressResultRequestConstruct(compressResponse.dstid, filename),
        );

        img.buffer = toBuffer(compressResultResponse);
        ctx.log.info(
            buildSuccessMessage(
                filename,
                "online",
                compressResponse.srcsize,
                compressResponse.dstsize,
            ),
        );
    } catch (error) {
        ctx.log.error(
            `Online compression failed for image ${filename}: ${buildRequestErrorMessage(error)}`,
        );
    }
};

module.exports = {
    compressImageOnline,
};
