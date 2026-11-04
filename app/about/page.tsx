import type { Metadata } from "next";
import { BookOpen, Folder, GraduationCap, Mail, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/github-icon";
import { OpenChatButton } from "@/components/open-chat-button";
import { getAllPostMeta, getAllTags } from "@/lib/posts";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "关于",
  description: "关于我、学习方向与这个博客的由来。",
};

export default function AboutPage() {
  const posts = getAllPostMeta();
  const tags = getAllTags();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="animate-rise">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">关于</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          你好，我是 {site.name}。一名非全日制硕士研究生，目前主要在
          <span className="text-ink">大模型系统</span>、
          <span className="text-ink">Serverless 架构</span>与
          <span className="text-ink">性能工程</span>
          方向上学习。这个博客记录我的学习路径与项目实践。
        </p>
      </header>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Target className="size-5 text-brand" />
          这个博客在做什么
        </h2>
        <div className="prose mt-4">
          <p>
            学习很容易有一种错觉：看懂了视频、跑通了 Demo，就以为掌握了。
            真正让我记住知识的，是把一个概念<strong>写给别人听</strong>的那一遍。
            所以这里的每一篇笔记都遵循同样的结构：先说清楚问题是什么，
            再推导为什么是这个答案，最后给出能跑的代码和能复现的结论。
          </p>
          <ul>
            <li>不写「XX 是什么」的百科搬运，只写「我为什么这样理解」。</li>
            <li>每篇尽量配一个能运行的最小示例，代码块支持一键复制。</li>
            <li>踩过的坑单独记录，避免同一个坑踩第二次。</li>
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <GraduationCap className="size-5 text-brand" />
          学习方向
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {site.tracks.map((track) => (
            <div
              key={track.title}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <p className="text-sm font-medium">{track.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {track.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Folder className="size-5 text-brand" />
          项目
        </h2>
        <div className="prose mt-4">
          <p>
            把博客本身当作第一个项目：静态生成 + Serverless AI 接口，
            从零搭建了一条「写 Markdown → 自动部署 → 可被问答」的内容流水线。
            后续的实验项目会陆续补充在这里。
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <BookOpen className="size-5 text-brand" />
          目前
        </h2>
        <div className="prose mt-4">
          <p>
            已累计 <strong>{posts.length}</strong> 篇学习笔记、
            <strong>{tags.length}</strong> 个知识标签。
            博客内置了一个 AI 助手，它会读取全站文章索引，
            能帮你回顾笔记内容、推荐阅读顺序，也能一起把知识串成体系。
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Sparkles className="size-5 text-brand" />
          联系方式
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          欢迎交流学习心得、指出文中的错误，或者只是想聊聊技术。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm transition-colors hover:border-brand/40 hover:text-brand"
          >
            <GitHubIcon className="size-4" />
            GitHub
          </a>
          <a
            href={`mailto:${site.email}`}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm transition-colors hover:border-brand/40 hover:text-brand"
          >
            <Mail className="size-4" />
            {site.email}
          </a>
          <OpenChatButton className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <Sparkles className="size-4" />
            和 AI 助手聊聊
          </OpenChatButton>
        </div>
      </section>

      <p className="mt-12 text-sm text-muted">
        想看文章目录？去{" "}
        <Link href="/blog" className="text-brand hover:underline">
          全部文章
        </Link>{" "}
        或{" "}
        <Link href="/tags" className="text-brand hover:underline">
          标签索引
        </Link>
        。
      </p>
    </div>
  );
}
