# 机器马 Animation

**30套可运行的代码动画，附画风规范、提示词、合成音效与MP4渲染工具。**

这次视频选取最初的30种画风，每种5秒，合计 **2分30秒**。主画面展示动画，右侧写名称和制作提示词。每种动画保留自己的故事、角色、镜头与构图。

- [下载30种完整视频（MP4）](https://github.com/prefect12/jiqima-animation/releases/download/v1.1.0/jiqima-animation-30-styles-150s.mp4)
- [Release与下载校验](https://github.com/prefect12/jiqima-animation/releases/tag/v1.1.0)
- [30种精选提示词](prompts/30-styles.md)
- [让Claude、Codex或DeepSeek使用这个库](prompts/USE-WITH-AI.md)
- [DeepSeek单项复刻实验（不代表全部30种）](experiments/README.md)

## 直接运行

需要 **Node.js 20+**、**FFmpeg/ffprobe**。源码画面由Canvas2D绘制，声音由Web Audio合成，不依赖视频生成服务。查看和渲染已有动画不需要模型API密钥。

```bash
git clone https://github.com/prefect12/jiqima-animation.git
cd jiqima-animation
npm ci
npx playwright install chromium
npm start
```

打开终端显示的 `http://127.0.0.1:8908`，搜索画风，点“播放动画 · 看代码”。每个样片页面点击▶播放，支持拖动进度。`PORT=8910 npm start` 可换端口。网页默认只绑定本机。

Linux安装浏览器系统依赖时，可使用Playwright官方命令 `npx playwright install --with-deps chromium`。FFmpeg通过操作系统包管理器安装，例如macOS使用 `brew install ffmpeg`。

## 渲染MP4

```bash
# 单个15秒原速样片：输出 pixel-game/demo.mp4 和 poster.jpg
npm run render -- pixel-game

# 抽取关键帧
npm run render -- pixel-game stills 1,5.8,9.8,13

# 渲染全部30套（耗时较长）
npm run render -- all

# 检查所有样片能否离线加载、出帧、运动、同时间重复渲染
npm test
```

默认1920×1080、30fps、H.264 + AAC。`CHROME_PATH`、`FFMPEG` 可指定现有程序；不需要修改代码中的本机路径。`OFFLINE=1` 禁止渲染页面请求外部字体，采用系统字体回退。逐帧检查只代表明确列出的技术项目，不能代替观看与核听。

## 重建30种×5秒合集

先渲染 `compilation/selected30.json` 对应的30支15秒原速样片，然后：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/compose.py
# 若未自动找到中文字体：
python scripts/compose.py --font /path/to/NotoSansCJK-Regular.ttc
```

输出 `outputs/compilation/animation-30-styles.mp4`。可先 `--limit 1` 验证首段。脚本完整保留原片15秒时间范围，3倍速压至5秒，音轨同步保音高；不要把已经5秒的合集再次送入这个步骤。不同操作系统字体可能影响文字版式；历史原样成片请直接下载Release。

## 代码在哪

| 路径 | 内容 |
|---|---|
| 每种画风的 `demo.html` | 完整可编辑动画、故事时间轴、绘制与配乐代码 |
| 每种画风的 `STYLE.md` | 造型、色彩、材质、动作、镜头、声音及制作经验 |
| `_engine/core.js` | Film绘制/声音引擎和逐帧导出接口 |
| `_engine/render.cjs` | 可移植渲染器，捕获页面/编码错误，固定导出随机种子 |
| `compilation/selected30.json` | 30种顺序、时间、名称及屏幕提示词 |
| `scripts/compose.py` | 视频左主屏＋右提示词版式与150秒合成 |
| `prompts/` | 可直接给AI使用的指令 |
| `experiments/` | DeepSeek独立复刻源码与检查记录 |

源代码及依赖锁文件在Git中；MP4、声音、渲染缓存不进Git历史。历史主片通过Release单独下载。

## 署名与许可

历史动画由Claude制作，开源工程整理由Codex完成。门类参考 **LemoLab / lemo-opuscar**，详情见 [来源与边界](docs/PROVENANCE.md)。自有代码和文档采用 [MIT](LICENSE)，品牌和二维码保留品牌权利。未包含第三方参考视频、无明确授权的提示词转载或私人聊天记录。

## 机器马玩AI

分享实用AI工具、教程与动画制作。公众号二维码：

<img src="assets/wechat-qr.jpg" alt="机器马玩AI公众号二维码" width="220">
