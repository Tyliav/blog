"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PostCard } from "@/components/post-card";
import type { PostMeta } from "@/lib/posts";

export function PostExplorer({
  posts,
  tags,
}: {
  posts: PostMeta[];
  tags: { name: string; count: number }[];
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchTag = !activeTag || post.tags.includes(activeTag);
      if (!matchTag) return false;
      if (!keyword) return true;
      const haystack = [
        post.title,
        post.description,
        post.category,
        ...post.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [posts, query, activeTag]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、摘要或标签…"
            className="w-full rounded-xl border border-line bg-surface py-3 pr-10 pl-10 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted transition-colors hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              activeTag === null
                ? "border-brand bg-brand-soft font-medium text-brand"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            全部 · {posts.length}
          </button>
          {tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() =>
                setActiveTag((current) =>
                  current === tag.name ? null : tag.name,
                )
              }
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                activeTag === tag.name
                  ? "border-brand bg-brand-soft font-medium text-brand"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              #{tag.name} · {tag.count}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 mb-4 text-sm text-muted">
        共 <span className="font-medium text-ink">{filtered.length}</span> 篇文章
        {activeTag && (
          <>
            ，标签 <span className="font-medium text-brand">#{activeTag}</span>
          </>
        )}
      </p>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">
            没有匹配的文章，换个关键词试试。
          </p>
        </div>
      )}
    </div>
  );
}
