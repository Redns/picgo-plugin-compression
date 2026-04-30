const { EXTENSION_BY_MIME, MIME_BY_EXTENSION } = require("./constants");

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

const updateImageNameByExtension = (img, nextExtension) => {
    if (!nextExtension) {
        return;
    }

    const currentExtension = String(img.extname || "");
    if (currentExtension.toLowerCase() === nextExtension.toLowerCase()) {
        return;
    }

    img.extname = nextExtension;

    if (img.fileName) {
        img.fileName = img.fileName.replace(/\.[^.]+$/, nextExtension);
    }

    if (img.filename) {
        img.filename = img.filename.replace(/\.[^.]+$/, nextExtension);
    }
};

const toBuffer = (payload) => {
    if (Buffer.isBuffer(payload)) {
        return payload;
    }

    if (payload instanceof ArrayBuffer) {
        return Buffer.from(payload);
    }

    if (ArrayBuffer.isView(payload)) {
        return Buffer.from(
            payload.buffer,
            payload.byteOffset,
            payload.byteLength,
        );
    }

    return Buffer.from(payload);
};

const parseSizeValue = (value) => {
    const match = String(value)
        .trim()
        .match(/^(\d+(?:\.\d+)?)(b|kb|k|mb|m)?$/i);
    if (!match) {
        return Number.NaN;
    }

    const size = Number.parseFloat(match[1]);
    const unit = (match[2] || "b").toLowerCase();

    if (unit === "m" || unit === "mb") {
        return size * 1024 * 1024;
    }

    if (unit === "k" || unit === "kb") {
        return size * 1024;
    }

    return size;
};

const buildRequestErrorMessage = (error) => {
    if (!error) {
        return "unknown error";
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

const getExtensionFromMime = (mimeType) => {
    const normalizedMimeType = String(mimeType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
    return EXTENSION_BY_MIME[normalizedMimeType] || null;
};

const formatFileSize = (bytes) => {
    if (bytes < 1024) {
        return `${bytes}B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}K`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)}M`;
};

const formatSizeChangePercent = (sourceSize, targetSize) => {
    if (!sourceSize) {
        return "↓0%";
    }

    const percent = Math.round(
        (Math.abs(sourceSize - targetSize) / sourceSize) * 100,
    );

    return targetSize <= sourceSize ? `↓${percent}%` : `↑${percent}%`;
};

const buildSuccessMessage = (filename, modeName, sourceSize, targetSize) => {
    return `Image ${filename} ${modeName} compression succeeded (${formatFileSize(
        sourceSize,
    )} --> ${formatFileSize(targetSize)}, ${formatSizeChangePercent(
        sourceSize,
        targetSize,
    )})`;
};

const getTinyPngKeyId = (apiKey) => {
    const input = String(apiKey || "");
    let hash = 2166136261;

    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const runWithConcurrency = async (items, concurrency, worker) => {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                await worker(items[currentIndex], currentIndex);
            }
        }),
    );
};

module.exports = {
    buildFilename,
    buildRequestErrorMessage,
    buildSuccessMessage,
    getExtensionFromMime,
    formatFileSize,
    getImageBuffer,
    getMimeFromExtension,
    getTinyPngKeyId,
    parseSizeValue,
    runWithConcurrency,
    toBuffer,
    updateImageNameByExtension,
};
