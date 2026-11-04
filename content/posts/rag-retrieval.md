---
title: "RAG 检索的工程取舍：切分、重排与上下文预算"
date: "2026-10-14"
description: "RAG 的效果瓶颈往往不在生成模型，而在检索环节。切分策略、重排序和上下文预算三个决策决定了答案质量。"
tags: ["大模型", "RAG", "NLP", "向量检索"]
category: "大模型"
---

搭完第一个 RAG demo 时我以为问题出在模型，换了更大的模型效果几乎没变。后来才明白：**检索不到正确的片段，生成模型再强也答不出来**。这篇笔记整理检索环节的三个核心决策。

## RAG 的完整链路

```text
文档 → 切分 → 向量化 → 索引 → 检索 → 重排 → 拼装上下文 → 生成
                      ↑                        ↑
                  离线批处理              在线低延迟
```

用户提问时只有右侧路径在跑，左侧是离线的。重点在于：**检索效果取决于切分质量和重排质量，而不是生成模型**。

## 决策一：怎么切分

### 固定长度切分的致命问题

最直觉的做法是按字符数硬切，比如每 500 字一段。但 Markdown 文档的结构信息全丢了：

- 一个表格被切成两半，两半都看不懂
- 一段代码被切断，语义断裂
- 标题和它描述的内容分到了不同 chunk

### 结构感知切分

更靠谱的做法是**先按结构分，再按长度分**：

```python
import re
from typing import Iterable

HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


def split_markdown(text: str, max_chars: int = 800) -> list[str]:
    """先按标题分节，节内按空行合并，超长节再按段落切开。"""
    sections: list[str] = []
    current: list[str] = []
    buffer: list[str] = []

    def flush_section() -> None:
        if not buffer:
            return
        chunk = "\n".join(buffer).strip()
        if chunk:
            sections.append(chunk)
        buffer.clear()

    for line in text.split("\n"):
        if HEADING.match(line):
            flush_section()
        buffer.append(line)
        if sum(len(x) for x in buffer) > max_chars:
            flush_section()
    flush_section()

    # 单节仍然超长时，按段落边界继续切
    result: list[str] = []
    for section in sections:
        if len(section) <= max_chars:
            result.append(section)
            continue
        para = ""
        for block in section.split("\n\n"):
            if len(para) + len(block) > max_chars and para:
                result.append(para.strip())
                para = block
            else:
                para = f"{para}\n\n{block}" if para else block
        if para.strip():
            result.append(para.strip())
    return result
```

### 切分粒度的权衡

| 粒度 | 优点 | 缺点 |
| --- | --- | --- |
| 小 chunk（200–300 字） | 检索精确、不稀释 | 上下文不完整，需要更多块拼装 |
| 大 chunk（1000+ 字） | 上下文完整 | 噪声多，嵌入向量被稀释 |
| 重叠窗口 | 边界信息不丢 | 增加索引量与去重难度 |

经验起点：**400–600 字 + 10–15% 重叠**，然后用真实问题集实测调整。

### 给每个 chunk 带上上下文

一个廉价但有效的提升：把 chunk 所属的标题路径拼进去。

```text
原始 chunk：
  "这个参数控制最大递归深度，超过就抛异常。"

加上标题路径后：
  "文档标题：配置项说明 > 递归参数 > 最大深度
   这个参数控制最大递归深度，超过就抛异常。"
```

同一句话在不同章节里含义可能完全不同，加上路径后检索准确率明显提升。

## 决策二：要不要重排

只用向量检索做 top-k，往往会出现「向量相似度前 5 个里有 4 个其实不相关，只是碰巧词面接近」。

**重排（rerank）** 用一个更精确但更贵的模型给候选文档重新打分：

```python
def retrieve(query: str, k: int = 20, top_n: int = 5):
    # 第一阶段：向量检索召回更多候选
    candidates = vector_store.similarity_search(query, k=k)

    # 第二阶段：交叉编码器精排，只保留少量
    pairs = [(query, doc.page_content) for doc in candidates]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(candidates, scores), key=lambda x: -x[1])
    return [doc for doc, _ in ranked[:top_n]]
```

关键参数是 **召回数量 k 要远大于最终保留数量 top_n**。典型的 `k=20, top_n=4`。召回多了再精排，是提升准确率性价比最高的一步。

> 重排模型直接吃 query 和文档的拼接文本，做交叉注意力，所以精度远高于双塔式的向量检索，但只能处理少量候选——这是它只能做「精排」不能做「召回」的原因。

## 决策三：上下文预算怎么分配

最后一步是把重排后的片段拼成 prompt 塞给模型。这里有个容易忽略的约束：**上下文窗口不是给满就最好**。

### 长上下文会稀释注意力

模型把 50 个片段全塞进去，即使其中只有一个相关，也可能被噪声干扰。对策：

- 严格限制片段数量（通常 3–5 个）
- 用 `top_k` 之外的分数阈值过滤
- 片段超长时先做一次摘要压缩

### 预算分配

```python
def build_context(reranked, max_tokens: int = 4000, per_doc_cap: int = 800) -> str:
    used = 0
    blocks = []
    for i, doc in enumerate(reranked):
        text = doc.page_content[:per_doc_cap]
        tokens = count_tokens(text)
        if used + tokens > max_tokens:
            break
        used += tokens
        blocks.append(f"[来源 {i+1}｜{doc.metadata.get('title', '未知')}]\n{text}")
    return "\n\n".join(blocks)
```

一个实用的技巧是**给每个片段编号并要求模型在答案里引用**：

```text
[来源 1｜文档 A]
...

[来源 2｜文档 B]
...

请基于以上资料回答，并标注引用了哪些来源编号。
```

这既降低了幻觉（模型倾向于引用给它的资料），又让用户可以核对。

## 评估：别靠感觉

RAG 最容易陷入「我觉得变好了」的循环。需要一个小的评估集：

```python
@dataclass
class EvalCase:
    question: str
    answer: str
    expected_sources: list[str]


def evaluate(cases, pipeline) -> dict:
    """检索指标 + 生成指标分开看。"""
    hit_rate = []
    for case in cases:
        retrieved = pipeline.retrieve(case.question)
        hit = any(
            src in [r.metadata["id"] for r in retrieved]
            for src in case.expected_sources
        )
        hit_rate.append(hit)
    return {"recall_at_k": sum(hit_rate) / len(hit_rate)}
```

先看 **recall@k**（正确来源有没有被召回），再看生成质量。如果 recall 就低，生成模型再换也没用。

## 小结

| 决策 | 默认起点 | 调优方向 |
| --- | --- | --- |
| 切分 | 400–600 字，10–15% 重叠 | 结构感知 + 标题路径 |
| 召回与重排 | k=20，重排取 4 | 加大 k，看 recall@k |
| 上下文预算 | 3–5 片段，编号引用 | 控制数量而非塞满 |

还有一件最重要的事：**先把评估集做出来**。有了它，上面每个数字都能被验证，而不是靠感觉。
