#!/usr/bin/env node
/**
 * Runtime smoke test for the zh-cn language pack.
 *
 * Unlike scripts/verify-i18n-completeness.mjs (which reads the modules as text),
 * this script actually *evaluates* every translation module object literal with
 * the JavaScript engine, assembles the real message tree exactly the way
 * src/i18n/index.ts wires it, and then resolves keys from that live tree.
 *
 * It therefore catches problems a text-level check cannot: invalid literals,
 * silently overwritten duplicate keys, broken escapes, and unresolvable
 * linked-message (`@:`) targets.
 *
 * Dependency-free by design, so it runs even when `node_modules` is absent.
 *
 * Usage: node scripts/runtime-i18n-smoke.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const I18N = join(REPO, 'src', 'i18n');

/* ---------------- locate the object literal assigned in a module ---------- */

function literalSourceOf(src) {
    // Find `const <name> ... = {` and extract the balanced literal.
    const m = /const\s+[A-Za-z0-9_$]+\s*(?::[^=]+)?=\s*\{/.exec(src);
    if (!m) throw new Error('no object literal assignment found');
    const start = src.indexOf('{', m.index + m[0].length - 1);

    let depth = 0;
    let i = start;
    let state = null; // 'sq' | 'dq' | 'tpl' | 'line' | 'block'
    for (; i < src.length; i++) {
        const c = src[i];
        const next = src[i + 1];

        if (state === 'line') {
            if (c === '\n') state = null;
            continue;
        }
        if (state === 'block') {
            if (c === '*' && next === '/') { state = null; i++; }
            continue;
        }
        if (state === 'sq' || state === 'dq' || state === 'tpl') {
            if (c === '\\') { i++; continue; }
            if (state === 'sq' && c === "'") state = null;
            else if (state === 'dq' && c === '"') state = null;
            else if (state === 'tpl' && c === '`') state = null;
            continue;
        }

        if (c === '/' && next === '/') { state = 'line'; i++; continue; }
        if (c === '/' && next === '*') { state = 'block'; i++; continue; }
        if (c === "'") { state = 'sq'; continue; }
        if (c === '"') { state = 'dq'; continue; }
        if (c === '`') { state = 'tpl'; continue; }

        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unbalanced object literal');
}

/** Evaluates a translation module and returns the live JS object. */
function evaluateModule(file) {
    const src = readFileSync(file, 'utf8');
    const literal = literalSourceOf(src);
    // eslint-disable-next-line no-new-func
    return new Function(`return (${literal});`)();
}

/** Text-level reader for index.ts, whose values are identifier references. */
function parseWiring(file) {
    const src = readFileSync(file, 'utf8');
    const metadata = {};
    const nameMatch = /name:\s*(['"])(.*?)\1/.exec(src);
    const localeMatch = /locale:\s*(['"])(.*?)\1/.exec(src);
    if (nameMatch) metadata.name = nameMatch[2];
    if (localeMatch) metadata.locale = localeMatch[2];
    return { metadata, src };
}

/* ---------------- module map (mirrors src/i18n/index.ts) ------------------ */

const MODULE_MAP = [
    ['banners/BannerTranslation.ts', 'banners'],
    ['enums/EnumTranslation.ts', 'enums'],
    ['modals/ModalTranslation.ts', 'modals'],
    ['modListStatus/ModListStatusTranslation.ts', 'modListStatus'],
    ['platforms/PlatformTranslation.ts', 'platforms'],
    ['pages/ConfigEditorTranslation.ts', 'configEditor'],
    ['pages/DownloadMonitorTranslation.ts', 'downloadMonitor'],
    ['pages/Error404Translation.ts', 'error404'],
    ['pages/GameSelectionTranslation.ts', 'gameSelection'],
    ['pages/HelpTranslation.ts', 'help'],
    ['pages/LinuxSetupTranslation.ts', 'linuxSetup'],
    ['pages/ManagerTranslation.ts', 'manager'],
    ['pages/ProfileSelectionTranslation.ts', 'profileSelection'],
    ['pages/SettingsTranslation.ts', 'settings'],
    ['pages/SplashTranslation.ts', 'splash'],
];

const PAGE_KEYS = new Set([
    'configEditor', 'downloadMonitor', 'error404', 'gameSelection', 'help',
    'linuxSetup', 'manager', 'profileSelection', 'settings', 'splash',
]);

/** Assembles the message tree the same way src/i18n/index.ts does. */
function assemble(localeDir) {
    const tree = { metadata: {}, translations: { pages: {} } };
    for (const [rel, key] of MODULE_MAP) {
        const file = join(localeDir, rel);
        if (!existsSync(file)) throw new Error(`missing module: ${relative(REPO, file)}`);
        const loaded = evaluateModule(file);
        if (PAGE_KEYS.has(key)) tree.translations.pages[key] = loaded;
        else tree.translations[key] = loaded;
    }
    tree.metadata = parseWiring(join(localeDir, 'index.ts')).metadata;
    return tree;
}

function resolve(tree, path) {
    let node = tree;
    for (const part of path.split('.')) {
        if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
        node = node[part];
    }
    return node;
}

/**
 * Counts string leaves. `searchTerms` holds localized search synonyms rather than
 * translated copy, so those entries are excluded: en and zh-cn legitimately differ
 * in how many keywords they carry, in both directions.
 */
function countLeaves(node, acc = { n: 0 }) {
    if (typeof node === 'string') { acc.n++; return acc.n; }
    if (Array.isArray(node)) { node.forEach((c) => countLeaves(c, acc)); return acc.n; }
    if (node && typeof node === 'object') {
        Object.entries(node).forEach(([key, c]) => {
            if (key === 'searchTerms') return;
            countLeaves(c, acc);
        });
        return acc.n;
    }
    return acc.n;
}

const CJK = /[\u3400-\u9FFF]/;
const failures = [];
const checks = [];
function check(label, fn) {
    try {
        const detail = fn();
        checks.push(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
    } catch (e) {
        failures.push(`${label}: ${e.message}`);
        checks.push(`  ❌ ${label} — ${e.message}`);
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

/* ---------------- run ---------------------------------------------------- */

const en = assemble(join(I18N, 'en'));
const zh = assemble(join(I18N, 'zh-cn'));

check('两个语言包均被 JS 引擎成功求值', () => {
    const enCount = countLeaves(en);
    const zhCount = countLeaves(zh);
    assert(enCount === zhCount, `叶子节点数量不同：en=${enCount}，zh=${zhCount}`);
    return `en=${enCount} 个字符串节点，zh=${zhCount} 个`;
});

check('metadata 正确', () => {
    assert(zh.metadata.name === '简体中文', `name 期望「简体中文」，实际 ${JSON.stringify(zh.metadata.name)}`);
    assert(zh.metadata.locale === 'zh-CN', `locale 期望 'zh-CN'，实际 ${JSON.stringify(zh.metadata.locale)}`);
    const fmt = new Intl.DateTimeFormat(zh.metadata.locale, { month: 'long' });
    return `locale=${zh.metadata.locale}，Intl 可用，8 月显示为「${fmt.format(new Date(2026, 7, 1))}」`;
});

check('全部 15 个翻译分区都存在且非空', () => {
    const sections = [
        'banners', 'enums', 'modals', 'modListStatus', 'platforms',
        'pages.configEditor', 'pages.downloadMonitor', 'pages.error404',
        'pages.gameSelection', 'pages.help', 'pages.linuxSetup',
        'pages.manager', 'pages.profileSelection', 'pages.settings', 'pages.splash',
    ];
    for (const s of sections) {
        const node = resolve(zh, `translations.${s}`);
        assert(node && typeof node === 'object', `分区缺失: ${s}`);
        assert(countLeaves(node) > 0, `分区为空: ${s}`);
    }
    return `${sections.length} 个分区全部就绪`;
});

const REPRESENTATIVE = [
    ['translations.platforms.OTHER', '其他'],
    ['translations.enums.sortingStyle.DOWNLOADS', '下载量'],
    ['translations.modListStatus.almostDone', '即将完成'],
    ['translations.banners.concerningPackage.text', 'Thunderstore'],
    ['translations.modals.error.title', '错误'],
    ['translations.pages.configEditor.hero.title', '模组配置编辑器'],
    ['translations.pages.downloadMonitor.title.text', '下载'],
    ['translations.pages.error404.actions.goBack', '返回'],
    ['translations.pages.gameSelection.tabs.game', '游戏'],
    ['translations.pages.help.hero.title', '帮助'],
    ['translations.pages.linuxSetup.actions.copy', '复制到剪贴板'],
    ['translations.pages.manager.navigation.modsActions.label', '模组'],
    ['translations.pages.profileSelection.actions.select', '选择'],
    ['translations.pages.settings.entries.language.title', '语言'],
    ['translations.pages.splash.content.faq.title', '常见问题'],
];

check('每个分区的代表键都能解析出中文（无英文回退）', () => {
    const problems = [];
    for (const [key, expectSub] of REPRESENTATIVE) {
        const val = resolve(zh, key);
        if (typeof val !== 'string' || val.length === 0) { problems.push(`${key} 无法解析`); continue; }
        if (!CJK.test(val)) problems.push(`${key} 不含中文: ${JSON.stringify(val)}`);
        if (!val.includes(expectSub)) problems.push(`${key} 期望包含「${expectSub}」，实际 ${JSON.stringify(val)}`);
        const enVal = resolve(en, key);
        if (enVal === val && !['translations.pages.settings.entries.language.title'].includes(key)) {
            problems.push(`${key} 与英文相同`);
        }
    }
    assert(problems.length === 0, problems.join('; '));
    return `${REPRESENTATIVE.length} 个代表键全部命中中文文案`;
});

check('插值占位符可被真实替换', () => {
    const samples = [
        ['translations.banners.managerUpdate.title', 'appName', 'r2modman'],
        ['translations.modals.gameRunning.starting', 'gameName', 'Risk of Rain 2'],
        ['translations.pages.settings.entries.resetGameInstallation.title', 'gameName', 'Valheim'],
        ['translations.pages.settings.hero.subtitle', 'version', '3.2.20'],
    ];
    for (const [key, name, value] of samples) {
        const raw = resolve(zh, key);
        assert(typeof raw === 'string', `${key} 无法解析`);
        const rendered = raw.replace(`{${name}}`, value);
        assert(rendered.includes(value), `${key} 替换 {${name}} 失败`);
        assert(!rendered.includes(`{${name}}`), `${key} 仍残留占位符 {${name}}`);
    }
    return `${samples.length} 处占位符插值正常`;
});

check('复数分支可被 vue-i18n 式选择', () => {
    const key = 'translations.pages.settings.entries.modState.someDisabled';
    const raw = resolve(zh, key);
    assert(typeof raw === 'string', `${key} 无法解析`);
    const branches = raw.split('|').map((s) => s.trim());
    assert(branches.length === 2, `期望 2 个复数分支，实际 ${branches.length}`);
    const singular = branches[0];
    const plural = branches[1].replace('{count}', '5');
    assert(CJK.test(singular) && CJK.test(plural), '复数分支不含中文');
    assert(plural.includes('5'), '复数分支插值失败');
    return `单数「${singular}」/ 复数「${plural}」`;
});

check('链接消息 (@:) 目标可解析', () => {
    const holder = resolve(zh, 'translations.pages.help.general.gettingStarted.whereToFindMods');
    assert(typeof holder === 'string', 'whereToFindMods 无法解析');
    const m = /@:([A-Za-z0-9_.]+)/.exec(holder);
    assert(m, '未找到 @: 链接消息');
    const target = resolve(zh, m[1]);
    assert(typeof target === 'string' && target.length > 0, `链接目标无法解析: ${m[1]}`);
    assert(CJK.test(target), `链接目标不含中文: ${m[1]}`);
    return `@:${m[1]} → 「${target}」`;
});

check('语言切换入口与默认语言接线正确', () => {
    const registry = readFileSync(join(I18N, 'index.ts'), 'utf8');
    assert(/'zh-cn'\s*:\s*langZhCn/.test(registry), "src/i18n/index.ts 未注册 'zh-cn'");
    assert(/\[langZhCn\.metadata\.locale\]/.test(registry), 'datetimeFormats 缺少 zh-CN');

    const localeManager = readFileSync(join(REPO, 'src', 'r2mm', 'manager', 'LocaleManager.ts'), 'utf8');
    assert(/DEFAULT_LOCALE\s*=\s*'zh-cn'/.test(localeManager), 'LocaleManager 未把默认语言设为 zh-cn');

    const store = readFileSync(join(REPO, 'src', 'r2mm', 'manager', 'SettingsDexieStore.ts'), 'utf8');
    assert(/locale:\s*'zh-cn'/.test(store), '全新安装的默认 locale 不是 zh-cn');

    const entry = join(REPO, 'src', 'components', 'settings-components', 'entries', 'Language.vue');
    assert(existsSync(entry), '缺少语言设置项组件 Language.vue');

    const view = readFileSync(join(REPO, 'src', 'components', 'settings-components', 'SettingsView.vue'), 'utf8');
    assert(/Language\.vue/.test(view) && /<Language /.test(view), '设置页未挂载语言设置项');

    for (const loc of ['en', 'fr', 'zh-cn']) {
        const f = join(I18N, loc, 'pages', 'SettingsTranslation.ts');
        assert(readFileSync(f, 'utf8').includes('language:'), `${loc} 语言包缺少 language 设置项文案`);
    }
    return 'registry / 默认语言 / 设置项 / 三语文案 全部就位';
});

/* ---------------- report ------------------------------------------------- */

console.log('==============================================');
console.log(' zh-cn 语言包运行时冒烟测试');
console.log('==============================================');
for (const line of checks) console.log(line);
console.log('----------------------------------------------');
if (failures.length === 0) {
    console.log(`结果：通过 ✅  ${checks.length} 项运行时断言全部成立。`);
    process.exit(0);
} else {
    console.log(`结果：失败 ❌  共 ${failures.length} 项：`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
}
