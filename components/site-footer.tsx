import { Mail } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/github-icon";
import { site } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 font-semibold">
              <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-sm font-bold text-white shadow-md shadow-brand/20">
                C
              </span>
              {site.name}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {site.description}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">
              导航
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted transition-colors hover:text-brand"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-widest text-muted uppercase">
              联系
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a
                  href={site.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 text-muted transition-colors hover:text-brand"
                >
                  <GitHubIcon className="size-4" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex items-center gap-2 text-muted transition-colors hover:text-brand"
                >
                  <Mail className="size-4" />
                  {site.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. 用 Next.js 构建。
          </p>
          <p>内容仅代表个人学习记录，不构成任何专业建议。</p>
        </div>
      </div>
    </footer>
  );
}
