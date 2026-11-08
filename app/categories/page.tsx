import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getAllPostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "分类",
  description: "按主题分类浏览全部学习笔记。",
};

export default function CategoriesPage() {
  const posts = getAllPostMeta();

  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const list = groups.get(post.category) ?? [];
    list.push(post);
    groups.set(post.category, list);
  }

  const categories = [...groups.entries()]
    .map(([name, list]) => ({ name, posts: list }))
    .sort(
      (a, b) =>
        b.posts.length - a.posts.length || a.name.localeCompare(b.name, "zh-CN"),
    );

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <header className="animate-rise">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">分类</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          每篇笔记都归属一个主题分类。分类比标签更粗、更稳定，适合按方向系统性地读。
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">还没有文章。</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/categories/${encodeURIComponent(category.name)}`}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-line hover:shadow-lift"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-brand">
                  {category.name}
                </h2>
                <span className="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand tabular-nums">
                  {category.posts.length} 篇
                </span>
              </div>

              <ul className="mt-4 flex flex-col gap-2">
                {category.posts.slice(0, 3).map((post) => (
                  <li
                    key={post.slug}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-muted">{post.title}</span>
                    <span className="shrink-0 text-xs text-muted/70 tabular-nums">
                      {formatDate(post.date)}
                    </span>
                  </li>
                ))}
              </ul>

              <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-brand">
                查看全部 {category.posts.length} 篇
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
