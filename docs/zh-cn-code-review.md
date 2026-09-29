# R2modman 简体中文汉化 —— 代码审查报告（code review）

审查对象：`r2modmanPlusChs` 分支 `feat/zh-cn-localization`
审查范围：上游合并正确性、zh-cn 语言包、语言切换入口、验证脚本与文档
审查方式：静态阅读 + 四个零依赖脚本的实际执行输出 + 键集合三方比对（en / fr / zh-cn）

---

## 1. 合并正确性与冲突解决审查

### 1.1 合并事实

| 项目 | 结论 |
| --- | --- |
| 合并基点 | `ebkr/r2modmanPlus@a1897e3d`（v3.2.20 + 7 提交） |
| 合并提交 | `e0a36a07`，父提交 = `9c6b3b1f`（fork tip） + `a1897e3d`（上游） |
| 冲突 | **0 个**，`ort` 策略自动完成 |
| 变更规模 | 817 files changed, +51010 / -22260 |

### 1.2 为什么没有冲突

Fork 与上游的合并基点 `d0dc891a` 之后，fork 侧的**全部**改动只有 1 行：

```text
$ git diff --stat d0dc891a..HEAD
 src/i18n/zh-cn/index.ts | 1 +
 1 file changed, 1 insertion(+)
```

而这 1 行是一个 **1 字节空文件**（`Create index.ts` → `Delete src/i18n/zh-cn` →
`Create zh-cn` 三次提交的净结果）。上游虽然把 i18n 目录整体重构
（删除 `en-us/`，新增 `base/` + `en/` + `fr/`），但从未触碰 `zh-cn/` 路径，
因此两边的改动集合**不相交**，结构上不可能冲突。

### 1.3 历史完整性与内容审查

- 上游未被 rebase 掉：`git merge-base --is-ancestor a1897e3d HEAD` → exit 0。
- Fork 原有提交未丢：`fa2c1280`、`7bb94100`、`9c6b3b1f` 均仍是 HEAD 祖先。
- 合并后 `src/i18n/{base,en,fr}`、`LocaleManager.ts`、`i18n/instance.ts` 全部存在。
- `src/i18n/en-us/**` 已按上游意图删除，无残留。

**审查结论：合并正确，无可疑的冲突解决动作（因为压根没有冲突）。**

### 1.4 合并引入的行为变化（须知悉）

上游这 8 个月的重构把 `LocalModList`、`SettingsView`、`GameSelectionScreen`
等组件都重写过，并新增了 `ecosystem.json` 校验、`EcosystemUpdateModule`、
`GameImageProviderImpl` 等。这些是上游自身的功能演进，本次**未做任何改动**，
符合「不改动与汉化无关的上游行为」的契约边界。

---

## 2. 术语一致性与译文质量

### 2.1 术语表（已按立项确认口径固定）

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Mod | 模组 | 全局统一 |
| Profile | **配置档** | 与「配置文件」刻意区分 |
| Package | 模组包 | |
| Dependency | 依赖 | |
| Modpack | 整合包 | |
| Config | 模组配置 | |
| Mod Loader | 模组加载器 | |
| r2modman / Thunderstore / Steam / Proton | 保留原文 | 品牌与专有名词 |

**关键歧义处理**：英文里 `Profile`（安装档案）和 `config file`（模组配置文件）
在中文语境下极易都被译成「配置」，造成用户混淆。本次严格分离：

- `Profile` → **配置档**（`导出配置档`、`配置档文件夹`、`更新已有配置档`）
- `config file` / `configuration file` → **模组配置文件**（`模组配置编辑器`、`搜索模组配置文件`）

同一概念在所有 687 个键中保持一致；`verify-i18n-completeness.mjs` 的键集合
比对间接保证了不会出现某处漏改。

### 2.2 标点与排版规范

| 规范 | 做法 | 示例 |
| --- | --- | --- |
| 句末标点 | 用中文全角句号/冒号 | `请选择要导入的 zip 或 DLL 文件。` |
| 界面内联引用 | 用中文直角引号「」 | `点击「启动模组模式」` |
| 变量插值处引号 | 用中文弯引号 “ ” | `“{profileName}” 是有效的配置档名称` |
| 中英混排 | 拉丁词两侧加半角空格 | `使用 {appName} 时你必须…`、`包含 manifest 文件` |
| 省略号 | 中文单字符省略号 | `正在刷新……` |
| 括号 | 中文全角括号 | `NSFW（可能含有成人内容）`、`已启用（推荐）` |

### 2.3 断行与模板字面量

上游对多行文案使用模板字面量（反引号 + 真实换行）。中文侧**保留了同构的换行结构**，
因为：

1. 这些字符串渲染进 `<p>` 后由 CSS 决定折行，保留换行不会破坏排版；
2. 结构同构让「英文改了、中文跟着改」的 diff 更可读，利于与上游长期同步；
3. 避免了「中文压成一行、英文是多行」这种后续维护上的隐性差异。

### 2.4 检索关键词（searchTerms）的处理

设置页搜索框用这些词做匹配。本次**中文优先、保留必要英文专有名词**：

```ts
// copyLogToClipboard
searchTerms: ['复制日志文件内容到剪贴板', 'LogOutput', 'LogOutput.txt', 'Discord'],
```

理由：中文用户会输入中文，但排查日志问题时也可能直接输入 `LogOutput` 文件名或
`Discord`。每条数组都至少含一个中文关键词，保证中文检索一定可用。
这条规则以 `SEARCH_TERM_RE` 的形式固化在验证脚本里，是有意为之而非疏漏。

### 2.5 语义准确性抽查

| 原文 | 原译倾向 | 本次译法 | 理由 |
| --- | --- | --- | --- |
| `dependants` | 「依赖项」 | **被依赖项** | 与 `dependencies`（依赖项）必须区分，否则弹窗里两栏同名 |
| `Mods not appearing` | 「模组不出现」 | 模组未显示 | 更符合界面用语 |
| `Start vanilla` | 「启动原版」 | 启动原版 | 与「启动模组模式」构成对仗 |
| `It's funky mode.` | — | 就是花哨模式。 | 保留原文的俏皮语气，不硬译 |
| `Categories are provided Thunderstore…`（原文缺 by） | — | 分类由 Thunderstore 提供，无法翻译。 | 按语义修正，不复制原文笔误 |

---

## 3. 占位符 / 复数 / 链接消息完整性结论

由 `scripts/verify-i18n-completeness.mjs` 逐值校验 **687 条**，全部通过：

| 检查项 | 方法 | 结论 |
| --- | --- | --- |
| 插值占位符 | **逐个复数分支**提取 `{name}` 集合后比对 | 全部一致 |
| 复数分支数 | 按未转义的 `\|` 切分比对分支数量 | 全部一致（4 个复数消息各 2 分支） |
| 链接消息 | 正则提取 `@:path` 目标集合后比对 | 一致 |
| 逐字未译 | 白名单外 zh ≠ en | 0 处 |
| 英文残留 | 白名单外必须含 CJK 字符 | 0 处 |
| 键集合 | 路径集合完全相等 | 缺失 0 / 多余 0 |

复数消息清单（4 条，均保留 2 分支）：

1. `translations.banners.updatableMods.text`
2. `translations.pages.configEditor.editConfig.hiddenCount`
3. `translations.pages.settings.entries.modState.someDisabled`
4. `translations.pages.settings.entries.updateAllMods.status`

中文没有语法上的单复数，理论上两个分支可以写成同一句；但 vue-i18n 依赖 `|`
做分支选择，分支数不一致会导致**运行时取到错误分支或整个消息解析失败**。
因此本次刻意保留 2 个分支（并在个别地方用「有…」/「共有…」做轻微语感区分）。

链接消息只有 1 条，且验证到**运行时可解析**：

```text
@:translations.pages.manager.navigation.modsActions.online → 「在线」
```

### 3.1 一个额外的正面发现

`runtime-i18n-smoke.mjs` 把 15 个模块的对象字面量交给 JS 引擎真实求值，再组装成
完整消息树解析。它同时证明了：

- 所有字面量**语法合法**（`new Function` 未抛错）
- en 与 zh 的**叶子字符串数完全相同**（689 = 687 键 + 2 个 metadata 字段）
- `metadata.locale = 'zh-CN'` 是**合法的 Intl 区域标识**——
  `Intl.DateTimeFormat('zh-CN', { month: 'long' })` 输出「八月」而非「August」，
  证明日期不会回落英文

---

## 4. 中文文案长度的 UI 溢出风险评估

中文通常比英文短，所以**默认不存在溢出风险**——但这次用数据说话，而不是假设。
`scripts/i18n-length-report.mjs` 对全部 687 条做了长度对比：

| 指标 | 数值 |
| --- | --- |
| 对比条目数 | 687 |
| **中文不长于英文的条目** | **683 / 687 = 99.4%** |
| 平均长度 | zh = 12.8 字符，en = 31.3 字符 |
| 长度比 > 1.3 的条目 | **3** |
| 长度比 > 2.0 的条目 | **0** |

### 4.1 全部 3 条「中文更长」的条目

| 长度比 | 中文长度 | 英文长度 | 键 | 评估 |
| --- | --- | --- | --- | --- |
| 1.33x | 8 | 6 | `settings.entries.language.searchTerms[2]` | 检索词 `Language`，不渲染 |
| 1.33x | 4 | 3 | `splash.menu.helpItems.faq` | 「常见问题」 vs `FAQ` |
| 1.33x | 4 | 3 | `splash.content.faq.title` | 同上，且是页面标题，空间充裕 |

**结论：零溢出风险。**

- 唯一的两个真实渲染项是 4 字符 vs 3 字符的差异（1 个汉字宽），出现在 Splash
  的菜单项与页面大标题上——这两处空间最宽裕。
- 紧凑控件（按钮、导航标签、表头、徽章）全部是**中文更短**，例如
  `Uninstall`(9) → 卸载(2)、`Download dependency`(19) → 下载依赖(4)。
- 中文绝对最长的 3 条（154 / 147 / 130 字符）全是帮助/Splash 的**正文段落**，
  容器是流式 `<p>`，本就会折行。

### 4.2 需要人工视觉复核（已识别，未阻塞交付）

由于本机无法启动 Electron（见 §6），以下**理论上**值得实机扫一眼，但按上面的
数据判断风险极低：

1. 侧边导航的 `模组 / 已安装 / 在线`（2–3 汉字，远短于 `Installed`/`Online`）
2. 设置页的七个分类标签（全部 2 汉字）
3. 模组卡片上的 `已弃用` / `已停用` 徽章（3 汉字 vs `Deprecated`/`Disabled`）

---

## 5. 问题清单与处置

### 5.1 本次引入并已修复的缺陷（5 项）

| # | 缺陷 | 严重度 | 如何发现 | 处置 |
| --- | --- | --- | --- | --- |
| 1 | zh-cn 缺少 `settings.entries.gameDirectory.searchTerms[5]`——翻译时把英文的 `Directory` 与 `Directories` 合并成一项，导致键数比 en 少 1 | 中 | `verify-i18n-completeness.mjs` 键集合比对 | 已修复：补入第 6 项 `'文件夹'`。**由工具链自动捕获，非人工发现** |
| 2 | 新增的 `language` 设置项只写进 zh-cn，未同步 base 类型与 en/fr 实现 | **高** | 同一脚本报「zh-cn 存在多余键」6 条 | 已修复：补齐 `base/pages/SettingsMessageFormat.ts` 类型、`en` 与 `fr` 文案。若不修，en 会**类型检查失败**，fr 用户会看到**空白设置项** |
| 3 | 硬编码扫描器的 `LATIN_WORD` 把 `&nbsp;` 中的 `nbsp` 误判为英文，产生 6 个假阳性 | 低 | 首次运行扫描器，6 条 `UI-TEXT` 全是 `&nbsp;` | 已修复：新增白名单规则 `/^&[a-zA-Z]+;$/`（HTML 实体） |
| 4 | 编辑扫描器白名单时误替换掉数组闭合的 `];`，脚本语法错误无法运行 | 低 | 运行即抛 `SyntaxError: Unexpected token 'function'` | 已修复：重新插入 `];` |
| 5 | 自测脚本 `runtime-i18n-smoke.mjs` 中 `platforms.OTHER` 的期望子串误写为英文 `'other'`，导致断言假失败 | 低 | 首次运行冒烟测试，1/8 失败 | 已修复：改为 `'其他'` |

> 第 1、2 项都是「人眼很难发现、工具一跑就报」的类型——这正是把校验脚本
> 写进仓库而不是靠一次性人工核对的价值。

### 5.2 发现但**不修**的上游既有问题（1 项）

| # | 问题 | 证据 | 为何不修 |
| --- | --- | --- | --- |
| 6 | 上游 `src/i18n/fr/**` 与 `en` **键集合不一致**：fr 多出 2 个键 | `fr vs en: keys=689 missing=0 extra=2`，多余的是 `pages.settings.entries.copyTroubleshooting.searchTerms[4]` 与 `dataDirectory.searchTerms[5]` | 属上游自身状态，与汉化无关；改它会扩大本次改动面、增加与上游的合并摩擦。符合契约「不改动与汉化无关的上游行为」 |

**这条问题顺带解释了一个设计选择**：上游 `fr/index.ts` 写的是
`const message = { … }`（**无**类型注解），所以法文缺键/多键**编译期发现不了**。
本次 `zh-cn/index.ts` 刻意采用 `en` 的同款写法：

```ts
const message: MessageFormat = { … };
```

让 `vue-tsc` 成为「是否译全」的强制门禁。建议上游给 fr 也补上该注解。

### 5.3 已知未覆盖项（不影响本次交付结论，但必须声明）

| # | 项目 | 状态 | 说明 |
| --- | --- | --- | --- |
| 7 | 74 条 `R2Error` 诊断错误串未本地化 | **未做** | 会显示在错误弹窗中，确属用户可见。需改 74 个核心逻辑调用点，在**无法类型检查/跑测试**的前提下回归风险过高。已逐条落盘 `docs/zh-cn-hardcoded-scan.json` |
| 8 | `pnpm typecheck` 未执行 | **未执行** | 环境阻塞（§6）。因此 `zh-cn/index.ts` 的显式类型注解**尚未被编译器实际验证过**；本次以键集合 687/687 精确相等作为结构等价证据 |
| 9 | `pnpm test` 未执行 | **未执行** | 同上。已新增 vitest 用例，但**它从未被执行过** |
| 10 | 实机界面截图 | **未做** | 依赖装不上，Electron 无法启动 |
| 11 | 实机视觉复核中文断行/溢出 | **未做** | 以 §4 的量化数据替代 |

### 5.4 vitest 用例的一个设计取舍

`test/vitest/tests/unit/i18n/ZhCnLocalization.spec.ts` **刻意不挂载 `.vue` 组件**：

- 上游 vitest 套件**没有**任何组件挂载测试，也没有配置 Quasar/Vite 的 SFC 管线
  （缺少 `~assets` 别名、`unplugin-vue-components`）。检查过现有 spec，
  它们只 import 纯 `.ts` 模块。
- 在**无法运行 vitest** 的前提下新增组件挂载测试，等于交付一段无法验证、
  大概率因 SFC 编译失败而报错的测试代码。

因此改用「真实 vue-i18n 实例 + 15 个分区代表键 + 不回落英文 + 占位符 + 复数 +
链接消息」的断言组合，而把「真实渲染」这一层交给
`scripts/runtime-i18n-smoke.mjs`（它真实求值并解析了完整消息树）来承担。

---

## 6. 环境阻塞（影响可验证性的根因）

`pnpm install` 在本机稳定失败：

```text
[ERR_PNPM_EPERM] [importPackage …\.pnpm\esbuild@0.27.4\node_modules\esbuild]
EPERM: operation not permitted, rename
  '…\esbuild_tmp_66688_17' -> '…\esbuild'
```

- 到达进度：**998 / 1005** 个包，卡在最后的 hoist/link 阶段。
- 包本身已全部下载进 `D:\.pnpm-store\v11`（`reused 1005`），**不是网络问题**。
- 已排除：`--ignore-scripts`、删 `node_modules` 重装、前台/后台、多次重试。
- 判断：沙箱/文件系统层面拒绝该路径的 `rename`，属环境限制，非项目问题。

因此 `vue-tsc`、`vitest`、Electron GUI 全部不可用。

**补偿措施**：本次所有验证脚本都刻意写成**零依赖**（自行解析/求值 TS 源码，
不 import 任何 npm 包），所以在无 `node_modules` 的环境下依然能完整跑通四个检查。

---

## 7. 审查结论

| 审查维度 | 结论 |
| --- | --- |
| 合并正确性 | ✅ 无冲突、上游未被重写、fork 历史完整 |
| 结构完整性 | ✅ 15 个模块 + 注册表，687 键精确对齐，占位符/复数/链接全一致 |
| 术语一致性 | ✅ 单一术语表贯穿 687 键，Profile / config file 歧义已刻意分离 |
| 排版质量 | ✅ 全角标点、中文引号、中英混排空格规范统一 |
| 溢出风险 | ✅ 99.4% 不比英文长，最大 1.33x，零溢出风险 |
| 运行时正确性 | ✅ 消息树真实求值通过，日期不回落英文，链接消息可解析 |
| 可验证性 | ⚠️ typecheck / test / GUI 因环境阻塞未执行（§6） |
| 覆盖完整性 | ⚠️ 74 条诊断错误串未本地化（§5.3） |

**总体：汉化本体（全部界面文案）已完整且经四层自动化验证通过；
两个开放项（诊断错误串、编译期验证）已明确记录，不隐瞒。**
