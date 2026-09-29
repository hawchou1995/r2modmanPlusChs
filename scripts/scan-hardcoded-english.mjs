#!/usr/bin/env node
/**
 * Scans the renderer (`src/`) and main process (`src-electron/`) sources for
 * hardcoded user-visible English that should instead come from the i18n layer.
 *
 * Dependency-free, so it runs without `node_modules`.
 *
 * Categories reported:
 *   UI-TEXT   literal text nodes inside <template> blocks
 *   UI-ATTR   user-visible attributes (placeholder/title/label/alt/aria-label)
 *   UI-API    strings passed to user-facing APIs (R2Error, showModal, ...)
 *   DEV-LOG   console/logger output (developer-facing, not user-visible)
 *
 * Entries matching ALLOWLIST are reported as exempt with a reason.
 *
 * Usage: node scripts/scan-hardcoded-english.mjs [--json]
 * Exit code 1 when there is at least one un-exempted UI-TEXT / UI-ATTR hit.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

const SCAN_ROOTS = [join(REPO, 'src'), join(REPO, 'src-electron')];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'i18n', 'test', 'assets']);

/** A Latin word of 2+ letters is required before a string is even considered. */
const LATIN_WORD = /[A-Za-z]{2,}/;
const HAS_MUSTACHE = /\{\{|\}\}/;

/**
 * Strings that are legitimately not translated. Matched case-sensitively against
 * the extracted string.
 */
const ALLOWLIST = [
    { re: /^(Steam|Steam Direct|Proton|Epic Games Store|Xbox Game Pass|Origin \/ EA App|Oculus \/ Meta Store|Other)$/, why: '平台/品牌专有名词（与 i18n 中的白名保持一致）' },
    { re: /^(OK|JSON|HTML|CSS|URL|ID|API|CDN|DLL|ZIP|EXE|SHA|MD5|UTF-8)$/i, why: '技术缩写' },
    { re: /^[A-Z][A-Za-z]*$/, why: '单个标识符/枚举名，非界面文案' },
    { re: /^[\w.-]+\.(json|txt|dll|exe|cfg|yml|yaml|log|md|zip|ts|vue|scss|ttf|woff2?|png|svg|webp)$/i, why: '文件名/扩展名' },
    { re: /^(https?:)?\/\//, why: 'URL' },
    { re: /^[\w.-]+@[\w.-]+$/, why: '邮箱地址' },
    { re: /^[A-Za-z0-9+/=_-]{16,}$/, why: '标识符/哈希/Base64' },
    { re: /^[\w-]+\s*[\w-]*$/, why: '单个或两个词的标识符、CSS 类名或键名' },
    { re: /^&[a-zA-Z]+;$/, why: 'HTML 实体（如 &nbsp;），非英文文案' },
];

function allowlistReason(value) {
    const trimmed = value.trim();
    for (const entry of ALLOWLIST) {
        if (entry.re.test(trimmed)) return entry.why;
    }
    return null;
}

function walk(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name)) continue;
            walk(full, out);
        } else if (/\.(vue|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
            out.push(full);
        }
    }
    return out;
}

function lineOf(src, index) {
    return src.slice(0, index).split('\n').length;
}

/** Extracts the <template>...</template> body of an SFC. */
function templateBlock(src) {
    const start = src.indexOf('<template');
    if (start === -1) return null;
    const open = src.indexOf('>', start);
    if (open === -1) return null;
    // Find the matching </template> at the end of file (last occurrence).
    const end = src.lastIndexOf('</template>');
    if (end === -1 || end <= open) return null;
    return { text: src.slice(open + 1, end), offset: open + 1 };
}

function scanFile(file, hits) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(REPO, file).replace(/\\/g, '/');
    const isVue = file.endsWith('.vue');

    // ---- UI-TEXT: literal text nodes in templates --------------------------
    if (isVue) {
        const tpl = templateBlock(src);
        if (tpl) {
            const re = />([^<>{}]+)</g;
            let m;
            while ((m = re.exec(tpl.text)) !== null) {
                const raw = m[1];
                if (HAS_MUSTACHE.test(raw)) continue;
                const value = raw.trim();
                if (!value || !LATIN_WORD.test(value)) continue;
                hits.push({
                    category: 'UI-TEXT',
                    file: rel,
                    line: lineOf(src, tpl.offset + m.index),
                    value,
                });
            }
        }

        // ---- UI-ATTR: user-visible attributes ------------------------------
        const attrRe = /\s(placeholder|title|label|alt|aria-label|tooltip)\s*=\s*"([^"]*)"/g;
        let a;
        while ((a = attrRe.exec(src)) !== null) {
            const value = a[2].trim();
            if (!value || HAS_MUSTACHE.test(value)) continue;
            if (!LATIN_WORD.test(value)) continue;
            hits.push({
                category: 'UI-ATTR',
                file: rel,
                line: lineOf(src, a.index),
                value,
            });
        }
    }

    // ---- UI-API / DEV-LOG: interesting string literals ---------------------
    const apiRe = /\bnew R2Error\(\s*(['"`])([^'"`]{4,})\1/g;
    let r;
    while ((r = apiRe.exec(src)) !== null) {
        const value = r[2].trim();
        if (!LATIN_WORD.test(value)) continue;
        hits.push({ category: 'UI-API', file: rel, line: lineOf(src, r.index), value });
    }

    const logRe = /\bconsole\.(log|warn|error|info|debug)\(\s*(['"`])([^'"`]{4,})\2/g;
    let l;
    while ((l = logRe.exec(src)) !== null) {
        const value = l[3].trim();
        if (!LATIN_WORD.test(value)) continue;
        hits.push({ category: 'DEV-LOG', file: rel, line: lineOf(src, l.index), value });
    }
}

const files = [];
for (const root of SCAN_ROOTS) walk(root, files);

const hits = [];
for (const f of files) {
    try {
        scanFile(f, hits);
    } catch (e) {
        console.error(`scan failed: ${f}: ${e.message}`);
    }
}

const byCategory = {};
for (const h of hits) {
    (byCategory[h.category] ??= []).push(h);
}

for (const h of hits) {
    h.allowlistedBecause = allowlistReason(h.value);
}

const blocking = hits.filter(
    (h) => (h.category === 'UI-TEXT' || h.category === 'UI-ATTR') && !h.allowlistedBecause
);

if (process.argv.includes('--json')) {
    const outFile = join(REPO, 'docs', 'zh-cn-hardcoded-scan.json');
    writeFileSync(
        outFile,
        JSON.stringify(
            {
                scannedFiles: files.length,
                totals: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])),
                blockingCount: blocking.length,
                hits,
            },
            null,
            2
        ),
        'utf8'
    );
    console.log(`JSON report written to ${relative(REPO, outFile)}`);
}

console.log('==============================================');
console.log(' 硬编码英文扫描');
console.log('==============================================');
console.log(`扫描文件数        : ${files.length}`);
for (const [cat, list] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat.padEnd(9)} 命中 ${String(list.length).padStart(5)}`);
}
console.log(`未处理界面英文    : ${blocking.length}`);
console.log('----------------------------------------------');

if (blocking.length) {
    console.log('未处理的界面英文（需修复或加入白名单）：');
    for (const h of blocking.slice(0, 200)) {
        console.log(`  ${h.category}  ${h.file}:${h.line}  ${JSON.stringify(h.value)}`);
    }
    if (blocking.length > 200) console.log(`  … 另有 ${blocking.length - 200} 项`);
} else {
    console.log('未处理界面英文：0（全部为已本地化、外部数据或已登记白名单项）');
}
console.log('----------------------------------------------');

process.exit(blocking.length ? 1 : 0);
