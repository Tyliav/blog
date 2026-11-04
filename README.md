# CyberCheems · 学习笔记与技术博客

个人技术博客，记录数据库系统，大模型系统，Serverless，与性能工程的学习笔记和项目实践。
写给未来的自己，也写给正在看这篇的人。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router / Turbopack） |
| UI | React 19、Tailwind CSS 4、next-themes 深色模式 |
| 内容 | Markdown + gray-matter，shiki + rehype-pretty-code 代码高亮 |
| AI | `/api/chat` 服务端代理，SSE 流式输出，兼容任意 OpenAI 接口 |

## 功能

- 文章列表、标签聚合、分类归档、上一篇 / 下一篇
- 自动生成目录、阅读时长、代码块一键复制
- RSS、sitemap、robots 自动生成
- 站内 AI 助手：基于文章索引回答问题、推荐阅读顺序
- 深色模式、响应式布局

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 LLM_* 配置，AI 助手才可用
npm run dev                  # http://localhost:3000
```

生产构建：

```bash
npm run build && npm start
```

## 写一篇新文章

在 `content/posts/` 下新建 `<slug>.md`，文件名即 URL（`/blog/<slug>`）：

```yaml
---
title: "标题"
date: "2026-11-04"
description: "一句话摘要，会出现在列表和 RSS 里"
tags: ["大模型", "推理优化"]
category: "大模型"
featured: false
draft: false
---
```

`draft: true` 的文章不会被打包。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LLM_BASE_URL` | AI 助手需要 | OpenAI 兼容接口地址，如 `https://api.deepseek.com/v1` |
| `LLM_API_KEY` | AI 助手需要 | 仅存在于服务端，不会下发到浏览器 |
| `LLM_MODEL` | AI 助手需要 | 如 `deepseek-chat` |
| `NEXT_PUBLIC_SITE_URL` | 部署时建议 | 站点正式地址，用于 sitemap / RSS |

## 部署

Vercel 导入本仓库即可，环境变量在项目 Settings → Environment Variables 中配置。
