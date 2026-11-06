import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="group relative rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-line hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 font-medium text-brand">
          {post.category}
        </span>
        <span>{formatDate(post.date)}</span>
        <span aria-hidden>·</span>
        <span>{post.readingTime}</span>
      </div>

      <h3 className="mt-3 text-lg leading-snug font-semibold tracking-tight transition-colors group-hover:text-brand">
        {post.title}
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
        {post.description}
      </p>

      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[0.7rem] text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/blog/${post.slug}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={`阅读《${post.title}》`}
      >
        <span className="sr-only">阅读文章</span>
      </Link>

      <ArrowUpRight className="absolute top-5 right-5 size-4 text-muted opacity-0 transition-all duration-200 group-hover:opacity-100" />
    </article>
  );
}
