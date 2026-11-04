"use client";

import { Check, Copy } from "lucide-react";
import { useEffect } from "react";

/** 给 rehype-pretty-code 生成的代码块挂上「复制」按钮。 */
export function CodeCopy() {
  useEffect(() => {
    const figures = document.querySelectorAll<HTMLElement>(
      "[data-rehype-pretty-code-figure]",
    );

    const buttons: HTMLButtonElement[] = [];

    figures.forEach((figure) => {
      const pre = figure.querySelector("pre");
      if (!pre || figure.querySelector(".copy-btn")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "copy-btn absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-md border border-line bg-canvas/90 text-muted opacity-0 transition-all hover:text-ink focus-visible:opacity-100";
      button.setAttribute("aria-label", "复制代码");
      button.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

      button.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.innerText ?? "";
        try {
          await navigator.clipboard.writeText(code);
          button.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
          button.classList.add("text-emerald-500");
          window.setTimeout(() => {
            button.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
            button.classList.remove("text-emerald-500");
          }, 1600);
        } catch {
          // 剪贴板不可用时静默失败
        }
      });

      figure.classList.add("relative");
      figure.appendChild(button);
      buttons.push(button);
    });

    return () => {
      buttons.forEach((button) => button.remove());
    };
  });

  return null;
}
