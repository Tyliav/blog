import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { readingTime } from "@/lib/utils";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  category: string;
  featured: boolean;
  draft: boolean;
  readingTime: string;
};

export type Post = PostMeta & { content: string };

function readDir(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));
}

function parseFile(fileName: string): Post | null {
  const slug = fileName.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  if (!data.title || !data.date) return null;

  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === "string"
      ? data.tags.split(/[,，]/).map((tag: string) => tag.trim()).filter(Boolean)
      : [];

  return {
    slug,
    title: String(data.title),
    date: new Date(data.date).toISOString(),
    description: String(data.description ?? ""),
    tags,
    category: String(data.category ?? "未分类"),
    featured: Boolean(data.featured),
    draft: Boolean(data.draft),
    readingTime: readingTime(content),
    content,
  };
}

/** 全部文章（已发布），按时间倒序。 */
export function getAllPosts(): Post[] {
  return readDir()
    .map(parseFile)
    .filter((post): post is Post => post !== null && !post.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** 只含元数据，用于列表页 / 搜索索引（不返回正文，避免打包体积膨胀）。 */
export function getAllPostMeta(): PostMeta[] {
  return getAllPosts().map(({ content: _content, ...meta }) => meta);
}

export function getPostBySlug(slug: string): Post | null {
  const fileName = readDir().find(
    (file) => file.replace(/\.mdx?$/, "") === slug,
  );
  return fileName ? parseFile(fileName) : null;
}

export function getAdjacentPosts(slug: string) {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  return {
    newer: index > 0 ? posts[index - 1] : null,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null,
  };
}

export type TagCount = { name: string; count: number };

export function getAllTags(): TagCount[] {
  const counter = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}

export function getPostsByCategory(category: string): Post[] {
  return getAllPosts().filter((post) => post.category === category);
}

export function getCategories(): TagCount[] {
  const counter = new Map<string, number>();
  for (const post of getAllPosts()) {
    counter.set(post.category, (counter.get(post.category) ?? 0) + 1);
  }
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
