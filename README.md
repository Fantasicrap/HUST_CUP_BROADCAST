# HUST_CUP_BROADCAST

面向 OBS 浏览器源的足球比赛直播图文包装系统。当前版本 **v0.1.0-design-preview**：按用户要求先交付两套主题、六个关键画面的可运行视觉预览，等待视觉确认后进入完整系统开发。

GitHub 仓库：[Fantasicrap/HUST_CUP_BROADCAST](https://github.com/Fantasicrap/HUST_CUP_BROADCAST)（私有）。版本标签：`v0.1.0-preview`。PULSE 和 NOCTURNE 两套主题均保留，后续可继续添加。

> 本版本不是完整比赛播控系统。时钟、比分、事件和点球轮次均来自固定示例；尚未实现比赛记账、正式播出、队列、输出延迟与断线恢复。不要将设计预览用于正式比赛。

## 启动

安装 Node.js 20 或更新版本，然后双击 `启动预览.cmd`。也可在本目录执行：

```powershell
node server.mjs
```

浏览器打开 <http://127.0.0.1:3210>。不需 `npm install`，不需联网加载字体或素材。服务仅监听本机 `127.0.0.1`。如果浏览器先于服务启动而提示无法连接，稍后刷新即可。关闭命令窗口或按 Ctrl+C 停止服务。

端口被占用时，在 PowerShell 执行：

```powershell
$env:PORT = '3211'
node server.mjs
```

随后使用 `http://127.0.0.1:3211`。

## 已提供的视觉内容

| 主题 | 方向 | 配色 |
| --- | --- | --- |
| PULSE / 几何竞技 | 紧凑、几何、色块、高对比 | 紫 `#32123F`、荧光黄绿 `#C9FF45`、米白 `#F6F4ED` |
| NOCTURNE / 蓝夜杯赛 | 深蓝、渐变、光弧、仪式感 | 深蓝 `#071936`、冰蓝 `#89DCFF`、浅金 `#E5CE9B` |

两套主题共用 `public/data/demo.json` 和同一套 DOM 模板，均含：常驻比分牌、进球弹窗、换人弹窗、球场阵型图、点球大战面板、开场对阵画面。赛事 logo 在双方队名之间，双方比分在其下方集中排列。

评审页可以切换主题与画面、重播入场、顺序展示六个画面，以及检查透明背景、安全区、长中文队名、缺失队徽和补时扩展。

`design-previews/` 包含两张六画面总览、12 张 1920×1080 单图、一张透明 PNG、边界情况图片和浏览器验证记录。比赛底图是原创 SVG 示意图，透明输出时隐藏；大画面本身具有有意设计的不透明背景。

- [PULSE 六画面总览](design-previews/pulse-contact-sheet.png)
- [NOCTURNE 六画面总览](design-previews/nocturne-contact-sheet.png)

## OBS 预览接入

1. 启动本地服务。
2. 在 OBS 添加「浏览器源」，URL 填入下面的透明输出地址。
3. 宽度 1920、高度 1080；若 OBS 提供自定义帧率选项，可设为 60。
4. 浏览器源置于比赛视频源上方。
5. 设计评审台的操作仅改变它内部的预览，不会遥控另一个 OBS 浏览器源；当前 OBS 地址中的场景由 URL 参数固定。

PULSE 比分牌：

```text
http://127.0.0.1:3210/overlay.html?theme=pulse&scene=scoreboard&transparent=1
```

NOCTURNE 进球画面：

```text
http://127.0.0.1:3210/overlay.html?theme=nocturne&scene=goal&transparent=1
```

URL 参数：

| 参数 | 可选值 |
| --- | --- |
| `theme` | `pulse` / `nocturne` |
| `scene` | `scoreboard` / `goal` / `substitution` / `formation` / `shootout` / `opening` |
| `transparent=1` | 隐藏示意比赛底图 |
| `safe=1` | 显示安全区辅助线，正式输出应去除 |
| `stress=1` | 长中文名和缺失队徽样例 |
| `added=1` | 展示补时、红牌及总比分扩展样例 |

以上只是浏览器源画面接入验证；还没有 OBS 实机验收、真实计时、输出延迟及视频回放功能。

## 文件说明

```text
HUST_CUP_BROADCAST/
  server.mjs                 本地静态预览服务
  启动预览.cmd                Windows 启动入口
  public/
    index.html               视觉评审页
    preview.css / preview.js 评审交互与布局
    overlay.html             1920×1080 图形预览入口
    graphics.css / .js        两套主题与六个画面
    assets/                  原创 SVG 赛事 logo、示例队徽
    data/demo.json           示例球队、球员、阵型、赛况
  design-previews/            预览图与验证记录
  docs/                      项目报告、设计与实施计划、续做存档
```

字体使用本机 Segoe UI / Microsoft YaHei / Arial 等回退字体，数字优先 Bahnschrift；没有外部字体请求。球衣颜色与球队品牌色分别保存。素材替换请保持相对路径，替换后刷新评审页。队徽使用 `object-fit: contain`，读取失败时显示简称替代图形。

## 继续开发

按用户最新要求，当前视觉预览版先作为 `v0.1.0-preview` 保存并上传 GitHub，**两套主题全部保留**，后续再添加内容。版本内容见 `CHANGELOG.md`；GitHub 上传状态以实际远程校验结果为准。后续开发仍按 `docs/项目报告.md` 的阶段计划进行，所有核心需求保留，可选和扩展功能单独列出。

## 额度约束

用户要求：**当 Codex 的 5 小时额度剩余不超过 5% 时，停止工作，保存当前文件及续做记录，明天再继续。** 后续每个主要工作阶段前后检查该额度；达到阈值后只完成必要的存档工作，不开启新开发。

## 素材声明

本项目赛事图形、示例队徽和球场底图为本项目制作的原创占位素材。球队、球员、赛况、时间均为演示数据，不代表实际比赛或学校官方授权。没有使用英超或欧冠官方 logo、队徽、音乐、视频和字体文件。
