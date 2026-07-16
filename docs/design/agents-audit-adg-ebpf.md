# Agents Audit — Fusing Static Agent Dependency Graphs with Runtime eBPF Observation

> Status: **Design draft** · Scope: PacketScope `Agents Audit` capability direction
> Audience: PacketScope maintainers

## 1. Motivation

LLM agent programs (built on frameworks such as LangGraph, OpenAI Agents SDK,
CrewAI, LlamaIndex, Semantic Kernel) express their real dependencies through
_framework-induced semantics_ rather than ordinary function calls: a decorator
registers a tool, a handoff transfers control between agents, a shared session
becomes a cross-agent memory channel, and an approval flag becomes a control
policy. These agent-level dependencies are invisible to both traditional static
analysis and to raw network monitoring taken in isolation.

PacketScope already observes the host at the protocol-stack level via eBPF. The
`Agents Audit` direction extends this to answer a harder question: **for an
agent system running on this host, what is each agent actually allowed to do,
what did it actually do, and where do those two disagree?**

The core idea of this design is to combine two complementary views:

|          | Static view                                                                                       | Dynamic view (eBPF)                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Answers  | what the code **allows** ("can happen")                                                           | what actually **happened** ("did happen")                                                            |
| Level    | agent / tool / policy (high level)                                                                | socket / syscall / packet (low level)                                                                |
| Weakness | over-approximate → false positives; blind to runtime reality; misses custom/dynamic orchestration | sees fragments, no global structure; observes a syscall but not _which agent's which tool_ caused it |

The two weaknesses are complementary. The static view supplies a **semantic
skeleton** that gives raw eBPF events meaning; eBPF supplies **runtime evidence**
that confirms, prunes, and augments the static graph. The fused artifact is the
**unified interaction graph** at the heart of PacketScope: static analysis draws
the skeleton, eBPF lights up the live edges.

A convenient alignment makes this practical: the high-impact sink categories for
prompt-to-tool (P2T) risk — **external send, file access, SQL, command/code
execution** — are exactly the operations eBPF observes at the syscall/network
layer. A static claim ("tainted prompt data _can_ reach a command-execution
sink") meets a runtime observation ("this process _actually_ called `execve`"),
and together they form a **runtime-confirmed taint path**.

## 2. Layered architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  (5) Response   alerting / in-kernel blocking (Guarder XDP) /     │
│                 audit & forensics export                          │
├─────────────────────────────────────────────────────────────────┤
│  (4) Reasoning  differential audit · privilege/anomaly detection  │
│                 · P2T confirmation · LLM causal analysis          │
├─────────────────────────────────────────────────────────────────┤
│  (3) Fusion / Correlation  ★core★                                 │
│      align runtime events ⇄ static graph nodes/edges, producing   │
│      three edge classes:                                          │
│      CONFIRMED (static∩dynamic)  UNEXPECTED (dynamic-only)         │
│      UNREALIZED (static-only)                                      │
│                    ┌──────────────────┐                           │
│                    │ unified interaction graph │                  │
│                    └──────────────────┘                           │
├──────────────────────────────┬──────────────────────────────────┤
│  (1) Static layer            │  (2) Runtime observation (eBPF)    │
│  agent dependency analysis   │  network flows · syscall sinks ·   │
│  (offline)                   │  identity correlation              │
│  → dependency graph + agent  │  → labeled runtime event stream    │
│    BOM + candidate P2T paths │                                    │
└──────────────────────────────┴──────────────────────────────────┘
```

## 3. Static layer — agent dependency analysis (offline)

An offline analyzer recovers agent-level dependencies from an agent program's
source code and emits:

- an **agent dependency graph** with typed nodes and edges,
- an **agent bill of materials (BOM)** enumerating agents, models, prompts,
  capabilities (tools / MCP servers / skills), memory states, and control
  policies, together with their binding relationships, and
- a set of **candidate P2T paths** where prompt-controlled data may reach a
  sensitive capability.

### 3.1 Node and edge model

Nodes (7 types): `Agent`, `Model`, `Prompt`, `Capability`, `MemoryState`,
`Policy`, plus runtime-only nodes added later (see §5.2).

Edges (3 families):

- **Component binding** — an agent is statically bound to its model, prompt,
  capabilities, and memory state; a policy is attached to an agent or capability.
- **Control flow** — execution may transfer from an agent to a capability
  (a tool call) or from one agent to another (a handoff), optionally guarded by
  a policy.
- **Data flow** — information may propagate through prompts, tool arguments and
  returns, shared sessions, and inter-agent messages.

The static graph is deliberately **over-approximate**: because an agent's
concrete behavior depends partly on runtime model outputs, static analysis
cannot predict a single execution trace and instead covers every dependency the
program structure permits. This over-approximation is precisely what the runtime
layer later prunes.

Static declarations also carry the **join keys** the correlation layer needs:
an MCP capability records its server URL, a tool records its signature, and a
policy records its enforcement mode (e.g. approval-required).

## 4. Runtime observation layer (eBPF)

Network packets alone are insufficient (TLS hides payloads), so three
complementary probe families are used, reusing PacketScope's existing modules
where possible.

| Vector                   | What it captures                                                                                      | eBPF technique                                            | Reused module                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| **Network flow**         | agent → MCP/HTTP/A2A connections, endpoints, latency, bytes                                           | XDP / TC / kprobe (tcp)                                   | Guarder (conntrack) + Monitor (tcxprober) |
| **Syscall sink**         | `connect`/`sendmsg` (external send), `openat` (file), DB-port connects (SQL), `execve` (command exec) | fentry / kprobe / tracepoint; LSM hooks for sensitive ops | Monitor (kbatch), extended                |
| **Identity correlation** | tag events with `(agent, capability, request_id)`                                                     | uprobe / USDT on framework dispatch points                | new (see §5.1)                            |

### 4.1 P2T sink ↔ eBPF probe mapping

| P2T sink category      | Runtime eBPF observation                                               | Severity |
| ---------------------- | ---------------------------------------------------------------------- | -------- |
| External send          | non-loopback `connect`/`sendmsg` → enrich with Geo/ASN/risk via Tracer | high     |
| File access            | `openat`/`read`/`write` (LSM can resolve path + read/write mode)       | medium   |
| SQL                    | connect to DB ports (5432/3306) + query payload, or DB-driver uprobe   | medium   |
| Command / code execute | `execve`/`execveat` (tracepoint/LSM)                                   | highest  |

The read/write mode and exact path available at the LSM layer let the runtime
layer discard coarse static false positives (e.g. distinguishing a read-only
`open` from a destructive write).

## 5. Fusion / correlation layer (core)

### 5.1 The semantic gap and tiered correlation

The central difficulty: eBPF sees `PID 4213 / TID 4230 sent 512 bytes to
10.0.3.7:8931`, while the static graph says `OpsAgent may send external mail via
its SendEmail capability`. Mapping the former to the latter is the crux. We use
**tiered correlation with a confidence score**, weakest to strongest:

- **Tier 0 — endpoint match (zero-instrumentation).** A capability's declared
  server URL / target address is known statically. Join eBPF `connect`
  destinations against declared endpoints. Confirms _which capability_ was
  reached, but not _which agent_ in a multi-agent process. Confidence: medium.
- **Tier 1 — process/thread lineage + timing.** Events carry `PID/TID/cgroup`;
  map process → agent program → (via the static graph) the candidate agent set,
  narrowing by concurrency and timing. Sufficient for single-agent programs.
  Confidence: medium.
- **Tier 2 — uprobe semantic tagging (primary).** Place uprobes/USDT at
  framework dispatch points (agent run entry, tool-call dispatch, handoff
  dispatch, MCP client call). On hit, write `(request_id, agent, capability)`
  into a per-task BPF map so subsequent syscalls on that thread inherit the
  label. Yields exact agent+tool attribution. Confidence: high.
- **Tier 3 — context propagation (cross-process / cross-host A2A).** Inject a
  correlation id (e.g. W3C `traceparent`) that travels with prompts, handoffs,
  and network calls; eBPF reads it from plaintext headers, or a lightweight
  in-process shim emits it. Confidence: high.

> Engineering reality: Python's async event loop interleaves multiple agents on
> one thread, so plain PID/TID (Tier 1) is not enough — Tier 2 uprobes at
> dispatch points (with request context surfaced via USDT) are required for
> correct attribution under concurrency. When payloads are TLS-encrypted and no
> uprobe is available, correlation degrades to Tier 0+1 (endpoint + process +
> timing) and edges are tagged with a lower `confidence`.

### 5.2 Unified graph model

Keep the static node/edge ontology and add runtime attributes:

- Each edge gains `observed { count, first_seen, last_seen, p50_latency, bytes,
confidence, trace_ids }`.
- Each edge carries a **status**:
  - `STATIC_ONLY` — present in the static graph, never observed at runtime.
  - `CONFIRMED` — present statically **and** observed at runtime.
  - `RUNTIME_ONLY` — observed at runtime, absent from the static graph.
- New **runtime-only nodes**: `RemoteEndpoint` (real IP / ASN / geo / risk score
  via Tracer), `Principal/Identity`, `Session` instance.

### 5.3 Three edge classes = three audit primitives

```
        static-permitted edges        eBPF-observed edges
        ┌────────────────┐          ┌────────────────┐
        │   UNREALIZED   │  ∩  =     │   UNEXPECTED    │
        │ declared,      │ CONFIRMED │ occurred,       │
        │ never invoked  │           │ never declared  │
        └────────────────┘          └────────────────┘
```

| Edge class                       | Security meaning                                                                                                                               | Why neither view alone suffices                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **UNREALIZED** (static-only)     | declared-but-unused capability/handoff = dead attack surface / over-privilege; BOM hygiene                                                     | a purely dynamic view cannot see what was _declared_               |
| **CONFIRMED** (static ∩ dynamic) | static taint path + real execution evidence = high-confidence P2T; runtime evidence prunes static false positives                              | resolves the static view's headline weakness                       |
| **UNEXPECTED** (dynamic-only)    | runtime behavior outside what the static graph permits = shadow tool call / privilege escalation / prompt-injection-induced call / C2 callback | a purely static view cannot see custom wrappers or dynamic binding |

These three classes are the primary output of Agents Audit and map directly onto
the capability direction's goals: UNREALIZED → attack surface / compliance,
CONFIRMED → risk confirmation, UNEXPECTED → privilege / anomaly discovery.

## 6. End-to-end walkthrough

Scenario: `ResearchAgent --handoff--> OpsAgent --> SendEmail(MCP,
approval-required)`.

1. **Static.** The dependency graph yields a path `UserInput ⇝ ResearchAgent
→(handoff)→ OpsAgent → SendEmail`, guarded by an approval policy, and flags it
   as a candidate P2T (user input may reach an external-send sink).
2. **Runtime.** A uprobe at the agent run entry tags request R; handoff dispatch
   hands control to OpsAgent; the MCP client call to `send_email` produces a
   `connect` to the declared server endpoint and a `sendmsg`; the approval hook
   is observed (or not).
3. **Fusion.**
   - The `ResearchAgent ⇝ SendEmail` edge becomes **CONFIRMED**, with real
     data-flow evidence.
   - Tracer scores the `RemoteEndpoint`; a hit on a known-bad list raises an
     **external-send-to-malicious-endpoint** alert.
   - If the approval policy node has **no corresponding runtime approval event**,
     raise a **policy-bypass** alert (declared but not enforced).

The last finding is unique to the fused view: the static view only knows an
approval _should_ occur; the dynamic view only sees an email _was_ sent; only the
combination can assert _the required approval did not happen_.

## 7. Mapping to existing PacketScope modules

| Component                             | Status                                                    | Effort                           |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| Static agent dependency analyzer      | new (offline)                                             | medium                           |
| Network-flow observation              | Guarder XDP/conntrack + Monitor tcxprober                 | small (extend)                   |
| Syscall-sink observation              | Monitor kbatch (fentry/kprobe); add `execve`/`openat`/LSM | medium                           |
| Endpoint risk enrichment              | Tracer (Geo/ASN/risk)                                     | small (reuse)                    |
| Identity correlation (uprobe tagging) | none                                                      | large (core new work)            |
| Unified graph store                   | none                                                      | medium (part of the engine base) |
| Reasoning layer                       | Guarder AI calls as a starting point                      | medium                           |
| Response / in-kernel blocking         | Guarder rule injection                                    | small (reuse)                    |
| MCP exposure                          | existing `skills/` pattern                                | small (reuse)                    |

Observation and response fall largely on existing modules; the genuinely new
work concentrates in **uprobe-based semantic correlation** and the **unified
graph**, which the engine base already needs to build.

## 8. Challenges and risks

1. **TLS opacity.** MCP-over-HTTPS hides payloads. Mitigations: uprobe on the
   plaintext boundary (`SSL_write`), an in-process shim, or degrade to
   endpoint + timing correlation with a lower confidence tag. The network layer
   must not be assumed to see through everything.
2. **Python async attribution.** One thread interleaves many agents; PID/TID is
   insufficient. Requires uprobes at dispatch points plus request context via
   USDT.
3. **Framework coverage upkeep.** Uprobe points must track framework constructs;
   framework upgrades require maintenance.
4. **Observation window ≠ completeness.** An unobserved edge is not proof of
   impossibility. `UNREALIZED` must be reported as "attack surface within window
   W", never as a safety guarantee.
5. **Performance.** Uprobes on hot paths add overhead; sample broadly and only
   capture sensitive sinks in full.
6. **Distributed A2A.** Cross-host correlation needs trace-context propagation.

## 9. Phased delivery

- **P1 — engine + graph base.** Unified graph store + offline static-graph
  import + network/syscall observation, correlated at Tier 0+1 (endpoint +
  process). Produces coarse CONFIRMED / UNEXPECTED edges. Reuses existing
  modules; fast to a first demo.
- **P2 — semantic correlation.** Tier 2 uprobe attribution (exact agent+tool);
  prune static P2T false positives with runtime evidence.
- **P3 — enforcement & response.** Policy-enforcement consistency checks
  (approval bypass), Tracer risk fusion on runtime endpoints, Guarder in-kernel
  blocking loop.
- **P4 — distributed & reasoning.** Cross-host A2A trace propagation; LLM causal
  reasoning over the fused graph.

## 10. Summary

Treat the static agent dependency graph as the **semantic skeleton of permitted
behavior** and eBPF as the **runtime evidence of actual behavior**, align both
onto **one interaction graph** through a **tiered, confidence-scored correlation
engine** (endpoint → process → uprobe → trace), and emit **CONFIRMED /
UNEXPECTED / UNREALIZED** edges. This simultaneously prunes static false
positives with runtime evidence, interprets raw runtime events with static
structure, and surfaces privilege and shadow-call behavior that static analysis
alone can never see. Observation and response reuse existing modules; the new
work (uprobe semantic correlation + unified graph) lands on the engine base the
roadmap already calls for.
