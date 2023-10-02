const qs = require('qs')

const pluginConfig = (ctx) => {
    let userConfig = ctx.getConfig('picgo-plugin-compression')
    if (!userConfig) {
        userConfig = {}
    }
    const config = [
        {
            name: 'accept_lossy',
            type: 'list',
            alias: '容许质量下降',
            choices: [true, false],
            default: userConfig.accept_lossy || '',
            message: '',
            required: false
        },
        {
            name: 'jpeg_quality',
            type: 'input',
            alias: '图片质量',
            default: userConfig.jpeg_quality || '',
            message: '图片质量不能为空',
            required: true
        }
    ]
    return config
}

/**
 * 上传待压缩的图片
 * @param {待压缩的图片名称}} filename 
 * @param {待压缩的图片内容(二进制形式)} imgSrc 
 * @returns 
 */
const uploadRequestConstruct = (filename, imgSrc) => {
    return {
        method: 'post',
        url: `https://www.secaibi.com/designtools/api/image.html?tag=resizer&restful_override_method=PUT&qqfile=${filename}`,
        headers: {
            'Origin': 'https://www.secaibi.com',
            'Content-Type': 'application/octet-stream'
        },
        data: imgSrc
    }
}


/**
 * 发送压缩设置信息
 * @param {源图片ID} srcid 
 * @param {源图片名称} filename 
 * @param {是否启用PNG压缩} accept_lossy 
 * @param {JPG压缩质量} jpeg_quality 
 * @returns 
 */
const compressRequestConstruct = (id, filename, accept_lossy, jpeg_quality) => {
    let data = qs.stringify({
        'action': 'compress',
        'srcid': id,
        'srcname': filename,
        'param_limit_width': 'origin',
        'param_accept_lossy': accept_lossy,
        'param_jpeg_quality': jpeg_quality 
    });

    return {
        method: 'post',
        url: 'https://www.secaibi.com/designtools/api/resizer-action',
        headers: {
            'Origin': 'https://www.secaibi.com',
            'Referer': 'https://www.secaibi.com/designtools/media/pages/resizer.html',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
    }
}


/**
 * 压缩结果获取请求
 * @param {*} dstid 
 * @param {*} filename 
 * @returns 
 */
const compressResultRequestConstruct = (dstid, filename) => {
    return {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.secaibi.com/designtools/api/image/${dstid}.bin?filename=${filename}`,
        headers: { 
            'Referer': 'https://www.secaibi.com/designtools/media/pages/resizer.html', 
            //'Accept': 'application/octet-stream'
        },
        responseType: 'arraybuffer'
    }
}


const handle = async (ctx) => {
    const userConfig = ctx.getConfig('picgo-plugin-compression')
    if (!userConfig) {
        throw new Error('请配置相关信息!')
    }   
    else {
        var accept_lossy = userConfig.accept_lossy
        var jpeg_quality = parseInt(userConfig.jpeg_quality)

        // 检查设置是否符合要求
        if((jpeg_quality != 0) && ((jpeg_quality < 5) || (jpeg_quality > 100))){
            jpeg_quality = 0
            ctx.saveConfig({
                "picgo-plugin-compression": {
                    "accept_lossy": accept_lossy,
                    "jpeg_quality": "0"
                }
            })
        }
        // 筛选可压缩的图片
        const compressibleExtensions = ['.jpg', '.jpeg', '.gif', '.png']
        const imgList = ctx.output.filter(img => compressibleExtensions.indexOf(img.extname) > -1)
        for (var i in imgList) {
            // 获取源图片内容
            var imgSrc = imgList[i].buffer
            if ((!imgSrc) && (imgList[i].base64Image)) {
                imgSrc = Buffer.from(imgList[i].base64Image, 'base64')
            }
            // 格式化图片名称
            var myDate = new Date()
            imgList[i].filename = `${myDate.getFullYear()}${myDate.getMonth() + 1}${myDate.getDate()}${myDate.getHours()}${myDate.getMinutes()}${myDate.getSeconds()}.${imgList[i].extname.slice(1)}`
            // 上传源图片
            const uploadRequest = uploadRequestConstruct(imgList[i].filename, imgSrc)
            await ctx.request(uploadRequest).then(async (uploadResponse) => {
                // 上传压缩参数
                const compressRequest = compressRequestConstruct(uploadResponse.id, imgList[i].filename, accept_lossy, jpeg_quality)
                await ctx.request(compressRequest).then(async (compressResponse) => {
                    if(compressResponse.success && (compressResponse.srcsize > compressResponse.dstsize)){
                        // 下载压缩后的图片
                        // ctx.log.info(`https://www.secaibi.com/designtools/api/image/${compressResponse.dstid}.bin?filename=${imgList[i].filename}`)
                        const compressResultRequest = compressResultRequestConstruct(compressResponse.dstid, imgList[i].filename)
                        await ctx.request(compressResultRequest).then(async (compressResultResponse) => {
                            imgList[i].buffer = Buffer.from(compressResultResponse, 'hex')
                        ctx.log.info(`[Compression] 图片 ${imgList[i].filename} 压缩成功（${compressResponse.srcsizeReadable} --> ${compressResponse.dstsizeReadable}, ↓${compressResponse.reducePercent}%}）`)
                        }).catch((error) => {
                            ctx.log.error(`[Compression] 图片压缩失败，${error.message}`)
                        })
                    }
                    else{
                        ctx.log.info(`[Compression] 图片已压缩至极限`)
                    }
                }).catch((error) => {
                    ctx.log.error(`[Compression] 上传压缩参数失败，${error.message}`)
                })
            }).catch((error) => {
                ctx.log.error(`[Compression] 上传图片 ${imgList[i].filename} 失败，${error.message}`)
            })
        }
    }  
    return ctx
}


module.exports = (ctx) => {
  const register = () => {
    ctx.log.success('compression加载成功!')
    ctx.saveConfig({
        'picgo-plugin-compression': {
            accept_lossy: true,
            jpeg_quality: "0"
        }
    })
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
