import type { Metadata } from "next";
import { ArrowLeft, Hash } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { getAllTags, getPostsByTag } from "@/lib/posts";

type Params = { tag: string };

export function generateStaticParams(): Params[] {
  return getAllTags().map((tag) => ({ tag: tag.name }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded}`,
    description: `所有关于「${decoded}」的学习笔记。`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);

  if (posts.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <Link
        href="/tags"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" />
        全部标签
      </Link>

      <header className="mt-8 animate-rise">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
          <Hash className="size-4" />
          {decoded}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {decoded}
        </h1>
        <p className="mt-3 text-sm text-muted">
          共 {posts.length} 篇相关笔记
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
