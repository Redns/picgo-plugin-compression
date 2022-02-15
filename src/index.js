var superagent = require('superagent')

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
 * @param {是否启用PNG压缩} param_accept_lossy 
 * @param {JPG压缩质量} param_jpeg_quality 
 * @returns 
 */
const compressionRequestConstruct = (srcid, filename, param_accept_lossy, param_jpeg_quality) => {
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
            'param_accept_lossy': `${param_accept_lossy}`,
            'param_jpeg_quality': param_jpeg_quality
        }
    }
}


const handle = async (ctx) => {
    const userConfig = ctx.getConfig('compression')
    if (!userConfig) {
        throw new Error('请配置相关信息!')
    }   
    else if(userConfig.enable){
        var param_accept_lossy = userConfig.param_accept_lossy
        var param_jpeg_quality = userConfig.param_jpeg_quality

        // 检查设置是否符合要求
        if((typeof(param_accept_lossy) != 'boolean') || 
           (typeof(param_jpeg_quality) != 'number') ||
           ((param_jpeg_quality < 5) && (param_jpeg_quality != 0)) ||
           (param_jpeg_quality > 100)){
            throw new Error('请检查设置是否正确!')
        }
        else {
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
                        const compressionRequest = compressionRequestConstruct(srcId, fileName, param_accept_lossy, param_jpeg_quality)
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
    }    
    return ctx
}


module.exports = (ctx) => {
  const register = () => {
    ctx.log.success('compression加载成功!')
    ctx.saveConfig({
        'compression': {
            enable: true,
            param_accept_lossy: true,
            param_jpeg_quality: 0
        }
    })
    ctx.helper.beforeUploadPlugins.register('compression', {
      handle: handle,
      name: 'compression'
    })
  }
  return {
    register,
    beforeUploadPlugins: 'compression'
  }
}
