# picgo-plugin-compression

## 简介

[色彩笔](https://www.secaibi.com/tools/在线图片压缩/) 是一个免费的在线图片压缩小工具，可以非常方便得将`PNG/GIF/JPG`图片大小优化到极限，为设备访问节约数据流量，提高访问速度。

<br>

## 插件特点

-  支持`JPG/JPEG/GIF/PNG`
- 支持多图片批量上传
- 在图片体积大大减小后, 仍能让清晰度保持和原版一样
- 图片在线处理，本地无需安装任何额外软件

但同时您要注意到，该压缩插件完全依赖于色彩笔在线网站，因此插件的稳定性也完全依赖于网站的稳定性，并且使用此插件后不可避免地会消耗额外的时间来处理图片。

<br>

## 环境搭建

1. `GUI`用户直接在`插件设置`中搜索`compression`下载安装

   ![image-20220215191806396](https://img1.imgtp.com/2022/02/15/v5DdFkLK.png)

<br>

2. 根据自己的喜好配置插件，`windows`用户的配置文件路径为`C:\Users\username\AppData\Roaming\picgo\data.json`

   ![image-20220215192010008](https://img1.imgtp.com/2022/02/15/YCRQqhlo.png)

   - `enable`：该插件属于`beforeUploadPlugin`，当您的`picgo`安装多个同类别的插件时，`picgo`会调用每个插件

     ![image-20220215192228604](https://img1.imgtp.com/2022/02/15/YWI14FY3.png)

     因此，作者提供了一个配置选项来让用户选择是否启用本插件，而不需要繁琐的卸载-安装插件。当您需要启动该插件时，请设置`enable`为`true`，否则请设为`false`

     <br>

   - `param_accept_lossy`：PNG是无损图片格式，若您能够接受图片质量的轻微下降，可将该属性设置为`true`来获得更大压缩比；若您不能接受，则将该属性设置为`false`即可

     <br>

   - `param_jpeg_quality`：取值范围: `5 ~ 100`，默认为`0`。数字越大，图像质量越好， 但相应能压缩的文件体积也较少。若您不确定具体的数值，请将其设置为`0`，我们将根据具体情况帮您决定

   <br>

3. 点击确定，设置完成！



