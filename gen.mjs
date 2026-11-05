#!/usr/bin/env node
/**
 * deepseekbase 插件市场索引生成器
 *
 * 输入：/root/market-input.json（我们导出的插件清单 + 测试结果）
 * 输出：/root/marketgen/dist/index.json（DSH Discover 可订阅的格式 1 索引）
 *
 * 关键：用官方 @deepseek-ai/dsh-plugin-market-index 的 parseMarketIndex 校验输出。
 *
 * 用法：
 *   node gen.mjs --limit 100        // 只处理前 100 个（测试用）
 *   node gen.mjs                    // 全量
 */
import fs from "node:fs";
import path from "node:path";
import { parseMarketIndex } from "@deepseek-ai/dsh-plugin-market-index";

const INPUT = "/root/market-input.json";
const CACHE = "/root/marketgen/cache";
const OUTDIR = "/root/marketgen/dist";
const REGISTRY = "https://registry.npmjs.org/";
const CONCURRENCY = 8;
// 每个插件最多保留多少个版本（有的包发了几千个 nightly）
const MAX_VERSIONS = 8;
const TIMEOUT_MS = 30000;

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 0;

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUTDIR, { recursive: true });

/** 测试判定 → 标签 id */
function testLabel(verdict) {
  if (!verdict) return "untested";
  if (verdict === "pass") return "installs-fine";
  if (verdict === "installs_but_not_registered") return "inert";
  if (verdict === "config_failed") return "config-broken";
  if (verdict === "boot_failed") return "boot-fails";
  return "cannot-install";
}

/** 分类 id 清理 */
function catId(c) {
  const s = String(c || "").trim().toLowerCase();
  if (!s) return "other";
  return s.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

async function fetchPackument(name) {
  const safe = name.replace(/[/@]/g, "_");
  const cf = path.join(CACHE, safe + ".json");
  if (fs.existsSync(cf)) {
    try {
      return JSON.parse(fs.readFileSync(cf, "utf8"));
    } catch {
      /* fallthrough */
    }
  }
  const url = REGISTRY + name.replace("/", "%2f");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const doc = await res.json();
    fs.writeFileSync(cf, JSON.stringify(doc));
    return doc;
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/** 该 version manifest 是否是可安装的 bundle */
function bundlePatch(manifest) {
  const p = manifest && manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch;
  if (!p) return null;
  return p;
}

/** engines.dsh：优先 manifest.engines.dsh，否则从 peerDependencies 推断 */
function enginesDsh(manifest) {
  const e = manifest && manifest.engines && manifest.engines.dsh;
  if (typeof e === "string" && e.trim()) return e.trim();
  const peers = (manifest && manifest.peerDependencies) || {};
  const parts = [];
  for (const [k, v] of Object.entries(peers)) {
    if (!k.startsWith("@deepseek-ai/dsh")) continue;
    if (typeof v !== "string") continue;
    if (v === "workspace:*" || v === "workspace:^" || v === "workspace:~") continue;
    parts.push(v);
  }
  // 多个范围取交集太复杂，这里只在唯一时返回
  if (parts.length === 1 && parts[0] !== "*") return parts[0];
  return undefined;
}

function semverDesc(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? parseInt(x, 10) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? parseInt(x, 10) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i];
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return y - x;
    if (typeof x === "number") return -1;
    if (typeof y === "number") return 1;
    return String(y).localeCompare(String(x));
  }
  return 0;
}

async function processOne(item) {
  const doc = await fetchPackument(item.name);
  if (doc.error) return { skip: doc.error };

  const versions = doc.versions || {};
  const times = doc.time || {};
  const good = [];

  for (const [ver, manifest] of Object.entries(versions)) {
    if (!bundlePatch(manifest)) continue;
    if (manifest.private === true) continue;
    const ts = times[ver] ? Math.floor(new Date(times[ver]).getTime() / 1000) : 0;
    if (!ts) continue;
    const eng = enginesDsh(manifest);
    good.push({
      version: ver,
      publishTimestamp: ts,
      source: { type: "npm" },
      engines: eng ? { dsh: eng } : {},
      manifest,
    });
  }
  if (good.length === 0) return { skip: "no-bundle-version" };

  good.sort((a, b) => semverDesc(a.version, b.version));
  const totalVersions = good.length;
  const kept = good.slice(0, MAX_VERSIONS);
  const latest = kept[0].manifest;

  // 显示字段
  const title = latest.description ? undefined : undefined;
  const descEn = (latest.description || item.desc_en || "").trim().slice(0, 300);
  const descZh = (item.desc_zh || "").trim().slice(0, 300);

  const localized = {};
  if (descEn) localized.en = descEn;
  if (descZh) localized.zh = descZh;
  if (!localized.en && !localized.zh) localized.en = item.name;

  const repoUrl = pickRepoUrl(latest, item);
  const homepage = pickHomepage(latest, item);

  const plugin = {
    name: item.name,
    description: localized,
    metadata: {
      category: catId(item.category),
      keywords: Array.isArray(latest.keywords)
        ? latest.keywords.filter((k) => typeof k === "string").slice(0, 12)
        : [],
      labels: [testLabel(item.test)],
      sortKeys: {
        downloads: Number(item.downloads) || 0,
        versions: totalVersions,
      },
    },
    versions: kept.map((g) => ({
      version: g.version,
      publishTimestamp: g.publishTimestamp,
      source: g.source,
      engines: g.engines,
    })),
  };

  if (repoUrl) plugin.repository = repoUrl;
  if (homepage) plugin.homepage = homepage;
  let author = "";
  if (typeof latest.author === "string") {
    author = latest.author.replace(/<[^>]*>|\([^)]*\)/g, "").trim().slice(0, 80);
  } else if (latest.author && typeof latest.author.name === "string") {
    author = latest.author.name.trim().slice(0, 80);
  }
  if (author) plugin.author = author;

  return { plugin };
}

function pickRepoUrl(manifest, item) {
  const r = manifest.repository;
  let url = null;
  if (typeof r === "string") url = r;
  else if (r && typeof r.url === "string") url = r.url;
  if (!url && item.repo) {
    url = `https://github.com/${item.repo}`;
  }
  if (!url) return undefined;
  url = url.replace(/^git\+/, "").replace(/\.git$/, "");
  if (url.startsWith("github:") || url.startsWith("gitlab:")) {
    const [host, slug] = url.split(":");
    url = `https://${host === "github" ? "github.com" : "gitlab.com"}/${slug}`;
  }
  if (!/^https?:\/\//.test(url)) return undefined;
  return { url };
}

function pickHomepage(manifest, item) {
  const h = manifest.homepage;
  if (typeof h === "string" && /^https?:\/\//.test(h)) return h;
  if (item.homepage && /^https?:\/\//.test(item.homepage)) return item.homepage;
  return undefined;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  let items = raw.items || [];
  if (LIMIT > 0) items = items.slice(0, LIMIT);
  console.log(`处理 ${items.length} 个插件…`);

  const plugins = [];
  const skipped = {};
  let done = 0;
  const t0 = Date.now();

  // 并发池
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      const item = items[i];
      let r;
      try {
        r = await processOne(item);
      } catch (e) {
        r = { skip: String(e.message || e).slice(0, 80) };
      }
      if (r.plugin) plugins.push(r.plugin);
      else skipped[r.skip || "unknown"] = (skipped[r.skip || "unknown"] || 0) + 1;
      done++;
      if (done % 50 === 0) {
        const el = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  ${done}/${items.length}  保留 ${plugins.length}  跳过 ${done - plugins.length}  ${el}s`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 分类声明
  const cats = {};
  for (const p of plugins) {
    const c = p.metadata.category;
    if (!cats[c]) {
      const zhMap = {
        tool: "工具", ui: "介面", fun: "趣味", integration: "接入", device: "設備",
        deployment: "部署", memory: "記憶", model: "模型", gateway: "網關",
        sdk: "SDK", "client-web": "網頁客戶端", "client-desktop": "桌面客戶端",
        mobile: "手機", plugin: "插件", awesome: "清單", dataset: "數據集",
        space: "演示", other: "其他",
      };
      cats[c] = {
        title: { en: c, zh: zhMap[c] || c },
      };
    }
  }

  const index = {
    format: 1,
    title: {
      en: "deepseekbase — DSH plugin market with install test results",
      zh: "deepseekbase — 帶安裝測試結果的 DSH 插件市場",
    },
    description: {
      en: "Every plugin carries its real sandbox install verdict. We test each one on the current DSH release: install, list, mount, boot.",
      zh: "每個插件都帶著真實的沙箱安裝判定。我們在當前 DSH 版本上對每個插件做四階段測試：安裝、列裝、掛載、啟動。",
    },
    metadata: {
      categories: cats,
      labels: {
        "installs-fine": { title: { en: "Installs fine", zh: "裝得上" } },
        "cannot-install": { title: { en: "Cannot install", zh: "裝不上" } },
        "config-broken": { title: { en: "Config broken", zh: "配置加載失敗" } },
        "boot-fails": { title: { en: "Boot fails", zh: "啟動失敗" } },
        inert: { title: { en: "Installs but inert", zh: "裝上但不生效" } },
        untested: { title: { en: "Not tested yet", zh: "尚未測試" } },
      },
      sortKeys: {
        downloads: { title: { en: "Downloads", zh: "下載量" }, order: "desc" },
        versions: { title: { en: "Versions", zh: "版本數" }, order: "desc" },
      },
    },
    plugins,
  };

  console.log(`\n构建完成：${plugins.length} 个插件`);
  console.log("跳过原因:", skipped);

  // 官方校验
  console.log("\n用官方 parseMarketIndex 校验…");
  try {
    const validated = parseMarketIndex(index, "https://deepseekbase.com/market/index.json");
    console.log(`  ✓ 校验通过：${validated.plugins.length} 个插件`);
    fs.writeFileSync(path.join(OUTDIR, "index.json"), JSON.stringify(validated, null, 1));
    const size = fs.statSync(path.join(OUTDIR, "index.json")).size;
    console.log(`  → ${OUTDIR}/index.json (${(size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (e) {
    console.log(`  ✗ 校验失败: ${e.path || ""} ${e.reason || e.message}`);
    // 保存未校验版本方便排查
    fs.writeFileSync(path.join(OUTDIR, "index.invalid.json"), JSON.stringify(index, null, 1));
    process.exitCode = 1;
  }
}

main();
