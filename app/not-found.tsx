import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-28 text-center">
      <p className="text-6xl font-bold tracking-tight text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        页面走丢了
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        这个地址可能已经失效，或者文章被移动到了别处。
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="size-4" />
        回到首页
      </Link>
    </div>
  );
}
