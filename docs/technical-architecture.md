# Knowclip 技术架构与设计概览

## 项目概览
- 桌面应用，核心用于：导入一个视频文件与 1~N 字幕文件，将字幕句子组合为卡片，导出为 Anki 牌组。
- 技术栈：Electron + React + Redux + RxJS + Vite，媒体侧依赖 ffmpeg/ffprobe 解析与转换。

## 技术栈与目录
- Electron 主进程初始化与窗口：`electron/main.ts`
- 预加载：安全桥接 API 暴露给渲染层：`electron.vite.config.ts:36–49`
- 渲染层（前端 UI）：`src/components/*`、状态与选择器：`src/reducers/*`、`src/selectors/*`
- Node 侧处理（媒体/字幕/导出）：`src/node/*`
- 文件模型与事件：`src/files/*`

## 运行架构
- 主进程
  - 创建窗口与启动本地文件服务器：`electron/main.ts:50–78`、`electron/main.ts:12`
  - 配置 ffmpeg/ffprobe 静态路径：`src/node/ffmpeg.ts:14–36`
- 预加载
  - 暴露 `ElectronApi` 与必要能力到渲染层：入口 `src/preload/index.ts`
- 渲染进程
  - 媒体播放与 `<track>` 字幕渲染：`src/components/Media.tsx:172–200, 255–300`
  - 波形与字幕片段渲染：`src/components/WaveformSubtitlesChunk.tsx:53–137`

## 数据模型
- `MediaFile`：包含媒体元数据与字幕关系：`src/types/FilesState.d.ts:40–69`
- 字幕文件类型
  - 外部字幕 `ExternalSubtitlesFile`：`src/types/FilesState.d.ts:85–91`
  - 嵌入字幕转换 VTT `VttConvertedSubtitlesFile`：`src/types/FilesState.d.ts:92–109`
- 字幕轨 `SubtitlesTrack`（含 `mode` 与 `chunks`）：`src/types/SubtitlesState.d.ts:5–20`
- 卡片基础实体 `SubtitlesCardBase`：`src/selectors/cardPreview.ts:12–19`

## 媒体与字幕处理流程
1) 打开媒体文件
- 读取 ffprobe 元数据并发现字幕流索引：`src/node/ffmpeg.ts:101–104`
- 触发嵌入字幕提取与轨挂载：`src/files/mediaFile.ts:275–312`

2) 提取嵌入字幕为 VTT
- 基于 `streamIndex` 写出临时 `.vtt`：`src/node/subtitles.ts:15–48` → `src/node/ffmpeg.ts:123–149`
- 解析并创建/挂载字幕轨：`src/files/temporaryVttFile.ts:48–96`

3) 外部字幕加载
- 验证与解析外部文件：`src/files/externalSubtitlesFile.ts:12–21, 22–86`
- `.ass/.srt` 转换与解析：`src/node/subtitles.ts:50–105, 127–160`

## 字幕显示与可见性
- 在 `<video>` 渲染 `<track>` 并使用本地服务器 URL：`src/components/Media.tsx:274–298`
- 同步 Redux `mode` 与 DOM `TextTrack.mode`：`src/components/Media.tsx:205–247`
- 显隐控制入口与 reducer：`src/components/SubtitlesMenu.tsx:469–478`、`src/reducers/subtitles.ts:18–34`
- 新建轨默认 `mode: 'hidden'`：`src/utils/newSubtitlesTrack.ts:1–9, 10–18`

## 波形与分割逻辑（片段 → 卡片）
- 将所有“已链接”的字幕轨 `chunks` 转为 `clipwave` 主片段集合：`src/selectors/cardPreview.ts:131–143`
- 基于时间重叠划分区域：`clipwave.calculateRegions` → `src/selectors/cardPreview.ts:160–168`
- 区域映射为卡片基础实体（及跨区域合并）：
  - 若与上一区域存在“显著重叠”（容忍 500ms），则并入上一卡片：`src/selectors/cardPreview.ts:191–215`
  - 阈值与判定：`HALF_SECOND=500`，`overlapsSignificantly`：`src/selectors/subtitles.ts:202–209`
  - 否则创建新卡片：`src/selectors/cardPreview.ts:233–265`
- 波形渲染（矩形与 clipPath）：`src/components/WaveformSubtitlesChunk.tsx:87–121`

### 单轨 vs 多轨合并差异
- 单轨：区域由该轨的 `chunk` 边界决定，短间隔更易形成新区域。
- 多轨：第二轨的 `chunk` 常跨越第一轨的短间隔，导致区域连续并触发“继续合并上一卡片”，多个句子被合并。

## 卡片文本与导出
- 文本聚合：依据 `SubtitlesCardBase.fields`，拼接各轨 `chunks[i].text`（换行）：`src/selectors/cardPreview.ts:106–115, 452–461`
- 导出到 Anki：打包 note 与资源，入口：`src/node/prepareExport.ts`（涉及 `@silvestre/mkanki`）
- 批量导出与生成：菜单触发与流程在 `src/components/SubtitlesMenu.tsx:152–166`

## 状态管理与副作用
- Redux 切片
  - 文件索引/可用性：`src/reducers/files.ts`
  - 字幕轨可见性：`src/reducers/subtitles.ts`
  - 卡片数据：`src/reducers/*`（多处）
- Epics
  - 媒体添加与打开：`src/epics/addMediaToProject.ts:6–26`
  - 字幕链接与加载：`src/epics/subtitles.ts`, `src/epics/subtitlesLinks.ts`
  - 键盘/播放控制：`src/epics/keyboard.ts`

## 本地服务与资源访问
- Koa 本地服务器提供文件 URL：在渲染层以 `fileByIdUrl` 使用：`src/components/Media.tsx:265–272`
- 资源可用性决定 `<track src>` 是否渲染：`src/components/Media.tsx:274–280`

## 设计取舍与已知行为
- 分割策略使用“所有已链接轨”的联合区间，第二轨可能桥接短间隔导致句子合并。
- 新建轨默认隐藏，需要通过菜单或快捷键显隐。
- 音频不显示 `<track>` 字幕（仅 `<video>`）。

## 前端工程师上手路线
- 构建与启动：`npm start`（Electron 主/预加载/渲染同时构建并启动）
- 关注目录：`src/components`、`src/selectors`、`src/epics`、`src/files`、`src/node`
- 典型流程：导入媒体 → 加载/链接字幕 → 波形选择 → 生成/编辑卡片 → 批量导出。

## 扩展建议（为新功能做准备）
- 分割策略可配置
  - 仅以“提示轨”（如 transcription）划分区域，避免多轨桥接合并。
  - 调整/暴露“显著重叠”阈值（500ms）为设置或导出选项。
- 链接与导出增强
  - 每卡片标注来源轨与预览，提升审校效率。
  - 导出模板化：自定义字段映射、分隔符与合并策略。
- 生产力与批量流程
  - 从字幕批量生成卡片向导：按句/按段/按停顿阈值。
  - 批量合并/拆分/忽略的队列操作。

