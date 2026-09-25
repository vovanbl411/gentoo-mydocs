#!/usr/bin/env node
// Guard синхронизации переводов RU → EN (контракт — DOCUMENTATION_POLICY.md §10).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DOCS_ROOT = 'src/content/docs';
const DOCS_PREFIX = `${DOCS_ROOT}/`;
const EN_PREFIX = `${DOCS_ROOT}/en/`;
const CONTENT_EXTS = new Set(['.md', '.mdx']);

const ruToEn = (p) => EN_PREFIX + p.slice(DOCS_PREFIX.length);
const enToRu = (p) => DOCS_PREFIX + p.slice(EN_PREFIX.length);

function git(root, args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: root });
}

function revResolve(root, ref) {
  try {
    return git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim() || null;
  } catch {
    return null;
  }
}

function listContentFiles(root) {
  const ru = new Set();
  const en = new Set();
  const docsDir = path.join(root, DOCS_ROOT);
  if (!fs.existsSync(docsDir)) return { ru, en };
  for (const rel of fs.readdirSync(docsDir, { recursive: true })) {
    const relPosix = String(rel).split(path.sep).join('/');
    if (!CONTENT_EXTS.has(path.posix.extname(relPosix))) continue;
    if (relPosix.split('/').some((segment) => segment.startsWith('.'))) continue;
    if (!fs.statSync(path.join(docsDir, relPosix)).isFile()) continue;
    const repoRel = DOCS_PREFIX + relPosix;
    if (repoRel.startsWith(EN_PREFIX)) en.add(repoRel);
    else ru.add(repoRel);
  }
  return { ru, en };
}

// -z + --no-renames: записи вида <status>\0<path>\0, без второй пары для rename.
function changedInCommitRange(root, baseSha) {
  const records = git(root, [
    'diff', '--name-status', '-z', '--no-renames', baseSha, 'HEAD', '--', DOCS_ROOT,
  ]).split('\0');
  const paths = new Set();
  for (let i = 0; i + 1 < records.length; i += 2) {
    if (!records[i].startsWith('D')) paths.add(records[i + 1]);
  }
  return paths;
}

// -z: записи вида <XY><space><path>\0; охватывает staged/unstaged/untracked.
function changedInWorkingTree(root) {
  const records = git(root, [
    'status', '--porcelain', '-z', '--no-renames', '--', DOCS_ROOT,
  ]).split('\0');
  const paths = new Set();
  for (const record of records) {
    if (record) paths.add(record.slice(3));
  }
  return paths;
}

function githubPushBase(root) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return { sha: null, note: null };
  let before;
  try {
    before = JSON.parse(fs.readFileSync(eventPath, 'utf8')).before;
  } catch {
    return { sha: null, note: null };
  }
  if (typeof before !== 'string' || !/^[0-9a-f]{40}$/.test(before) || /^0+$/.test(before)) {
    return { sha: null, note: null };
  }
  if (!revResolve(root, before)) {
    return { sha: null, note: "github 'before' not in local history" };
  }
  return { sha: before, note: null };
}

function parseArgs(argv) {
  let base = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' && i + 1 < argv.length) {
      base = argv[++i];
    } else if (arg.startsWith('--base=') && arg.length > '--base='.length) {
      base = arg.slice('--base='.length);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Usage: node scripts/check-i18n-sync.mjs [--base <git-ref>]');
      process.exit(2);
    }
  }
  return base;
}

function main() {
  const baseOverride = parseArgs(process.argv.slice(2));
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const { ru, en } = listContentFiles(root);

  let rangeLabel;
  let mentioned;
  if (baseOverride) {
    const sha = revResolve(root, baseOverride);
    if (!sha) {
      console.error(`--base: revision not found: ${baseOverride}`);
      process.exit(2);
    }
    mentioned = changedInCommitRange(root, sha);
    rangeLabel = `${sha.slice(0, 10)}..HEAD (--base ${baseOverride})`;
  } else {
    const push = githubPushBase(root);
    if (push.sha) {
      mentioned = changedInCommitRange(root, push.sha);
      rangeLabel = `${push.sha.slice(0, 10)}..HEAD (github push)`;
    } else {
      mentioned = changedInWorkingTree(root);
      if (mentioned.size > 0) {
        rangeLabel = 'working tree vs HEAD';
      } else {
        const parent = revResolve(root, 'HEAD^');
        if (parent) {
          mentioned = changedInCommitRange(root, parent);
          rangeLabel = `HEAD^..HEAD${push.note ? ` — ${push.note}` : ''}`;
        } else {
          mentioned = new Set();
          rangeLabel = 'no parent commit — structural checks only';
        }
      }
    }
  }

  // Удалённые в диапазоне файлы не существуют в текущем состоянии — гасим
  // пересечением с FS; их последствия ловит структурная проверка orphan'ов.
  const changed = new Set([...mentioned].filter((p) => ru.has(p) || en.has(p)));

  const orphans = [...en].filter((p) => !ru.has(enToRu(p))).sort();

  const stale = [];
  const synced = [];
  const fallback = [];
  for (const ruPath of [...changed].filter((p) => ru.has(p)).sort()) {
    const enPath = ruToEn(ruPath);
    if (!en.has(enPath)) fallback.push(ruPath);
    else if (changed.has(enPath)) synced.push([ruPath, enPath]);
    else stale.push([ruPath, enPath]);
  }

  const translated = [...ru].filter((p) => en.has(ruToEn(p))).length;
  const lines = [`i18n sync: ${stale.length || orphans.length ? 'FAIL' : 'PASS'}`];

  if (stale.length) {
    lines.push('', 'Stale translation:');
    for (const [ruPath, enPath] of stale) lines.push(`  RU: ${ruPath}`, `  EN: ${enPath}`);
  }
  if (orphans.length) {
    lines.push('', 'Orphan translation:');
    for (const enPath of orphans) {
      lines.push(`  EN: ${enPath}`, `  RU source missing: ${enToRu(enPath)}`);
    }
  }
  if (!stale.length && !orphans.length) {
    if (synced.length) {
      lines.push('', 'Synced:');
      for (const [ruPath, enPath] of synced) lines.push(`  RU: ${ruPath}`, `  EN: ${enPath}`);
    }
    if (fallback.length) {
      lines.push('', 'Fallback:');
      for (const ruPath of fallback) lines.push(`  ${ruPath}`);
    }
  }

  lines.push(
    '',
    `Range: ${rangeLabel}`,
    `Russian sources: ${ru.size}`,
    `English translations: ${en.size}`,
    `Fallback-only pages: ${ru.size - translated}`,
    `Changed Russian sources: ${stale.length + synced.length + fallback.length}`,
  );
  console.log(lines.join('\n'));
  process.exit(stale.length || orphans.length ? 1 : 0);
}

try {
  main();
} catch (err) {
  console.error(`i18n sync: ERROR: ${err.message}`);
  process.exit(2);
}
