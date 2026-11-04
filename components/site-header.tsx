"use client";

import { Menu, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105">
            C
          </span>
          <span className="hidden sm:inline">{site.name}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("blog:open-chat"))}
            className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2 sm:flex"
          >
            <MessageSquare className="size-4 text-brand" />
            AI 助手
          </button>

          <ThemeToggle />

          <button
            type="button"
            aria-label="打开菜单"
            onClick={() => setOpen((value) => !value)}
            className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-canvas px-5 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm",
                    isActive(item.href)
                      ? "bg-brand-soft font-medium text-brand"
                      : "text-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
