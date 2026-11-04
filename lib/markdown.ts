import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

export type TocItem = {
  id: string;
  text: string;
  depth: 2 | 3;
};

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
};

function nodeText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

/** 收集 h2 / h3 生成目录；必须在 rehype-slug 之后运行才能拿到 id。 */
function rehypeCollectHeadings(toc: TocItem[]) {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && (node.tagName === "h2" || node.tagName === "h3")) {
        const id = typeof node.properties?.id === "string" ? node.properties.id : "";
        toc.push({
          id,
          text: nodeText(node).trim(),
          depth: node.tagName === "h2" ? 2 : 3,
        });
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

export type RenderedMarkdown = {
  html: string;
  toc: TocItem[];
};

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const toc: TocItem[] = [];

  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeCollectHeadings, toc)
    .use(rehypeAutolinkHeadings, {
      behavior: "wrap",
      properties: { className: ["heading-anchor"] },
    })
    .use(rehypePrettyCode, {
      theme: { light: "github-light", dark: "github-dark-dimmed" },
      keepBackground: false,
      defaultLang: "text",
    })
    .use(rehypeStringify)
    .process(source);

  return { html: String(file), toc };
}
