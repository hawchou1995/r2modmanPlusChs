# R2modman 简体中文汉化（r2modmanPlusChs）

这个 fork 给 r2modmanPlus 加简体中文界面，并补齐它的多语言机制。本文件定义讨论与代码里
使用的词汇：一半是本地化机制的概念，一半是中文界面里选定的译法。

## 语言与本地化机制

**locale 键**（locale key）:
在语言注册表里选择一个语言包的短名，与消息树的顶层键一致（`en`、`fr`、`zh-cn`）。
_Avoid_: 语言代码、locale 值、语言名

**locale 标签**（locale tag）:
交给 `Intl` 的 BCP-47 标签（`en-US`、`fr-FR`、`zh-CN`），只用于日期时间格式化，独立于 locale 键。
_Avoid_: 语言地区、区域代码

**默认语言**（`DEFAULT_LOCALE`）:
库里还没有存过语言（全新安装）时使用的语言。本 fork 为 `zh-cn`。
_Avoid_: 初始语言、首选语言

**回退语言**（`FALLBACK_LOCALE`）:
库里存的语言是本版本不提供的值时使用的语言。为 `en`。
_Avoid_: 备用语言、降级语言

**消息格式契约**（`MessageFormat`）:
在类型层面规定「一个语言包必须提供哪些字符串」的接口；漏键即编译错误，而不是运行时回落英文。
_Avoid_: 语言模板、翻译 schema

**翻译分区**（translation section）:
语言包里按界面区域划分的一组消息，共 15 个（10 个 `pages` 加 platforms / modListStatus / banners / modals / enums）。
_Avoid_: 翻译模块、语言分区

**检索词**（`searchTerms`）:
设置页搜索框用来匹配某个条目的一组同义词。它是**本地化内容**而不是翻译单元：允许不同语言条数不同，
不计入键比对与长度统计。
_Avoid_: 关键词、别名

**语言包**（language pack）:
一个 locale 键对应的整套译文实现。
_Avoid_: 翻译文件、语言文件

## 中文界面词汇

**模组**（mod）:
被安装的单个软件包。全文统一用「模组」。
_Avoid_: 插件、MOD、模块

**模组包**（package）:
Thunderstore 上的发布单元，可包含多个模组；仅在与「模组」需要区分时使用。
_Avoid_: 包、资源包

**配置档**（profile）:
一套可切换的模组集合。
_Avoid_: 配置文件、档案、档位（「配置文件」指的是 `mod config`，是另一个概念）

**依赖**（dependency）:
模组运行所需的其他模组。成对出现的分组标题写作「依赖项 / 被依赖项」。
_Avoid_: 前置、需求

**停用 / 启用**（disable / enable）:
模组的开关状态。统一用「停用」「启用」。
_Avoid_: 禁用、开启、关闭

**数据文件夹 / 游戏目录 / Steam 目录**:
三个不同的路径设置。「数据文件夹」放管理器的模组与配置档，「游戏目录」是游戏本体的安装位置，
「Steam 目录」是 Steam 的安装位置。
_Avoid_: 路径、文件夹（不加限定时指代不明）

**在线 / 本地**（online / local）:
模组来源的两种视角：从 Thunderstore 拉取，还是已安装在磁盘上。
_Avoid_: 远端、离线

**平台**（platform）:
游玩该游戏的渠道（Steam、Xbox Game Pass、Epic、Origin…），决定安装与启动方式。
_Avoid_: 商店、渠道
