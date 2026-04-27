# picgo-plugin-squeeze

![](https://img.shields.io/npm/v/picgo-plugin-squeeze?label=release&color=green) ![](https://img.shields.io/badge/License-MIT-blue)

## 简介

现有图像压缩算法可在保证图像质量基本不变的前提下，极大降低图像大小，从而减少存储占用和数据流量传输，对于使用云存储的用户极为重要。目前 [PicGo](https://picgo.app/) 图像压缩插件大致分为本地压缩和在线压缩两类

- `本地压缩`：通过本地 npm 包实现图片压缩
- `在线压缩`：将图像上传至云端图像压缩 API 实现

本地压缩无需网络，但受限于本地计算能力；在线压缩可借助云端算力，但依赖网络带宽。本插件同时支持上述两种方式。其中本地压缩通过 npm 包 [sharp/libvips](https://www.npmjs.com/package/sharp) 实现，在线压缩通过 [色彩笔](https://www.secaibi.com/tools/在线图片压缩/) 实现，相关对比测试见下文

## 特性

-  支持本地压缩和在线压缩，无需注册登录、无需安装额外软件
   
   | 压缩方式 | JPG/JPEG | PNG  | WebP | GIF  |
   | :------: | :------: | :--: | :--: | :--: |
   | 本地压缩 |    ✔️     |  ✔️   |  ✔️   |  ✔️   |
   | 在线压缩 |    ✔️     |  ✔️   |  ❌   |  ✔️   |
   
- 支持 PNG 无损压缩和图像质量控制

## 配置

1. 在插件设置中搜索 `squeeze` 安装

2. 点击右下角设置，选择配置 plugin

3. 修改相关设置

   - `压缩方式`：可选择本地压缩（local）或上传至色彩笔在线压缩（online）
   - `图片质量`：取值范围 5 ~ 100，数字越大图像质量越好，但相应能压缩的文件体积也较少（若不确定具体的数值请设置为 0，插件将根据具体情况决定）
   - `允许 png 质量下降`：若能够接受 png 图片质量的轻微下降，可设置为 true 以获得更大压缩比
   
4. 点击 确定，设置完成

## 测试



[![Star History Chart](https://api.star-history.com/svg?repos=Redns/picgo-plugin-squeeze&type=Date)](https://star-history.com/#Redns/picgo-plugin-squeeze&Date)

