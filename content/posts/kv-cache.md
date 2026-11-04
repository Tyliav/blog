---
title: "KV Cache：推理慢的真正原因"
date: "2026-11-02"
description: "自回归解码每一步都要重算全部历史，KV Cache 把这部分重复计算砍掉，但也带来了显存与并发的新问题。"
tags: ["大模型", "推理优化", "LLM"]
category: "大模型"
featured: true
---

跑过一次本地推理之后，我第一次意识到「模型很大」并不是显存占用的主因——**KV Cache 才是**。这篇笔记从自回归解码的重复计算讲起，拆清楚 KV Cache 到底缓存了什么、代价在哪，以及工程上常见的几种优化。

## 为什么需要 KV Cache

Transformer 的自回归生成是这样的：给定前缀 $y_{1..t}$，模型输出 $y_{t+1}$，然后把它拼回前缀，重复直到生成结束。

关键问题在于，**每一步都要把整个前缀重新前向一遍**。假设生成 $n$ 个 token，第 $i$ 步要处理的输入长度是 $i$，那么总计算量是：

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2} = O(n^2)
$$

这和训练时一次算完整句的 $O(n)$ 相比，多了一个 $n$ 的因子。这就是为什么「输出 1000 token」比「输出 10 token」的耗时远超 100 倍——不是线性增长。

## 缓存的是什么

先回忆注意力机制的三个张量：

| 张量 | 形状 | 是否随 token 变化 | 能否缓存 |
| --- | --- | --- | --- |
| $Q$ | `[B, H, T, d]` | 每个位置都不同 | 只算当前步 |
| $K$ | `[B, H, T, d]` | 每个位置都不同 | 可以追加写入 |
| $V$ | `[B, H, T, d]` | 每个位置都不同 | 可以追加写入 |

$Q$ 只在当前解码步用到，但 $K$、$V$ 对历史 token 来说是**不变**的——第 5 个 token 的 $K$ 和 $V$ 不会因为后面又生成了 100 个 token 而改变。

所以 KV Cache 的做法极其朴素：**把每一步算出的 $K$、$V$ 存下来，下次解码时直接拼接使用，跳过对历史 token 的重复前向**。

```python
import torch

class KVCache:
    """最朴素但足够说明问题的 KV Cache 实现。"""

    def __init__(self, max_len: int, batch: int, heads: int, dim: int, device="cuda"):
        self.max_len = max_len
        self.k = torch.zeros(batch, heads, max_len, dim, device=device)
        self.v = torch.zeros(batch, heads, max_len, dim, device=device)
        self.length = 0

    def append(self, k_new: torch.Tensor, v_new: torch.Tensor) -> None:
        """k_new / v_new: [B, H, 1, d]"""
        start = self.length
        end = start + k_new.shape[2]
        self.k[:, :, start:end] = k_new
        self.v[:, :, start:end] = v_new
        self.length = end

    def get(self) -> tuple[torch.Tensor, torch.Tensor]:
        return self.k[:, :, : self.length], self.v[:, :, : self.length]
```

用上缓存之后，单步解码只计算 1 个 token 的 $Q/K/V$，计算量从 $O(n^2)$ 降回 $O(n)$。**代价转移到了显存带宽上**——这是理解后续所有优化的关键。

## 显存账：为什么长上下文会 OOM

单个 token 的 KV Cache 占用（以 fp16 存储）：

$$
\text{bytes per token} = 2 \times 2 \times L \times H \times d_{head}
$$

其中 $2$ 是 K 和 V，$2$ 是 fp16 的字节数，$L$ 是层数，$H$ 是注意力头数，$d_{head}$ 是单头维度。

拿一个 7B 的模型举例：$L=32$、$H=32$、$d_{head}=128$：

$$
2 \times 2 \times 32 \times 32 \times 128 = 524288 \text{ bytes} = 0.5 \text{ MB/token}
$$

上下文 4096 token 就是 **2 GB**。而且这只是单条请求——batch size 32 时就是 64 GB。

> **结论**：KV Cache 的显存占用与 `batch_size × seq_len` 成正比。在长上下文场景下，**限制并发的主要因素不是算力，而是 KV Cache 显存**。

## 工程优化手段

### 1. PagedAttention（vLLM 的做法）

传统实现要求为每条序列预留连续的 `max_len` 长度显存，实际用不到的部分就是浪费。PagedAttention 借鉴操作系统的分页机制：

- 把 KV Cache 切成固定大小的 **block**（如 16 个 token 一块）
- 用一个块表记录逻辑块到物理块的映射
- 请求结束后，块可以立刻被其他请求复用

内存利用率从 20–40% 提升到 90% 以上。同样的显存，能容纳的并发请求数翻了 2–3 倍。

### 2. 分组查询注意力（GQA）

传统 MHA 中，每个注意力头都有自己的 $K$、$V$，所以 KV Cache 很大。GQA 让多个 Query 头共享同一组 $K$、$V$ 头：

$$
\text{KV Cache} \propto \frac{H_{kv}}{H_{q}}
$$

Llama 2 70B 用了 8 组 KV 头（对应 64 个 Query 头），KV Cache 直接降到 1/8。DeepSeek 进一步提出 MLA（Multi-head Latent Attention），把 KV 压缩到低维隐空间再缓存，是同一思路的更激进版本。

### 3. 量化

把 KV Cache 从 fp16 量化到 int8 或 int4。需要注意**离群值问题**：注意力矩阵中存在少数极大的 key，量化误差会被放大。常见解法是按通道分组量化，而不是整个张量统一缩放。

## 一个容易踩的坑

KV Cache 配合**变长 batch** 时，不同请求的序列长度不同。如果把它们 padding 到相同长度再一起算，就会有大量无效计算。

正确的做法是按长度排序分桶，同桶内请求共享一次前向；或者用 CUDA Graph 把解码阶段固化成固定形状，避免每步都有 kernel launch 开销。

```python
# 按长度分桶，减少 padding 浪费
def sort_by_length(reqs):
    return sorted(reqs, key=lambda r: r.prompt_len)
```

## 小结

| 手段 | 解决什么 | 代价 |
| --- | --- | --- |
| KV Cache | 消除历史 token 的重复前向 | 显存占用 |
| PagedAttention | 降低显存碎片浪费 | 实现复杂度 |
| GQA / MLA | 直接减少缓存量 | 可能损失质量 |
| KV 量化 | 进一步压缩显存 | 精度损失、离群值处理 |

推理性能调优的核心思路始终是：**把瓶颈从算力转移到带宽，再想办法把带宽需求压下来**。

## 延伸阅读

- *FlashAttention-2*：不减少计算量，而是通过分块和重计算把 IO 变成计算
- *Speculative Decoding*：用小模型草拟多个 token，大模型一次验证，把解码步数压下来
