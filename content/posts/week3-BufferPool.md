---
title: Week 3 Buffer Pool 复盘与拓展
date: 2026-11-14
description: BusTub Project 1 的 Buffer Pool 复盘：C++ 资源所有权与 RAII、并发同步工具的选型、BPM Lock 与 Page Lock 的层次与死锁规避、跨组件状态一致性与 Flush 边界。
tags: ["数据库", "C++", "并发编程"]
category: 数据库
featured: false
draft: false
---

本篇是 Week 3 的复盘，重点不在把 ARC、Disk Scheduler 和 Buffer Pool Manager 分开写完，而是把页面替换、磁盘 I/O、并发访问和资源生命周期这几个东西连起来看。

## 一、Buffer Pool 开发中的 C++ 核心机制

在 Buffer Pool Manager 的实现过程中，除了需要理解页面、帧和磁盘 I/O 的基本逻辑外，还大量涉及 C++ 的资源管理、并发控制和线程同步机制。Week2 总结中已经涉及到了 PageGuard 的 RAII、`std::move` 语义以及 future/promise 等概念，本次主要结合实际开发过程对这些机制进行进一步梳理。

### 1.1 资源所有权与生命周期

实现 PageGuard 时，不能把它当成一个普通对象来看，因为 Guard 不只是保存一个 Frame，还承担着页面锁和 pin 的释放。因此 PageGuard 不能随意复制。假设：

```cpp
ReadPageGuard guard2 = guard1;
```

复制后两个 Guard 都认为自己负责该页面，那么它们析构时就可能重复解锁，甚至让 `pin_count_` 被减两次。

![std::move 前后资源所有权的转移](/posts/week3-BufferPool/1794623936167.png)

`std::move` 与复制不同，它是把这份资源的管理权交给另一个对象。move 完成后，新 Guard 接管 Frame、页面锁以及之后的释放工作，原来的 Guard 则变成无效状态。

DiskRequest 中也能看到同样的所有权问题。内部定义的 promise 对应一次异步任务的完成结果，这个结果的写入端只能由一个对象管理，因此 DiskRequest 不能简单复制。

```cpp
request_queue_.Put(std::move(request));
```

`std::move` 实际上是把整个磁盘请求以及其中 promise 的管理权交给请求队列，之后再由后台线程接管。

### 1.2 并发状态与同步工具

Buffer Pool 会被多个线程同时访问，因此需要不同的同步机制保护不同类型的状态。

`bpm_latch_` 使用 `std::mutex`，主要保护 `page_table_`、空闲 Frame 等全局管理信息。Page 数据使用 `std::shared_mutex`。`shared_mutex` 不是两把锁，而是一把支持两种模式的锁：读操作以共享模式获取，多个 Reader 可以同时访问；写操作以独占模式获取，此时其他读写线程都必须等待。

对于 `pin_count_` 这类简单共享变量，项目使用了 `std::atomic`。Atomic 是保证一次读、写或加减操作不可被其他线程打断的原子类型，适合多个线程共同修改简单计数。`pin_count_` 可以通过 `load()`、`store()`、`fetch_add()`、`fetch_sub()` 安全更新；`next_page_id_` 同样使用 atomic，保证多个线程申请新页面时能够得到不同的 Page ID。项目说明也明确将 `pin_count_` 和 `next_page_id_` 设计为原子变量。

另外，`std::optional` 用来表示"结果可能不存在"。在 DiskScheduler 中，正常的 DiskRequest 表示继续处理任务，而 `std::nullopt` 被作为结束信号，让后台线程退出；在 ARC 中，如果没有可淘汰的 Frame，也会返回 `std::nullopt`。

### 1.3 异步任务与线程同步

Buffer Pool 在缺页读取或脏页写回时都需要访问磁盘。由于磁盘 I/O 比内存操作慢得多，BusTub 将磁盘请求交给后台线程执行，使请求的提交和实际的磁盘读写分离开来。这一过程主要由请求队列、后台线程以及 promise/future 完成。

如图所示，主线程首先创建 DiskRequest，同时创建一对 promise/future，然后通过 `Put(std::move(request))` 将请求放入 `request_queue_`。后台线程通过 `Get()` 从队列中取出请求，再调用 `ReadPage()` 或 `WritePage()` 完成真正的磁盘 I/O。这里实际上形成了一个生产者—消费者模型：主线程负责产生请求，后台线程负责消费并执行请求。

![磁盘异步 I/O：请求提交与完成信号的时序](/posts/week3-BufferPool/image-002.png)

请求放入队列只代表任务已经提交，并不代表磁盘操作已经结束。因此后台线程完成 I/O 后，会调用 `promise.set_value(true)` 发出完成信号，使对应的 future 变为就绪状态；主线程调用 `future.get()` 时，如果任务还未完成就继续等待，直到收到该信号后才返回。

`Schedule()` 表示请求已经提交，而 `future.get()` 返回才表示磁盘 I/O 真正完成。这样，请求队列负责在线程之间传递任务，后台线程负责执行磁盘操作，promise/future 则负责同步任务的完成状态。

## 二、锁与死锁

Buffer Pool Manager 中既要保护全局管理状态，也要保护具体 Page 的数据。相比"有没有加锁"，更重要的是明确锁保护什么、不同锁如何配合，以及锁应该持有多久。

### 2.1 锁的层次

BPM Lock 是全局互斥锁，主要保护 `page_table_`、空闲 Frame 以及 Page 和 Frame 的映射等管理状态。比如线程在 `CheckedReadPage()` 中查找某个 Page 是否已经在内存、为缺页选择空闲 Frame，或者更新 Page–Frame 映射时，都需要保证这些全局状态不会被其他线程同时修改。项目中 `bpm_latch_` 以 `std::mutex` 的形式创建。

Page Lock 保护的则是 Frame 中实际存放的页面数据。页面一旦被定位到某个 Frame，真正读写数据时就需要通过 ReadPageGuard 或 WritePageGuard 获取对应的页面锁。多个 Reader 可以同时读取同一个 Page，但 Writer 必须独占访问，避免页面正在修改时被其他线程同时读写。

BPM Lock 负责保护 Page 在哪里、Frame 如何分配，而 Page Lock 则保护 Page 里面的数据如何读写。但这也带来一个新问题：当一条执行路径需要同时接触 BPM Lock 和 Page Lock 时，如果不同线程获取它们的顺序不一致，就可能互相等待。这就是死锁。

### 2.2 死锁的形成与原因

Buffer Pool 的一条执行路径可能同时涉及 BPM Lock 和 Page Lock。例如 BPM 需要先根据 `page_table_` 找到 Frame，而 `FlushPage()` 又需要锁住具体 Page，保证写盘过程中页面内容保持一致。项目说明也明确指出，BPM 的公共方法通常可以一直持有全局 latch，但在可能发生死锁时需要提前释放。`FlushPage()` 则要求获取 Page Lock，确保写入磁盘的是一致的页面状态。

当不同线程以相反顺序获取这两把锁时，可能发生死锁：

![BPM Lock 与 Page Lock 交叉持有导致循环等待](/posts/week3-BufferPool/image-003.png)

图中线程 A 已经持有 BPM Lock，继续等待 Page Lock；线程 B 此时正持有 Page Lock，又需要 BPM Lock。两边都不能继续执行，也不会主动释放已经持有的锁，于是形成死锁。

死锁的形成需要同时满足四个条件：资源互斥、线程持有资源继续等待、资源不能被强制抢占，以及多个线程之间形成循环等待。在 Buffer Pool 中，前几个条件很难完全消除，因此最实际的做法是破坏最后的循环等待：给不同层次的锁规定统一的获取顺序，使所有执行路径都遵守同一顺序规则。

例如，如果系统规定需要同时使用两把锁时始终按照同一个方向获取，就不会出现一个线程 BPM → Page、另一个线程 Page → BPM 的反向依赖。设计时不能只检查 `CheckedReadPage()` 或 `FlushPage()` 单个函数，而要把 `CheckedReadPage()`、`CheckedWritePage()`、`FlushPage()` 和 PageGuard 的释放过程放在一起看，这样才能破坏不同函数在不同线程中组合执行后形成的锁依赖环。

### 2.3 锁粒度与并发性能优化

大家的实现方式一般是进入 BufferPoolManager 的公共函数后一直持有 `bpm_latch_`，这样容易保证 `page_table_`、Frame 分配等状态一致，但这样并不能保证性能最优。

问题在于 `bpm_latch_` 是一把全局锁。例如缺页时，一个线程可能需要选择 Frame、发起磁盘读取，再通过 `future.get()` 等待 I/O 完成。如图所示，如果整个过程中一直持有 BPM Lock，那么磁盘虽然是在后台线程执行，其他线程仍然可能因为拿不到全局锁而无法继续访问 Buffer Pool。

![持有全局锁等待磁盘 I/O 会阻塞其他线程](/posts/week3-BufferPool/image-004.png)

一个重要的优化方向是缩短全局锁的临界区：只在查询和修改 `page_table_`、`free_frames_`、Page–Frame 映射等全局状态时持有 BPM Lock；像等待 Page Lock、等待磁盘 I/O 这类可能耗时较长的操作，在能够保证状态不被其他线程破坏的前提下，可以考虑移出全局临界区。这里的难点在于，提前释放锁之前必须先把 Frame 的状态固定好，例如保证它不会在等待 I/O 时又被其他线程重新分配，所以锁优化不能只追求"尽早 unlock"，还要同时维护系统状态的一致性。

Page Lock 本身也是考虑到这一点，不同 Page 用各自的锁，线程访问 Page A 时，不需要阻塞正在访问 Page B 的线程。但是锁并不是越细越好。锁越多，锁顺序和状态维护也会越复杂，更容易引入死锁。

## 三、Buffer Pool 的状态一致性与 Flush

在 Buffer Pool 中，一次 Page 操作往往会同时改变多处状态，而这些状态之间又彼此关联，不能各自独立更新。只要 `page_table_`、Frame、`pin_count_`、ARC 状态或磁盘数据中有一处没有同步，就可能出现错误映射、错误淘汰甚至数据丢失。因此我们要注意一次 Page 操作发生以后，系统中所有相关状态如何保持一致。

### 3.1 多状态同步与系统不变量

在 Buffer Pool 中，一次 Page 状态变化往往会同时影响多个组件。Page 被访问时，不仅要找到对应的 Frame，还需要增加 `pin_count_` 并将该 Frame 设为不可淘汰；当最后一个使用者释放 Page 后，又要同步减少 `pin_count_`，并在其降为 0 后恢复可淘汰状态。项目中也要求同一个 Page 在内存中只保留一份，并保证 pin count 与 ARC 的 evictable 状态始终同步。

这些始终需要保持成立的关系，可以理解为 Buffer Pool 的系统不变量。例如 Page–Frame 映射必须和 Frame 中实际保存的 Page 一致，`pin_count_ > 0` 时 Frame 不能被淘汰，Page 被修改后在写回磁盘之前必须保持 dirty 状态。实现时真正需要关注的，不只是某个函数是否执行成功，而是一次操作完成后，这些相互关联的状态是否仍然保持一致。Buffer Pool 的核心难点，本质上是维护这些跨组件状态之间的一致关系。

### 3.2 Page 生命周期与 Frame 替换

![Page 从正在使用到被替换的五个阶段](/posts/week3-BufferPool/image-005.png)

Page 在 Buffer Pool 中并不是一直固定占用某个 Frame，而是随着访问、释放和淘汰不断经历状态变化。当线程正在使用某个 Page 时，对应 Frame 的 `pin_count_ > 0`，此时该 Frame 必须保持不可淘汰状态；只有当所有使用者都释放 Page、`pin_count_` 降为 0 后，它才会重新进入 ARC 的可淘汰集合。

如果随后被 ARC 选为 victim，就意味着这个 Frame 即将结束对旧 Page 的服务。也就是说，Page 从"正在使用"到"被替换"之间，还存在一个明确的状态过渡过程：正在使用 → 可淘汰 → 被选为 victim。这种设计的作用，是保证仍被线程访问的 Page 不会因为缓存空间不足而被提前覆盖。

如图所示，真正的 Frame 替换从 victim 被选中后才开始。此时首先要处理旧 Page 的遗留状态：如果 `is_dirty_ = true`，必须先完成写回；之后才能删除旧的 Page–Frame 映射并重置 Frame。只有旧 Page 的身份和状态被完整清理后，Frame 才能重新用于新的 Page。新 Page 读入后，还需要重新建立 `page_table_` 映射，并恢复新的运行状态，例如 `pin_count_ = 1`、`evictable = false`。整个过程本质上不是一次简单的内存覆盖，而是一次旧 Page 退出、新 Page 接管的完整状态交接。

这里最容易出现问题的是状态更新的顺序。如果在脏页尚未写回时就复用 Frame，可能直接丢失尚未持久化的数据；如果旧映射没有删除，新 Page 又建立了新的映射，就可能出现 Frame 身份混乱；如果 Frame 已经准备被替换，但 ARC、`pin_count_` 或 PageGuard 的状态没有同步完成，也可能导致正在使用的 Page 被错误淘汰。因此，Frame 替换真正需要维护的不是某一个变量，而是一组跨组件状态之间的先后关系。

### 3.3 Flush 与内存—磁盘一致性

Flush 中真正困难的是并发情况下的状态一致性。假设线程 A 正在把 Page 写入磁盘，而线程 B 同时又修改了该 Page；如果 A 写盘结束后直接把 `is_dirty_` 设为 false，B 刚产生的新修改就可能尚未持久化，却被错误地标记为 clean。

BusTub 因此区分了 Safe Flush 和 Unsafe Flush：`FlushPage()` 会获取 Page Lock，保证 Flush 期间页面内容不会被并发修改，从而写出一个稳定的 Page 状态；`FlushPageUnsafe()` 不获取 Page Lock，因此需要更加谨慎地处理 dirty 状态的更新时机。项目说明也明确要求 Safe Flush 通过 Page Lock 保证写盘数据的一致性，而 Unsafe Flush 要特别考虑 `is_dirty_` 的切换。

从这个角度看，Flush 实际上是 Buffer Pool 中一次重要的一致性边界操作：在 Flush 之前，内存可以暂时领先于磁盘；Flush 成功之后，系统才有条件认为这一版本已经持久化。并且 Flush 本身并不等于淘汰，Page 写回磁盘后仍然可以继续留在 Buffer Pool 中。真正需要保证的是：只要 `is_dirty_ = false`，就不能再存在"内存里有更新但磁盘还没有"的未同步修改。

## 四、总结

BusTub Project 1 的核心，不在于分别完成 ARC、Disk Scheduler 和 Buffer Pool Manager，而是同时连接页面替换、磁盘 I/O、并发访问和资源生命周期管理。ARC、Disk Scheduler、PageGuard 和 BufferPoolManager 分别承担替换决策、异步 I/O、访问生命周期和全局状态管理，系统正确性依赖这些组件之间明确的职责边界以及稳定的协作协议。

另一个关键点是，Buffer Pool 中很多信息必须一起变化，不能只看单个变量是否正确。一个 Page 被访问、释放、淘汰或重新读入时，`page_table_`、Frame、`pin_count_`、evictable 和 `is_dirty_` 都可能随之改变。真正需要保证的是这些信息始终互相对应：正在使用的 Page 不能被淘汰，Frame 更换 Page 后旧映射不能继续存在，脏页在复用前必须先写回磁盘。很多难排查的问题，本质上都是某一步漏掉了相关状态，或者更新顺序不正确。

最后，整个 Buffer Pool 的设计实际上一直在平衡三件事：尽量少访问磁盘（成本）、允许多个线程并发工作（并发性），同时保证数据不会出错（正确性）。使用缓存减少磁盘 I/O，使用 dirty page 延迟写回，使用读写锁提高并发，再通过 Flush、PageGuard 和 Frame 替换过程保证数据最终仍然一致。把这些机制放在一起看，才能真正理解 Buffer Pool 为什么要这样设计，而不是只把它看成几个独立函数的集合。
