# DeepSeek 独立重建实验

**结果：能做出同类像素画风和完整故事，但没有复刻到一模一样。** 本次只测试1种15秒电玩像素动画，不能据此推断全部30种的复刻能力。

- [15秒并排对比（无声）](https://github.com/prefect12/jiqima-animation/releases/download/v1.0.0/claude-vs-deepseek-pixel-15s.mp4)
- [DeepSeek单片（有合成音轨）](https://github.com/prefect12/jiqima-animation/releases/download/v1.0.0/deepseek-pixel-15s.mp4)
- [实际生成源码](deepseek-pixel/demo.html)、[输入指令](deepseek-pixel/prompt.txt)、[模型自己的制作记录](deepseek-pixel/MODEL-NOTES.md)、[来源记录](deepseek-pixel/provenance.json)

## 实验条件

2026-10-24，使用本机 DeepSeek Harness 0.2.0-rc.2 的现有默认配置：`deepseek-official / deepseek-flash`。这是本机工具调用官方云API，并非离线模型权重；实际生成源码的是DeepSeek。

在独立目录中只提供本库 `pixel-game/STYLE.md` 与 `_engine/core.js`，未提供原始 `demo.html`、原视频或参考截图。请求重新实现15秒 BUG HUNT：橙色主角、三次踩怪、升级、BOSS三次受击、通关及合成音效。任务指令限制模型只读所提供材料。模型完成一次独立生成并自行检查、修正。Codex没有重画它的动画，只调整打包后的引擎相对地址，完成渲染与比较。

这验证的是“从规范独立重写”的能力。如果目标是保留原画面直接换文字、颜色或故事，优先让模型读取并修改已有 `demo.html`；复用原码与独立重建是不同任务。

## 实际画面对比

对比两支视频在同一浏览器、离线字体回退、相同渲染器和分辨率下导出的版本。查看1.0、2.0、5.8、7.8、9.8、11.3、12.4秒实际编码帧；同秒比较不代表角色处于完全相同动作状态。

| 项目 | 原版Claude | DeepSeek重建 |
|---|---|---|
| 整体画风 | 低分辨率像素、蓝天雪山、横向闯关 | 保留像素、雪山、横向闯关，山体/地面细节不同 |
| 主角 | 宽矮橙色Clawd | 细长橙色小人，轮廓和比例未保留 |
| 剧情 | 踩BUG、升级、攻击BOSS、通关 | 这些事件均存在，具体时序和表演不同 |
| BOSS动作 | 主角跳跃踩击，怪物弹起 | 主角站在左侧射击，BOSS戴皇冠 |
| 文字与构图 | AGENT、LV4/LV5；较小标题 | HERO、LV1/LV2；更大标题与山体 |
| 声音 | 原码合成音乐/音效 | 模型重写合成音乐/音效，非原音轨复制 |

适合作为可编辑初稿，若要贴近原版，还需要锁定主角造型、动作方式、HUD和构图并继续返工。本轮保留原始实验结果，未把差异修掉后冒充一次成功。

## 检查范围

- DeepSeek源码离线加载、2.5秒与12.5秒画面变化、乱序重复查询同一时间像素一致、无页面JS错误：通过。
- 实际MP4：1920×1080、30fps、450帧、15秒，包含AAC音轨；FFmpeg全量解码通过。
- 并排视频：两边均为实际编码画面，15秒，无声，避免同时混播两轨造成误判。
- 已检查上述实际关键帧及浏览器播放。音乐听感、完整动作自然度与用户接受仍待审阅；技术检查不能代替这些判断。

## 重新渲染

先按根目录README安装依赖及浏览器，然后：

```bash
ANIMATION_ROOT="$PWD/experiments" OFFLINE=1 npm run render -- deepseek-pixel
```

输出 `experiments/deepseek-pixel/demo.mp4`。原版对照用 `OFFLINE=1 npm run render -- pixel-game`。`OFFLINE=1`使双方采用各自系统字体回退，不承诺与历史联网字体画面逐像素一致。

未包含API密钥、原始会话日志、私人配置或模型思考记录。
