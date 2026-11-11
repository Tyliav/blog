#!/usr/bin/env node
/**
 * 新建一篇文章。
 *
 *   npm run new:post <文件名> [标题] [摘要]
 *
 * 例：
 *   npm run new:post kv-cache "KV Cache 原理" "讲清楚前缀缓存怎么工作的"
 *
 * 会自动填好标题和今天的日期，并生成 content/posts/<文件名>.md。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = path.join(ROOT, "content", "posts");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("用法：npm run new:post <文件名> [标题] [摘要]");
  console.error(
    '例：  npm run new:post kv-cache "KV Cache 原理" "讲清楚前缀缓存怎么工作的"',
  );
  process.exit(1);
}

const [slug, rawTitle, rawDescription] = args;

if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`文件名只能用小写字母、数字和中划线：${slug}`);
  process.exit(1);
}

const target = path.join(POSTS_DIR, `${slug}.md`);

if (fs.existsSync(target)) {
  console.error(`已存在同名文章：content/posts/${slug}.md`);
  process.exit(1);
}

const now = new Date();
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

const yamlString = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const title = rawTitle ?? slug.replace(/-/g, " ");
const description = rawDescription ?? "";

const content = `---
title: ${yamlString(title)}
date: ${yamlString(date)}
description: ${yamlString(description)}
tags: []
category: "未分类"
featured: false
draft: false
---

正文从这里开始写。语法速查见 \`content/posts/_template.md\`。
`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(target, content, "utf8");

console.log(`已创建 content/posts/${slug}.md`);
console.log(`  标题：${title}`);
console.log(`  日期：${date}`);
console.log(`  路径：/blog/${slug}`);
