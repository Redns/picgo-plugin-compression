>  [!WARNING]
> 本插件由 picgo-plugin-compression 更名为 picgo-plugin-squeeze，安装后相关设置将自动迁移

# picgo-plugin-squeeze

![](https://img.shields.io/npm/v/picgo-plugin-squeeze?label=release&color=green) ![](https://img.shields.io/badge/License-MIT-blue)

## 简介

现有图像压缩算法可在保证图像质量基本不变的前提下，极大降低图像大小，从而减少存储占用和数据流量传输，对于使用云存储的用户极为重要。目前 [PicGo](https://picgo.app/) 图像压缩插件大致分为本地压缩和在线压缩两类

- `本地压缩`：通过本地 npm 包实现图片压缩
- `在线压缩`：将图像上传至云端图像压缩 API 实现

本地压缩无需网络，但受限于本地计算能力；在线压缩可借助云端算力，但依赖网络带宽。本插件同时支持上述两种方式。其中本地压缩通过 npm 包 [sharp/libvips](https://www.npmjs.com/package/sharp) 实现，在线压缩通过 [色彩笔](https://www.secaibi.com/tools/在线图片压缩/) 实现，相关对比测试见下文

## 特性

-  支持 **本地压缩** 和 **在线压缩**，无需注册登录、无需安装额外软件
   
   | 压缩方式 |                           图像限制                           | JPG/JPEG | PNG  | WebP | GIF  | AVIF |
   | :------: | :----------------------------------------------------------: | :------: | :--: | :--: | :--: | :--: |
   | 本地压缩 | 根据当前 npm sharp 库的输入/输出格式能力判断，且输入图片像素数 ≤ [268402689 pixels](https://sharp.pixelplumbing.com/api-constructor/) |    ✔️     |  ✔️   |  ✔️   |  ✔️   |  ✔️   |
   | 在线压缩 |                            ≤ 5MB                             |    ✔️     |  ✔️   |  ❌   |  ✔️   |  ❌   |
   
- 支持 PNG 无损压缩和图像质量控制，压缩变大时自动保留原图

- 支持 **自定义压缩规则**

- 支持 **临时关闭压缩**，无需禁用插件或重启 PicGo

- 支持 **zh-CN / zh-TW / en**

## 配置

1. 在插件设置中搜索 `squeeze` 安装
2. 点击右下角设置 > 配置 plugin - plugin-squeeze
3. 修改相关设置

   - `压缩方式`：可选择关闭压缩（off）、本地压缩（local）、上传至色彩笔在线压缩（online）或自定义压缩流程（custom）
   - `图片质量`：取值范围 5 ~ 100，数字越大图像质量越好，但相应能压缩的文件体积也较少（若不确定具体的数值请设置为 0，插件将根据具体情况决定）
   - `允许 png 质量下降`：png 为无损压缩格式，若能够接受 png 图片质量的轻微下降，可设置为 true 以获得更大压缩比
   - `在线压缩并发数`：取值范围 1 ~ 5，多图在线压缩时可同时处理的图片数量（默认 1）
   - `快捷键切换时提醒`：控制通过快捷键切换压缩模式时是否弹出提醒通知
   - `自定义压缩流程`：通过图片后缀名和大小自定义压缩方式、图片质量等参数，仅当压缩方式为 custom 时生效，规则模板及示例见下文。多条规则用英文分号分隔，匹配到第一条的规则生效
4. 点击 确定，设置完成

### 快捷键

部分场景下可能需要 **临时关闭压缩且不想禁用插件、重启 PicGo**，本插件可通过插件设置 > 压缩模式 > off 实现，也可以通过 `TOGGLE_MODE` 快捷键命令快速切换

- 若当前压缩方式不是 `off`，触发后会记录当前模式并切换为 `off`
- 若当前已是 `off`，再次触发会恢复到上一次记录的模式

通过快捷键切换默认会弹窗提醒当前压缩模式，可通过插件设置 > 快捷键切换时提醒控制

### 自定义压缩流程

规则格式为 `条件 => 动作`，条件和动作之间用英文逗号分隔，`*` 表示任意值

- 多条规则可在同一个输入框内用英文分号分隔，匹配到第一条的规则生效
- 若自定义规则格式错误，插件会在日志中输出错误，并在本次上传临时使用 `ext=* => mode=local`
- `=>` 左右两侧空格不影响解析，例如 `ext=jpg=>mode=online` 和 `ext=jpg => mode=online` 等价

支持的条件和动作如下表所示

|      |   参数    |       参数范围        | 描述 |      示例      |
| :--: | :-------: | :-------------------: | :--: | :------------: |
| 条件 |    ext    | jpg/jpeg/png/gif/webp | 图片拓展名 | ext = jpg\|jpeg\|png |
|      |   size    |       [Comparer]*B/KB/MB       | 图片尺寸 |     size < 200KB     |
|      |   width   |      [Comparer]*px      | 图片宽度 |    width >= 1920     |
|      |  height   |      [Comparer]*px      | 图片高度 |    height >= 1080    |
| 动作 |   mode    |      local<br />online<br />skip      | 压缩模式（本地/在线/跳过） | mode = local |
|      |  quality  | 0/5~100 | 图片质量 | quality = 0 |
|      | png_lossy | true/false | 允许 PNG 质量下降 | png_lossy = false |

例如，大小在 200KB~5MB 的 jpg/jpeg 采用在线压缩，其余均采用本地压缩

```bash
ext=jpg|jpeg,size>=200KB,size<=5MB => mode=online; ext=* => mode=local
```

宽度 ≥ 1920 或高度 ≥ 1080 的 png 使用本地压缩并允许 png 有损

```bash
ext=png,width>=1920 => mode=local,png_lossy=true; ext=png,height>=1080 => mode=local,png_lossy=true; ext=* => mode=local
```

## 测试

### jpg/jpeg

|              |          |                           原始图像                           |                          图像质量 = 0                          |                         图像质量 = 20                          |                         图像质量 = 60                          |                         图像质量 = 80                          |
| :----------: | :------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| **本地压缩** | 图像尺寸 |                            315KB                             |                            305KB                             |                             58KB                             |                            148KB                             |                            259KB                             |
|              | 压缩比例 |                              0%                              |                            3.17%                             |                            81.59%                            |                            53.02%                            |                            17.78%                            |
|              | 压缩图像 | ![20260425-bing](https://image.krins.cloud/c88c90a3537ae7cb04f622eb4046a27c.jpg) | ![20260425-bing](https://image.krins.cloud/895633295f02d2eb67bcfab1cd213966.jpg) | ![20260425-bing](https://image.krins.cloud/fc7c3a2e53d87d27a71612cf6207c809.jpg) | ![20260425-bing](https://image.krins.cloud/074623255d5941a70006b982bda32faf.jpg) | ![20260425-bing](https://image.krins.cloud/710d0aa0fdd18a56e1a0c2fdac63ccd7.jpg) |
| **在线压缩** | 图像尺寸 |                              *                               |                            247KB                             |                             57KB                             |                            147KB                             |                            257KB                             |
|              | 压缩比例 |                              *                               |                             22%                              |                             83%                              |                             54%                              |                             19%                              |
|              | 压缩图像 |                              *                               | ![20260425-bing](https://image.krins.cloud/b61026e1b87545af0352bbf501e8f1ea.jpg) | ![20260425-bing](https://image.krins.cloud/8bb73dcc4c666b424493f8ab479d8cb0.jpg) | ![20260425-bing](https://image.krins.cloud/4cdc3e2ff304b6c60397e02262de86bf.jpg) | ![20260425-bing](https://image.krins.cloud/40322df3cc1850457ecb0840b1b95271.jpg) |

### png

|              |          |                           原始图像                           |             禁止 PNG 质量下降<br />图像质量 = ANY              |              允许 PNG 质量下降<br />图像质量 = 0               |              允许 PNG 质量下降<br />图像质量 = 30              |              允许 PNG 质量下降<br />图像质量 = 60              |              允许 PNG 质量下降<br />图像质量 = 90              |
| :----------: | :------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| **本地压缩** | 图像尺寸 |                            2.39MB                            |                            1.70MB                            |                            912KB                             |                            496KB                             |                            496KB                             |                            912KB                             |
|              | 压缩比例 |                              0%                              |                            28.87%                            |                            62.74%                            |                            79.73%                            |                            79.73%                            |                            62.74%                            |
|              | 压缩图像 | ![Wallhaven](https://image.krins.cloud/17d4ad565b3662c0b6b5bd3b84019801.png) | ![Wallhaven](https://image.krins.cloud/b46d2ea88c0c522a0c8f5c60cf321584.png) | ![Wallhaven](https://image.krins.cloud/2736b5bfbd2f5bac89da65d74a99610b.png) | ![Wallhaven](https://image.krins.cloud/5ba56591a3acb3a7ab5abcc497380324.png) | ![Wallhaven](https://image.krins.cloud/5ba56591a3acb3a7ab5abcc497380324.png) | ![Wallhaven](https://image.krins.cloud/2736b5bfbd2f5bac89da65d74a99610b.png) |
| **在线压缩** | 图像尺寸 |                              *                               |                            2.1MB                             |                            547KB                             |                            547KB                             |                            547KB                             |                            547KB                             |
|              | 压缩比例 |                              *                               |                             11%                              |                             78%                              |                             78%                              |                             78%                              |                             78%                              |
|              | 压缩图像 |                              *                               | ![Wallhaven](https://image.krins.cloud/38f04429a533bfac251d2ff9b9d861f8.png) | ![Wallhaven](https://image.krins.cloud/61d8c529e2bee71bc41910bee235f804.png) | ![Wallhaven](https://image.krins.cloud/61d8c529e2bee71bc41910bee235f804.png) | ![Wallhaven](https://image.krins.cloud/61d8c529e2bee71bc41910bee235f804.png) | ![Wallhaven](https://image.krins.cloud/61d8c529e2bee71bc41910bee235f804.png) |

### webp

|              |          |                           原始图像                           |                          图像质量 = 0                          |                         图像质量 = 30                          |                         图像质量 = 60                          |                         图像质量 = 90                          |
| :----------: | :------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| **本地压缩** | 图像尺寸 |                            876KB                             |                            771KB                             |                            244KB                             |                            367KB                             |                            876KB                             |
|              | 压缩比例 |                              0%                              |                             12%                              |                             72%                              |                             58%                              |                              0%                              |
|              | 压缩图像 | ![1777338320759](https://image.krins.cloud/412fb6723b89827896d344e180b4fd8a.webp) | ![1777338320759](https://image.krins.cloud/e29dcd3b6eae6adac5b01fea9e12afb2.webp) | ![1777338320759](https://image.krins.cloud/b8767039b40d638ca3c8a23debdc5453.webp) | ![1777338320759](https://image.krins.cloud/888266b0666f047e7bf96ddd56717a91.webp) | ![1777338320759](https://image.krins.cloud/412fb6723b89827896d344e180b4fd8a.webp) |

### gif

|              |          |                           原始图像                           |                          图像质量 = 0                          |                         图像质量 = 30                          |                         图像质量 = 60                          |                         图像质量 = 90                          |
| :----------: | :------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| **本地压缩** | 图像尺寸 |                            2.4MB                             |                            2.4MB                             |                            1.4MB                             |                            1.5MB                             |                            2.4MB                             |
|              | 压缩比例 |                              0%                              |                              0%                              |                             41%                              |                             39%                              |                              0%                              |
|              | 压缩图像 | ![bili_v_d_1777340453881](https://image.krins.cloud/b1b3891ed0352b89bb0645357901be9b.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/b1b3891ed0352b89bb0645357901be9b.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/82bdd01ff26b4feb7891134f8b351ae3.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/194bb1a5847d1c3d30cb57aff56ed6a0.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/b1b3891ed0352b89bb0645357901be9b.gif) |
| **在线压缩** | 图像尺寸 |                              *                               |                            2.4MB                             |                            2.4MB                             |                            2.4MB                             |                            2.4MB                             |
|              | 压缩比例 |                              *                               |                              0%                              |                              0%                              |                              0%                              |                              0%                              |
|              | 压缩图像 |                              *                               | ![bili_v_d_1777340453881](https://image.krins.cloud/e83f0a962bd9dd0dc9d9fc4334fc1fb5.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/e83f0a962bd9dd0dc9d9fc4334fc1fb5.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/e83f0a962bd9dd0dc9d9fc4334fc1fb5.gif) | ![bili_v_d_1777340453881](https://image.krins.cloud/e83f0a962bd9dd0dc9d9fc4334fc1fb5.gif) |

### avif

|              |          |                           原始图像                           |                         图像质量 = 0                         |                        图像质量 = 30                         |                        图像质量 = 60                         |                        图像质量 = 90                         |
| :----------: | :------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| **本地压缩** | 图像尺寸 |                            586KB                             |                            541KB                             |                            240KB                             |                            360KB                             |                            586KB                             |
|              | 压缩比例 |                              0%                              |                              8%                              |                             59%                              |                             39%                              |                              0%                              |
|              | 压缩图像 | ![](https://image.krins.cloud/907ead91340ea7722b0572f7531b0e68.avif) | ![](https://image.krins.cloud/4715e69f858d0be72998b00be96d56ed.avif) | ![](https://image.krins.cloud/92995792b5d5a9ac4a7a962f7f070c4f.avif) | ![](https://image.krins.cloud/67d4fa43c6f45da84393239449359b49.avif) | ![](https://image.krins.cloud/907ead91340ea7722b0572f7531b0e68.avif) |

[![Star History Chart](https://api.star-history.com/svg?repos=Redns/picgo-plugin-squeeze&type=Date)](https://star-history.com/#Redns/picgo-plugin-squeeze&Date)

