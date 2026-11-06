"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition-all hover:border-brand-line hover:text-brand"
    >
      <Sun className="size-4 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110 dark:hidden" />
      <Moon
        className="hidden size-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 dark:block"
      />
    </button>
  );
}
