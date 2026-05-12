# Go项目的Makefile

# 设置变量
APP_NAME := baserun
GO := go
GOFLAGS := -v
BUILD_FLAGS := -ldflags "-w -s"
OUTPUT_DIR := ../
OUTPUT := $(OUTPUT_DIR)$(APP_NAME)

# 默认目标
all: build

# 编译目标
build: $(OUTPUT)

$(OUTPUT): *.go
	$(GO) build $(GOFLAGS) $(BUILD_FLAGS) -o $(OUTPUT) .

# 清理目标
clean:
	$(GO) clean
	rm -f $(OUTPUT)

# 运行目标
run: $(OUTPUT)
	$(OUTPUT)

# 格式化代码
fmt:
	$(GO) fmt ./...

# 检查代码
vet:
	$(GO) vet ./...

# 测试代码
test:
	$(GO) test ./...

.PHONY: all build clean run fmt vet test