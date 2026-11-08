import type { Metadata } from "next";
import { PostExplorer } from "@/components/post-explorer";
import { getAllPostMeta, getAllTags, getCategories } from "@/lib/posts";

export const metadata: Metadata = {
  title: "全部文章",
  description: "所有学习笔记、项目复盘与源码阅读记录。",
};

export default function BlogPage() {
  const posts = getAllPostMeta();
  const tags = getAllTags();
  const categories = getCategories();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <header className="animate-rise">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">全部文章</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          按分类或标签缩小范围，也可以直接搜索关键词。
        </p>
      </header>

      <div className="mt-10">
        <PostExplorer posts={posts} tags={tags} categories={categories} />
      </div>
    </div>
  );
}
