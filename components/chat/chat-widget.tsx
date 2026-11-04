"use client";

import { Bot, CornerDownLeft, MessageSquare, Send, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

const SUGGESTIONS = [
  "帮我梳理一份大模型学习路线",
  "我写过哪些 Serverless 相关的笔记？",
  "解释一下 KV Cache 是什么",
  "帮我把这段项目经历润色成简历描述",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("blog:open-chat", openChat);
    return () => window.removeEventListener("blog:open-chat", openChat);
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      // 等面板渲染完成再聚焦，避免移动端键盘遮挡突兀
      const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, open]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || streaming) return;

      const history = [...messages, { role: "user" as Role, content: text }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setError(null);
      setStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || `请求失败（${response.status}）`);
        }
        if (!response.body) throw new Error("浏览器不支持流式响应");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            let payload: { delta?: string; error?: string };
            try {
              payload = JSON.parse(data);
            } catch {
              continue;
            }
            if (payload.error) throw new Error(payload.error);
            if (!payload.delta) continue;

            const chunk = payload.delta;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + chunk };
              }
              return next;
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "出错了，请稍后再试。");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content.trim()) next.pop();
          return next;
        });
      } finally {
        setStreaming(false);
      }
    },
    [input, messages, streaming],
  );

  const reset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* 悬浮入口 */}
      <button
        type="button"
        aria-label="打开 AI 助手"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed right-5 bottom-5 z-50 grid size-13 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition-all hover:scale-105 active:scale-95",
          open && "hidden",
        )}
      >
        <MessageSquare className="size-6" />
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-canvas" />
      </button>

      {/* 面板 */}
      <div
        className={cn(
          "fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl shadow-black/10 transition-all duration-300",
          "h-[min(34rem,calc(100dvh-7rem))]",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0",
        )}
      >
        <header className="flex items-center gap-2.5 border-b border-line bg-surface px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
            <Bot className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">AI 学习助手</p>
            <p className="truncate text-xs text-muted">基于本站笔记回答问题</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label="清空对话"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="animate-rise space-y-4">
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Sparkles className="size-4" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
                  你好！我可以基于这个博客里的学习笔记帮你答疑、推荐阅读顺序，
                  或者一起制定学习计划。想问点什么？
                </div>
              </div>
              <div className="grid gap-2 pl-9">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => send(item)}
                    className="rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs text-muted transition-colors hover:border-brand/40 hover:text-ink"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-2.5",
                message.role === "user" && "flex-row-reverse",
              )}
            >
              {message.role === "assistant" && (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Bot className="size-4" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  message.role === "user"
                    ? "rounded-tr-sm bg-brand text-white"
                    : "rounded-tl-sm border border-line bg-surface",
                )}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                ) : message.content ? (
                  <div className="chat-prose">
                    <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:120ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:240ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="border-t border-line bg-surface px-3 py-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="问点什么…（Enter 发送）"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="发送"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {streaming ? (
                <CornerDownLeft className="size-4 animate-pulse" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 px-1 text-[0.68rem] text-muted">
            <CornerDownLeft className="size-3" />
            Enter 发送 · Shift + Enter 换行 · AI 回答可能有误，请核对原文
          </p>
        </form>
      </div>
    </>
  );
}
