---
title: "用 Next.js + Serverless 搭一个带 AI 助手的博客"
date: "2026-10-06"
description: "把博客做成静态站，再加一个 Serverless 接口承接 AI 对话——全程零服务器、几乎零成本，这篇记录整个实现与踩坑过程。"
tags: ["工程实践", "Next.js", "Serverless", "TypeScript"]
category: "工程实践"
---

这个博客本身就是我第一个完整部署的项目。目标很明确：**免费托管、写 Markdown 就发文章、内置一个能回答问题的 AI 助手**。这篇记录架构选择和实现细节。

## 架构

```text
content/posts/*.md
        │
        │ 构建时解析（gray-matter + remark）
        ▼
   Next.js 静态页面 ──────► GitHub / Vercel / Cloudflare Pages
        │
        └─ /api/chat （Serverless Function）
                 │
                 ▼
           大模型 API（密钥只在服务端）
```

关键点：**博客内容是静态的，只有对话是动态的**。所以静态托管平台（免费、快、稳）和 Serverless 函数（按需、有状态）可以各司其职。

## 内容层：Markdown 就是数据库

选择 Markdown 而不是数据库，好处是做笔记顺手、可以随时用编辑器改、diff 友好。

```ts
// lib/posts.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export function getAllPosts(): Post[] {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title),
        date: new Date(data.date).toISOString(),
        description: String(data.description ?? ""),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        content,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
```

### Markdown 转 HTML 与目录

用 unified 生态，标题 id 和目录一起生成：

```ts
// lib/markdown.ts
const toc: TocItem[] = [];

const file = await remark()
  .use(remarkGfm)                      // 表格、任务列表、自动链接
  .use(remarkRehype)
  .use(rehypeSlug)                     // 生成标题 id
  .use(rehypeCollectHeadings, toc)     // 收集目录
  .use(rehypeAutolinkHeadings)         // 标题可点击
  .use(rehypePrettyCode, {             // 代码高亮（双主题）
    theme: { light: "github-light", dark: "github-dark-dimmed" },
  })
  .use(rehypeStringify)
  .process(source);
```

`rehypeSlug` 必须排在收集目录之前，否则拿不到 id。双主题代码高亮靠 CSS 变量切换：

```css
code[data-theme*=" "] span { color: var(--shiki-light); }
.dark code[data-theme*=" "] span { color: var(--shiki-dark); }
```

## AI 接口：密钥绝不能进浏览器

这是整个项目最重要的安全边界。如果直接在 React 组件里调大模型 API，按 F12 就能看到密钥，几天后你的额度就没了。

正确做法是加一层 Serverless 路由做代理：

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json();

  const upstream = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    }),
  });

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

客户端只看到 `/api/chat`，看不到上游地址和密钥。

### 流式输出的前端

SSE 逐块读取，边读边追加到消息末尾：

```ts
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const { delta } = JSON.parse(data);
    appendToLastMessage(delta);
  }
}
```

> **踩坑**：`buffer = lines.pop() ?? ""` 这一行不能少。SSE 的数据块可能在网络层被切成两半，最后一行经常是不完整的，直接 `split` 会丢掉半截内容。

## 让助手「懂」这个博客

如果助手只是通用聊天机器人，价值就打折了。做法是**在系统提示词里塞进全站文章索引**：

```ts
function buildSystemPrompt() {
  const index = getAllPostMeta()
    .map((p) => `- [${p.title}](/blog/${p.slug}) | 标签: ${p.tags.join("、")} | ${p.description}`)
    .join("\n");

  return [
    "你是一个技术博客的内置 AI 助手。",
    "回答时优先引用下面索引里的笔记，并说明依据。",
    "=== 博客文章索引 ===",
    index,
  ].join("\n");
}
```

这样它能回答「我写过哪些关于 RAG 的笔记」「推荐一下复习顺序」这类问题。

索引是构建时从文件系统读的，不需要额外数据库，也不会因为文章多了而拖慢接口。

## 一些细节

### 限流

公开部署的接口会被人刷。加一个内存限流：

```ts
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT.max;
}
```

> 注意：Serverless 实例随时会被回收，内存限流是 best-effort 的，**真正的防线是模型服务商的用量上限**。两层都要有。

### 优雅降级

没配置密钥时，不要返回 500 报错，而是返回一个友好的提示：

```ts
if (!baseUrl || !apiKey || !model) {
  return Response.json(
    { error: "NOT_CONFIGURED", message: "AI 助手还没有配置…" },
    { status: 503 },
  );
}
```

### 深色模式

用 `next-themes` 的 class 模式，配合 CSS 变量切换：

```css
:root { --canvas: #ffffff; --ink: #0d1117; }
.dark { --canvas: #090c12; --ink: #e8ecf3; }
```

只写一套组件，主题由变量决定。

## 成本

| 项目 | 费用 | 说明 |
| --- | --- | --- |
| 静态托管 | 0 | GitHub Pages / Vercel / Cloudflare Pages 都有免费额度 |
| 域名 | 约 10–30 元 / 年 | 首年常有促销 |
| 大模型 API | 按量 | 个人博客用量很小，DeepSeek / GLM 的免费额度通常够用 |
| Serverless 调用 | 0 | 免费额度足够个人博客 |

**核心结论：不需要租服务器。** 静态托管免费，AI 接口按调用付费且有免费额度，总成本基本就是一个域名。

## 下一步

- [ ] 把 `/api/chat` 加上更严格的限流（用 KV 或 Durable Objects）
- [ ] 检索增强：让助手真正读全文而不只是索引
- [ ] 加一个「阅读进度」记录，配合错题本
