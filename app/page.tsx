import {
  ArrowRight,
  BookOpen,
  Brain,
  Code,
  Gauge,
  Hash,
  Server,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { OpenChatButton } from "@/components/open-chat-button";
import { PostCard } from "@/components/post-card";
import { getAllPostMeta, getAllTags } from "@/lib/posts";
import { site } from "@/lib/site";

const ICONS: Record<string, typeof Brain> = { Brain, Server, Gauge, Code };

export default function HomePage() {
  const posts = getAllPostMeta();
  const tags = getAllTags();
  const featured = posts.filter((post) => post.featured);
  const spotlight = featured.length > 0 ? featured : posts.slice(0, 2);
  const spotlightSlugs = new Set(spotlight.map((post) => post.slug));
  const rest = posts.filter((post) => !spotlightSlugs.has(post.slug)).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-5">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line py-16 sm:py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="dot-grid absolute inset-0" />
          <div className="animate-float-slow absolute -top-32 -left-24 size-80 rounded-full bg-brand/25 blur-3xl dark:bg-brand/15" />
          <div className="absolute top-20 -right-24 size-72 rounded-full bg-accent/20 blur-3xl dark:bg-accent/15" />
        </div>

        <div className="animate-rise max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-surface/80 px-3.5 py-1.5 text-xs text-muted backdrop-blur">
            <BookOpen className="size-3.5 text-brand" />
            非全日制硕士 · AI 系统 / Serverless / 性能工程方向
          </span>

          <h1 className="mt-6 text-4xl leading-[1.15] font-bold tracking-tight text-ink sm:text-5xl">
            把学过的
            <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
              变成讲得清的
            </span>
            笔记
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            这里存放我的学习笔记、源码阅读与项目复盘。写给三个月后忘记细节的自己，
            也写给正在看这一页的你。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand/90"
            >
              开始阅读
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-line hover:text-brand"
            >
              关于我
            </Link>
            <OpenChatButton className="inline-flex items-center gap-2 rounded-xl border border-transparent px-5 py-3 text-sm font-medium text-muted transition-colors hover:text-brand">
              <Sparkles className="size-4" />
              和 AI 助手聊聊
            </OpenChatButton>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-8">
            {[
              { label: "学习笔记", value: posts.length },
              { label: "知识标签", value: tags.length },
              { label: "学习方向", value: site.tracks.length },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs tracking-wider text-muted uppercase">
                  {item.label}
                </dt>
                <dd className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 学习方向 */}
      <section className="py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              学习方向
            </h2>
            <p className="mt-2 text-sm text-muted">
              内容围绕这四个方向展开，每一篇都尽量写清「为什么」而不只是「是什么」。
            </p>
          </div>
          <Link
            href="/tags"
            className="hidden shrink-0 items-center gap-1 text-sm text-brand hover:underline sm:inline-flex"
          >
            全部标签
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {site.tracks.map((track) => {
            const Icon = ICONS[track.icon] ?? Code;
            return (
              <Link
                key={track.title}
                href={track.href}
                className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-line hover:shadow-lift"
              >
                <div
                  aria-hidden
                  className={`absolute inset-0 bg-gradient-to-br ${track.accent} opacity-60 transition-opacity group-hover:opacity-100`}
                />
                <div className="relative">
                  <span
                    className={`grid size-10 place-items-center rounded-xl ${track.chip}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold tracking-tight">
                    {track.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {track.desc}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    查看相关笔记
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 最新文章 */}
      <section className="border-t border-line py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              最新笔记
            </h2>
            <p className="mt-2 text-sm text-muted">
              持续更新中 · 最近写下的学习记录
            </p>
          </div>
          <Link
            href="/blog"
            className="hidden shrink-0 items-center gap-1 text-sm text-brand hover:underline sm:inline-flex"
          >
            查看全部 {posts.length} 篇
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {spotlight.length > 0 && (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {spotlight.slice(0, 2).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand/12 via-surface to-accent/8 p-7 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-line hover:shadow-lift"
              >
                <div>
                  <span className="inline-flex rounded-md bg-brand px-2 py-0.5 text-[0.7rem] font-medium text-white">
                    {post.category}
                  </span>
                  <h3 className="mt-4 text-xl leading-snug font-bold tracking-tight transition-colors group-hover:text-brand">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {post.description}
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  继续阅读
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}

        <Link
          href="/blog"
          className="mt-6 flex items-center justify-center gap-1 rounded-xl border border-line bg-surface py-3 text-sm text-muted transition-colors hover:border-brand/40 hover:text-brand sm:hidden"
        >
          查看全部 {posts.length} 篇
          <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* 标签 */}
      <section className="border-t border-line py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">知识标签</h2>
        <p className="mt-2 text-sm text-muted">
          点标签可以看到相关的全部笔记。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.name}
              href={`/tags/${encodeURIComponent(tag.name)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand"
            >
              <Hash className="size-3" />
              {tag.name}
              <span className="text-xs text-muted/70">{tag.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* AI 助手 */}
      <section className="border-t border-line py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand/10 via-surface to-surface p-8 sm:p-12">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 size-64 rounded-full bg-brand/15 blur-3xl"
          />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <Sparkles className="size-3.5" />
              内置 AI 助手
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              把博客变成一个会回答问题的知识库
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              右下角的助手会读取全站文章索引，可以帮你制定学习路线、
              推荐相关笔记、解释概念，或把零散笔记整理成结构化提纲。
              密钥只保存在服务端，不会暴露在浏览器里。
            </p>
            <OpenChatButton className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:opacity-90">
              立即试用
              <ArrowRight className="size-4" />
            </OpenChatButton>
          </div>
        </div>
      </section>
    </div>
  );
}
