# CyberCheems · 学习笔记与技术博客

个人技术博客，记录数据库系统，大模型系统，Serverless，与性能工程的学习笔记和项目实践。
写给未来的自己，也写给正在看这篇的人。

- 线上地址：https://cybercheems.top
- 仓库地址：https://github.com/Tyliav/blog

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router / Turbopack） |
| UI | React 19、Tailwind CSS 4、next-themes 深色模式 |
| 内容 | Markdown + gray-matter，shiki + rehype-pretty-code 代码高亮 |
| AI | `/api/chat` 服务端代理，SSE 流式输出，兼容任意 OpenAI 接口 |
| 托管 | Vercel（构建、CDN、Serverless 函数） |

## 功能

- 文章列表、标签聚合、分类归档、上一篇 / 下一篇
- 自动生成目录、阅读时长、代码块一键复制
- RSS、sitemap、robots 自动生成
- 站内 AI 助手：基于文章索引回答问题、推荐阅读顺序
- 浅色 / 深色双主题（默认浅色）、响应式布局

## 域名与上线

自有域名 `cybercheems.top`（阿里云万网注册），Vercel 负责托管与证书。
Vercel 分配的 `*.vercel.app` 地址同时保留，可作为备用入口。

### 1. 在 Vercel 添加域名

Vercel 控制台 → 该项目 → **Settings → Domains** → 输入 `cybercheems.top` → Add。
按 Vercel 页面提示配置 DNS，裸域名通常使用 `A` 记录，`www` 通常使用 `CNAME`，
记录值以控制台实际显示为准。

### 2. 在阿里云配 DNS

阿里云控制台 → 云解析 DNS → `cybercheems.top` → 解析设置 → 添加记录，
把 Vercel 给的记录抄进去。然后在 Vercel 的 Domains 页面等它变成有效状态，
验证通过后会自动配置 HTTPS 证书。DNS 生效时间因服务商与缓存而异。

### 3. 改站点地址并重新部署

Vercel → Settings → Environment Variables，把 `NEXT_PUBLIC_SITE_URL` 改成
`https://cybercheems.top`，然后 **Redeploy**。这个变量用于 sitemap、RSS 和 Open Graph
等元数据中的站点地址。仓库里 `lib/site.ts` 的默认值也已同步，漏配也不会指向 localhost。

> 提示：Vercel 默认已开启 HTTPS 强制跳转，`www` 与裸域名互跳也在 Domains 页面一键设置。

## 日常流程：写一篇笔记并发到线上

```bash
cd ~/blog                     # 进项目目录
git pull                      # 先同步远程（习惯动作，没冲突时瞬间完成）
# 写新文章：在 content/posts/ 下新建 xxx.md
git add -A                    # 暂存所有改动（新文件必须显式 add）
git commit -m "add: 写一篇 XXX 笔记"
git push                      # 推上去，Vercel 自动部署
```

`git push` 完成后约 1 分钟线上更新，网址不变。构建失败不会影响已上线的版本，
Vercel 会继续提供上一次成功的部署；改好再推一次即可。

想推之前先看效果：

```bash
npm run dev                   # http://localhost:3000，Ctrl+C 停止
```

## 写一篇新文章

在 `content/posts/` 下新建 `<slug>.md`，**文件名即 URL**：`kv-cache.md` → `/blog/kv-cache`。
最省事的做法是复制 `content/posts/_template.md`，改名后填内容即可；
模板本身因为标题为空会被自动忽略，不会发布到网站上。

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

`draft: true` 的文章不会被打包进站点。`featured: true` 会出现在首页精选位。

### 配图

图片放 `public/` 下，用绝对路径引用。例如 `public/llm/kv.png` 写作：

```markdown
![KV Cache 显存占用](/llm/kv.png)
```

直接放 `content/posts/` 里浏览器访问不到。

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

## 冲突处理

本地和 GitHub 网页端都改过同一个文件，`git push` 会报 `rejected (fetch first)`。执行：

```bash
git pull --rebase
```

- **没有冲突**：自动合并，顺手 rebase 完，再 `git push` 即可。
- **有冲突**：Git 在文件里插入 `<<<<<<<` / `=======` / `>>>>>>>` 标记，手动改成最终内容，删掉这些标记，然后

  ```bash
  git add -A
  git rebase --continue
  git push
  ```

  改乱了想放弃、回到 rebase 之前：

  ```bash
  git rebase --abort
  ```

避免冲突的习惯：**同一篇文章只在一处改**。要网页端改就先把本地推干净，要本地改就先 `git pull`。

## 分支预览

改布局、换主题这类大改动，先推到分支看预览，不影响正式站：

```bash
git checkout -b redesign
git add -A && git commit -m "改版"
git push -u origin redesign    # Vercel 生成独立预览地址
```

满意后合并回 main：

```bash
git checkout main
git merge redesign
git push
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LLM_BASE_URL` | AI 助手需要 | OpenAI 兼容接口地址，如 `https://api.deepseek.com/v1` |
| `LLM_API_KEY` | AI 助手需要 | 仅存在于服务端，不会下发到浏览器 |
| `LLM_MODEL` | AI 助手需要 | 如 `deepseek-chat` |
| `NEXT_PUBLIC_SITE_URL` | 部署时建议 | 站点正式地址，用于 sitemap / RSS |

Vercel 项目中在 Settings → Environment Variables 配置，改完需要 Redeploy 才生效。

## 目录结构

```
app/            路由页面与 API（app/api/chat 是 AI 助手）
components/     UI 组件
content/posts/  Markdown 文章（写作只动这里）
lib/posts.ts    文章读取、排序、标签统计
lib/site.ts     站名、简介、导航、首页方向卡片
public/         静态资源（图片等）
```
