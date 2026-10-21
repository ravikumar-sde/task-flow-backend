#!/usr/bin/env node
// Node.js 22+. No npm dependencies, model credentials, or network calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DIR = '.software-factory/context';
const MANIFEST = '.software-factory/context.config.json';
const CONFIG = '.software-factory/collector.config.json';
const OVERVIEW = `${DIR}/project-overview.md`;
const FACTS = `${DIR}/repository-facts.json`;
const INDEX = `${DIR}/source-index.json`;
const REQUIRED = [OVERVIEW, FACTS, INDEX];
const MAX_CONTEXT = 150000;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
function check(condition, message) { if (!condition) throw new Error(message); }
function git(...args) {
  try {
    return execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { throw new Error('Git read failed. Run from a repository with a committed HEAD.'); }
}
function atRoot() {
  check(fs.realpathSync(process.cwd()) === fs.realpathSync(git('rev-parse', '--show-toplevel').toString().trim()), 'Run from the working repository root.');
}
function safePath(p) {
  return typeof p === 'string' && p.length <= 255 && /^[A-Za-z0-9_./-]+$/.test(p)
    && !p.startsWith('/') && p.split('/').every(part => part && part !== '.' && part !== '..');
}
function localBytes(p, limit) {
  check(safePath(p), 'Invalid relative file path.');
  const parts = p.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const stat = fs.lstatSync(parts.slice(0, i).join('/'));
    check(!stat.isSymbolicLink(), `Symlinks are not allowed: ${p}`);
    check(i === parts.length ? stat.isFile() : stat.isDirectory(), `Not a regular path: ${p}`);
    if (i === parts.length) check(stat.size <= limit, `File exceeds size limit: ${p}`);
  }
  return fs.readFileSync(p);
}
function text(bytes) {
  check(!bytes.includes(0), 'Binary/NUL content is not supported.');
  let result;
  try { result = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Files must contain valid UTF-8.'); }
  check(result.trim(), 'Empty context/source file.');
  check(!result.startsWith('version https://git-lfs.github.com/spec/'), 'Git LFS pointers are not supported.');
  // Basic screening, not a substitute for an approved secret scanner and review.
  check(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-ant-[A-Za-z0-9_-]{15,}|\bAKIA[A-Z0-9]{16}/.test(result), 'Possible credential detected. Content not logged.');
  return result;
}
function parse(bytes, label) {
  try { return JSON.parse(text(bytes)); }
  catch (e) { if (e instanceof SyntaxError) throw new Error(`Invalid JSON: ${label}`); throw e; }
}
function manifest() {
  const cfg = parse(localBytes(MANIFEST, 16384), MANIFEST);
  check(cfg.version === 1 && Array.isArray(cfg.files) && cfg.files.length >= 1 && cfg.files.length <= 20, 'Manifest requires version 1 and 1–20 files.');
  check(new Set(cfg.files).size === cfg.files.length, 'Duplicate manifest paths.');
  for (const p of cfg.files) check(safePath(p) && /^\.software-factory\/context\/.+\.(md|txt|json)$/.test(p), 'Invalid context file path.');
  for (const p of REQUIRED) check(cfg.files.includes(p), `Manifest must include ${p}`);
  return cfg;
}
function config() {
  const cfg = parse(localBytes(CONFIG, 16384), CONFIG);
  check(cfg.version === 1, 'Collector configuration requires version 1.');
  check(Array.isArray(cfg.sourceFiles) && cfg.sourceFiles.length >= 1 && cfg.sourceFiles.length <= 500, 'Select 1–500 explicit source files.');
  check(new Set(cfg.sourceFiles).size === cfg.sourceFiles.length, 'Duplicate source paths.');
  check(Array.isArray(cfg.documentFiles), 'documentFiles must be an array (may be empty).');
  check(new Set(cfg.documentFiles).size === cfg.documentFiles.length, 'Duplicate document paths.');
  check(Number.isInteger(cfg.maxSourceBytes) && cfg.maxSourceBytes >= 1 && cfg.maxSourceBytes <= 5000000, 'maxSourceBytes must be 1–5,000,000.');
  for (const p of cfg.sourceFiles) {
    check(safePath(p), 'Invalid source path; use explicit relative filenames, not globs.');
    check(!/(^|\/)(\.env[^/]*|\.git|\.software-factory|node_modules|dist|build|coverage|vendor|secrets?|credentials?)(\/|$)|\.(pem|key|p12|pfx)$/i.test(p), `Excluded source path: ${p}`);
  }
  for (const p of cfg.documentFiles) check(cfg.sourceFiles.includes(p) && /\.(md|txt)$/.test(p), 'Documents must be selected .md/.txt source files.');
  return { ...cfg, sourceFiles: [...cfg.sourceFiles].sort(), documentFiles: [...cfg.documentFiles].sort() };
}
function collect(cfg, revision = 'HEAD') {
  // Read Git blobs, not working-tree source contents; no project scripts executed.
  const tree = new Map(git('ls-tree', '-rz', '--full-tree', revision).toString().split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t'); return [line.slice(tab + 1), line.slice(0, tab).split(' ')];
  }));
  const rows = [];
  let total = 0;
  for (const p of cfg.sourceFiles) {
    const entry = tree.get(p);
    check(entry && ['100644', '100755'].includes(entry[0]) && entry[1] === 'blob', `Missing or nonregular committed source: ${p}`);
    const size = Number(git('cat-file', '-s', entry[2]).toString());
    total += size;
    check(total <= cfg.maxSourceBytes, 'Selected source exceeds maxSourceBytes; no output written.');
    const bytes = git('cat-file', 'blob', entry[2]);
    rows.push({ path: p, bytes: bytes.length, sha256: sha256(bytes), content: text(bytes) });
  }
  return rows;
}
function fingerprint(rows, cfg) {
  return sha256(json({ config: cfg, files: rows.map(({ path, sha256 }) => ({ path, sha256 })) }));
}
function overview(value) { check(!value.includes('REPLACE_WITH_PROJECT_DETAILS'), 'Fill in project-overview.md before generating/validating.'); }
function validateContents(cfg, replacements = new Map()) {
  let total = 0;
  for (const p of cfg.files) {
    const bytes = replacements.has(p) ? Buffer.from(replacements.get(p)) : localBytes(p, MAX_CONTEXT);
    const content = text(bytes);
    total += bytes.length;
    if (p.endsWith('.json')) parse(bytes, p);
    if (p === OVERVIEW) overview(content);
  }
  check(total <= MAX_CONTEXT, 'Combined context exceeds 150,000 bytes.');
  return total;
}
export function generate() {
  atRoot();
  const cfg = config(); const m = manifest();
  const rows = collect(cfg);
  const digest = fingerprint(rows, cfg);
  let sourceRevision = git('rev-parse', 'HEAD').toString().trim();
  // Avoid churn on context-only commits. Reuse provenance only if still reachable.
  if (fs.existsSync(INDEX)) {
    const old = parse(localBytes(INDEX, MAX_CONTEXT), INDEX);
    if (old.sourceFingerprint === digest && /^[a-f0-9]{40,64}$/.test(old.sourceRevision)) {
      try { git('merge-base', '--is-ancestor', old.sourceRevision, 'HEAD'); sourceRevision = old.sourceRevision; } catch { /* Re-record HEAD after history rewriting. */ }
    }
  }
  const packages = rows.filter(r => path.posix.basename(r.path) === 'package.json').map(r => {
    const pkg = parse(Buffer.from(r.content), r.path);
    const dependencies = {};
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const entries = Object.entries(pkg[key] || {});
      check(entries.every(([, v]) => typeof v === 'string'), `Invalid dependency map: ${r.path}`);
      // Do not propagate credential-bearing Git/HTTP dependency URLs.
      dependencies[key] = Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, /:\/\/|@.*:/.test(v) ? '[external location omitted]' : v]));
    }
    return { path: r.path, name: typeof pkg.name === 'string' ? pkg.name : null, dependencies, scriptNames: Object.keys(pkg.scripts || {}).sort() };
  });
  const common = { version: 1, collectorVersion: 1, sourceRevision, sourceFingerprint: digest };
  const facts = { ...common, coverage: 'Explicit selected files only; no full-project semantic analysis.',
    limitations: ['No API, schema, or import parsing in this version.', 'Business meaning comes from the human overview and selected documents.', 'Unselected files are not inspected. Basic credential screening is not exhaustive.'],
    packages, documents: rows.filter(r => cfg.documentFiles.includes(r.path)).map(r => ({ path: r.path, content: r.content })) };
  const index = { ...common, sourceFiles: rows.map(({ content, ...metadata }) => metadata) };
  const outputs = new Map([[FACTS, json(facts)], [INDEX, json(index)]]);
  validateContents(m, outputs); // Validate both outputs before replacing either.
  // The overview's validated parent guarantees the output directory already exists.
  for (const p of outputs.keys()) {
    try { localBytes(p, MAX_CONTEXT); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  for (const [p, content] of outputs) {
    fs.writeFileSync(p, content, { flag: fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW });
  }
  console.log(`Generated two context files from ${rows.length} committed sources. Review before merging.`);
}
export function validate({ fresh = false } = {}) {
  atRoot();
  const m = manifest(); const bytes = validateContents(m);
  const facts = parse(localBytes(FACTS, MAX_CONTEXT), FACTS);
  const index = parse(localBytes(INDEX, MAX_CONTEXT), INDEX);
  for (const item of [facts, index]) {
    check(item.version === 1 && item.collectorVersion === 1 && /^[a-f0-9]{40,64}$/.test(item.sourceRevision)
      && /^[a-f0-9]{64}$/.test(item.sourceFingerprint), 'Invalid generated metadata.');
  }
  check(facts.sourceFingerprint === index.sourceFingerprint && facts.sourceRevision === index.sourceRevision, 'Generated context files disagree. Regenerate both.');
  check(Array.isArray(facts.packages) && Array.isArray(facts.documents) && Array.isArray(facts.limitations), 'Invalid facts structure.');
  check(Array.isArray(index.sourceFiles) && index.sourceFiles.length >= 1 && index.sourceFiles.length <= 500, 'Invalid source index.');
  check(new Set(index.sourceFiles.map(r => r.path)).size === index.sourceFiles.length, 'Duplicate index paths.');
  for (const r of index.sourceFiles) check(safePath(r.path) && /^[a-f0-9]{64}$/.test(r.sha256) && Number.isInteger(r.bytes) && r.bytes > 0, 'Invalid source index entry.');
  if (fresh) {
    const cfg = config();
    check(fingerprint(collect(cfg), cfg) === index.sourceFingerprint, 'Selected sources/config changed. Regenerate context.');
  }
  console.log(`Context valid: ${m.files.length} files, ${bytes} bytes. ${fresh ? 'Selected committed sources match.' : 'Freshness not checked.'}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [mode, flag, ...extra] = process.argv.slice(2);
    check(!extra.length && (!flag || (mode === 'validate' && flag === '--check-fresh')), 'Unsupported arguments.');
    if (mode === 'generate') generate();
    else if (mode === 'validate') validate({ fresh: flag === '--check-fresh' });
    else throw new Error('Usage: node scripts/collect-project-context.mjs generate|validate [--check-fresh]');
  } catch (e) {
    console.error(e.code ? `File operation failed (${e.code}). Check required paths and permissions.` : e.message);
    process.exitCode = 1;
  }
}
