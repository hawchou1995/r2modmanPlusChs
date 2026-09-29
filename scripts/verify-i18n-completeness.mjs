#!/usr/bin/env node
/**
 * Verifies that the Simplified Chinese (zh-cn) language pack is a complete and
 * structurally faithful translation of the English (en) reference pack.
 *
 * This script is dependency-free: it parses the TypeScript translation modules
 * directly, so it can run even when `node_modules` is not installed.
 *
 * Checks performed:
 *   1. Key path sets of en and zh-cn are identical (no missing / no extra keys).
 *   2. Every interpolation placeholder match between en and zh-cn, compared
 *      per plural alternative (so `a | b` forms cannot silently lose a branch).
 *   3. Plural separator (`|`) branch counts match.
 *   4. Linked message targets (`@:...`) match.
 *   5. Outside an explicit whitelist, zh values differ verbatim from en.
 *   6. Outside an explicit whitelist, zh values contain CJK characters
 *      (detects leftover untranslated English).
 *   7. The zh-cn registry (index.ts) wires the same modules under the same keys
 *      as the en registry, and the top-level i18n registry exposes zh-cn.
 *
 * Usage: node scripts/verify-i18n-completeness.mjs
 * Exit code 0 = all checks passed, 1 = at least one check failed.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const I18N_DIR = join(REPO, 'src', 'i18n');

/* ------------------------------------------------------------------ *
 * 1. Minimal TypeScript object-literal parser
 * ------------------------------------------------------------------ */

function tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const isIdentChar = (c) => /[A-Za-z0-9_$]/.test(c);

    while (i < n) {
        const c = src[i];

        // line comment
        if (c === '/' && src[i + 1] === '/') {
            while (i < n && src[i] !== '\n') i++;
            continue;
        }
        // block comment
        if (c === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        // whitespace
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            i++;
            continue;
        }
        // quoted string
        if (c === "'" || c === '"') {
            const quote = c;
            let s = '';
            i++;
            while (i < n && src[i] !== quote) {
                if (src[i] === '\\') {
                    const e = src[i + 1];
                    s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
                    i += 2;
                } else {
                    s += src[i];
                    i++;
                }
            }
            i++;
            toks.push({ t: 'str', v: s });
            continue;
        }
        // template literal
        if (c === '`') {
            i++;
            let s = '';
            while (i < n && src[i] !== '`') {
                if (src[i] === '\\') {
                    const e = src[i + 1];
                    s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
                    i += 2;
                } else {
                    s += src[i];
                    i++;
                }
            }
            i++;
            toks.push({ t: 'str', v: s });
            continue;
        }
        // punctuation
        if ('{}[]:,;='.includes(c)) {
            toks.push({ t: 'p', v: c });
            i++;
            continue;
        }
        // bare identifier
        if (isIdentChar(c)) {
            let j = i;
            while (j < n && isIdentChar(src[j])) j++;
            toks.push({ t: 'id', v: src.slice(i, j) });
            i = j;
            continue;
        }
        // anything else (angle brackets of generics, etc.) is skipped
        i++;
    }
    return toks;
}

function parseValue(toks, pos) {
    const t = toks[pos];
    if (t === undefined) throw new Error('unexpected end of input');
    if (t.t === 'str') return { value: t.v, next: pos + 1 };
    if (t.t === 'p' && t.v === '{') return parseObject(toks, pos);
    if (t.t === 'p' && t.v === '[') return parseArray(toks, pos);
    if (t.t === 'id') return { value: { __ref: t.v }, next: pos + 1 };
    throw new Error(`unexpected token: ${JSON.stringify(t)}`);
}

function parseObject(toks, pos) {
    // pos points at '{'
    const obj = {};
    let i = pos + 1;
    for (;;) {
        const t = toks[i];
        if (t === undefined) throw new Error('unterminated object');
        if (t.t === 'p' && t.v === '}') return { value: obj, next: i + 1 };
        if (t.t === 'p' && t.v === ',') { i++; continue; }

        let key;
        if (t.t === 'str' || t.t === 'id') {
            key = t.v;
            i++;
        } else {
            throw new Error(`unexpected key token: ${JSON.stringify(t)}`);
        }

        const colon = toks[i];
        if (!(colon && colon.t === 'p' && colon.v === ':')) {
            throw new Error(`expected ':' after key ${key}`);
        }
        i++;

        const parsed = parseValue(toks, i);
        obj[key] = parsed.value;
        i = parsed.next;
    }
}

function parseArray(toks, pos) {
    // pos points at '['
    const arr = [];
    let i = pos + 1;
    for (;;) {
        const t = toks[i];
        if (t === undefined) throw new Error('unterminated array');
        if (t.t === 'p' && t.v === ']') return { value: arr, next: i + 1 };
        if (t.t === 'p' && t.v === ',') { i++; continue; }
        const parsed = parseValue(toks, i);
        arr.push(parsed.value);
        i = parsed.next;
    }
}

/** Parses the object literal assigned in an `export const X = { ... }` statement. */
function parseExportedObject(file) {
    const src = readFileSync(file, 'utf8');
    const toks = tokenize(src);

    // Find `const <name> ... = {`
    let i = 0;
    let name = null;
    while (i < toks.length) {
        if (toks[i].t === 'id' && toks[i].v === 'const') {
            name = toks[i + 1]?.v ?? null;
            let j = i + 2;
            while (j < toks.length && !(toks[j].t === 'p' && toks[j].v === '=')) j++;
            const open = toks[j + 1];
            if (open && open.t === 'p' && open.v === '{') {
                return { name, object: parseObject(toks, j + 1).value };
            }
        }
        i++;
    }
    throw new Error(`no exported object literal found in ${file}`);
}

/* ------------------------------------------------------------------ *
 * 2. Flattening helpers
 * ------------------------------------------------------------------ */

function flatten(node, prefix, out) {
    if (typeof node === 'string') {
        out.set(prefix, node);
        return;
    }
    if (Array.isArray(node)) {
        node.forEach((child, idx) => flatten(child, `${prefix}[${idx}]`, out));
        return;
    }
    if (node && typeof node === 'object') {
        if ('__ref' in node) {
            out.set(prefix, `__ref__:${node.__ref}`);
            return;
        }
        for (const [k, v] of Object.entries(node)) {
            flatten(v, prefix === '' ? k : `${prefix}.${k}`, out);
        }
        return;
    }
    out.set(prefix, String(node));
}

function splitPlural(value) {
    return value.split('|').map((s) => s.trim());
}

function placeholdersOf(text) {
    const found = new Set();
    const re = /\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const inner = m[1].trim();
        // `{''}` is a vue-i18n literal escape, not a named interpolation.
        if (inner === '' || /^'.*'$/.test(inner)) continue;
        found.add(inner);
    }
    return found;
}

function linkTargetsOf(text) {
    const found = new Set();
    const re = /@:([A-Za-z0-9_.]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) found.add(m[1]);
    return found;
}

const CJK_RE = /[\u3400-\u9FFF\u3000-\u303F\uFF01-\uFF60\u201C\u201D\u2018\u2019\u3008-\u3011]/;

/* ------------------------------------------------------------------ *
 * 3. Whitelist
 * ------------------------------------------------------------------ */

/**
 * Values that are legitimately identical to English. Each entry needs a reason;
 * the script reports every hit so the exemption list stays auditable.
 */
const VALUE_WHITELIST = new Map([
    ['translations.platforms.STEAM', '品牌名 Steam，保留原文'],
    ['translations.platforms.STEAM_DIRECT', '品牌名 Steam，保留原文'],
    ['translations.platforms.ORIGIN', '平台品牌名 Origin / EA App'],
    ['translations.platforms.XBOX_GAME_PASS', '平台品牌名 Xbox Game Pass'],
    ['translations.enums.launchType.PROTON', '兼容层专有名词 Proton'],
    ['translations.pages.splash.content.about.techStack.electron', '技术栈专有名称'],
    ['translations.pages.splash.content.about.techStack.node', '技术栈专有名称'],
    ['translations.pages.splash.content.about.techStack.vue', '技术栈专有名称'],
    ['translations.pages.splash.content.about.techStack.typescript', '技术栈专有名称'],
    ['translations.pages.manager.online.previewPanel.tabs.readme', 'README 为通用文档名，业界惯例保留'],
    ['translations.pages.manager.online.previewPanel.tabs.changelog', 'CHANGELOG 为通用文档名，业界惯例保留'],
    ['translations.modals.dependencyStrings.dependency', '依赖字符串格式模板，须与 Thunderstore 规范一致'],
]);

/** Search keywords intentionally keep some Latin proper nouns so bilingual search keeps working. */
const SEARCH_TERM_RE = /\.searchTerms(\[\d+\])?$/;

function isSearchTermPath(path) {
    return SEARCH_TERM_RE.test(path);
}

/* ------------------------------------------------------------------ *
 * 4. Locale file -> full message key prefix mapping
 * ------------------------------------------------------------------ */

const MODULE_MAP = [
    ['banners/BannerTranslation.ts', 'translations.banners'],
    ['enums/EnumTranslation.ts', 'translations.enums'],
    ['modals/ModalTranslation.ts', 'translations.modals'],
    ['modListStatus/ModListStatusTranslation.ts', 'translations.modListStatus'],
    ['platforms/PlatformTranslation.ts', 'translations.platforms'],
    ['pages/ConfigEditorTranslation.ts', 'translations.pages.configEditor'],
    ['pages/DownloadMonitorTranslation.ts', 'translations.pages.downloadMonitor'],
    ['pages/Error404Translation.ts', 'translations.pages.error404'],
    ['pages/GameSelectionTranslation.ts', 'translations.pages.gameSelection'],
    ['pages/HelpTranslation.ts', 'translations.pages.help'],
    ['pages/LinuxSetupTranslation.ts', 'translations.pages.linuxSetup'],
    ['pages/ManagerTranslation.ts', 'translations.pages.manager'],
    ['pages/ProfileSelectionTranslation.ts', 'translations.pages.profileSelection'],
    ['pages/SettingsTranslation.ts', 'translations.pages.settings'],
    ['pages/SplashTranslation.ts', 'translations.pages.splash'],
];

/* ------------------------------------------------------------------ *
 * 5. Runner
 * ------------------------------------------------------------------ */

const failures = [];
const notes = [];
let checkedValues = 0;
let whitelistHits = 0;

function fail(msg) {
    failures.push(msg);
}

function loadLocale(localeDir) {
    const map = new Map();
    for (const [rel, prefix] of MODULE_MAP) {
        const file = join(localeDir, rel);
        if (!existsSync(file)) {
            fail(`缺少翻译文件：${relative(REPO, file)}`);
            continue;
        }
        const { object } = parseExportedObject(file);
        flatten(object, prefix, map);
    }
    return map;
}

function main() {
    const enDir = join(I18N_DIR, 'en');
    const zhDir = join(I18N_DIR, 'zh-cn');

    if (!existsSync(enDir)) { fail(`找不到英文语言包目录：${relative(REPO, enDir)}`); }
    if (!existsSync(zhDir)) { fail(`找不到简体中文语言包目录：${relative(REPO, zhDir)}`); }
    if (failures.length) return;

    // ---- module file parity -------------------------------------------------
    for (const [rel] of MODULE_MAP) {
        const enExists = existsSync(join(enDir, rel));
        const zhExists = existsSync(join(zhDir, rel));
        if (enExists !== zhExists) {
            fail(`文件不对应：en/${rel} exists=${enExists}，zh-cn/${rel} exists=${zhExists}`);
        }
    }

    const en = loadLocale(enDir);
    const zh = loadLocale(zhDir);

    // ---- 1. key parity ------------------------------------------------------
    const enKeys = new Set(en.keys());
    const zhKeys = new Set(zh.keys());
    const missing = [...enKeys].filter((k) => !zhKeys.has(k));
    const extra = [...zhKeys].filter((k) => !enKeys.has(k));
    for (const k of missing.slice(0, 40)) fail(`zh-cn 缺失键：${k}`);
    for (const k of extra.slice(0, 40)) fail(`zh-cn 存在多余键：${k}`);
    if (missing.length > 40) fail(`… 另有 ${missing.length - 40} 个缺失键（已省略）`);
    if (extra.length > 40) fail(`… 另有 ${extra.length - 40} 个多余键（已省略）`);

    // ---- 2..6 per-value checks ---------------------------------------------
    for (const [key, enValue] of en) {
        if (!zhKeys.has(key)) continue; // already reported
        const zhValue = zh.get(key);
        checkedValues++;

        const enPlural = splitPlural(enValue);
        const zhPlural = splitPlural(zhValue);

        if (enPlural.length !== zhPlural.length) {
            fail(`复数分支数量不一致：${key}（en=${enPlural.length}，zh=${zhPlural.length}）`);
        } else {
            for (let i = 0; i < enPlural.length; i++) {
                const ep = [...placeholdersOf(enPlural[i])].sort().join(',');
                const zp = [...placeholdersOf(zhPlural[i])].sort().join(',');
                if (ep !== zp) {
                    fail(`第 ${i + 1} 个复数分支占位符不一致：${key}（en=[${ep}]，zh=[${zp}]）`);
                }
            }
        }

        const el = [...linkTargetsOf(enValue)].sort().join(',');
        const zl = [...linkTargetsOf(zhValue)].sort().join(',');
        if (el !== zl) {
            fail(`链接消息目标不一致：${key}（en=[${el}]，zh=[${zl}]）`);
        }

        const whitelisted = VALUE_WHITELIST.has(key) || isSearchTermPath(key);
        if (whitelisted) {
            if (VALUE_WHITELIST.has(key)) {
                whitelistHits++;
                notes.push(`白名单：${key}（${VALUE_WHITELIST.get(key)}）`);
            }
            continue;
        }

        if (zhValue.trim() === enValue.trim()) {
            fail(`译文与英文完全相同（疑似未翻译）：${key}`);
        }
        if (!CJK_RE.test(zhValue)) {
            fail(`译文不含中文字符（疑似英文残留）：${key} => ${JSON.stringify(zhValue)}`);
        }
    }

    // ---- 7. registry wiring -------------------------------------------------
    const enIndex = parseExportedObject(join(enDir, 'index.ts'));
    const zhIndex = parseExportedObject(join(zhDir, 'index.ts'));

    const enWiring = new Map();
    const zhWiring = new Map();
    flatten(enIndex.object.translations, 'translations', enWiring);
    flatten(zhIndex.object.translations, 'translations', zhWiring);

    const wiringKeysEn = new Set(enWiring.keys());
    const wiringKeysZh = new Set(zhWiring.keys());
    for (const k of wiringKeysEn) {
        if (!wiringKeysZh.has(k)) fail(`zh-cn 注册表缺少分区：${k}`);
    }
    for (const k of wiringKeysZh) {
        if (!wiringKeysEn.has(k)) fail(`zh-cn 注册表存在多余分区：${k}`);
    }
    for (const [k, v] of enWiring) {
        if (zhWiring.has(k) && zhWiring.get(k) !== v) {
            fail(`注册表模块不一致：${k}（en=${v}，zh=${zhWiring.get(k)}）`);
        }
    }

    const zhMeta = zhIndex.object.metadata ?? {};
    if (zhMeta.name !== '简体中文') {
        fail(`zh-cn metadata.name 应为「简体中文」，实际为 ${JSON.stringify(zhMeta.name)}`);
    }
    if (zhMeta.locale !== 'zh-CN') {
        fail(`zh-cn metadata.locale 应为 'zh-CN'，实际为 ${JSON.stringify(zhMeta.locale)}`);
    }
    try {
        new Intl.DateTimeFormat(zhMeta.locale);
    } catch {
        fail(`metadata.locale 不是合法的 Intl 区域标识：${zhMeta.locale}`);
    }

    // zh-cn/index.ts must annotate the message object with MessageFormat so the
    // compiler enforces completeness (same technique as en/index.ts).
    const zhIndexSrc = readFileSync(join(zhDir, 'index.ts'), 'utf8');
    if (!/const message\s*:\s*MessageFormat\s*=/.test(zhIndexSrc)) {
        fail('zh-cn/index.ts 未使用 `const message: MessageFormat` 显式类型注解，编译期无法强制校验完备性');
    }

    // ---- top level registry ------------------------------------------------
    const registry = readFileSync(join(I18N_DIR, 'index.ts'), 'utf8');
    if (!/'zh-cn'\s*:\s*langZhCn/.test(registry)) {
        fail("src/i18n/index.ts 未注册 'zh-cn' 语言包");
    }
    if (!/\[langZhCn\.metadata\.locale\]/.test(registry)) {
        fail('src/i18n/index.ts 的 datetimeFormats 缺少 zh-CN 条目');
    }
}

main();

/* ------------------------------------------------------------------ *
 * 6. Report
 * ------------------------------------------------------------------ */

const enCount = existsSync(join(I18N_DIR, 'en')) ? loadLocale(join(I18N_DIR, 'en')).size : 0;
const zhCount = existsSync(join(I18N_DIR, 'zh-cn')) ? loadLocale(join(I18N_DIR, 'zh-cn')).size : 0;

console.log('==============================================');
console.log(' i18n 完备性校验 (en  vs  zh-cn)');
console.log('==============================================');
console.log(`翻译文件数      : ${MODULE_MAP.length} (+ index.ts)`);
console.log(`英文键总数      : ${enCount}`);
console.log(`中文键总数      : ${zhCount}`);
console.log(`已逐值校验数量  : ${checkedValues}`);
console.log(`白名单命中数量  : ${whitelistHits}`);
console.log('----------------------------------------------');
if (notes.length) {
    console.log('白名单命中项：');
    for (const n of notes) console.log(`  - ${n}`);
    console.log('----------------------------------------------');
}

if (failures.length === 0) {
    console.log('结果：通过 ✅  键集合一致、占位符/复数/链接一致、无英文残留。');
    process.exit(0);
} else {
    console.log(`结果：失败 ❌  共 ${failures.length} 项问题：`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
}
