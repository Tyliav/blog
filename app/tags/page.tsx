import type { Metadata } from "next";
import { Hash } from "lucide-react";
import Link from "next/link";
import { getAllTags } from "@/lib/posts";

export const metadata: Metadata = {
  title: "标签",
  description: "按主题浏览全部学习笔记。",
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
      <header className="animate-rise">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">标签</h1>
        <p className="mt-3 text-sm text-muted sm:text-base">
          共 {tags.length} 个主题标签，点击进入对应笔记集合。
        </p>
      </header>

      <div className="mt-10 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <Link
            key={tag.name}
            href={`/tags/${encodeURIComponent(tag.name)}`}
            className="group inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md hover:shadow-black/5"
          >
            <Hash className="size-3.5 text-brand" />
            <span className="text-sm font-medium">{tag.name}</span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
              {tag.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
