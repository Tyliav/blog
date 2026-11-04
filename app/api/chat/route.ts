import { NextRequest } from "next/server";
import { getAllPostMeta } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 4000;

const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT.max;
}

function buildSystemPrompt() {
  const posts = getAllPostMeta();
  const index = posts
    .map(
      (post) =>
        `- [${post.title}](/blog/${post.slug}) | 分类: ${post.category} | 标签: ${
          post.tags.join("、") || "无"
        } | ${post.description}`,
    )
    .join("\n");

  const lines = [
    "你是一个技术博客的内置 AI 助手，服务于一位正在读研 / 求职中的工程师（CyberCheems）。",
    "",
    "你的能力：",
    "1. 解答学习笔记中涉及的技术问题（大模型、推理系统、Serverless、性能工程、前后端开发等）。",
    "2. 根据下面的文章索引推荐最相关的笔记，并给出建议阅读顺序。",
    "3. 对学习路线给出可执行的学习计划与练习题。",
    "4. 辅助润色简历 / 项目描述、撰写技术博客提纲。",
    "",
    "回答要求：",
    "- 使用简体中文回答，术语可保留英文原词。",
    "- 结构清晰，善用 Markdown 小标题、列表与代码块；代码块请标注语言。",
    "- 不要编造文章内容：如果博客里没有相关笔记，明确说明，并给出通用建议。",
    "- 保持简洁，避免长篇大论。",
    "",
    "=== 博客文章索引 ===",
    index || "（暂无文章）",
    "=== 索引结束 ===",
  ];

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";

  if (rateLimited(ip)) {
    return Response.json(
      { error: "RATE_LIMITED", message: "请求太频繁，请稍后再试。" },
      { status: 429 },
    );
  }

  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return Response.json(
      {
        error: "NOT_CONFIGURED",
        message:
          "AI 助手还没有配置。请在 .env.local 里填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 后重启服务。",
      },
      { status: 503 },
    );
  }

  let incoming: ChatMessage[];
  try {
    const body = await req.json();
    incoming = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return Response.json(
      { error: "BAD_REQUEST", message: "请求格式不正确。" },
      { status: 400 },
    );
  }

  const messages = incoming
    .filter(
      (m): m is ChatMessage =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT_LENGTH),
    }));

  if (messages.length === 0) {
    return Response.json(
      { error: "BAD_REQUEST", message: "没有可发送的消息。" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
        stream: true,
        temperature: 0.6,
        max_tokens: 2048,
      }),
    });
  } catch {
    return Response.json(
      {
        error: "UPSTREAM_UNREACHABLE",
        message: "无法连接模型服务，请检查网络或 API 地址。",
      },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "UPSTREAM_ERROR",
        message: `模型服务返回 ${upstream.status}${detail ? `：${detail.slice(0, 300)}` : ""}`,
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
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
            if (!data) continue;
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
                );
              }
            } catch {
              // 忽略无法解析的 keep-alive 片段
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
