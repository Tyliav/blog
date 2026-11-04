---
title: "Serverless 冷启动的三个层次"
date: "2026-10-28"
description: "冷启动不只是「启动慢」，它至少包含调度分配、运行时初始化和函数代码加载三层，每层的优化手段完全不同。"
tags: ["Serverless", "云原生", "性能工程"]
category: "Serverless"
featured: true
---

第一次遇到冷启动时，我以为只要「把镜像做小一点」就行了。实际排查后发现，冷启动至少可以拆成三个独立叠加的层次，每一层的量级和优化手段都不一样。

## 三个层次

从请求到达，到函数真正开始执行业务代码，中间的时间可以分成：

1. **调度与分配**：平台找到有空闲容量的实例
2. **运行时启动**：拉起沙箱 / 容器 / 进程，初始化语言运行时
3. **函数代码加载**：下载并初始化你的代码、依赖、配置

```text
请求到达
  │
  ├─ 调度分配      ~ 10–100 ms
  ├─ 运行时启动    ~ 100–3000 ms   ← 语言运行时差异最大的部分
  └─ 代码加载      ~ 50–5000 ms    ← 依赖体积决定
  │
  ▼
开始执行业务逻辑
```

把「冷启动」当成一个数去优化，往往抓不到重点——你可能花了三天压缩依赖，但瓶颈其实在调度层。

## 第一层：调度与分配

这一层主要由平台负责，个人能优化的空间有限，但可以**规避**：

- **预留并发（provisioned concurrency）**：提前准备好实例，代价是即使没流量也要付费
- **最小化冷路径**：把「必须做的初始化」从 handler 里挪出去，用「延迟初始化 + 并发安全」的模式

最小化冷路径的核心思路是：**函数第一次被调用时才做昂贵初始化，但要保证并发调用下只做一次**。

```python
import os
import threading

_client = None
_lock = threading.Lock()


def get_client():
    """惰性初始化 + 双重检查，避免冷启动时重复建连接。"""
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is None:
            _client = Client(
                endpoint=os.environ["ENDPOINT"],
                timeout=5,
                keepalive=True,
            )
    return _client
```

## 第二层：运行时启动

不同语言的差异非常明显，这往往决定了冷路径的语言选择：

| 运行时 | 冷启动量级 | 说明 |
| --- | --- | --- |
| Python | 200 ms – 1.5 s | 解释器 + 依赖导入 |
| Node.js | 100 ms – 800 ms | V8 启动较快，但 npm 依赖树容易膨胀 |
| Go | 5 ms – 50 ms | 编译成单二进制，初始化极少 |
| Java (JVM) | 500 ms – 3 s | JVM 启动 + 类加载，可提前做 CDS |
| Rust / 静态编译 | < 10 ms | 几乎无初始化开销 |

如果冷启动是主要矛盾，**用 Go 或 Rust 重写热点函数**往往比任何配置调优都有效。

### JVM 的 CDS 优化

Java 有个容易被忽略的手段：Class Data Sharing。预先把类元数据 dump 成文件，启动时直接 mmap 加载，省掉大部分类加载和验证时间。

```bash
java -XX:SharedArchiveFile=app.jsa -jar app.jar
```

## 第三层：代码与依赖加载

这一层是个人可控性最强的，也是大多数教程讲的「缩小包体积」那一层。

### 依赖体积的连锁反应

一个 300 MB 的 `node_modules`，启动时要：

1. 从存储下载（网络 IO，可能几十到几百 MB）
2. 解压到临时目录（磁盘 IO）
3. `require` 时解析依赖树（CPU + 内存）

三步都是线性成本。**包体积减半，冷启动可能直接减半。**

### 几种有效的做法

**依赖裁剪**：用工具找出实际用到的子集。很多包只需要其中一个函数，整包引入是纯浪费。

```bash
npx depcheck          # 列出未使用的依赖
npx knip             # 更彻底，还能找出未使用的导出
```

**懒加载重依赖**：只在真正走到那条分支时才 import。

```ts
// 只有命中 debug 分支时才付出加载代价
async function dumpTrace(payload: unknown) {
  if (!process.env.DEBUG_TRACE) return;
   const { Profiler } = await import("node:inspector/promises");
  // ...
}
```

**外部化依赖**：把通用依赖放到运行时提供而不是打包进去，Node.js 18+ 的 Lambda 运行时已经预装了一部分。

## 怎么确认你优化的是对的那一层

别猜，去测。冷启动的每次请求都要单独测量，不要用平均值掩盖长尾。

```ts
const started = Date.now();

export const handler = async (event: unknown) => {
  // 区分「进程刚起来」和「进程已经热了」
  const initAge = Date.now() - process.uptime() * 1000;
  return {
    body: JSON.stringify({
      total: Date.now() - started,
      initAgeMs: Math.round(initAge),
      cold: initAge < 60_000,
    }),
  };
};
```

关键指标：

- **冷启动比例**：首次请求数 / 总请求数
- **P99 延迟**：长尾才是用户真正感受到的
- **初始化耗时**：业务代码里第一段 `await` 的耗时

## 一个常见的错误优化

把连接池调到很大，比如每个实例开 100 个数据库连接。听起来很合理，但：

- 冷启动时要建 100 个连接，**反而更慢**
- Serverless 实例数量不可控，数据库总连接数可能瞬间打满
- 实例随时被回收，连接频繁重建

正确的做法是**单个实例少量连接 + 后端连接池**（PgBouncer、RDS Proxy）。实例级别的池不是无限的。

## 小结

冷启动优化的顺序应该是：

1. 先测量，确认瓶颈在哪一层
2. 调度层 → 用预留并发兜底，或接受它
3. 运行时层 → 换更快的语言运行时，或做运行时级预热
4. 代码层 → 裁剪依赖、懒加载、外部化

盲目压缩包体积之前，先把三层拆开看。
