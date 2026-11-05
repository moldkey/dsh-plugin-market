# DSH Plugin Market — by deepseekbase

**A plugin market index for DeepSeek Harness where every entry carries its real install verdict.**

Subscribe in DSH:

```
Settings → Plugin market → Add index source
https://deepseekbase.com/market/index.json
```

---

## Why another market?

DSH ships with **no default market**. The official design says:

> "No official market exists, so DSH cannot ship a default source; the sources are user data."

So markets are third-party. The question is: what makes one worth subscribing to?

**Ours answers a question no other market does: does this plugin actually install?**

Every plugin in this index carries a label from a real sandbox test on the current DSH release:

| Label | Meaning |
|---|---|
| `installs-fine` | Installed, listed, mounted and booted successfully |
| `cannot-install` | Install stage failed outright |
| `config-broken` | Installed but the profile tree would not compose |
| `boot-fails` | Composed but the profile crashed on boot |
| `inert` | Installed and composed, but never appeared in the tree |
| `untested` | In the index, not yet tested |

**Current snapshot:** 4,367 plugins indexed, 120 tested, 104 pass (87%).

Full test detail, including the exact error for every failure:
**https://deepseekbase.com/ecosystem/plugin-tests/**

---

## How the test works

Four stages, each in a fresh container:

| Stage | Network | What happens |
|---|---|---|
| 1 | on | `dsh plugin --profile web add <pkg>` in a clean profile |
| 2 | **off** | `dsh plugin list` confirms the install |
| 3 | **off** | `dsh --profile web --dump-config` confirms it mounted |
| 4 | **off** | boot the profile, confirm the process stays alive |

Stages 2–4 run with `--network none`, so a malicious plugin has nowhere to send data.
Containers are destroyed after each run.

---

## Submitting a plugin

Open a pull request adding one line to `plugins.txt`:

```diff
+ dsh-my-plugin
+ https://github.com/someone/dsh-other
```

That is the whole process. A maintainer reviews it, the index regenerates, and your plugin
appears in Discover.

### Don't use GitHub?

You have two options:

1. **We submit it for you.** Open an issue with the package name or repository URL and we will
   add it. No GitHub experience required beyond opening an issue — or just email us.
2. **Read the tutorial:** https://deepseekbase.com/dev/plugin/

Everyone starts somewhere.

---

## What gets listed

A package is listed only when its manifest declares `dsh.bundle.patch` — the same rule the
official generator uses. We also skip `"private": true` packages and versions without a
publish timestamp.

Each plugin keeps its **8 most recent versions** (some packages publish thousands of nightly
builds, which would make the index unusably large).

---

## What we do not do

- We do not host or distribute plugin code. Every version installs from npm or Git.
- We do not accept payment on behalf of plugin authors. If you want to charge for a plugin,
  use your own payment page — we take 0%.
- We do not score or rank plugin quality. We report a fact: did it install.

---

## Who runs this

[deepseekbase.com](https://deepseekbase.com) — a third-party DeepSeek ecosystem index.
Not affiliated with DeepSeek.

| | |
|---|---|
| 287 pages | pricing, providers, 7,164 derived models, 8,559 plugins, industry kits |
| 21 open datasets | every figure carries a source and verification date |
| Free plugin testing | this index is built on it |
| MCP server | https://deepseekbase.com/mcp |

---

## Licence

MIT for the tooling in this repository. The compiled index is generated from public registry
data; per-plugin attribution is carried in the index itself.
