const PLUGIN_NAME = 'picgo-plugin-compression'
const DEFAULT_CONFIG = {
  accept_lossy: true,
  jpeg_quality: '0'
}
const COMPRESSIBLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.gif', '.png'])
const SECAIBI_ORIGIN = 'https://www.secaibi.com'
const SECAIBI_REFERER = `${SECAIBI_ORIGIN}/designtools/media/pages/resizer.html`

const getUserConfig = (ctx) => {
  const userConfig = ctx.getConfig(PLUGIN_NAME) || {}
  const acceptLossy = typeof userConfig.accept_lossy === 'boolean'
    ? userConfig.accept_lossy
    : DEFAULT_CONFIG.accept_lossy

  let jpegQuality = Number.parseInt(userConfig.jpeg_quality, 10)
  if (Number.isNaN(jpegQuality)) {
    jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10)
  }

  if (jpegQuality !== 0 && (jpegQuality < 5 || jpegQuality > 100)) {
    jpegQuality = Number.parseInt(DEFAULT_CONFIG.jpeg_quality, 10)
    ctx.saveConfig({
      [PLUGIN_NAME]: {
        accept_lossy: acceptLossy,
        jpeg_quality: DEFAULT_CONFIG.jpeg_quality
      }
    })
  }

  return {
    acceptLossy,
    jpegQuality
  }
}

const pluginConfig = (ctx) => {
  const userConfig = ctx.getConfig(PLUGIN_NAME) || DEFAULT_CONFIG

  return [
    {
      name: 'accept_lossy',
      type: 'list',
      alias: '容许质量下降',
      choices: [true, false],
      default: userConfig.accept_lossy,
      message: '',
      required: false
    },
    {
      name: 'jpeg_quality',
      type: 'input',
      alias: '图片质量',
      default: userConfig.jpeg_quality,
      message: '图片质量不能为空',
      required: true
    }
  ]
}

const uploadRequestConstruct = (filename, imgSrc) => {
  return {
    method: 'post',
    url: `${SECAIBI_ORIGIN}/designtools/api/image.html`,
    params: {
      tag: 'resizer',
      restful_override_method: 'PUT',
      qqfile: filename
    },
    headers: {
      Origin: SECAIBI_ORIGIN,
      'Content-Type': 'application/octet-stream'
    },
    data: imgSrc
  }
}

const compressRequestConstruct = (id, filename, acceptLossy, jpegQuality) => {
  const requestBody = new URLSearchParams({
    action: 'compress',
    srcid: id,
    srcname: filename,
    param_limit_width: 'origin',
    param_accept_lossy: String(acceptLossy),
    param_jpeg_quality: String(jpegQuality)
  }).toString()

  return {
    method: 'post',
    url: `${SECAIBI_ORIGIN}/designtools/api/resizer-action`,
    headers: {
      Origin: SECAIBI_ORIGIN,
      Referer: SECAIBI_REFERER,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: requestBody
  }
}

const compressResultRequestConstruct = (dstid, filename) => {
  return {
    method: 'get',
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    url: `${SECAIBI_ORIGIN}/designtools/api/image/${dstid}.bin`,
    params: {
      filename
    },
    headers: {
      Referer: SECAIBI_REFERER
    },
    responseType: 'arraybuffer'
  }
}

const getImageBuffer = (img) => {
  if (img.buffer) {
    return img.buffer
  }

  if (img.base64Image) {
    return Buffer.from(img.base64Image, 'base64')
  }

  return null
}

const buildFilename = (img, index) => {
  return `${Date.now()}-${index}${img.extname}`
}

const toBuffer = (payload) => {
  if (Buffer.isBuffer(payload)) {
    return payload
  }

  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload)
  }

  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength)
  }

  return Buffer.from(payload)
}

const buildRequestErrorMessage = (error) => {
  if (!error) {
    return '未知错误'
  }

  const responseData = error.response && error.response.data
  if (typeof responseData === 'string' && responseData) {
    return `${error.message} - ${responseData}`
  }

  if (responseData && typeof responseData === 'object') {
    try {
      return `${error.message} - ${JSON.stringify(responseData)}`
    } catch (_) {
      return error.message
    }
  }

  return error.message
}

const compressImage = async (ctx, img, index, options) => {
  const imgSrc = getImageBuffer(img)
  if (!imgSrc) {
    ctx.log.warn(`[Compression] 图片 ${img.fileName || index + 1} 缺少可用数据，跳过压缩`)
    return
  }

  const filename = buildFilename(img, index)
  img.filename = filename

  try {
    const uploadResponse = await ctx.request(uploadRequestConstruct(filename, imgSrc))
    const compressResponse = await ctx.request(
      compressRequestConstruct(uploadResponse.id, filename, options.acceptLossy, options.jpegQuality)
    )

    if (!compressResponse.success || compressResponse.srcsize <= compressResponse.dstsize) {
      ctx.log.info(`[Compression] 图片 ${filename} 已压缩至极限`)
      return
    }

    const compressResultResponse = await ctx.request(
      compressResultRequestConstruct(compressResponse.dstid, filename)
    )

    img.buffer = toBuffer(compressResultResponse)
    ctx.log.info(
      `[Compression] 图片 ${filename} 压缩成功（${compressResponse.srcsizeReadable} --> ${compressResponse.dstsizeReadable}, ↓${compressResponse.reducePercent}%）`
    )
  } catch (error) {
    ctx.log.error(`[Compression] 图片 ${filename} 压缩失败，${buildRequestErrorMessage(error)}`)
  }
}

const handle = async (ctx) => {
  const userConfig = ctx.getConfig(PLUGIN_NAME)
  if (!userConfig) {
    throw new Error('请配置相关信息!')
  }

  const options = getUserConfig(ctx)
  const imgList = ctx.output.filter((img) => COMPRESSIBLE_EXTENSIONS.has(img.extname))

  for (const [index, img] of imgList.entries()) {
    await compressImage(ctx, img, index, options)
  }

  return ctx
}

module.exports = (ctx) => {
  const register = () => {
    ctx.log.success('compression加载成功!')

    if (!ctx.getConfig(PLUGIN_NAME)) {
      ctx.saveConfig({
        [PLUGIN_NAME]: DEFAULT_CONFIG
      })
    }

    ctx.helper.beforeUploadPlugins.register('compression', {
      handle,
      config: pluginConfig
    })
  }

  return {
    register,
    config: pluginConfig,
    beforeUploadPlugins: 'compression'
  }
}
