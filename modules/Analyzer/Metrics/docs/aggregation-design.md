# Metrics In-Kernel Aggregation Design

## 1. Problem Review

The current architecture inherits the "per-packet delivery" model from the original BCC/Python version: every time the kernel matches a packet, it submits an `event_t` event to the Go user space via RingBuffer. The Go side consumes these events sequentially to calculate PPS, frequency, and latency.

**Core Flaws**: When the monitored traffic reaches a high PPS (e.g., 100,000+), it causes:
- RingBuffer overflow and dropped events
- Massive kernel-to-user space context switching
- Go user space CPU fully occupied by batch event processing

## 2. Solution Overview

Adopt the standard best practice in the eBPF domain — **In-Kernel Aggregation**:

```
┌─────────────────── Kernel Space ───────────────────┐
│                                                     │
│  probe hit ──→ extract tuple ──→ match filter       │
│                     │                                │
│                     ▼                                │
│          ┌──────────────────────┐                    │
│          │  PERCPU_ARRAY (agg)  │  val->packets++   │
│          │  26 slots, lock-free │  val->last_lat=Δ  │
│          └──────────────────────┘                    │
│                                                     │
└─────────────────────────────────────────────────────┘
                      │
              Map Read Once per Second
                      ▼
┌─────────────────── User Space (Go) ────────────────┐
│                                                     │
│  Ticker(1s) ──→ Read 26 slots (sum across CPUs)    │
│       │                                             │
│       ├──→ Calc PPS = Σpackets / interval           │
│       ├──→ Calc frequency = Σcount / interval       │
│       ├──→ Get last_lat_us → LAT(ms)               │
│       ├──→ Zero out Map entries                     │
│       │                                             │
│       └──→ Push JSON to WebSocket                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Performance Guarantee**: Whether the traffic PPS is 1 or 1,000,000, the user space performs exactly 26 Map reads + 26 zero writes = 52 syscalls every second. The overhead is $O(1)$.

## 3. Data Structure Design

### 3.1 Aggregation Map (BPF Side)

Use `BPF_MAP_TYPE_PERCPU_ARRAY`. Each CPU has a separate counter copy, so **no locks** are needed when probes write to it.

```c
// Aggregation value structure
struct agg_val_t {
    u64 packets;        // Packets matched in current cycle
    u64 first_ts_ns;    // First packet timestamp (ns)
    u64 last_ts_ns;     // Last packet timestamp (ns)
    u64 last_lat_us;    // Last cross-layer latency (us)
    u32 last_pid;       // Last matched PID
    char last_task[16]; // Last matched task/process name
};

// Fixed-size array, 26 slots
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, AGG_MAX);      // 26
    __type(key, u32);
    __type(value, struct agg_val_t);
} agg_map SEC(".maps");
```

### 3.2 Slot Encoding Rules

Use a fixed index determinable at compile-time to avoid runtime hash lookup overhead:

```
index = metric_type × 12 + layer × 4 + direction × 2 + is_ipv6
```

| Category | metric_type | layer/crosslayer | direction | is_ipv6 | Index Range |
|------|-------------|-----------------|-----------|---------|---------|
| **PPS** | 0 | link=0, network=1, trans=2 | RX=0, TX=1 | 0/1 | 0 – 11 |
| **LAT** | 1 | linknetwork=0, networktrans=1, linktrans=2 | RX=0, TX=1 | 0/1 | 12 – 23 |
| **DROP** | 2 | fixed=0 | fixed=0 | 0/1 | 24 – 25 |

Total of **26 fixed slots**.

### 3.3 Probe Modifications

Taking `netif_receive_skb` (Link layer RX) as an example:

```c
// Old: submit_event(e, DIR_RX, LAYER_LINK) → push to RingBuffer per packet
// New:
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

// Link layer RX probe only needs to call:
u32 pps_idx = AGG_IDX(AGG_PPS, LAYER_LINK, DIR_RX, e.is_ipv6);
agg_increment(pps_idx, 0, pid);
```

For probes calculating cross-layer latency (e.g., `ip_local_deliver` calculating link→network latency), additionally update the LAT index:

```c
u32 lat_idx = AGG_IDX(AGG_LAT, CROSSLAYER_LINKNETWORK, DIR_RX, e.is_ipv6);
agg_increment(lat_idx, delta_us, pid);
```

## 4. Go User Space Design

### 4.1 Periodic Pull Engine

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
        // PerCPU read: returns []AggVal, one per CPU
        vals, err := e.objs.AggMap.Lookup(idx)
        // Sum across CPUs
        sum := sumPerCPU(vals)
        // Zero out map entry
        e.objs.AggMap.Update(idx, zero)

        if sum.Packets == 0 { continue }

        // Calc metrics
        interval := float64(sum.LastTsNs - sum.FirstTsNs) / 1e9
        if interval <= 0 { interval = 1.0 }

        pps := float64(sum.Packets) / interval
        // ... build MetricsResponse and push
    }
}
```

### 4.2 Race Condition in Zeroing

There is a tiny window between reading and zeroing out the entries where packet counts might be overwritten to zero. For a monitoring context (as opposed to billing/auditing), this slight inaccuracy is perfectly acceptable and is standard practice for eBPF observability tools.

If more precision is ever needed, a double-buffering approach (A/B swap) could be used, but this adds complexity and is unnecessary at this stage.

## 5. RingBuffer Retained Uses

The RingBuffer is **no longer used for the main data path**, but is retained for:
- First packet notifications (optional, for topology discovery or low-frequency events)
- Per-packet debugging in debug mode

In default builds, the RingBuffer size can be shrunk down to 64KB or smaller.

## 6. External Interface Consistency

The JSON formats published via WebSocket remain completely identical to the original Calculator module:

**Type A — Cross-layer Latency + Frequency:**
```json
{"crosslayer":"linknetwork","direction":"send","type":"ipv4","pid":123,"pid_name":"nginx","saddr":"...","daddr":"...","sport":80,"dport":443,"LAT(ms)":0.5,"frequency(s)":100}
```

**Type B — Per-layer Packet Count + PPS:**
```json
{"layer":"trans","direction":"send","type":"ipv4","pid":123,"saddr":"...","daddr":"...","sport":80,"dport":443,"num":1000,"pps(s)":500}
```

**Type C — Packet Drop Rate:**
```json
{"type":"ipv4","pid":123,"saddr":"...","daddr":"...","sport":80,"dport":443,"drop(s)":5}
```

## 7. Idle Heartbeat

When `packets` in all 26 slots are 0 for a 1-second cycle, the Go side will still send roughly 26 zeroed-out JSON items. This preserves the original behavior to ensure the frontend can perform keep-alive validation.
