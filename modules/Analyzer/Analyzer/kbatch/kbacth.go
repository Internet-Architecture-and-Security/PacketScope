package kbatch

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"fmt"
	"log"
	"os"
	"os/signal"
	"reflect"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/util"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/ringbuf"
	"github.com/cilium/ebpf/rlimit"
	_ "github.com/lib/pq"
)

// min returns the smaller of two integers

// U32ToIpv4 converts a 32-bit integer to IPv4 string (e.g., 0x01020304 -> "1.2.3.4")
func U32ToIpv4(ip uint32) string {
	return fmt.Sprintf("%d.%d.%d.%d",
		byte(ip>>24),
		byte(ip>>16),
		byte(ip>>8),
		byte(ip))
}

// ArrayToIpv6 converts a 16-byte array to IPv6 string
func ArrayToIpv6(ip [16]uint8) string {
	return fmt.Sprintf("%02x%02x:%02x%02x:%02x%02x:%02x%02x:%02x%02x:%02x%02x:%02x%02x:%02x%02x",
		ip[0], ip[1], ip[2], ip[3], ip[4], ip[5], ip[6], ip[7],
		ip[8], ip[9], ip[10], ip[11], ip[12], ip[13], ip[14], ip[15])
}

// 定义与BPF程序中对应的结构体
type SkProbe struct {
	Pid          uint32
	Padding32    uint32
	KernelTime   uint64
	FuncID       uint64
	Ret          uint64
	Family       uint64
	Dport        uint64
	Lport        uint64
	Ipv4SendAddr uint32
	Ipv4RecvAddr uint32
	Ipv6SendAddr [16]uint8
	Ipv6RecvAddr [16]uint8
}

type PacketMetadata struct {
	IsPacket   uint64
	Timestamp  uint64
	Pid        uint64
	FuncID     uint64
	PayloadLen uint64
	PayloadHdr [58]uint8
}

func Runkbatch() error {
	// 移除内存锁定限制，允许程序锁定足够的内存来加载BPF程序
	if err := rlimit.RemoveMemlock(); err != nil {
		log.Fatal(err)
	}

	// 初始化数据库连接 - PostgreSQL
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
		dbName = "functioninfo"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	defer db.Close()

	// 创建表 - PostgreSQL需要明确的数据类型
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS functionCall(
			time DOUBLE PRECISION,
			isRet BIGINT,
			ID BIGINT,
			PID INTEGER
		)
	`)
	if err != nil {
		log.Fatalf("创建functionCall表失败: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS SpecfunctionCall(
			time DOUBLE PRECISION,
			isRet BIGINT,
			ID BIGINT,
			PID INTEGER,
			family BIGINT,
			srcport BIGINT,
			dstport BIGINT,
			srcip VARCHAR(50),
			dstip VARCHAR(50),
			pkt VARCHAR(1024)
		)
	`)
	if err != nil {
		log.Fatalf("创建SpecfunctionCall表失败: %v", err)
	}

	// 清除表中所有现有数据
	_, err = db.Exec("TRUNCATE TABLE functionCall")
	if err != nil {
		log.Fatalf("清空functionCall表失败: %v", err)
	}

	_, err = db.Exec("TRUNCATE TABLE SpecfunctionCall")
	if err != nil {
		log.Fatalf("清空SpecfunctionCall表失败: %v", err)
	}

	// 从ELF对象文件加载编译好的BPF程序和映射
	var obj kProberFuncObjects
	if err := loadKProberFuncObjects(&obj, nil); err != nil {
		log.Fatalf("加载BPF对象失败: %v", err)
	}
	defer obj.Close()

	// 自动挂载所有kprobe和kretprobe
	// 保存所有挂载的链接
	var links []link.Link
	defer func() {
		for _, l := range links {
			l.Close()
		}
	}()

	// 加载BPF规范，获取所有程序信息
	spec, err := loadKProberFunc()
	if err != nil {
		log.Fatalf("加载BPF规范失败: %v", err)
	}

	// 获取kProberFuncObjects结构体的反射值
	programsValue := reflect.ValueOf(obj.kProberFuncPrograms)
	// 如果是指针类型，获取其指向的值
	if programsValue.Kind() == reflect.Ptr {
		programsValue = programsValue.Elem()
	}

	// 遍历所有程序规范
	log.Printf("找到 %d 个BPF程序", len(spec.Programs))
	failedCount := 0 // 挂载失败计数器
	for progName := range spec.Programs {
		// log.Printf("检查程序: %s, 长度: %d", progName, len(progName))
		// 根据程序名称确定挂载类型和目标函数
		var attachFunc func(string, *ebpf.Program, *link.KprobeOptions) (link.Link, error)
		var targetFunc string

		// 检查kprobe类型
		if len(progName) > 7 && progName[:7] == "Ktprobe" {
			attachFunc = link.Kprobe
			targetFunc = progName[7:] // 去掉"ktprobe_"前缀
		} else if len(progName) > 10 && progName[:10] == "Ktretprobe" {
			attachFunc = link.Kretprobe
			targetFunc = progName[10:] // 去掉"ktretprobe_"前缀
		} else {
			log.Printf("跳过程序 %s, 不符合命名规范", progName)
			continue // 跳过非kprobe/kretprobe程序
		}
		// 按照TransUtilSec中给出的方法，将targetFunc转换回原始的蛇形命名法函数名
		// 处理两种格式：
		// 1. 带有ZVZX前缀的格式（正确格式）
		// 2. 直接以函数名开头的格式（缺少ZVZX前缀的错误格式）
		if len(targetFunc) > 4 && targetFunc[:4] == "ZVZX" {
			// 正确格式：直接转换
			targetFunc = util.SpecialToSnake(targetFunc)
		} else {
			// 错误格式：手动转换，将VZVX替换为下划线
			targetFunc = strings.ReplaceAll(targetFunc, "VZVX", "_")
		}

		// 使用反射从obj.skbuffPrograms中获取对应的程序对象
		programField := programsValue.FieldByName(progName)
		if !programField.IsValid() {
			log.Printf("无法获取程序字段: %s", progName)
			continue
		}

		// 获取程序对象
		program := programField.Interface().(*ebpf.Program)

		// 挂载程序
		link, err := attachFunc(targetFunc, program, nil)
		if err != nil {
			// log.Printf("挂载%s到%s失败: %v", progName, targetFunc, err)
			// 忽略挂载失败的程序，继续处理下一个
			failedCount++ // 增加失败计数
			continue      // 继续处理下一个程序
		}
		links = append(links, link)
		// log.Printf("成功挂载%s到%s", progName, targetFunc)
	}

	// 输出挂载结果统计
	log.Printf("所有程序挂载完成，共失败 %d 次", failedCount)
	log.Printf("失败数在500以内，均属正常现象。请不要报告这个问题。这个问题来自于不允许挂载观测的网络函数。")
	// 打开ringbuf事件通道
	events, err := ringbuf.NewReader(obj.Events)
	if err != nil {
		log.Fatalf("创建ringbuf读取器失败: %v", err)
	}
	defer events.Close()

	// 打开SpecEvents ringbuf事件通道
	specEvents, err := ringbuf.NewReader(obj.SpecEvents)
	if err != nil {
		log.Fatalf("创建SpecEvents ringbuf读取器失败: %v", err)
	}
	defer specEvents.Close()

	// 设置信号处理，以便优雅退出
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动定期清理协程，每2分钟清理一次，保留最近100万条记录
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// 清理functionCall表，保留最近100万条记录
				_, err := db.Exec(`
					DELETE FROM functionCall 
					WHERE time < (
						SELECT time 
						FROM functionCall 
						ORDER BY time DESC 
						LIMIT 1 OFFSET 1000000
					)
				`)
				if err != nil {
					log.Printf("清理functionCall表失败: %v", err)
				} else {
					log.Println("functionCall表清理完成")
				}

				// 清理SpecfunctionCall表，保留最近100万条记录
				_, err = db.Exec(`
					DELETE FROM SpecfunctionCall 
					WHERE time < (
						SELECT time 
						FROM SpecfunctionCall 
						ORDER BY time DESC 
						LIMIT 1 OFFSET 1000000
					)
				`)
				if err != nil {
					log.Printf("清理SpecfunctionCall表失败: %v", err)
				} else {
					log.Println("SpecfunctionCall表清理完成")
				}

			case <-sigChan:
				return
			}
		}
	}()

	// 初始化变量
	var (
		start      uint64 = 0
		g_status   int    = 0
		g_srcip    string = ""
		g_dstip    string = ""
		g_srcport  int    = -1
		g_dstport  int    = -1
		attachtime float64
	)

	// 获取当前时间作为attachtime
	attachtime = float64(time.Now().UnixNano()) / 1e9

	// 定义事件和数据包的结构体切片，用于批量处理
	type EventToStore struct {
		Time    float64
		IsRet   uint64
		ID      uint64
		PID     uint32
		Family  uint64
		SrcPort uint64
		DstPort uint64
		SrcIP   string
		DstIP   string
		Pkt     string
	}

	var (
		eventsChan    = make(chan EventToStore, 1000)
		clearFlagFunc = false
		startTime     = time.Now().Unix()
	)

	// 启动协程读取普通事件(只包含SkProbe)
	go func() {
		var event SkProbe

		for {
			record, err := events.Read()
			if err != nil {
				log.Fatalf("读取事件失败: %v", err)
			}

			if err := binary.Read(bytes.NewBuffer(record.RawSample), binary.LittleEndian, &event); err != nil {
				log.Printf("解析SkProbe事件失败: %v", err)
				continue
			}

			// 计算时间
			if start == 0 {
				start = event.KernelTime
			}
			time_s := (float64(event.KernelTime - start)) / 1e9
			id := event.FuncID
			ret := event.Ret
			pid := event.Pid

			// 处理FuncID >= 200000的情况
			if id >= 200000 {
				if ret == 0 {
					if id >= 300000 {
						// 简单插入到两个表中
						eventsChan <- EventToStore{
							Time:    attachtime + time_s,
							IsRet:   ret,
							ID:      id,
							PID:     pid,
							Family:  0,
							SrcPort: 0,
							DstPort: 0,
							SrcIP:   "",
							DstIP:   "",
							Pkt:     "",
						}
						continue
					}

					family := event.Family
					dport := event.Dport
					lport := event.Lport

					// 端口检查
					if lport > 65536 || dport > 65536 {
						eventsChan <- EventToStore{
							Time:    attachtime + time_s,
							IsRet:   ret,
							ID:      id,
							PID:     pid,
							Family:  0,
							SrcPort: 0,
							DstPort: 0,
							SrcIP:   "",
							DstIP:   "",
							Pkt:     "",
						}
						continue
					}

					dstip := ""
					srcip := ""

					// 根据协议族转换IP地址
					if family == 4 {
						dstip = U32ToIpv4(event.Ipv4RecvAddr)
						srcip = U32ToIpv4(event.Ipv4SendAddr)
					} else if family == 6 {
						dstip = ArrayToIpv6(event.Ipv6RecvAddr)
						srcip = ArrayToIpv6(event.Ipv6SendAddr)
					} else {
						eventsChan <- EventToStore{
							Time:    attachtime + time_s,
							IsRet:   ret,
							ID:      id,
							PID:     pid,
							Family:  0,
							SrcPort: 0,
							DstPort: 0,
							SrcIP:   "",
							DstIP:   "",
							Pkt:     "",
						}
						continue
					}

					// 更新g_status
					if (srcip == g_srcip && dstip == g_dstip) || (srcip == g_dstip && dstip == g_srcip) {
						if (lport == uint64(g_srcport) && dport == uint64(g_dstport)) || (lport == uint64(g_dstport) && dport == uint64(g_srcport)) {
							if ret == 0 {
								g_status++
							} else if ret == 1 && g_status > 0 {
								g_status--
							}
						}
					}

					// 插入到SpecfunctionCall和functionCall表
					eventsChan <- EventToStore{
						Time:    attachtime + time_s,
						IsRet:   ret,
						ID:      id,
						PID:     pid,
						Family:  family,
						SrcPort: lport,
						DstPort: dport,
						SrcIP:   srcip,
						DstIP:   dstip,
						Pkt:     "",
					}
				} else if ret == 1 {
					// 只插入到functionCall表
					eventsChan <- EventToStore{
						Time:    attachtime + time_s,
						IsRet:   ret,
						ID:      id,
						PID:     pid,
						Family:  0,
						SrcPort: 0,
						DstPort: 0,
						SrcIP:   "",
						DstIP:   "",
						Pkt:     "",
					}
				}
			} else {
				// 处理FuncID < 200000的情况
				if g_status > 0 || g_srcport < 0 {
					eventsChan <- EventToStore{
						Time:    attachtime + time_s,
						IsRet:   ret,
						ID:      id,
						PID:     pid,
						Family:  0,
						SrcPort: 0,
						DstPort: 0,
						SrcIP:   "",
						DstIP:   "",
						Pkt:     "",
					}
				}
			}
		}
	}()

	// 启动协程读取SpecEvents(只包含PacketMetadata)
	go func() {
		var packet PacketMetadata

		for {
			record, err := specEvents.Read()
			if err != nil {
				log.Fatalf("读取SpecEvents失败: %v", err)
			}

			if err := binary.Read(bytes.NewBuffer(record.RawSample), binary.LittleEndian, &packet); err != nil {
				log.Printf("解析PacketMetadata事件失败: %v", err)
				continue
			}

			// 计算时间
			if start == 0 {
				start = packet.Timestamp
			}
			time_s := (float64(packet.Timestamp - start)) / 1e9

			// 获取有效载荷长度
			payloadLen := packet.PayloadLen
			if payloadLen > uint64(len(packet.PayloadHdr)) {
				payloadLen = uint64(len(packet.PayloadHdr))
			}

			// 将有效载荷转换为十六进制字符串
			pktHex := fmt.Sprintf("%x", packet.PayloadHdr[:payloadLen])

			// 发送到eventsChan进行处理
			eventsChan <- EventToStore{
				Time:    attachtime + time_s,
				IsRet:   0, // 默认值，PacketMetadata没有ret字段
				ID:      packet.FuncID,
				PID:     uint32(packet.Pid >> 32),
				Family:  0,  // 默认值，PacketMetadata没有family字段
				SrcPort: 0,  // 默认值，PacketMetadata没有端口字段
				DstPort: 0,  // 默认值，PacketMetadata没有端口字段
				SrcIP:   "", // 默认值，PacketMetadata没有IP字段
				DstIP:   "", // 默认值，PacketMetadata没有IP字段
				Pkt:     pktHex,
			}
		}
	}()

	// 启动数据处理协程，用于将事件批量存储到数据库
	go func() {
		var eventsBuffer []EventToStore
		bufferMutex := &sync.Mutex{}

		for {
			select {
			case event := <-eventsChan:
				// 将事件添加到缓冲区
				bufferMutex.Lock()
				eventsBuffer = append(eventsBuffer, event)
				bufferMutex.Unlock()

			default:
				// 检查是否需要提交数据到数据库
				currentTime := time.Now().Unix()
				if currentTime-startTime >= 1 {
					bufferMutex.Lock()
					if len(eventsBuffer) > 0 {
						// 开始事务
						tx, err := db.Begin()
						if err != nil {
							log.Printf("开始事务失败: %v", err)
							bufferMutex.Unlock()
							continue
						}

						// 准备插入语句
						funcCallStmt, err := tx.Prepare("INSERT INTO functionCall VALUES($1, $2, $3, $4)")
						if err != nil {
							log.Printf("准备functionCall插入语句失败: %v", err)
							tx.Rollback()
							bufferMutex.Unlock()
							continue
						}
						defer funcCallStmt.Close()

						specFuncCallStmt, err := tx.Prepare("INSERT INTO SpecfunctionCall VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)")
						if err != nil {
							log.Printf("准备SpecfunctionCall插入语句失败: %v", err)
							tx.Rollback()
							bufferMutex.Unlock()
							continue
						}
						defer specFuncCallStmt.Close()

						// 批量插入数据
						for _, e := range eventsBuffer {
							// 插入到functionCall表
							_, err := funcCallStmt.Exec(e.Time, e.IsRet, e.ID, e.PID)
							if err != nil {
								log.Printf("插入functionCall失败: %v", err)
								continue
							}

							// 根据条件插入到SpecfunctionCall表
							if e.ID >= 200000 && e.IsRet == 0 {
								_, err := specFuncCallStmt.Exec(e.Time, e.IsRet, e.ID, e.PID, e.Family, e.SrcPort, e.DstPort, e.SrcIP, e.DstIP, e.Pkt)
								if err != nil {
									log.Printf("插入SpecfunctionCall失败: %v", err)
									continue
								}
							}
						}

						// 提交事务
						if err := tx.Commit(); err != nil {
							log.Printf("提交事务失败: %v", err)
							bufferMutex.Unlock()
							continue
						}

						// 清空缓冲区
						eventsBuffer = eventsBuffer[:0]
					}

					// 检查是否需要清空表
					if clearFlagFunc {
						// 清空并重新创建表
						_, err := db.Exec(`
				DROP TABLE IF EXISTS functionCall;
				CREATE TABLE IF NOT EXISTS functionCall(
					time DOUBLE PRECISION,
					isRet BIGINT,
					ID BIGINT,
					PID INTEGER
				);
				DROP TABLE IF EXISTS SpecfunctionCall;
				CREATE TABLE IF NOT EXISTS SpecfunctionCall(
					time DOUBLE PRECISION,
					isRet BIGINT,
					ID BIGINT,
					PID INTEGER,
					family BIGINT,
					srcport BIGINT,
					dstport BIGINT,
					srcip VARCHAR(50),
					dstip VARCHAR(50),
					pkt VARCHAR(1024)
				);
			`)
						if err != nil {
							log.Printf("清空表失败: %v", err)
						} else {
							clearFlagFunc = false
						}
					}

					bufferMutex.Unlock()
					startTime = currentTime
				}

				// 短暂休眠，避免CPU占用过高
				time.Sleep(10 * time.Millisecond)
			}
		}
	}()

	// 等待中断信号
	<-sigChan
	fmt.Println("程序退出...")
	return nil
}
