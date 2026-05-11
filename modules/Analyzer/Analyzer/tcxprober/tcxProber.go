package tcxprober

//go:generate go run github.com/cilium/ebpf/cmd/bpf2go tcxProber tcxProber.bpf.c -- -I./headers -I/usr/include/x86_64-linux-gnu

import (
	"database/sql"
	"encoding/binary"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
	tc "github.com/florianl/go-tc"
	_ "github.com/lib/pq"
	"github.com/vishvananda/netlink"
)

// 与 eBPF 程序中定义的 struct packet_metadata 对应
type packetMetadata struct {
	Direction  uint64
	Timestamp  uint64
	Netifidx   uint64
	Payloadlen uint64
	Payload    [6144]byte
}

// tcxProber.go
// 简单示例：加载编译好的 eBPF ELF 并将其中定义的 TC 程序
// 附加到指定接口的 ingress / egress hook 上。
// 注意：此文件为示例参考，具体细节（如 section 名称、qdisc 管理）
// 可能需根据目标系统和库版本调整。

func TcxExample() error {

	var (
		ifName = flag.String("iface", "ens33", "network interface to attach to")
	)
	flag.Parse()

	// 查找接口索引
	linkIf, err := netlink.LinkByName(*ifName)
	if err != nil {
		return fmt.Errorf("failed to find interface %s: %w", *ifName, err)
	}
	ifIndex := linkIf.Attrs().Index

	// 加载 eBPF 对象
	var objs tcxProberObjects
	err = loadTcxProberObjects(&objs, nil)
	if err != nil {
		return fmt.Errorf("failed to load eBPF objects: %w", err)
	}
	defer objs.Close()

	// 初始化 PostgreSQL 数据库
	// 默认连接到本地PostgreSQL，使用环境变量可以覆盖这些默认值
	dbHost := os.Getenv("POSTGRES_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbPort := os.Getenv("POSTGRES_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := os.Getenv("POSTGRES_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("POSTGRES_PASSWORD")
	if dbPassword == "" {
		dbPassword = "password"
	}
	dbName := os.Getenv("POSTGRES_DB")
	if dbName == "" {
		dbName = "tcxprober"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	// 创建表 - PostgreSQL需要明确的数据类型和SERIAL自增主键
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS packets (
			id SERIAL PRIMARY KEY,
			direction BIGINT,
			timestamp BIGINT,
			netifidx BIGINT,
			payloadlen BIGINT,
			payload BYTEA
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	// 清除表中所有现有数据
	_, err = db.Exec("TRUNCATE TABLE packets")
	if err != nil {
		return fmt.Errorf("failed to clear packets table: %w", err)
	}

	// 在 C 源中定义的 program section 名称 -> 附加点映射
	progNames := map[string]ebpf.AttachType{
		"tcx_ingress": ebpf.AttachTCXIngress,
		// "tcx_ingress_v6": ebpf.AttachTCXIngress,
		"tcx_egress": ebpf.AttachTCXEgress,
		// "tcx_egress_v6":  ebpf.AttachTCXEgress,
	}
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)

	// 启动定期清理协程，每2分钟清理一次，保留最近100万条记录
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// 清理packets表，保留最近100万条记录
				_, err := db.Exec(`
					DELETE FROM packets 
					WHERE timestamp < (
						SELECT timestamp 
						FROM packets 
						ORDER BY timestamp DESC 
						LIMIT 1 OFFSET 1000000
					)
				`)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to clean packets table: %v\n", err)
				} else {
					fmt.Println("packets table cleanup completed")
				}

			case <-sigChan:
				return
			}
		}
	}()
	// 示例：使用 go-tc 检查/管理 qdisc（可选，示例演示如何打开客户端）
	// 真实环境中你可能需要确保在接口上存在 clsact qdisc，
	// 否则 AttachTC 可能会失败或需要先创建 qdisc。
	if tcClient, err := tc.Open(&tc.Config{}); err == nil {
		_ = tcClient
		// 对 qdisc 的具体操作（添加 clsact 等）请参阅 go-tc 文档。
	}

	// 使用 cilium/ebpf/link 附加程序到 TC hook
	for name, attach := range progNames {
		var p *ebpf.Program
		switch name {
		case "tcx_ingress":
			p = objs.TcxIngress
		case "tcx_egress":
			p = objs.TcxEgress
		default:
			continue
		}
		if p == nil {
			fmt.Fprintf(os.Stderr, "program %s not found, skipping\n", name)
			return fmt.Errorf("program %s not found, skipping", name)
		}

		opts := link.TCXOptions{
			Program:   p,
			Interface: ifIndex,
			Attach:    attach,
		}

		l, err := link.AttachTCX(opts)
		if err != nil {
			return fmt.Errorf("failed to attach %s: %w", name, err)
		}
		defer l.Close()

		fmt.Printf("attached %s to %s (ifindex=%d)\n", name, *ifName, ifIndex)
	}

	// 启动数据收集和存储
	packets := make([]packetMetadata, 0, 1000)
	var mu sync.Mutex

	// 数据收集协程 - 使用 perf reader 读取 ring buffer
	go func() {
		// 创建 perf reader 来读取 ring buffer
		reader, err := perf.NewReader(objs.Events, 524288)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to create perf reader: %v\n", err)
			return
		}
		defer reader.Close()

		for {
			record, err := reader.Read()
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to read ring buffer: %v\n", err)
				continue
			}

			if record.LostSamples > 0 {
				fmt.Fprintf(os.Stderr, "ring buffer lost %d samples\n", record.LostSamples)
			}

			if len(record.RawSample) < 32 {
				continue
			}

			var meta packetMetadata
			meta.Direction = binary.LittleEndian.Uint64(record.RawSample[0:8])
			meta.Timestamp = binary.LittleEndian.Uint64(record.RawSample[8:16])
			meta.Netifidx = binary.LittleEndian.Uint64(record.RawSample[16:24])
			meta.Payloadlen = binary.LittleEndian.Uint64(record.RawSample[24:32])

			payloadSize := int(meta.Payloadlen)
			if payloadSize > 6144 {
				payloadSize = 6144
			}
			if payloadSize < 0 {
				payloadSize = 0
			}
			rawPayloadSize := len(record.RawSample) - 32
			if payloadSize > rawPayloadSize {
				payloadSize = rawPayloadSize
			}
			copy(meta.Payload[:payloadSize], record.RawSample[32:32+payloadSize])

			mu.Lock()
			packets = append(packets, meta)
			mu.Unlock()
		}
	}()

	// 数据存储协程（每100ms执行一次，或累积1000条记录时写入）
	go func() error {
		for {
			time.Sleep(15 * time.Millisecond)

			mu.Lock()
			if len(packets) == 0 {
				mu.Unlock()
				continue // 如果没有数据包，继续下一次循环，而不是退出
			}
			// 复制当前数据包列表并清空原列表
			currentPackets := make([]packetMetadata, len(packets))
			copy(currentPackets, packets)
			packets = packets[:0]
			mu.Unlock()

			// 批量插入数据库
			tx, err := db.Begin()
			if err != nil {
				return fmt.Errorf("failed to begin transaction: %w", err)

			}

			stmt, err := tx.Prepare("INSERT INTO packets (direction, timestamp, netifidx, payloadlen, payload) VALUES ($1, $2, $3, $4, $5)")
			if err != nil {
				return fmt.Errorf("failed to prepare statement: %w", err)

			}
			defer stmt.Close()

			for _, p := range currentPackets {
				payloadLen := int(p.Payloadlen)
				if payloadLen > 6144 {
					payloadLen = 6144
				}
				if payloadLen < 0 {
					payloadLen = 0
				}
				_, err := stmt.Exec(p.Direction, p.Timestamp, p.Netifidx, p.Payloadlen, p.Payload[:payloadLen])
				if err != nil {
					return fmt.Errorf("failed to insert packet: %w", err)
				}
			}

			if err := tx.Commit(); err != nil {
				return fmt.Errorf("failed to commit transaction: %w", err)
			}
		}
	}()

	fmt.Printf("tcxProber attachments complete, press Ctrl+C to exit\n")

	// 保持程序运行
	// 等待中断信号以优雅退出

	<-sigChan
	fmt.Println("程序退出...")
	return nil
}
