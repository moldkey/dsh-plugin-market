# 提交你的插件

有两种方式。**不会 GitHub 也能提交。**

---

## 方式一：提 PR（如果你会用 GitHub）

1. Fork 这个仓库
2. 在 `plugins.txt` 里加一行
3. 提 PR

```diff
 # ── 我们自己的插件 ──
 https://github.com/moldkey/dsh-deepseekbase
+
+# ── 我的插件 ──
+dsh-my-plugin
+# 或者
+https://github.com/me/dsh-my-plugin
```

**就这些。** 维护者会看，合并后索引自动更新。

### 格式规则

| 类型 | 写法 | 例子 |
|---|---|---|
| npm 套件 | 套件名 | `dsh-pet`、`@scope/dsh-plugin` |
| Git 仓库 | 完整 https URL | `https://github.com/owner/repo` |

**不接受：**
- `http:`（必須 https）
- 帶帳號密碼的 URL
- 帶 query 或 fragment 的 URL
- tarball 直鏈

---

## 方式二：让我们帮你提交（不会 GitHub 用这个）

**开一个 Issue 就行：**

1. 点 [Issues](../../issues) → New issue
2. 标题写：`提交插件：<你的插件名>`
3. 正文写：
   ```
   插件名：dsh-my-plugin
   仓库：https://github.com/me/dsh-my-plugin
   一句话说明：做什么用的
   ```
4. 提交

**我们会在 48 小时内帮你加进去。**

> 连 Issue 都不想开？发邮件到 GitHub 个人页上的邮箱也行。

---

## 提交前检查清单

你的插件必须满足这些，否则会被拒：

| 要求 | 怎么检查 |
|---|---|
| `package.json` 里有 `dsh.bundle.patch` | 打开文件看 |
| 不是 `"private": true` | 同上 |
| 有发布版本 | npm 上能查到，或 Git 有 tag |
| `engines.dsh` 不要写死上界 | 见下方警告 |

### ⚠️ 最常见被拒原因：engines.dsh 写死上界

我们发现 122 个头部插件里，**8 个因为这个问题装不上**。

**错的写法：**
```json
"engines": { "dsh": ">=0.2.0-rc.2 <0.2.2-0" }
```
这排除了 `0.2.2-rc.1`，用户在最新版上装不了。

**对的写法：**
```json
"engines": { "dsh": ">=0.2.0" }
```
只写下界，不封顶。

---

## 提交后会怎样

1. 我们合并 PR
2. 索引重新生成（约 3 分钟）
3. 你的插件出现在 DSH 的 Discover 页
4. **我们还会免费测它装不装得上**，结果标注在你的插件上

如果测试失败，你会看到具体错误 —— 拿去修就行。
**我们记录的是事实，不是评价你的代码。**

---

## 想学怎么写插件

看这个：**https://deepseekbase.com/dev/plugin/**

十章，含我们自己的真实踩坑记录（两个报错都是我们实际遇到的）。

---

## 关于收费

如果你想给你的插件收费：

- 用你自己的收款页（爱发电 / Stripe / Gumroad / Creem）
- 在 README 里写清楚
- **我们不抽成，也不经手你的钱**

详见：https://deepseekbase.com/plugin/
