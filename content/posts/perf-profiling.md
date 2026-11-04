---
title: "系统级性能剖析：从火焰图到 P99"
date: "2026-10-21"
description: "平均延迟会把所有问题藏起来。这篇笔记整理了一套可复用的性能剖析流程：先定义指标，再定位热点，最后做对照实验。"
tags: ["性能工程", "可观测性", "后端"]
category: "性能工程"
---

「接口变慢了」这种反馈几乎无法直接行动。真正有用的性能工作从**定义一个可复现的指标**开始。这篇笔记是我自己的性能排查流程模板。

## 第一步：把问题变成数字

没有基线的性能问题没法判断严重性，也无法验证修复效果。常用的四个量：

| 指标 | 定义 | 用途 |
| --- | --- | --- |
| Throughput | 单位时间完成的请求数 | 系统容量上限 |
| Latency | 单次请求耗时分布 | 用户实际感受 |
| Saturation | 资源利用率 | 瓶颈在哪里 |
| Errors | 失败率 | 是否已经影响正确性 |

其中 **Latency 一定要看分布，而不是平均值**。

```python
import numpy as np

def summarize(latencies_ms: list[float]) -> dict:
    arr = np.array(latencies_ms)
    return {
        "count": arr.size,
        "mean": round(arr.mean(), 2),
        "p50": round(np.percentile(arr, 50), 2),
        "p95": round(np.percentile(arr, 95), 2),
        "p99": round(np.percentile(arr, 99), 2),
        "max": round(arr.max(), 2),
    }
```

为什么要看 P99 而不是均值？因为**均值会骗人**。假设 1000 个请求里 10 个走了降级路径耗时 2 秒，其余 990 个都是 50 ms，均值只有 69 ms，看起来毫无问题——但那 10 个用户的体验已经崩了。

## 第二步：先怀疑什么

有个经验法则能省掉大量瞎猜：

> **如果延迟随负载线性增长，瓶颈多半是计算；如果负载翻倍延迟也翻倍但 CPU 没满，瓶颈多半是等待（锁、IO、网络）。**

按这个顺序排除：

1. **CPU 是否打满** → 不是则瓶颈在别处
2. **是否在等锁** → 线程池耗尽、数据库行锁
3. **是否在等 IO** → 磁盘、网络、下游依赖
4. **是否在等 GC** → 内存分配速率过高

## 第三步：火焰图

CPU 火焰图回答「时间花在哪个函数上」。关键是会读：

- **宽度 = 占比**：最宽的块就是热点
- **高度 = 调用栈深度**：不是耗时
- **宽而扁的块 = 大量小函数累加**，往往比单个宽块更值得优化

```bash
# 采样 30 秒，输出折叠火焰图
py-spy record --rate 100 --duration 30 --format speedscope --output profile.svg -- python app.py

# 直接对运行中的进程采样，无需重启
py-spy top --pid 12345 --duration 30
```

### 别忘了 off-CPU 时间

CPU 火焰图有个盲区：**等待**不消耗 CPU，所以不会出现在里面。线程池等待、锁等待、IO 等待都是「off-CPU 时间」。

Go 的 goroutine 阻塞分析、Java 的 jstack、Python 的 `py-spy dump --locals` 都能补上这一块。

```bash
# Java：抓三次 thread dump，间隔 5 秒，看线程状态变化
jstack $(pgrep java) > dump1.txt
sleep 5
jstack $(pgrep java) > dump2.txt
```

## 第四步：对照实验

每次只改一个变量。性能实验最忌讳的是「我改了 A、B、C 三处，现在快了 30%」——你不知道该保留哪一个。

```bash
# 基准测试要固定随机种子、预热、多次重复
for i in $(seq 1 10); do
  pytest benchmark/ --seed=42 --json-report --json-report-file="run-$i.json"
done
```

注意两个常见陷阱：

- **预热不足**：JIT 还没编译热，测的是解释执行
- **缓存被绕过或被污染**：第一次跑没缓存、之后全命中，两组数据不可比

## 第五步：把结论固化

性能是一次性的，但**回归是长期的**。把关键路径的基准测试放进 CI，阈值设成「超过基线 10% 就失败」。

```yaml
# .github/workflows/perf.yml
- name: Run performance benchmarks
  run: |
    pytest benchmark/ --json-report --json-report-file=perf.json
    python scripts/check_regression.py perf.json baseline.json --threshold 10
```

## 一份可直接复用的排查清单

- [ ] 指标定义清楚：是 P99 还是平均值？是哪个接口？
- [ ] 有基线数据吗？问题是什么时候开始的？
- [ ] 能稳定复现吗？流量特征是什么？
- [ ] CPU / 内存 / 网络 / 磁盘，各自的使用率？
- [ ] 有火焰图吗？宽扁块和单个宽块哪个更可疑？
- [ ] 有 off-CPU 分析吗？线程在等什么？
- [ ] 下游依赖的延迟是多少？
- [ ] 改动之后，对照实验做了几组？

## 最后

性能优化的收益往往没有想象中高，而**引入 bug 的风险是实打实的**。我自己的判断标准是：

> 只有当优化能同时满足「可测量」「改动局部」「风险可控」三条时才动手。

否则先做架构上的事——比如把同步调用改成消息队列——通常比在热路径上抠那 5% 划算得多。
