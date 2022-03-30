var superagent = require('superagent')

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
        'method': 'POST',
        'url': 'https://www.secaibi.com/designtools/api/image.html?tag=resizer&restful_override_method=PUT&qqfile=' + filename,
        'headers': {
        'Origin': 'https://www.secaibi.com',
        'Content-Type': 'application/octet-stream'
        },
        body: imgSrc
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
const compressionRequestConstruct = (srcid, filename, accept_lossy, jpeg_quality) => {
    return {
        'method': 'POST',
        'url': 'https://www.secaibi.com/designtools/api/resizer-action',
        'headers': {
        'Origin': 'https://www.secaibi.com',
        'Referer': 'https://www.secaibi.com/designtools/media/pages/resizer.html',
        'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            'action': 'compress',
            'srcid': srcid,
            'srcname': filename,
            'param_limit_width': 'origin',
            'accept_lossy': `${accept_lossy}`,
            'jpeg_quality': jpeg_quality
        }
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
        var imgList = ctx.output
        for (var i in imgList) {
            try {
                // 获取源图片内容
                var imgSrc = imgList[i].buffer
                if ((!imgSrc) && (imgList[i].base64Image)) {
                    imgSrc = Buffer.from(imgList[i].base64Image, 'base64')
                }

                // 格式化图片名称
                var myDate = new Date()
                var fileName = `${myDate.getFullYear()}${myDate.getMonth() + 1}${myDate.getDate()}${myDate.getHours()}${myDate.getMinutes()}${myDate.getSeconds()}.${imgList[i].extname.slice(1)}`
                imgList[i].filename = fileName

                // 上传源图片
                const uploadRequest = uploadRequestConstruct(fileName, imgSrc)
                const uploadResponse = await ctx.Request.request(uploadRequest)
                const uploadResponseObject = JSON.parse(uploadResponse)
                if (uploadResponseObject.success) {
                    const srcId = uploadResponseObject.id
                    const compressionRequest = compressionRequestConstruct(srcId, fileName, accept_lossy, jpeg_quality)
                    const compressionResponse = await ctx.Request.request(compressionRequest)
                    const compressionResponseObject = JSON.parse(compressionResponse)
                    if (compressionResponseObject.success) {
                        const dstId = compressionResponseObject.dstid
                        let res = await superagent
                            .get('https://www.secaibi.com/designtools/api/image/' + dstId +'.bin?filename=' + fileName + '&browser=')
                            .set("Content-Type", "application/json")
                            .set("accept", "application/octet-stream")
                            .buffer(true).disableTLSCerts()
                        imgList[i].buffer = res.body
                    }
                    else {
                        ctx.log.error('提交压缩设置失败!')
                    }
                }
                else {
                    ctx.log.error('上传源图片' + fileName + '失败, 请检查网络连接!')
                }
            }
            catch (err) {
                if (err.error === 'Upload failed') {
                    ctx.emit('notification', {
                    title: '上传失败!',
                    body: '请检查你的配置项是否正确'
                    })
                }
                else {
                    ctx.emit('notification', {
                    title: '上传失败!',
                    body: '请检查你的配置项是否正确'
                    })
                }
                throw err
            }
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
