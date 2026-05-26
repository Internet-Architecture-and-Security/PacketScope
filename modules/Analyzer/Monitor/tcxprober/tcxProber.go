package tcxprober

import (
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
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

func TcxExample() error {
	var (
		ifName = flag.String("iface", "ens33", "network interface to attach to")
	)
	flag.Parse()

	linkIf, err := netlink.LinkByName(*ifName)
	if err != nil {
		return fmt.Errorf("failed to find interface %s: %w", *ifName, err)
	}
	ifIndex := linkIf.Attrs().Index

	var objs tcxProberObjects
	err = loadTcxProberObjects(&objs, nil)
	if err != nil {
		return fmt.Errorf("failed to load eBPF objects: %w", err)
	}
	defer objs.Close()

	// 初始化 PostgreSQL 数据库
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

	// 创建表 - 与 Python 版本保持一致
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS ipv4packets (
			time DOUBLE PRECISION,
			netif INTEGER,
			direction INTEGER,
			length INTEGER,
			content TEXT,
			srcip TEXT,
			dstip TEXT,
			srcport INTEGER,
			dstport INTEGER,
			prot INTEGER,
			ipid INTEGER,
			ttl INTEGER,
			frag TEXT,
			option TEXT
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create ipv4packets table: %w", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS ipv6packets (
			time DOUBLE PRECISION,
			netif INTEGER,
			direction INTEGER,
			length INTEGER,
			content TEXT,
			srcip TEXT,
			dstip TEXT,
			header INTEGER,
			srcport INTEGER,
			dstport INTEGER
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create ipv6packets table: %w", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS otherpackets (
			time DOUBLE PRECISION,
			netif INTEGER,
			direction INTEGER,
			length INTEGER,
			content TEXT
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create otherpackets table: %w", err)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)

	// 启动定期清理协程
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				tables := []string{"ipv4packets", "ipv6packets", "otherpackets"}
				for _, table := range tables {
					_, err := db.Exec(fmt.Sprintf(`
						DELETE FROM %s 
						WHERE time < (
							SELECT time 
							FROM %s 
							ORDER BY time DESC 
							LIMIT 1 OFFSET 1000000
						)
					`, table, table))
					if err != nil {
						fmt.Fprintf(os.Stderr, "failed to clean %s table: %v\n", table, err)
					}
				}
				fmt.Println("tables cleanup completed")

			case <-sigChan:
				return
			}
		}
	}()

	// 附加 eBPF 程序到 TC hook
	progNames := map[string]ebpf.AttachType{
		"tcx_ingress": ebpf.AttachTCXIngress,
		"tcx_egress":  ebpf.AttachTCXEgress,
	}

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

	// 数据收集
	packets := make([]packetMetadata, 0, 1000)
	var mu sync.Mutex
	attachTime := float64(time.Now().UnixNano()) / 1e9

	// 数据读取协程
	go func() {
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

	// 数据存储协程 - 解析并存储到对应表
	go func() {
		for {
			time.Sleep(15 * time.Millisecond)

			mu.Lock()
			if len(packets) == 0 {
				mu.Unlock()
				continue
			}
			currentPackets := make([]packetMetadata, len(packets))
			copy(currentPackets, packets)
			packets = packets[:0]
			mu.Unlock()

			tx, err := db.Begin()
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to begin transaction: %v\n", err)
				continue
			}

			for _, p := range currentPackets {
				payloadSize := int(p.Payloadlen)
				if payloadSize > 6144 {
					payloadSize = 6144
				}
				if payloadSize < 0 {
					payloadSize = 0
				}

				// 解析数据包并插入对应表
				parseAndInsertPacket(tx, p, payloadSize, attachTime)
			}

			if err := tx.Commit(); err != nil {
				fmt.Fprintf(os.Stderr, "failed to commit transaction: %v\n", err)
			}
		}
	}()

	fmt.Printf("tcxProber attachments complete, press Ctrl+C to exit\n")
	<-sigChan
	fmt.Println("程序退出...")
	return nil
}

// parseAndInsertPacket 解析数据包并插入对应表
func parseAndInsertPacket(tx *sql.Tx, p packetMetadata, payloadSize int, attachTime float64) {
	payload := p.Payload[:payloadSize]
	timeS := attachTime + float64(p.Timestamp)/1e9

	if payloadSize < 14 {
		// 小于以太网帧头，存入 otherpackets
		insertOtherPacket(tx, timeS, int(p.Netifidx), int(p.Direction), payloadSize, payload)
		return
	}

	ethernetType := binary.BigEndian.Uint16(payload[12:14])
	if ethernetType != 0x0800 && ethernetType != 0x86dd {
		// 不是 IPv4 或 IPv6
		insertOtherPacket(tx, timeS, int(p.Netifidx), int(p.Direction), payloadSize, payload)
		return
	}

	if ethernetType == 0x0800 {
		// IPv4
		parseIPv4Packet(tx, timeS, int(p.Netifidx), int(p.Direction), payloadSize, payload)
	} else {
		// IPv6
		parseIPv6Packet(tx, timeS, int(p.Netifidx), int(p.Direction), payloadSize, payload)
	}
}

// parseIPv4Packet 解析 IPv4 数据包
func parseIPv4Packet(tx *sql.Tx, timeS float64, netif, direction, payloadSize int, payload []byte) {
	if payloadSize < 20 {
		insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
		return
	}

	ipHeaderLen := int(payload[14]&0x0f) * 4
	protocol := int(payload[23])
	ttl := int(payload[22])
	ipID := int(binary.BigEndian.Uint16(payload[18:20]))
	fragConfig := payload[20:22]

	// 解析源IP和目的IP
	srcIP := fmt.Sprintf("%d.%d.%d.%d", payload[26], payload[27], payload[28], payload[29])
	dstIP := fmt.Sprintf("%d.%d.%d.%d", payload[30], payload[31], payload[32], payload[33])

	// 提取 IP 选项
	var optionSeg []byte
	if ipHeaderLen > 20 {
		optionSeg = payload[34 : 14+ipHeaderLen]
	}

	nextProtStart := 14 + ipHeaderLen
	if nextProtStart >= payloadSize {
		insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
		return
	}

	if protocol == 6 || protocol == 17 {
		// TCP 或 UDP
		if nextProtStart+4 > payloadSize {
			insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
			return
		}

		srcPort := int(binary.BigEndian.Uint16(payload[nextProtStart : nextProtStart+2]))
		dstPort := int(binary.BigEndian.Uint16(payload[nextProtStart+2 : nextProtStart+4]))

		_, err := tx.Exec(`
			INSERT INTO ipv4packets (time, netif, direction, length, content, srcip, dstip, srcport, dstport, prot, ipid, ttl, frag, option)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, timeS, netif, direction, payloadSize, hex.EncodeToString(payload), srcIP, dstIP, srcPort, dstPort, protocol, ipID, ttl, hex.EncodeToString(fragConfig), hex.EncodeToString(optionSeg))
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to insert ipv4packets: %v\n", err)
		}
	} else if protocol == 1 {
		// ICMP
		_, err := tx.Exec(`
			INSERT INTO ipv4packets (time, netif, direction, length, content, srcip, dstip, srcport, dstport, prot, ipid, ttl, frag, option)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, timeS, netif, direction, payloadSize, hex.EncodeToString(payload), srcIP, dstIP, 0, 0, protocol, ipID, ttl, hex.EncodeToString(fragConfig), hex.EncodeToString(optionSeg))
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to insert ipv4packets (ICMP): %v\n", err)
		}
	} else {
		// 其他协议
		insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
	}
}

// parseIPv6Packet 解析 IPv6 数据包
func parseIPv6Packet(tx *sql.Tx, timeS float64, netif, direction, payloadSize int, payload []byte) {
	if payloadSize < 54 {
		insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
		return
	}

	headerType := int(payload[20])

	// 解析 IPv6 地址
	srcIP := formatIPv6Address(payload[22:38])
	dstIP := formatIPv6Address(payload[38:54])

	if headerType == 6 || headerType == 17 {
		// TCP 或 UDP
		if payloadSize < 58 {
			insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
			return
		}

		srcPort := int(binary.BigEndian.Uint16(payload[54:56]))
		dstPort := int(binary.BigEndian.Uint16(payload[56:58]))

		_, err := tx.Exec(`
			INSERT INTO ipv6packets (time, netif, direction, length, content, srcip, dstip, header, srcport, dstport)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, timeS, netif, direction, payloadSize, hex.EncodeToString(payload), srcIP, dstIP, headerType, srcPort, dstPort)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to insert ipv6packets: %v\n", err)
		}
	} else if headerType == 58 {
		// ICMPv6
		_, err := tx.Exec(`
			INSERT INTO ipv6packets (time, netif, direction, length, content, srcip, dstip, header, srcport, dstport)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, timeS, netif, direction, payloadSize, hex.EncodeToString(payload), srcIP, dstIP, headerType, 0, 0)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to insert ipv6packets (ICMPv6): %v\n", err)
		}
	} else {
		// 其他协议
		insertOtherPacket(tx, timeS, netif, direction, payloadSize, payload)
	}
}

// insertOtherPacket 插入 otherpackets 表
func insertOtherPacket(tx *sql.Tx, timeS float64, netif, direction, payloadSize int, payload []byte) {
	_, err := tx.Exec(`
		INSERT INTO otherpackets (time, netif, direction, length, content)
		VALUES ($1, $2, $3, $4, $5)
	`, timeS, netif, direction, payloadSize, hex.EncodeToString(payload))
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to insert otherpackets: %v\n", err)
	}
}

// formatIPv6Address 格式化 IPv6 地址
func formatIPv6Address(addr []byte) string {
	var result string
	for i := 0; i < 16; i += 2 {
		if i > 0 {
			result += ":"
		}
		result += fmt.Sprintf("%02x%02x", addr[i], addr[i+1])
	}
	return result
}
