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
  var loss = true
  if (param_accept_lossy == '0') {
    loss = false
  }
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
      'param_accept_lossy': `${loss}`,
      'param_jpeg_quality': param_jpeg_quality
    }
  }
}


/**
 * 获取压缩后的图片
 * @param {压缩图片ID} dstid 
 * @param {图片名称} filename 
 * @returns 
 */
const downloadRequestConstruct = (dstid, filename) => {
  return {
    'method': 'GET',
    'url': 'https://www.secaibi.com/designtools/api/image/' + dstid + '.bin?filename=' + filename + '&browser=',
    'headers': {
      'Referer': 'https://www.secaibi.com/designtools/media/pages/resizer.html'
    }
  }
}


const strToBinary = (str) => {
  var result = [];
  var list = str.split("");
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var binaryStr = item.charCodeAt().toString(2);
    result.push(binaryStr);
  }
  return result.join("");
}


const handle = async (ctx) => {
  // 获取用户配置信息
  // const userConfig = ctx.getConfig('picBed.compression')
  var param_accept_lossy = '1'
  var param_jpeg_quality = '0'

  // if (!userConfig) {
  //   throw new Error('请配置相关信息!')
  // }
  // else {
  //   // 检查设置是否为数字
  //   var regex = /^\d+$/
  //   if ((!regex.test(param_accept_lossy)) || (!regex.test(param_jpeg_quality))) {
  //     throw new Error('请检查设置是否正确!')
  //   }
  //   else {
  //     // 检查设置是否符合规定
  //     if (param_accept_lossy != '0') {
  //       param_accept_lossy = '1'
  //     }
  //     if ((param_jpeg_quality == '') || (Number(param_jpeg_quality) < 5) || (Number(param_jpeg_quality) > 100)) {
  //       param_jpeg_quality = '0'
  //     }
  //     // 保存设置
  //     ctx.saveConfig({
  //       'picBed.compression': {
  //         param_accept_lossy: param_accept_lossy,
  //         param_jpeg_quality: param_jpeg_quality
  //       }
  //     })
  //   }
  // }


  var imgList = ctx.output
  for (var i in imgList) {
    try {
      // 获取源图片内容
      var imgSrc = imgList[i].buffer
      if ((!imgSrc) && (imgList[i].base64Image)) {
        imgSrc = Buffer.from(imgList[i].base64Image, 'base64')
      }
      ctx.log.info(imgList[i].buffer)

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
  return ctx
}


module.exports = (ctx) => {
  const register = () => {
    ctx.log.success('compression加载成功!')
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
