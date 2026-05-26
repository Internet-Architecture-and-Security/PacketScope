go mod init github.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/baserun

## ReadBTFandGetItsMember (Linux-only) ✅

- 文件: `ReadBTFandGetItsMember.go` (package `main`)
- 功能: 读取 `./.cache/btf.json`，查找与 `sk_buff` 相关（深度 ≤ 5）的 types，筛选出参数中包含这些 type 的 `FUNC` 项并写入 `./.cache/relatedFuncD5.json`。
- 导出函数: `ReadBTFandGetItsMember()`，返回 `([]map[string]interface{}, error)`。
- 注意: 仅在 **Linux** 上编译（文件包含 `//go:build linux`）。实现对 JSON 结构的断言做了防御性处理，尽量兼容原 Python 脚本的行为。

### 示例用法

```go
func main() {
    funcs, err := ReadBTFandGetItsMember()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("found %d related funcs\n", len(funcs))
}
```

- 使用 `Router.Register(method, path, handler)` 注册新的路由。
- 处理函数签名为 `func(w http.ResponseWriter, r *http.Request) error`，返回 `error` 可统一处理各种错误并返回 JSON。
- 中间件（如日志、JSON header）集中注册，易于插拔。

---

## TranslateJSON (Linux-only) ✅

- 文件: `translateJSON.go` (package `main`)
- 功能: 读取 `./.cache/relatedFuncD5.json`，将函数列表按 `id` 重建为字典并写入 `./.cache/FuncIDMap.json`，同时根据函数名规则生成 BPF C 源文件 `./.cache/kProberFunc.c`。
- 导出函数: `TranslateJSON()`，返回 `error`。
- 注意: 仅在 **Linux** 上编译（文件包含 `//go:build linux`）。此 Go 实现行为与原 `translateJSON.py` 等价，尽量保留原脚本的选择逻辑和模板。

使用示例：

```go
if err := TranslateJSON(); err != nil {
    log.Fatalf("translate json failed: %v", err)
}
```


**Baserun (Linux-only)**

- **File**: [baserun.go](baserun.go)
- **Package**: `baserun`
- **Exported function**: `BaseRun()` — performs the same actions as the original `baserun.py`.
- **Behavior**: ensures `./.cache` exists, removes `FunctionInfo.db` and `PacketInfo.db` if present, recreates `./.cache/btf.json` by running `bpftool -j btf dump file /sys/kernel/btf/vmlinux` and writing the JSON output into it.
- **Usage**:

```go
package main

import (
    "log"
    "github.com/your/module/baserun" // adjust module path as needed
)

func main() {
    if err := baserun.BaseRun(); err != nil {
        log.Fatalf("baserun failed: %v", err)
    }
}
```

**Notes**:

- This code mirrors the original Python script and is intended for Linux systems where `bpftool` and `/sys/kernel/btf/vmlinux` are available.
Only `BaseRun` is exported; helper functions are unexported per the refactor request.

````


`````

**Makefile**

- 已添加 `Makefile`（项目根目录）。主要目标：
    - `make build`：构建可执行文件到 `bin/goserverps`。
    - `make run`：先构建，然后运行 `./bin/goserverps`。
    - `make run-dev`：使用 `go run main.go` 在开发模式下运行（无需先构建）。
    - `make clean`：删除 `bin` 目录和 `.cache`（注意：`.cache` 会被删除）。
    - `make fmt`：格式化源码（`gofmt -w .`）。
    - `make vet`：运行 `go vet ./...`。

使用示例：

```bash
make build
make run
# 或者（开发时）
make run-dev
```

更多编译与运行细节见 [BUILD.md](BUILD.md).

