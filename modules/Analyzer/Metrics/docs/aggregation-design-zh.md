# Metrics 内核态聚合方案设计

## 1. 问题回顾

当前架构继承自原 BCC/Python 版本的"逐包投递"模式：内核每匹配到一个数据包，就通过 RingBuffer 向 Go 用户态提交一个 `event_t` 事件。Go 侧逐个消费这些事件后计算 PPS、频率和延迟。

**核心缺陷**：当被监测流的速率达到较高 PPS 时（如 10 万+），会产生：
- RingBuffer 溢出丢事件
- 大量内核→用户态上下文切换
- Go 侧 CPU 被批量事件处理占满

## 2. 方案概述

采用 eBPF 领域的标准最佳实践 —— **In-Kernel Aggregation（内核内聚合）**：

```
┌─────────────────── Kernel Space ───────────────────┐
│                                                     │
│  probe hit ──→ extract tuple ──→ match filter       │
│                     │                                │
│                     ▼                                │
│          ┌──────────────────────┐                    │
│          │  PERCPU_ARRAY (agg)  │  val->packets++   │
│          │  26 slots, 无锁     │  val->last_lat=Δ  │
│          └──────────────────────┘                    │
│                                                     │
└─────────────────────────────────────────────────────┘
                      │
              每秒一次 Map Read
                      ▼
┌─────────────────── User Space (Go) ────────────────┐
│                                                     │
│  Ticker(1s) ──→ 读取 26 个 slot（跨 CPU 求和）     │
│       │                                             │
│       ├──→ 计算 PPS = Σpackets / interval           │
│       ├──→ 计算 frequency = Σcount / interval       │
│       ├──→ 取 last_lat_us → LAT(ms)                │
│       ├──→ 写零重置 Map 条目                        │
│       │                                             │
│       └──→ JSON 推送至 WebSocket                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**性能保证**：无论流量 PPS 为 1 还是 1,000,000，用户态每秒固定执行 26 次 Map 读取 + 26 次写零 = 52 次系统调用，开销 $O(1)$。

## 3. 数据结构设计

### 3.1 聚合 Map（BPF 侧）

使用 `BPF_MAP_TYPE_PERCPU_ARRAY`，每个 CPU 有独立的计数副本，探针写入时**无需任何锁**。

```c
// 聚合值结构
struct agg_val_t {
    u64 packets;        // 本周期命中包数
    u64 first_ts_ns;    // 首包时间戳（纳秒）
    u64 last_ts_ns;     // 末包时间戳（纳秒）
    u64 last_lat_us;    // 最近一次跨层延迟（微秒）
    u32 last_pid;       // 最近一次 PID
    char last_task[16]; // 最近一次进程名
};

// 固定大小数组，26 个 slot
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, AGG_MAX);      // 26
    __type(key, u32);
    __type(value, struct agg_val_t);
} agg_map SEC(".maps");
```

### 3.2 槽位编码规则

采用编译期可确定的固定索引，避免运行时 hash 查找开销：

```
index = metric_type × 12 + layer × 4 + direction × 2 + is_ipv6
```

| 类别 | metric_type | layer/crosslayer | direction | is_ipv6 | 索引范围 |
|------|-------------|-----------------|-----------|---------|---------|
| **PPS** | 0 | link=0, network=1, trans=2 | RX=0, TX=1 | 0/1 | 0 – 11 |
| **LAT** | 1 | linknetwork=0, networktrans=1, linktrans=2 | RX=0, TX=1 | 0/1 | 12 – 23 |
| **DROP** | 2 | 固定=0 | 固定=0 | 0/1 | 24 – 25 |

总计 **26 个固定 slot**。

### 3.3 探针修改

以 `netif_receive_skb`（链路层 RX）为例：

```c
// 旧: submit_event(e, DIR_RX, LAYER_LINK) → RingBuffer 逐包提交
// 新:
static __always_inline void agg_increment(u32 idx, u64 lat_us, u32 pid) {
    struct agg_val_t *val = bpf_map_lookup_elem(&agg_map, &idx);
    if (!val) return;

    val->packets++;
    u64 now = bpf_ktime_get_ns();
    if (val->first_ts_ns == 0)
        val->first_ts_ns = now;
    val->last_ts_ns = now;
    val->last_lat_us = lat_us;
    val->last_pid = pid;
    bpf_get_current_comm(&val->last_task, sizeof(val->last_task));
}

// 链路层 RX 探针只需调用:
u32 pps_idx = AGG_IDX(AGG_PPS, LAYER_LINK, DIR_RX, e.is_ipv6);
agg_increment(pps_idx, 0, pid);
```

对于产生跨层延迟的探针（如 `ip_local_deliver` 计算 link→network 延迟），额外更新 LAT 索引：

```c
u32 lat_idx = AGG_IDX(AGG_LAT, CROSSLAYER_LINKNETWORK, DIR_RX, e.is_ipv6);
agg_increment(lat_idx, delta_us, pid);
```

## 4. Go 用户态设计

### 4.1 定时拉取引擎

```go
func (e *Engine) StartAggregationLoop(ctx context.Context, out chan<- MetricsResponse) {
    ticker := time.NewTicker(1 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            e.collectAndPush(out)
        }
    }
}

func (e *Engine) collectAndPush(out chan<- MetricsResponse) {
    zero := AggVal{}
    for idx := uint32(0); idx < AGG_MAX; idx++ {
        // PerCPU read: 返回 []AggVal，每个 CPU 一个
        vals, err := e.objs.AggMap.Lookup(idx)
        // 跨 CPU 求和
        sum := sumPerCPU(vals)
        // 写零重置
        e.objs.AggMap.Update(idx, zero)

        if sum.Packets == 0 { continue }

        // 计算指标
        interval := float64(sum.LastTsNs - sum.FirstTsNs) / 1e9
        if interval <= 0 { interval = 1.0 }

        pps := float64(sum.Packets) / interval
        // ... 构造 MetricsResponse 推送
    }
}
```

### 4.2 写零重置的竞态

读取和写零之间存在微小窗口，期间到达的包的计数会被覆盖清零。对于监控场景（非计费/审计），这个误差完全可以接受，是 eBPF 监控工具的标准做法。

如果未来需要更精确：可以改用双缓冲（A/B swap），但这会增加复杂度，当前阶段不建议引入。

## 5. RingBuffer 的保留用途

RingBuffer **不再用于主数据路径**，但保留用于：
- 首包通知（可选，用于拓扑发现等低频事件）
- 调试模式下的逐包审查

默认编译中可以将 RingBuffer 大小缩减至 64KB 甚至更小。

## 6. 对外接口不变

WebSocket 输出的 JSON 格式保持与原 Calculator 模块完全一致：

**Type A — 跨层延迟 + 频率：**
```json
{"crosslayer":"linknetwork","direction":"send","type":"ipv4","pid":123,"pid_name":"nginx","saddr":"...","daddr":"...","sport":80,"dport":443,"LAT(ms)":0.5,"frequency(s)":100}
```

**Type B — 每层包计数 + PPS：**
```json
{"layer":"trans","direction":"send","type":"ipv4","pid":123,"saddr":"...","daddr":"...","sport":80,"dport":443,"num":1000,"pps(s)":500}
```

**Type C — 丢包率：**
```json
{"type":"ipv4","pid":123,"saddr":"...","daddr":"...","sport":80,"dport":443,"drop(s)":5}
```

## 7. 空闲心跳

当某个 1 秒周期内所有 26 个 slot 的 `packets` 均为 0 时，Go 侧发送所有维度的零值 JSON（约 26 条），与原版行为保持一致，确保前端判活。
