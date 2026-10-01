# R2modman 简体中文汉化报告（zh-cn localization report）

本报告记录 `r2modmanPlusChs` 分支 `feat/zh-cn-localization` 的汉化范围、方法、
可复现验证方式、硬编码英文的处置结果，以及**第二轮独立审计**的修订记录。

> 建议阅读顺序：先看 [§9 第二轮独立审计与修订记录](#9-第二轮独立审计与修订记录)，
> 它列出了哪些结论被推翻、哪些缺陷被修掉；§1–§8 是原始实现记录（已按第二轮结论更正）。

---

## 1. 上游同步

| 项目 | 值 |
| --- | --- |
| Fork | `hawchou1995/r2modmanPlusChs` |
| 上游 | `ebkr/r2modmanPlus` |
| 合并基点 | `a1897e3d`（= v3.2.20 + 7 个提交） |
| 合并提交 | `e0a36a07`（第二父提交即上游基点） |
| 合并方式 | `git merge --no-ff`，817 个文件变更，**无冲突** |
| 冲突数 | 0 |

第二轮核对：`git fetch upstream --prune --tags` 之后，`upstream/develop` 尖端**仍然是
`a1897e3d`**，也就是上游没有更新的提交可拉。Fork 的 `develop` 原先落后上游 206 个提交，
这 206 个提交正是这次合并补上的。

Fork 在合并前的全部差异，只有 `src/i18n/zh-cn/index.ts` 这一个**空文件**，以及上游 i18n
重构之前遗留的 `src/i18n/en-us/`、`src/i18n/index.ts` 旧骨架。上游已把扁平的 `en-us`
结构改成「类型契约 + 逐语言实现」的 `base` / `en` / `fr` 三件套，因此本次汉化是**从零建立**，
而非搬运旧译文。

上游历史未被重写：fork 原有提交 `fa2c1280`、`7bb94100`、`9c6b3b1f` 仍是 HEAD 的祖先。
（这三个提交是历史包袱，净效果只是一个空的 `zh-cn/index.ts` 占位；本分支已用真实语言包
取代它，无需改写已发布的历史。）

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

### 数量口径（三个数字不矛盾）

| 口径 | 数量 | 含义 |
| --- | --- | --- |
| 翻译键 | **687** | en 与 zh-cn 逐键一一对应的字符串键数 |
| 运行时字符串叶子 | **689** | 687 键 + 2 个 `metadata` 字段（`name`、`locale`） |
| 不含 `searchTerms` 的字符串叶子 | **601** | 见 §4.3 的计数口径说明 |

`searchTerms`（设置页搜索框的同义词列表）**不计入翻译单元**：它是各地语言各自的检索关键词，
内容与条数都允许不同。§4.2 / §4.3 的校验脚本已按此规则实现。

---

## 3. 语言切换入口与默认语言

> **更正（第二轮）**：本报告第一版在这里写「上游没有任何语言选择界面，`MessageFormat`
> 里的 `TODO - Use for language selection screens` 尚未实现」，这个判断是**错的**。
> 上游 `src/App.vue:12-33` 早就有语言选择器：右下活动栏的地球图标（`fa-globe-europe`）
> 通过 `ActivityDropdown` 枚举 vue-i18n 的 `availableLocales`，点击即调
> `LocaleManager.save(lang)`。上游真正缺的只是「设置页里的语言入口」。

因此本轮的实际改动是「注册语言包 + 补一个更易发现的入口」，而不是「从零造选择器」：

| 改动 | 文件 |
| --- | --- |
| 注册 `zh-cn` 语言包 + `datetimeFormats`（**仅此一步就会让上游地球图标自动列出简体中文**） | `src/i18n/index.ts` |
| 导出 `availableLocaleKeys`（供选择器枚举与排序） | `src/i18n/index.ts` |
| 新增设置页「语言」条目组件 | `src/components/settings-components/entries/Language.vue` |
| 挂载到设置页「外观」分区 | `src/components/settings-components/SettingsView.vue` |
| 新增 `language` 条目类型 | `src/i18n/base/pages/SettingsMessageFormat.ts` |
| 三语文案 | `src/i18n/{en,fr,zh-cn}/pages/SettingsTranslation.ts` |
| **全新安装默认简体中文** | `src/r2mm/manager/LocaleManager.ts`（`DEFAULT_LOCALE = 'zh-cn'`） |
| **全新安装默认简体中文** | `src/r2mm/manager/SettingsDexieStore.ts`（`locale: 'zh-cn'`） |

于是中文有**两个**入口：活动栏地球图标（上游原有）与设置页「外观 → 语言」（本次新增）。
两者都调用同一个 `LocaleManager.save()`，不存在状态分叉；`Language.vue` 的结构与既有的
`entries/Theme.vue` 完全一致（同样用 `<select class="select">`）。

默认语言策略（互不干扰的两条路径）：

- `locale` 未写入（全新安装）→ 使用 `DEFAULT_LOCALE = 'zh-cn'`
- `locale` 已写入但本版本不支持 → 使用 `FALLBACK_LOCALE = 'en'`

已经存有语言的用户**不会**被改写设置。`availableLocaleKeys = ['zh-cn', 'en', 'fr']`
同时决定设置项下拉的排序。

`Language.vue` 在第二轮做了一处归一化（见 §9 第 8 条）：库里存的是 `'en-us'`（i18n 重构
之前的旧值）或字段缺失时，`LocaleManager` 会回退到 `en`，但如果把原始值直接绑到
`<select>`，就没有任何 `<option>` 与之匹配、下拉框会显示空白。现在按同一套回退语义归一化。

---

## 4. 验证方式

### 4.1 零依赖脚本（可直接 node 运行，不需要 `node_modules`）

```bash
node scripts/verify-i18n-completeness.mjs   # 静态结构完备性
node scripts/runtime-i18n-smoke.mjs         # 运行时求值与解析
node scripts/scan-hardcoded-english.mjs     # 硬编码英文扫描
node scripts/i18n-length-report.mjs         # 文案长度 / 溢出风险
```

第二轮把前两个断言脚本接进了 `package.json`，一条命令即可回归：

```bash
pnpm verify:i18n   # = verify-i18n-completeness && runtime-i18n-smoke
```

### 4.2 `verify-i18n-completeness.mjs` —— 通过 ✅

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

**规则性豁免（第二轮修正）**：`searchTerms` 的**索引路径**不参与严格键比对，改为
「每组检索词的数量不得少于英文」的规则。理由：检索词是本地化同义词，中文列表天然会
比英文多几项（例如中文侧有「语言 / 界面语言 / 翻译」，英文侧有 `Language / Locale /
Translation`）；按位置逐项比对会把正确的中文列表判成「多余键」。列表被**缩短**仍会报错。

### 4.3 `runtime-i18n-smoke.mjs` —— 通过 ✅（8/8）

这个脚本用 JS 引擎**真实求值**每个翻译模块的对象字面量，再按 `src/i18n/index.ts` 的接线
方式组装成完整消息树并从树里解析键。它能抓到纯文本检查抓不到的问题（非法字面量、重复键
覆盖、转义错误、链接目标不可解析）：

```text
✅ 两个语言包均被 JS 引擎成功求值 — en=601 个字符串节点，zh=601 个
✅ metadata 正确 — locale=zh-CN，Intl 可用，8 月显示为「八月」
✅ 全部 15 个翻译分区都存在且非空 — 15 个分区全部就绪
✅ 每个分区的代表键都能解析出中文（无英文回退） — 15 个代表键全部命中中文文案
✅ 插值占位符可被真实替换 — 4 处占位符插值正常
✅ 复数分支可被 vue-i18n 式选择 — 单数「有 1 个模组已停用。」/ 复数「有 5 个模组已停用。」
✅ 链接消息 (@:) 目标可解析 — @:translations.pages.manager.navigation.modsActions.online → 「在线」
✅ 语言切换入口与默认语言接线正确 — registry / 默认语言 / 设置项 / 三语文案 全部就位
```

计数口径：**601** = 689 个字符串叶子 − `searchTerms` 的 88 项（21 组 × 4 项，取自英文侧）。
`searchTerms` 被排除的理由与 §4.2 相同（各地语言的关键词条数可以不同）；该计数按
**不重复项名**逐语言比较，仍要求两侧一致。

### 4.4 vitest 用例

`test/vitest/tests/unit/i18n/ZhCnLocalization.spec.ts`（25 个用例）通过**真实的 vue-i18n
实例**（`src/i18n/instance.ts`）验证：语言注册与可选性、`Intl` 区域合法性、15 个分区的代表
键解析、不回落英文、占位符插值、复数的**分支选择**、链接消息解析、语言来回切换、选择器可选
语言名，以及（第二轮新增的）**中英消息树逐路径一致**。

最后这条补齐了一个真实覆盖缺口：`MessageFormat` 类型契约能挡住「漏键」，但挡不住嵌套对象里
的键被改名/删除后静默回落英文；而第一轮的规格只抽查了 15 个代表键，全量键集合比对只存在于
那个**没有接进 CI** 的零依赖脚本里。现在 `pnpm test` 自己就能全量比对。

### 4.5 类型检查与全量测试（第二轮首度执行）

上游 CI 的测试任务在跑测试前会先 `npx @quasar/cli prepare` 生成 `.quasar/`（`tsconfig.json`
继承它，缺了它 `vue-tsc` / vite 会报上百条与项目无关的 `--target` / `paths` 错误），测试前还会
执行 `node test/folder-structure-testing/populator.mjs` 生成安装器用例所需夹具。按顺序执行后：

```text
$ npx @quasar/cli prepare           # 生成 .quasar/tsconfig.json
$ pnpm typecheck                    # vue-tsc --noEmit
  → exit 0（无任何错误）

$ node test/folder-structure-testing/populator.mjs && pnpm test
  → Test Files  41 passed (41)
  → Tests       233 passed (233)
     ✓ test/vitest/tests/unit/i18n/ZhCnLocalization.spec.ts (25 tests)
```

这两项在第一轮**无法执行**（见 §7），是本轮才闭合的验收标准。

---

## 5. 硬编码英文清扫结果

`scan-hardcoded-english.mjs` 扫描 `src/` 与 `src-electron/` 共 **358 个文件**：

| 类别 | 含义 | 命中 | 处置 |
| --- | --- | --- | --- |
| `UI-TEXT` | 模板里的字面文本节点 | 7 | 全部为白名单项（见下） |
| `UI-ATTR` | 用户可见属性（placeholder/title/label/alt） | 0 | — |
| `UI-API` | `new R2Error(...)` 诊断类错误串 | 74 | **见 §6.1** |
| `DEV-LOG` | `console.*` 开发者输出 | 33 | 非用户可见，不译 |
| **未处理界面英文** | | **0** | — |

结论：**界面骨架文案（按钮、标签、标题、占位符）已无硬编码英文**。上游那次 i18n 重构已经
把绝大部分界面文案抽走了，剩下的确实是边角。

> **诚实声明（第二轮补充）**：`未处理界面英文 = 0` 是**按该扫描器自己的口径**成立的。第二轮
> 独立排查发现它有 5 处结构性盲区：只认 `new R2Error(`（不认 `R2Error.fromThrownValue(e, '…')`）、
> 只匹配双引号且限定 6 个属性名、只取纯文本节点、`SKIP_DIRS` 跳过 `assets`、以及一条
> `^[\w-]+\s*[\w-]*$` 白名单会静默放行任意 1–2 个英文词。因此 §6.2 用独立手段（沿错误通道
> 反向追到 `ErrorModal` 的渲染点）列出了它漏掉的那批。

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
代码标识符、CSS 类名 —— 均按契约边界保持原样。

---

## 6. 边界与未完成项（诚实披露）

### 6.1 74 条 `R2Error` 诊断错误串仍未本地化（唯一实质缺口）

这 74 条会显示在红色错误弹窗里（如 `Unable to resolve the ${game.displayName} install
folder`、`Failed to export profile`）。它们**确实对用户可见**——错误弹窗的标题、按钮、
说明都已汉化（`translations.modals.error.*`），唯独弹窗正文仍是英文。本次**没有**本地化：

1. `R2Error` 的 name / message / solution 完全不在 i18n 消息树里，改造需要**新增一个消息
   分区**（`base` + `en` + `fr` + `zh-cn` 四件套 × 约 74 键），并把所有调用点改成走 i18n；
2. 调用点分散在 `installers` / `providers` / `resolvers` / `store` 等**核心逻辑层**，
   其中不少是 `R2Error.fromThrownValue(e, '…')` 形式，含模板插值（`${game.displayName}`），
   需要逐条转成 `{placeholder}`；
3. 上游对所有语言都是同一个边界：CHANGELOG 3.2.20 明确写着 *"The only exception currently
   are error message translations, which are still in English."*——法文也一样。在此处单方面
   分叉，会让这个 fork 与上游的 i18n 重构越走越远，后续合并成本显著上升；
4. 错误正文也常被用户复制粘贴去检索报错，保留英文对排障反而有利。

所有 74 条已由扫描器逐条落盘在 `docs/zh-cn-hardcoded-scan.json`，可审计、可接续。
第二轮已能完整跑类型检查与测试（§4.5），所以这不再受"无法验证"限制——它现在是一个
**明确的决策**，而不是阻塞项。需要的话可以另起一轮按 `translations.errors.*` 分区实现。

### 6.2 少量非 i18n 来源的界面英文（第二轮新增，逐条清单）

这些既不在消息树里、也没被扫描器抓到，全部需要**新增键 × 3 种语言**才能翻译，因此本轮
只登记不动手（新增键会同时要求补法文，属于跨出汉化范围的改动）：

| 位置 | 文案 | 说明 |
| --- | --- | --- |
| `src/router/routes.ts:10,15` | `Games`、`Profiles` | 面包屑，经 `BreadcrumbNavigator.vue:18,21` 原样渲染 |
| `src/components/OnlineRowCard.vue:8,9` | `alt='Mod Logo'` | 图片替代文本（加载失败时可见） |
| `src/components/views/LocalModList/LocalModCard.vue:207` | `This package can no longer be found on Thunderstore` | 悬停提示（`v-tooltip`） |
| `LocalFileImportModal.vue:148,175,188,252`、`src/model/ManifestV2.ts:44` | `Unknown` | 表单与卡片默认值 |
| `GameDirectory.vue:100`、`SteamDirectory.vue:86`、`ImportProfileModal.vue:114` | `gamelaunchhelper`、`steam`、`*` | 原生文件对话框的「文件类型」下拉名 |
| `src/pages/Help.vue:114` | `<i>old_uninstaller</i>` | **上游遗留缺陷**：消息槽期望旧安装程序的真实文件名，英文界面同样显示这个字面量 |
| `ProfilesModule.ts:20` 等 | `Default` | 默认配置档名；同时是磁盘目录名，翻译需要映射，风险最高 |
| `ProfileModule.ts:356` 附近 | `App:` / `Game:` / `Steam path:` … | 「复制排障信息」的标签，用户会粘贴给别人看 |

### 6.3 Quasar 内置语言包未跟随界面语言（有意不改）

`quasar.config.ts` 仍是 `framework.lang: 'en-US'`。评估结论是**改了也没有可见影响，且静态改成
`'zh-CN'` 反而是错的**：

- 全仓库只用到 `<q-btn>` 一个 Quasar 组件（原文全量 grep：`<q-[a-z-]+` 的唯一命中），
  没有 `q-table` / `q-date` / `q-time` / `q-pagination` / `q-uploader` 等带内置文案的组件；
- `q-btn` 自身不含任何内置文字，也没有任何地方调用 `Quasar.Lang.set()`，所以语言包
  影响不到任何用户可见文案；
- 若静态改成 `'zh-CN'`，用户切到 English/Français 时 Quasar 侧仍是中文——为 0 收益引入
  一个错误状态。真要跟随就应在 `LocaleManager` 里动态 `Lang.set()`，但那同样只有 0 可见收益。

结论：保持上游值，并在本报告备案理由。

---

## 7. 环境说明（历史，已解除）

第一轮工作发生在 `D:\Documents\PI\娱乐\r2modmanPlusChs`，那里 `pnpm install` 稳定失败于
`[ERR_PNPM_EPERM] … esbuild … EPERM: operation not permitted, rename`，位于最后的
hoist/link 阶段（包已全部下载进 store）。因此第一轮**无法**执行 `pnpm typecheck` 与
`pnpm test`，只能靠四个零依赖脚本自证——这也是第一轮规格里那条错误断言（§9 第 1 条）
得以留存的原因。

第二轮在 `C:\Users\11374\Documents\PID\r2modmanPlusChs` 执行，`corepack pnpm install
--frozen-lockfile` **32 秒完成、exit 0**（`node v24.19.0` + `pnpm 11.8.0`），于是
`vue-tsc` 与 vitest 全部跑通（§4.5）。第一轮报告里「无法验证」的保留意见随之作废。

---

## 8. 复现命令

```bash
# 合并上游（当前上游尖端 = a1897e3d，已合并）
git fetch upstream develop && git merge upstream/develop --no-ff

# 汉化完备性（零依赖，静态 + 运行时求值）
pnpm verify:i18n                    # 期望 exit 0
# 等价于：
node scripts/verify-i18n-completeness.mjs      # 期望 exit 0
node scripts/runtime-i18n-smoke.mjs            # 期望 exit 0

# 硬编码英文 / 文案长度
node scripts/scan-hardcoded-english.mjs        # 期望 exit 0
node scripts/scan-hardcoded-english.mjs --json # 产出 docs/zh-cn-hardcoded-scan.json
node scripts/i18n-length-report.mjs --json     # 产出 docs/zh-cn-length-report.json

# 类型与测试（需要依赖；顺序不能颠倒）
corepack pnpm install --frozen-lockfile
npx @quasar/cli prepare                        # 生成 .quasar/tsconfig.json
pnpm typecheck                                 # 期望 exit 0
node test/folder-structure-testing/populator.mjs && pnpm test   # 期望 233 passed
```

---

## 9. 第二轮独立审计与修订记录

**方法**：不采信第一轮的自证脚本，另起两路只读审计（一路逐行通读 15 个 zh-cn 模块并与
en 逐键对照；一路沿 `error/handleError` → `ErrorModal` 反向追查不经过 i18n 的界面文案），
再加上我自己对 `LocaleManager` / `SettingsDexieStore` / `App.vue` / `Language.vue` /
`quasar.config.ts` 的接线核对，最后用真实工具链（§4.5）验证。

键集合 687 / 687、占位符、复数分支、`@:` 链接、注册表接线**均无缺陷**——这部分第一轮的
工作是对的。下面是被修掉的缺陷：

| # | 缺陷 | 位置 | 处置 |
| --- | --- | --- | --- |
| 1 | 断言基于错误假设：`tm()` 返回的不是「分支数组」，`branches.length === 2` 恒为 1 | `ZhCnLocalization.spec.ts` | 改为断言**两个分支的实际输出**（`有 1 个…` / `有 5 个…`） |
| 2 | `t(key, 5, {count: 5})` 不符合 vue-i18n 重载，`vue-tsc` 报 `TS2769` | 同上 | 改为 `t(key, {count: n}, n)` |
| 3 | 覆盖缺口：规格只抽查 15 个代表键，全量键比对不在 CI 路径上 | 同上 | 新增 `zh-cn mirrors the English message tree path for path`（`leafPaths` 全量逐路径比对） |
| 4 | 译文不成句：`出于设计如此，通过 Steam 启动游戏时会是原版…` | `zh-cn/pages/HelpTranslation.ts:44` | 改写为「这是有意为之：…会以原版（未装模组）状态运行。」 |
| 5 | 译文冗余且英文原意是两个不同现象：`装了模组之后游戏变卡 / 卡顿？`（en: `Slow game with mods / stuttering?`） | `HelpTranslation.ts:24` | 改写为「装了模组后游戏变慢或卡顿？」 |
| 6 | 译文生硬 + 术语离群：`选择游戏的选项会被禁用。`（其余 21 处统一用「停用」） | `zh-cn/pages/GameSelectionTranslation.ts:16` | 改写为「在相关工作完成之前，无法选择游戏。」 |
| 7 | 检索词丢项：丢了 en 的 `Translation`，且**没有任何中文关键词**「翻译」 | `zh-cn/pages/SettingsTranslation.ts` | 补齐 `Translation` 并新增「翻译」，重排为中文在前 |
| 8 | 设置项下拉可能空白：库里存 i18n 重构前的 `'en-us'`（或字段缺失）时，`<select>` 无匹配项 | `Language.vue` | 按 `LocaleManager` 的回退语义归一化（不支持的值显示实际生效的语言） |
| 9 | 校验脚本把本地化同义词列表当翻译单元：多 2 个检索词就被判「多余键」/「叶子数不等」 | `scripts/verify-i18n-completeness.mjs`、`scripts/runtime-i18n-smoke.mjs` | 对 `searchTerms` 路径改为「每组数量不得少于英文」，列表被缩短仍报错 |
| 10 | 四个校验脚本没有任何可执行入口，实际只能靠人记得手敲 | `package.json` | 新增 `pnpm verify:i18n` |
| 11 | 文档错误：声称上游没有语言选择界面 | 本报告 §3（第一版） | 已更正（见 §3） |
| 12 | 文档过期：§6.2 / §7 的「无法类型检查 / 测试」 | 本报告（第一版） | 已闭合（见 §4.5、§7） |

**复核后判定「不需要改」的**：

- `translations.modals.associatedMods.dependencies/dependants` 用「依赖项 / 被依赖项」，
  与正文多数处的「依赖」在词形上不同——但作为**成对出现的分组标题**更清楚，属风格差异非缺陷；
- `CategoryFilterModal.vue` 的 `locale !== 'en'` 提示：上游设计如此（说明分类名来自
  Thunderstore、仍是英文），对 zh-cn 是正确行为；
- Quasar `framework.lang`：见 §6.3；
- §6.2 那批需要新增三语键的字符串：超出「汉化」范围，登记待办。

**结论**：`feat/zh-cn-localization` 上的 zh-cn 语言包在「界面文案」这一层是完整的，并且
现在同时受四层零依赖脚本、25 条 vitest 用例、`vue-tsc` 严格类型检查与全量 233 条测试保护。
唯一已知的界面英文缺口是错误弹窗正文（§6.1）与 §6.2 那批边缘字符串。

---

## 10. 术语与决策记录

- 术语表：[`GLOSSARY.md`](../GLOSSARY.md)（`locale` 键 / `locale` 标签 / 默认语言 / 回退语言 /
  翻译分区 / 检索词 / 配置档 / 模组…）
- 决策记录：[`docs/adr/0001-fork-defaults-to-simplified-chinese.md`](./adr/0001-fork-defaults-to-simplified-chinese.md)
  （为什么这个 fork 把默认语言定为简体中文，以及为什么版本号与上游保持一致）
- 第一轮自审记录：[`docs/zh-cn-code-review.md`](./zh-cn-code-review.md)（其结论以本文件 §9 为准）
