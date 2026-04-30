const {
    TINYPNG_COMPRESSIBLE_EXTENSIONS,
    VALID_TINYPNG_CONVERT_TO,
} = require("./constants");
const {
    buildFilename,
    buildRequestErrorMessage,
    buildSuccessMessage,
    getExtensionFromMime,
    getImageBuffer,
    getMimeFromExtension,
    getTinyPngKeyId,
    toBuffer,
    updateImageNameByExtension,
} = require("./utils");
const { updateTinyPngKeyResetTime } = require("./config");

const TINYPNG_API_BASE = "https://api.tinify.com";

const buildTinyPngAuthHeader = (apiKey) => {
    return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
};

const parseTinyPngError = async (response) => {
    let errorData = null;
    try {
        errorData = await response.json();
    } catch (_) {
        errorData = null;
    }

    const message =
        (errorData && (errorData.message || errorData.error)) ||
        response.statusText ||
        "Unknown TinyPNG error";
    const error = new Error(message);
    error.response = {
        data: errorData || message,
        status: response.status,
    };
    error.tinyPngError = errorData || null;
    throw error;
};

const shouldTryNextTinyPngKey = (error) => {
    const status = error && error.response && error.response.status;
    if (status === 401 || status === 429) {
        return true;
    }

    const data = error && error.response && error.response.data;
    const message = String(
        (data && (data.message || data.error)) || error.message || "",
    ).toLowerCase();

    return [
        "limit",
        "quota",
        "too many",
        "rate",
        "unauthorized",
        "credentials",
    ].some((keyword) => message.includes(keyword));
};

const isTinyPngMonthlyLimitError = (error) => {
    const status = error && error.response && error.response.status;
    const message = String(
        (error &&
            error.response &&
            error.response.data &&
            (error.response.data.message || error.response.data.error)) ||
            error.message ||
            "",
    ).toLowerCase();

    if (
        message.includes("rate limit") ||
        message.includes("too many requests") ||
        message.includes("consecutive requests")
    ) {
        return false;
    }

    return (
        status === 429 &&
        [
            "limit",
            "quota",
            "compression count",
            "next calendar month",
            "month",
        ].some((keyword) => message.includes(keyword))
    );
};

const getNextCalendarMonthStart = (now = new Date()) => {
    return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
        0,
    ).toISOString();
};

const shrinkWithTinyPng = async (apiKey, inputBuffer) => {
    const response = await fetch(`${TINYPNG_API_BASE}/shrink`, {
        method: "POST",
        headers: {
            Authorization: buildTinyPngAuthHeader(apiKey),
            "Content-Type": "application/octet-stream",
        },
        body: inputBuffer,
    });

    if (!response.ok) {
        await parseTinyPngError(response);
    }

    const result = await response.json();
    return {
        location: response.headers.get("location"),
        output: result.output || null,
    };
};

const convertWithTinyPng = async (apiKey, resourceLocation, convertTo) => {
    const targetMimeType = getMimeFromExtension(`.${convertTo}`);
    const requestBody = {
        convert: {
            type: [targetMimeType],
        },
    };

    if (convertTo === "jpeg") {
        requestBody.transform = {
            background: "#ffffff",
        };
    }

    const response = await fetch(resourceLocation, {
        method: "POST",
        headers: {
            Authorization: buildTinyPngAuthHeader(apiKey),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        await parseTinyPngError(response);
    }

    const result = await response.json();
    return {
        location: response.headers.get("location") || resourceLocation,
        output: result.output || null,
    };
};

const downloadTinyPngResult = async (apiKey, resourceLocation) => {
    const response = await fetch(resourceLocation, {
        method: "GET",
        headers: {
            Authorization: buildTinyPngAuthHeader(apiKey),
        },
    });

    if (!response.ok) {
        await parseTinyPngError(response);
    }

    return {
        buffer: toBuffer(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type"),
    };
};

const compressImageWithTinyPng = async (ctx, img, index, options) => {
    const extname = String(img.extname || "").toLowerCase();
    const imageLabel = img.fileName || buildFilename(img, index);
    const imgSrc = getImageBuffer(img);
    const safeOptions = {
        ...(options || {}),
        tinyPngApiKeys: Array.isArray(options?.tinyPngApiKeys)
            ? options.tinyPngApiKeys
            : [],
        convertTo: typeof options?.convertTo === "string"
            ? options.convertTo
            : "off",
        tinyPngCacheResetTime: Boolean(options?.tinyPngCacheResetTime),
        tinyPngKeyResetSchedule:
            options && typeof options.tinyPngKeyResetSchedule === "object"
                ? options.tinyPngKeyResetSchedule
                : {},
    };

    if (!imgSrc) {
        ctx.log.warn(
            `Image ${imageLabel} has no available data, skipping compression`,
        );
        return { status: "failed" };
    }

    if (!safeOptions.tinyPngApiKeys.length) {
        ctx.log.warn(
            `Image ${imageLabel} skipped TinyPNG compression because no TinyPNG API key is configured`,
        );
        return { status: "error" };
    }

    if (!TINYPNG_COMPRESSIBLE_EXTENSIONS.has(extname)) {
        ctx.log.warn(
            `Image ${imageLabel} format ${extname} is not supported by TinyPNG mode, skipping compression`,
        );
        return { status: "error" };
    }

    let lastError = null;

    for (const [apiKeyIndex, apiKey] of safeOptions.tinyPngApiKeys.entries()) {
        const keyId = getTinyPngKeyId(apiKey);
        const cachedResetAt = safeOptions.tinyPngCacheResetTime
            ? safeOptions.tinyPngKeyResetSchedule[keyId]
            : null;
        if (cachedResetAt && Date.parse(cachedResetAt) > Date.now()) {
            ctx.log.info(
                `TinyPNG key #${apiKeyIndex + 1} is temporarily skipped for image ${imageLabel} until ${cachedResetAt}`,
            );
            continue;
        }

        try {
            let shrinkResult = await shrinkWithTinyPng(apiKey, imgSrc);

            const convertTo = safeOptions.convertTo;

            if (
                convertTo !== "off" &&
                !VALID_TINYPNG_CONVERT_TO.has(convertTo)
            ) {
                ctx.log.warn(
                    `Image ${imageLabel} target format ${convertTo} is not supported by TinyPNG conversion, skipping compression`,
                );
                return { status: "error" };
            }

            if (convertTo !== "off") {
                shrinkResult = await convertWithTinyPng(
                    apiKey,
                    shrinkResult.location,
                    convertTo,
                );
            }

            const downloadResult = await downloadTinyPngResult(
                apiKey,
                shrinkResult.location,
            );

            if (!downloadResult.buffer || !downloadResult.buffer.length) {
                ctx.log.info(
                    `TinyPNG compression returned no result for image ${imageLabel}, keeping the original image`,
                );
                return { status: "failed" };
            }

            if (downloadResult.buffer.length >= imgSrc.length) {
                ctx.log.info(
                    `Image ${imageLabel} is already compressed to its limit`,
                );
                return { status: "larger" };
            }

            const outputExtension =
                convertTo !== "off"
                    ? `.${convertTo === "jpeg" ? "jpg" : convertTo}`
                    : getExtensionFromMime(downloadResult.mimeType);

            img.buffer = downloadResult.buffer;
            updateImageNameByExtension(img, outputExtension);
            if (safeOptions.tinyPngCacheResetTime && cachedResetAt) {
                updateTinyPngKeyResetTime(ctx, apiKey, null);
            }

            ctx.log.info(
                buildSuccessMessage(
                    imageLabel,
                    "tinypng",
                    imgSrc.length,
                    img.buffer.length,
                ),
            );
            return { status: "success" };
        } catch (error) {
            lastError = error;
            if (safeOptions.tinyPngCacheResetTime && isTinyPngMonthlyLimitError(error)) {
                const resetAt = getNextCalendarMonthStart();
                updateTinyPngKeyResetTime(ctx, apiKey, resetAt);
                safeOptions.tinyPngKeyResetSchedule[keyId] = resetAt;
                ctx.log.warn(
                    `TinyPNG key #${apiKeyIndex + 1} reached its monthly limit and will be skipped until ${resetAt}`,
                );
            }
            if (
                shouldTryNextTinyPngKey(error) &&
                apiKeyIndex < safeOptions.tinyPngApiKeys.length - 1
            ) {
                ctx.log.warn(
                    `TinyPNG key #${apiKeyIndex + 1} is unavailable for image ${imageLabel}, trying the next key`,
                );
                continue;
            }

            ctx.log.error(
                `TinyPNG compression failed for image ${imageLabel}: ${buildRequestErrorMessage(error)}`,
            );
            return { status: "error" };
        }
    }

    if (lastError) {
        ctx.log.error(
            `TinyPNG compression failed for image ${imageLabel}: ${buildRequestErrorMessage(lastError)}`,
        );
        return { status: "error" };
    }

    return { status: "failed" };
};

module.exports = {
    compressImageWithTinyPng,
};
