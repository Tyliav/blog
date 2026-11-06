import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeCopy } from "@/components/code-copy";
import { Toc } from "@/components/toc";
import { renderMarkdown } from "@/lib/markdown";
import { getAdjacentPosts, getAllPosts, getPostBySlug } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { html, toc } = await renderMarkdown(post.content);
  const { newer, older } = getAdjacentPosts(post.slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" />
        返回文章列表
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="min-w-0 rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-10">
          <header className="animate-rise">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link
                href={`/tags/${encodeURIComponent(post.category)}`}
                className="rounded-md bg-brand-soft px-2 py-0.5 font-medium text-brand transition-opacity hover:opacity-80"
              >
                {post.category}
              </Link>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(post.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {post.readingTime}
              </span>
            </div>

            <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted">
              {post.description}
            </p>

            {post.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand-line hover:text-brand"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-8 border-b border-line" />
          </header>

          <div
            className="prose mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <CodeCopy />

          <nav className="mt-16 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
            {older ? (
              <Link
                href={`/blog/${older.slug}`}
                className="group rounded-xl border border-line bg-canvas p-4 transition-colors hover:border-brand-line"
              >
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <ArrowLeft className="size-3.5" />
                  上一篇
                </span>
                <p className="mt-2 text-sm font-medium transition-colors group-hover:text-brand">
                  {older.title}
                </p>
              </Link>
            ) : (
              <span />
            )}

            {newer && (
              <Link
                href={`/blog/${newer.slug}`}
                className="group rounded-xl border border-line bg-canvas p-4 text-right transition-colors hover:border-brand-line"
              >
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  下一篇
                  <ArrowRight className="size-3.5" />
                </span>
                <p className="mt-2 text-sm font-medium transition-colors group-hover:text-brand">
                  {newer.title}
                </p>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <Toc items={toc} />
          </div>
        </aside>
      </div>
    </div>
  );
}
