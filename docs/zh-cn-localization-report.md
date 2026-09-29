# R2modman 简体中文汉化报告（zh-cn localization report）

本报告记录 `r2modmanPlusChs` 分支 `feat/zh-cn-localization` 的汉化范围、方法、
可复现验证方式，以及硬编码英文的逐条处置结果。

---

## 1. 上游同步

| 项目 | 值 |
| --- | --- |
| Fork | `hawchou1995/r2modmanPlusChs` |
| 合并基点 | `ebkr/r2modmanPlus@a1897e3d6f7c1946dc51312252db1cc25f1dace0`（= v3.2.20 + 7 个提交） |
| 合并提交 | `e0a36a07`（第二父提交即上游基点） |
| 合并方式 | `git merge --no-ff`，817 个文件变更，**无冲突** |
| 冲突数 | 0 |

Fork 在此之前的全部差异只有 `src/i18n/zh-cn/index.ts` 一个 **1 字节空文件**，
因此上游的 i18n 重构（扁平 `en-us` → 强类型 `base` / `en` / `fr` 三件套）可以
干净落地，本次汉化是**从零建立**，而非搬运旧译文。

上游历史未被重写：fork 原有提交 `fa2c1280`、`7bb94100`、`9c6b3b1f` 仍是 HEAD 的祖先。

---

## 2. 语言包结构

上游 i18n 采用「类型契约 + 逐语言实现」架构：

- `src/i18n/base/**` —— 15 个 `*MessageFormat` 类型，定义**必须**提供哪些字符串
- `src/i18n/en/**` —— 英文参考实现
- `src/i18n/fr/**` —— 法文实现（上游已有）
- `src/i18n/zh-cn/**` —— **本次新增**

新增文件（15 个翻译模块 + 1 个注册表）：

| # | 文件 | 对应消息前缀 |
| --- | --- | --- |
| 1 | `banners/BannerTranslation.ts` | `translations.banners` |
| 2 | `enums/EnumTranslation.ts` | `translations.enums` |
| 3 | `modals/ModalTranslation.ts` | `translations.modals` |
| 4 | `modListStatus/ModListStatusTranslation.ts` | `translations.modListStatus` |
| 5 | `platforms/PlatformTranslation.ts` | `translations.platforms` |
| 6 | `pages/ConfigEditorTranslation.ts` | `translations.pages.configEditor` |
| 7 | `pages/DownloadMonitorTranslation.ts` | `translations.pages.downloadMonitor` |
| 8 | `pages/Error404Translation.ts` | `translations.pages.error404` |
| 9 | `pages/GameSelectionTranslation.ts` | `translations.pages.gameSelection` |
| 10 | `pages/HelpTranslation.ts` | `translations.pages.help` |
| 11 | `pages/LinuxSetupTranslation.ts` | `translations.pages.linuxSetup` |
| 12 | `pages/ManagerTranslation.ts` | `translations.pages.manager` |
| 13 | `pages/ProfileSelectionTranslation.ts` | `translations.pages.profileSelection` |
| 14 | `pages/SettingsTranslation.ts` | `translations.pages.settings` |
| 15 | `pages/SplashTranslation.ts` | `translations.pages.splash` |
| — | `index.ts` | 语言注册表 |

> 说明：立项契约里写的「13 个翻译分区」是对上游枚举的笔误，实际上游为
> 10 个 pages 分区 + 5 个非 pages 分区 = **15 个分区 / 15 个翻译文件**。本次按 15 个实施。

`zh-cn/index.ts` 采用了与 `en/index.ts` 完全相同的**编译期强制校验**写法：

```ts
const message: MessageFormat = { ... };
```

只要漏掉任何一个必需的字符串键，`vue-tsc` 就会报错——这把「是否译全」从人工检查
变成了类型系统约束。

---

## 3. 语言切换入口与默认语言

上游 `MessageFormat` 里长期挂着 `TODO - Use for language selection screens`，
即**没有**任何语言选择界面。本次补齐：

| 改动 | 文件 |
| --- | --- |
| 注册 `zh-cn` 语言包 + `datetimeFormats` | `src/i18n/index.ts` |
| 导出 `availableLocaleKeys`（供选择器枚举） | `src/i18n/index.ts` |
| 新增「语言」设置项组件 | `src/components/settings-components/entries/Language.vue` |
| 挂载到设置页「外观」分区 | `src/components/settings-components/SettingsView.vue` |
| 新增 `language` 条目类型 | `src/i18n/base/pages/SettingsMessageFormat.ts` |
| 三语文案 | `src/i18n/{en,fr,zh-cn}/pages/SettingsTranslation.ts` |
| **全新安装默认简体中文** | `src/r2mm/manager/LocaleManager.ts`（`DEFAULT_LOCALE = 'zh-cn'`） |
| **全新安装默认简体中文** | `src/r2mm/manager/SettingsDexieStore.ts`（`locale: 'zh-cn'`） |

默认语言策略（互不干扰的两条路径）：

- `locale` 未写入（全新安装）→ 使用 `DEFAULT_LOCALE = 'zh-cn'`
- `locale` 已写入但不受支持 → 使用 `FALLBACK_LOCALE = 'en'`

已经存有语言的用户**不会**被改写设置，仍保持其原选项。英文用户可在设置页
「语言」中切回 English。

---

## 4. 验证方式（全部可复现、零依赖）

四个脚本均**不依赖 `node_modules`**，直接解析/求值源码，因此在未安装依赖的
环境里也能跑：

```bash
node scripts/verify-i18n-completeness.mjs   # 静态结构完备性
node scripts/runtime-i18n-smoke.mjs         # 运行时求值与解析
node scripts/scan-hardcoded-english.mjs     # 硬编码英文扫描
node scripts/i18n-length-report.mjs         # 文案长度 / 溢出风险
```

### 4.1 `verify-i18n-completeness.mjs` —— 通过 ✅

```text
翻译文件数      : 15 (+ index.ts)
英文键总数      : 687
中文键总数      : 687
已逐值校验数量  : 687
白名单命中数量  : 12
结果：通过 ✅  键集合一致、占位符/复数/链接一致、无英文残留。
```

逐条断言：

1. en 与 zh-cn 的**键路径集合完全相同**（缺失 0、多余 0）
2. **逐个复数分支**比对插值占位符集合（`a | b` 形式不能少分支）
3. 复数分隔符 `|` 分支数量一致
4. 链接消息 `@:` 目标一致
5. 白名单外，中文值不得与英文逐字相同
6. 白名单外，中文值必须含 CJK 字符（可检出英文残留）
7. zh-cn 注册表与 en 注册表逐模块一致；顶层注册表已暴露 `zh-cn`

### 4.2 `runtime-i18n-smoke.mjs` —— 通过 ✅（8/8）

这个脚本用 JS 引擎**真实求值**每个翻译模块的对象字面量，再按
`src/i18n/index.ts` 的接线方式组装成完整消息树并从树里解析键。
它能抓到纯文本检查抓不到的问题（非法字面量、重复键覆盖、转义错误、链接目标不可解析）：

```text
✅ 两个语言包均被 JS 引擎成功求值 — en=689 个字符串节点，zh=689 个
✅ metadata 正确 — locale=zh-CN，Intl 可用，8 月显示为「八月」
✅ 全部 15 个翻译分区都存在且非空 — 15 个分区全部就绪
✅ 每个分区的代表键都能解析出中文（无英文回退） — 15 个代表键全部命中中文文案
✅ 插值占位符可被真实替换 — 4 处占位符插值正常
✅ 复数分支可被 vue-i18n 式选择 — 单数「有 1 个模组已停用。」/ 复数「有 5 个模组已停用。」
✅ 链接消息 (@:) 目标可解析 — @:translations.pages.manager.navigation.modsActions.online → 「在线」
✅ 语言切换入口与默认语言接线正确 — registry / 默认语言 / 设置项 / 三语文案 全部就位
```

> 689 = 687 个翻译键 + 2 个 metadata 字段（`name`、`locale`），与上面的 687 个键并不矛盾。

### 4.3 vitest 用例

新增 `test/vitest/tests/unit/i18n/ZhCnLocalization.spec.ts`，通过**真实的
vue-i18n 实例**（`src/i18n/instance.ts`）验证：语言注册与可选性、`Intl` 区域合法性、
15 个分区的代表键解析、**不回落英文**、占位符插值、复数分支、链接消息解析、
语言来回切换，以及选择器可选语言名。

---

## 5. 硬编码英文清扫结果

`scan-hardcoded-english.mjs` 扫描 `src/` 与 `src-electron/` 共 **358 个文件**：

| 类别 | 含义 | 命中 | 处置 |
| --- | --- | --- | --- |
| `UI-TEXT` | 模板里的字面文本节点 | 7 | 全部为白名单项（见下） |
| `UI-ATTR` | 用户可见属性（placeholder/title/label/alt） | 0 | — |
| `UI-API` | `new R2Error(...)` 诊断类错误串 | 74 | **见 §6 未完成项** |
| `DEV-LOG` | `console.*` 开发者输出 | 33 | 非用户可见，不译（契约边界：日志/调试输出不译） |
| **未处理界面英文** | | **0** | — |

结论：**界面骨架文案（按钮、标签、标题、占位符）已无硬编码英文**。
上游那次 i18n 重构已经把绝大部分界面文案抽走了，剩下的确实是边角。

### 白名单项（逐条列出，共 7 条扫描器级 + 12 条翻译级）

扫描器白名单（`scan-hardcoded-english.mjs` 的 `ALLOWLIST`）：

| 命中 | 位置 | 理由 |
| --- | --- | --- |
| `&nbsp;` ×6 | `MultiSelect.vue`、`CategorySelectorModal.vue`、`LocalModList.vue`、`OnlineModView.vue` ×3 | HTML 实体，非英文文案 |
| （其余 1 条） | — | 单标识符/属性值，非界面文案 |

翻译级白名单（`verify-i18n-completeness.mjs` 的 `VALUE_WHITELIST`，12 条，脚本逐条打印）：

| 键 | 保留原文的理由 |
| --- | --- |
| `translations.platforms.STEAM` | 品牌名 Steam |
| `translations.platforms.STEAM_DIRECT` | 品牌名 Steam |
| `translations.platforms.ORIGIN` | 平台品牌名 Origin / EA App |
| `translations.platforms.XBOX_GAME_PASS` | 平台品牌名 Xbox Game Pass |
| `translations.enums.launchType.PROTON` | 兼容层专有名词 Proton |
| `...splash.content.about.techStack.electron` | 技术栈专有名称 |
| `...splash.content.about.techStack.node` | 技术栈专有名称 |
| `...splash.content.about.techStack.vue` | 技术栈专有名称 |
| `...splash.content.about.techStack.typescript` | 技术栈专有名称 |
| `...manager.online.previewPanel.tabs.readme` | README 为通用文档名 |
| `...manager.online.previewPanel.tabs.changelog` | CHANGELOG 为通用文档名 |
| `translations.modals.dependencyStrings.dependency` | `{modName}-{versionNumber}` 格式模板，须与 Thunderstore 规范一致 |

另有一类规则性豁免：**`searchTerms` 检索关键词数组**允许保留英文专有名词
（如 `LogOutput`、`Discord`、`Proton`），以便中英双语检索都能命中。每条数组
都至少含一项中文关键词。

### 属于外部数据、按契约不译

Thunderstore 模组名/描述/版本号、游戏名、文件路径、`console.*` 日志、
代码标识符、CSS 类名 —— 均按立项契约边界保持原样。

---

## 6. 未完成项（诚实披露）

### 6.1 74 条 `R2Error` 诊断错误串未本地化

这 74 条会显示在红色错误弹窗里（如 `Unable to resolve the ${game.displayName}
install folder`、`Failed to export profile`）。它们**确实对用户可见**，
本次**没有**本地化，理由：

1. 改造范围大：需要新增约 74 个 i18n 键 × 4 处（base/en/fr/zh-cn），并把
   `new R2Error("...")` 的 **74 个调用点**改成走 i18n；这些调用点分散在
   installers / providers / resolvers 等核心逻辑里。
2. 含模板插值（`${game.displayName}`、`${modName}`），需要逐一转成
   `{placeholder}` 形式。
3. **无法验证**：本机 `pnpm install` 被沙箱拦截（详见 §7），`vue-tsc` 与
   vitest 都跑不起来。在完全无法类型检查/跑测试的前提下改 74 处核心逻辑，
   对一个需要与上游保持可合并性的 fork 来说回归风险过高。

所有 74 条已由扫描器逐条落盘在 `docs/zh-cn-hardcoded-scan.json` 中，可审计、可接续。

### 6.2 未执行 `pnpm typecheck` / `pnpm test`

见 §7。这直接导致立项契约中第 3、4 条验收标准无法用规定命令闭合。

---

## 7. 环境阻塞：`pnpm install` 无法完成

本机安装依赖稳定失败于同一个点：

```text
[ERR_PNPM_EPERM] [importPackage D:\Documents\PI\娱乐\r2modmanPlusChs\node_modules\.pnpm\esbuild@0.27.4\node_modules\esbuild]
EPERM: operation not permitted, rename
  '...\node_modules\.pnpm\esbuild@0.27.4\node_modules\esbuild_tmp_66688_17'
  -> '...\node_modules\.pnpm\esbuild@0.27.4\node_modules\esbuild'
```

已尝试并全部失败的方案：

| # | 方案 | 结果 |
| --- | --- | --- |
| 1 | `pnpm install --frozen-lockfile`（后台） | 卡在 `added 765` 后被终止 |
| 2 | 同上，前台 | 40 分钟超时未完成 |
| 3 | 删除 `node_modules` 后重装 | 到达 998/1005 后 `ERR_PNPM_EPERM` |
| 4 | `pnpm install --ignore-scripts` | 同样卡住 |
| 5 | 重试（利用已填充的 store，`reused 1005`） | 同样卡住 |

结论：这是**沙箱/文件系统层面拒绝对 `node_modules` 内该路径做 rename**，
不是项目配置问题；包本身已全部下载进 `D:\\.pnpm-store\\v11`（1005 个包），
失败点纯粹在最后的 hoist/link 阶段。

**因此下列验收项无法闭合**（已在最终交付说明中逐条标注）：
`pnpm typecheck`、`pnpm test`、以及需要 GUI 的实机截图验证。

作为补偿，本次用四个零依赖脚本完成了**结构完备性 + 运行时求值 + 硬编码扫描 +
长度风险**四层验证，覆盖面覆盖了「汉化是否完整」这一核心命题。

---

## 8. 复现命令

```bash
# 合并上游
git fetch upstream develop && git merge upstream/develop --no-ff

# 汉化完备性（静态）
node scripts/verify-i18n-completeness.mjs      # 期望 exit 0

# 汉化完备性（运行时求值）
node scripts/runtime-i18n-smoke.mjs            # 期望 exit 0

# 硬编码英文
node scripts/scan-hardcoded-english.mjs        # 期望 exit 0
node scripts/scan-hardcoded-english.mjs --json # 产出 docs/zh-cn-hardcoded-scan.json

# 文案长度 / 溢出风险
node scripts/i18n-length-report.mjs --json     # 产出 docs/zh-cn-length-report.json

# 依赖装好之后（当前环境被阻塞）
pnpm typecheck
pnpm test
```
