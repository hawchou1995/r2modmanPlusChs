#!/usr/bin/env node
/**
 * Reports the length of every zh-cn string against its English source, to
 * assess UI overflow risk (buttons, nav labels, table headers, badges).
 *
 * Chinese is usually more compact than English, but not always — this script
 * surfaces the exceptions so they can be reviewed instead of assumed.
 *
 * Usage: node scripts/i18n-length-report.mjs [--json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const I18N = join(REPO, 'src', 'i18n');

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

function extractLiteral(src) {
    const m = /const\s+[A-Za-z0-9_$]+\s*(?::[^=]+)?=\s*\{/.exec(src);
    if (!m) throw new Error('no object literal');
    const start = src.indexOf('{', m.index + m[0].length - 1);
    let depth = 0;
    let state = null;
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        const n = src[i + 1];
        if (state === 'line') { if (c === '\n') state = null; continue; }
        if (state === 'block') { if (c === '*' && n === '/') { state = null; i++; } continue; }
        if (state) {
            if (c === '\\') { i++; continue; }
            if (state === 'sq' && c === "'") state = null;
            else if (state === 'dq' && c === '"') state = null;
            else if (state === 'tpl' && c === '`') state = null;
            continue;
        }
        if (c === '/' && n === '/') { state = 'line'; i++; continue; }
        if (c === '/' && n === '*') { state = 'block'; i++; continue; }
        if (c === "'") { state = 'sq'; continue; }
        if (c === '"') { state = 'dq'; continue; }
        if (c === '`') { state = 'tpl'; continue; }
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('unbalanced literal');
}

function flatten(node, prefix, out) {
    if (typeof node === 'string') { out[prefix] = node; return; }
    if (Array.isArray(node)) { node.forEach((c, i) => flatten(c, `${prefix}[${i}]`, out)); return; }
    if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) flatten(node[k], prefix ? `${prefix}.${k}` : k, out);
    }
}

function load(localeDir) {
    const out = {};
    for (const [rel, prefix] of MODULE_MAP) {
        const src = readFileSync(join(localeDir, rel), 'utf8');
        // eslint-disable-next-line no-new-func
        const obj = new Function(`return (${extractLiteral(src)});`)();
        flatten(obj, prefix, out);
    }
    return out;
}

const en = load(join(I18N, 'en'));
const zh = load(join(I18N, 'zh-cn'));

const rows = Object.keys(en)
    .filter((k) => k in zh)
    .map((k) => ({
        key: k,
        zhLength: zh[k].length,
        enLength: en[k].length,
        ratio: zh[k].length / Math.max(1, en[k].length),
    }));

const byRatio = [...rows].sort((a, b) => b.ratio - a.ratio);
const byZhLength = [...rows].sort((a, b) => b.zhLength - a.zhLength);

const shorterOrEqual = rows.filter((r) => r.zhLength <= r.enLength).length;
const avgZh = rows.reduce((a, r) => a + r.zhLength, 0) / rows.length;
const avgEn = rows.reduce((a, r) => a + r.enLength, 0) / rows.length;

if (process.argv.includes('--json')) {
    writeFileSync(
        join(REPO, 'docs', 'zh-cn-length-report.json'),
        JSON.stringify({ totals: rows.length, shorterOrEqual, avgZh, avgEn, rows: byRatio }, null, 2),
        'utf8'
    );
}

console.log('==============================================');
console.log(' 中文文案长度 / UI 溢出风险报告');
console.log('==============================================');
console.log(`对比条目数            : ${rows.length}`);
console.log(`中文不长于英文的条目  : ${shorterOrEqual} (${((100 * shorterOrEqual) / rows.length).toFixed(1)}%)`);
console.log(`平均长度              : zh=${avgZh.toFixed(1)} 字符, en=${avgEn.toFixed(1)} 字符`);
console.log('----------------------------------------------');
console.log('中文相对最长的 12 条（长度比由高到低）：');
for (const r of byRatio.slice(0, 12)) {
    console.log(`  ${r.ratio.toFixed(2)}x  zh=${String(r.zhLength).padStart(3)} en=${String(r.enLength).padStart(3)}  ${r.key}`);
}
console.log('----------------------------------------------');
console.log('中文绝对最长的 10 条：');
for (const r of byZhLength.slice(0, 10)) {
    console.log(`  zh=${String(r.zhLength).padStart(3)} en=${String(r.enLength).padStart(3)}  ${r.key}`);
}
console.log('----------------------------------------------');
console.log(`长度比 > 1.3 的条目数（需重点复核）：${byRatio.filter((r) => r.ratio > 1.3).length}`);
console.log(`长度比 > 2.0 的条目数（可能溢出）：  ${byRatio.filter((r) => r.ratio > 2.0).length}`);
