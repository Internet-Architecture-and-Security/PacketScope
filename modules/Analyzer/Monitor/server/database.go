package main

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"

	_ "github.com/lib/pq"
)

// DBManager 数据库管理器 - 集中管理数据库连接
type DBManager struct {
	host     string
	port     string
	user     string
	password string
	dbname   string
	sslmode  string
	db       *sql.DB
}

// NewDBManager 创建数据库管理器实例
func NewDBManager(dbnameEnv, defaultDBName string) *DBManager {
	return &DBManager{
		host:     getEnv("PG_HOST", "localhost"),
		port:     getEnv("PG_PORT", "5432"),
		user:     getEnv("PG_USER", "postgres"),
		password: getEnv("PG_PASSWORD", "password"),
		dbname:   getEnv(dbnameEnv, defaultDBName),
		sslmode:  getEnv("PG_SSLMODE", "disable"),
	}
}

// getEnv 获取环境变量，若不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Connect 建立数据库连接
func (m *DBManager) Connect() error {
	if m.db != nil {
		return nil
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		m.host, m.port, m.user, m.password, m.dbname, m.sslmode)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return err
	}

	// 验证连接
	if err := db.Ping(); err != nil {
		return err
	}

	m.db = db
	return nil
}

// Close 关闭数据库连接
func (m *DBManager) Close() {
	if m.db != nil {
		m.db.Close()
		m.db = nil
	}
}

// Query 执行查询并返回结果
func (m *DBManager) Query(query string, args ...interface{}) (*sql.Rows, error) {
	if m.db == nil {
		if err := m.Connect(); err != nil {
			return nil, err
		}
	}
	return m.db.Query(query, args...)
}

// TcxQuery 查询指定条件的数据包
func TcxQuery(srcPort, dstPort, srcIP, dstIP, ipVer string) (interface{}, error) {
	dbm := NewDBManager("PG_DBNAME_PACKET", "tcxprober")
	defer dbm.Close()

	if err := dbm.Connect(); err != nil {
		return nil, err
	}

	table := "ipv4packets"
	switch ipVer {
	case "6":
		table = "ipv6packets"
	case "other":
		table = "otherpackets"
	}

	// otherpackets 表没有 srcport, dstport, srcip, dstip 字段
	if table == "otherpackets" {
		query := fmt.Sprintf("SELECT * FROM %s", table)
		rows, err := dbm.Query(query)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return getPacketResults(rows, "other")
	}

	// 构建查询语句
	query1 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4", table)
	query2 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4", table)

	// 执行第一个查询
	rows1, err := dbm.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getPacketResults(rows1, ipVer)
	if err != nil {
		return nil, err
	}

	// 执行第二个查询（反向）
	rows2, err := dbm.Query(query2, dstPort, srcPort, dstIP, srcIP)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	result2, err := getPacketResults(rows2, ipVer)
	if err != nil {
		return nil, err
	}

	// 合并结果
	result := append(result1, result2...)

	return result, nil
}

// QueryAndGetFuncMapRecv 查询接收函数映射
func QueryAndGetFuncMapRecv(srcPort, dstPort, srcIP, dstIP string) (interface{}, error) {
	dbm := NewDBManager("PG_DBNAME_FUNCTION", "functioninfo")
	defer dbm.Close()

	if err := dbm.Connect(); err != nil {
		return nil, err
	}

	// Step 1: 提取所有ID为200000/200001的条目 - 双向匹配
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200000, 200001) AND ((srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4) OR (srcport = $2 AND dstport = $1 AND srcip = $4 AND dstip = $3))"
	rows1, err := dbm.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getFuncCallResults(rows1)
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// Step 2: 处理每个结果 - 从旧到新
	for i := len(result1) - 1; i >= 0; i-- {
		item := result1[i]
		timeStart, ok := getFloatValue(item, 0)
		if !ok {
			continue
		}

		PIDnow, ok := getIntValue(item, 3)
		if !ok {
			continue
		}

		// Step 3: 获取ID>299999且PID相同且时间小于timeStart的最后一条记录
		query2 := "SELECT * FROM SpecfunctionCall WHERE ID > 299999 AND PID = $1 AND time < $2 ORDER BY time DESC LIMIT 1"
		rows2, err := dbm.Query(query2, PIDnow, timeStart)
		if err != nil {
			continue
		}

		result2, err := getFuncCallResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			continue
		}

		corCall := result2[0]
		timeStartR, ok := getFloatValue(corCall, 0)
		if !ok {
			continue
		}

		IDnow, ok := getIntValue(corCall, 2)
		if !ok {
			continue
		}

		// Step 4: 获取functionCall中对应的返回记录
		query3 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows3, err := dbm.Query(query3, timeStartR, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result3, err := getFuncCallResults(rows3)
		rows3.Close()
		if err != nil || len(result3) == 0 {
			continue
		}

		timeEnd, ok := getFloatValue(result3[0], 0)
		if !ok {
			continue
		}

		// Step 5: 获取该时间段内的所有functionCall记录
		query4 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3 ORDER BY time ASC"
		rows4, err := dbm.Query(query4, timeStartR, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result4, err := getFuncCallResults(rows4)
		rows4.Close()
		if err != nil {
			continue
		}

		dataset = append(dataset, result4)
	}

	return dataset, nil
}

// QueryAndGetFuncMapSend 查询发送函数映射
func QueryAndGetFuncMapSend(srcPort, dstPort, srcIP, dstIP string) (interface{}, error) {
	dbm := NewDBManager("PG_DBNAME_FUNCTION", "functioninfo")
	defer dbm.Close()

	if err := dbm.Connect(); err != nil {
		return nil, err
	}

	// Step 1: 提取所有指定ID的条目 - 双向匹配
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007) AND ((srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4) OR (srcport = $2 AND dstport = $1 AND srcip = $4 AND dstip = $3))"
	rows1, err := dbm.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getFuncCallResults(rows1)
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// Step 2: 处理每个结果 - 从旧到新
	for i := len(result1) - 1; i >= 0; i-- {
		item := result1[i]
		timeStart, ok := getFloatValue(item, 0)
		if !ok {
			continue
		}

		PIDnow, ok := getIntValue(item, 3)
		if !ok {
			continue
		}

		IDnow, ok := getIntValue(item, 2)
		if !ok {
			continue
		}

		// Step 3: 获取对应的返回记录
		query2 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows2, err := dbm.Query(query2, timeStart, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result2, err := getFuncCallResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			continue
		}

		timeEnd, ok := getFloatValue(result2[0], 0)
		if !ok {
			continue
		}

		// Step 4: 获取该时间段内的所有functionCall记录
		query3 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3 ORDER BY time ASC"
		rows3, err := dbm.Query(query3, timeStart, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result3, err := getFuncCallResults(rows3)
		rows3.Close()
		if err != nil {
			continue
		}

		dataset = append(dataset, result3)
	}

	return dataset, nil
}

// GetRecentMaps 获取最近的映射
func GetRecentMaps(srcPort, dstPort, srcIP, dstIP string, count int, timeDownLimit float64) (interface{}, error) {
	println("[DEBUG] GetRecentMaps 开始")
	println(fmt.Sprintf("[DEBUG] 参数: srcPort=%v, dstPort=%v, srcIP=%v, dstIP=%v, count=%v, timeDownLimit=%v",
		srcPort, dstPort, srcIP, dstIP, count, timeDownLimit))

	dbm := NewDBManager("PG_DBNAME_FUNCTION", "functioninfo")
	defer dbm.Close()

	if err := dbm.Connect(); err != nil {
		println(fmt.Sprintf("[DEBUG] 数据库连接失败: %v", err))
		return nil, err
	}
	println("[DEBUG] 数据库连接成功")

	dataset1 := make([]interface{}, 0)
	dataset2 := make([]interface{}, 0)

	// Step 1: 处理接收方向
	println("[DEBUG] === Step 1: 处理接收方向 ===")
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200000, 200001) AND time > $1 AND ((srcport = $2 AND dstport = $3 AND srcip = $4 AND dstip = $5) OR (srcport = $6 AND dstport = $7 AND srcip = $8 AND dstip = $9)) ORDER BY time DESC"
	println(fmt.Sprintf("[DEBUG] 查询1: %v", query1))
	rows1, err := dbm.Query(query1, timeDownLimit, srcPort, dstPort, srcIP, dstIP, dstPort, srcPort, dstIP, srcIP)
	if err != nil {
		println(fmt.Sprintf("[DEBUG] 查询1失败: %v", err))
		return nil, err
	}
	defer rows1.Close()

	result1, err := getFuncCallResults(rows1)
	if err != nil {
		println(fmt.Sprintf("[DEBUG] 转换结果1失败: %v", err))
		return nil, err
	}
	println(fmt.Sprintf("[DEBUG] 查询1结果数量: %v", len(result1)))

	// 处理结果 - 类似Python的reverse，从旧到新
	Ncount := 0
	for i := len(result1) - 1; i >= 0; i-- {
		if Ncount >= count {
			println(fmt.Sprintf("[DEBUG] 已达到count限制: %v", count))
			break
		}

		println(fmt.Sprintf("[DEBUG] 处理接收方向条目 %v/%v", Ncount+1, count))
		item := result1[i]
		// SpecfunctionCall列顺序: time[0], isret[1], id[2], pid[3], family[4], srcport[5], dstport[6], srcip[7], dstip[8], pkt[9]
		timeStart, ok := getFloatValue(item, 0)
		if !ok {
			println("[DEBUG] 获取timeStart失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] timeStart=%v", timeStart))

		PIDnow, ok := getIntValue(item, 3)
		if !ok {
			println("[DEBUG] 获取PIDnow失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] PIDnow=%v", PIDnow))

		// 获取对应的SpecfunctionCall记录 (ID > 299999)
		query2 := "SELECT * FROM SpecfunctionCall WHERE ID > 299999 AND PID = $1 AND time < $2 ORDER BY time DESC LIMIT 1"
		println(fmt.Sprintf("[DEBUG] 查询2: %v (PID=%v, timeStart=%v)", query2, PIDnow, timeStart))
		rows2, err := dbm.Query(query2, PIDnow, timeStart)
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 查询2失败: %v", err))
			continue
		}

		result2, err := getFuncCallResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			println(fmt.Sprintf("[DEBUG] 查询2无结果或失败: err=%v, len=%v", err, len(result2)))
			continue
		}
		println(fmt.Sprintf("[DEBUG] 查询2结果数量: %v", len(result2)))

		corCall := result2[0]
		timeStartR, ok := getFloatValue(corCall, 0)
		if !ok {
			println("[DEBUG] 获取timeStartR失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] timeStartR=%v", timeStartR))

		IDnow, ok := getIntValue(corCall, 2)
		if !ok {
			println("[DEBUG] 获取IDnow失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] IDnow=%v", IDnow))

		// 获取对应的返回记录 - functionCall列顺序: time[0], isret[1], id[2], pid[3]
		query3 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		println(fmt.Sprintf("[DEBUG] 查询3: %v (timeStartR=%v, IDnow=%v, PIDnow=%v)", query3, timeStartR, IDnow, PIDnow))
		rows3, err := dbm.Query(query3, timeStartR, IDnow, PIDnow)
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 查询3失败: %v", err))
			continue
		}

		result3, err := getFuncCallResults(rows3)
		rows3.Close()
		if err != nil || len(result3) == 0 {
			println(fmt.Sprintf("[DEBUG] 查询3无结果或失败: err=%v, len=%v", err, len(result3)))
			continue
		}
		println(fmt.Sprintf("[DEBUG] 查询3结果数量: %v", len(result3)))

		timeEnd, ok := getFloatValue(result3[0], 0)
		if !ok {
			println("[DEBUG] 获取timeEnd失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] timeEnd=%v", timeEnd))

		// 获取该时间段内的所有functionCall记录
		query4 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3 ORDER BY time ASC"
		println(fmt.Sprintf("[DEBUG] 查询4: %v (timeStartR=%v, timeEnd=%v, PIDnow=%v)", query4, timeStartR, timeEnd, PIDnow))
		rows4, err := dbm.Query(query4, timeStartR, timeEnd, PIDnow)
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 查询4失败: %v", err))
			continue
		}

		result4, err := getFuncCallResults(rows4)
		rows4.Close()
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 转换结果4失败: %v", err))
			continue
		}
		println(fmt.Sprintf("[DEBUG] 查询4结果数量: %v", len(result4)))

		dataset1 = append(dataset1, result4)
		println(fmt.Sprintf("[DEBUG] 成功添加到dataset1，当前大小: %v", len(dataset1)))
		Ncount++
	}
	println(fmt.Sprintf("[DEBUG] 接收方向处理完成，dataset1大小: %v", len(dataset1)))

	// Step 2: 处理发送方向
	println("[DEBUG] === Step 2: 处理发送方向 ===")
	query5 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007) AND time > $1 AND ((srcport = $2 AND dstport = $3 AND srcip = $4 AND dstip = $5) OR (srcport = $6 AND dstport = $7 AND srcip = $8 AND dstip = $9)) ORDER BY time DESC"
	println(fmt.Sprintf("[DEBUG] 查询5: %v", query5))
	rows5, err := dbm.Query(query5, timeDownLimit, dstPort, srcPort, dstIP, srcIP, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		println(fmt.Sprintf("[DEBUG] 查询5失败: %v", err))
		return nil, err
	}
	defer rows5.Close()

	result5, err := getFuncCallResults(rows5)
	if err != nil {
		println(fmt.Sprintf("[DEBUG] 转换结果5失败: %v", err))
		return nil, err
	}
	println(fmt.Sprintf("[DEBUG] 查询5结果数量: %v", len(result5)))

	// 处理结果 - 类似Python的reverse，从旧到新
	Ncount = 0
	for i := len(result5) - 1; i >= 0; i-- {
		if Ncount >= count {
			println(fmt.Sprintf("[DEBUG] 已达到count限制: %v", count))
			break
		}

		println(fmt.Sprintf("[DEBUG] 处理发送方向条目 %v/%v", Ncount+1, count))
		item := result5[i]
		timeStart, ok := getFloatValue(item, 0)
		if !ok {
			println("[DEBUG] 获取timeStart失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] timeStart=%v", timeStart))

		PIDnow, ok := getIntValue(item, 3)
		if !ok {
			println("[DEBUG] 获取PIDnow失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] PIDnow=%v", PIDnow))

		IDnow, ok := getIntValue(item, 2)
		if !ok {
			println("[DEBUG] 获取IDnow失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] IDnow=%v", IDnow))

		// 获取对应的返回记录
		query6 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		println(fmt.Sprintf("[DEBUG] 查询6: %v (timeStart=%v, IDnow=%v, PIDnow=%v)", query6, timeStart, IDnow, PIDnow))
		rows6, err := dbm.Query(query6, timeStart, IDnow, PIDnow)
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 查询6失败: %v", err))
			continue
		}

		result6, err := getFuncCallResults(rows6)
		rows6.Close()
		if err != nil || len(result6) == 0 {
			println(fmt.Sprintf("[DEBUG] 查询6无结果或失败: err=%v, len=%v", err, len(result6)))
			continue
		}
		println(fmt.Sprintf("[DEBUG] 查询6结果数量: %v", len(result6)))

		timeEnd, ok := getFloatValue(result6[0], 0)
		if !ok {
			println("[DEBUG] 获取timeEnd失败")
			continue
		}
		println(fmt.Sprintf("[DEBUG] timeEnd=%v", timeEnd))

		// 获取该时间段内的所有functionCall记录
		query7 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3 ORDER BY time ASC"
		println(fmt.Sprintf("[DEBUG] 查询7: %v (timeStart=%v, timeEnd=%v, PIDnow=%v)", query7, timeStart, timeEnd, PIDnow))
		rows7, err := dbm.Query(query7, timeStart, timeEnd, PIDnow)
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 查询7失败: %v", err))
			continue
		}

		result7, err := getFuncCallResults(rows7)
		rows7.Close()
		if err != nil {
			println(fmt.Sprintf("[DEBUG] 转换结果7失败: %v", err))
			continue
		}
		println(fmt.Sprintf("[DEBUG] 查询7结果数量: %v", len(result7)))

		dataset2 = append(dataset2, result7)
		println(fmt.Sprintf("[DEBUG] 成功添加到dataset2，当前大小: %v", len(dataset2)))
		Ncount++
	}
	println(fmt.Sprintf("[DEBUG] 发送方向处理完成，dataset2大小: %v", len(dataset2)))

	println(fmt.Sprintf("[DEBUG] GetRecentMaps 结束，返回: [dataset1.len=%v, dataset2.len=%v]", len(dataset1), len(dataset2)))
	return []interface{}{dataset1, dataset2}, nil
}

// getProtocolName 将协议号转换为协议名称
func getProtocolName(protocolNum int) string {
	switch protocolNum {
	case 1:
		return "ICMP"
	case 6:
		return "TCP"
	case 17:
		return "UDP"
	default:
		return fmt.Sprintf("%d", protocolNum)
	}
}

// getPacketResults 将查询结果转换为前端期望的二维数组格式
func getPacketResults(rows *sql.Rows, ipVer string) ([]interface{}, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// 创建列值的切片
	values := make([]sql.RawBytes, len(columns))
	valuePtrs := make([]interface{}, len(columns))

	for rows.Next() {
		// 将值指针指向values切片
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// 扫描行
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		// 创建结果数组
		entry := make([]interface{}, 0)
		for i, col := range columns {
			var v interface{}
			val := values[i]
			if val == nil {
				v = nil
			} else {
				// 尝试转换为数字
				if num, err := strconv.ParseFloat(string(val), 64); err == nil {
					v = num
				} else {
					v = string(val)
				}
			}

			// 处理协议字段转换 - IPv4的prot字段需要转换为协议名称
			if ipVer == "4" || ipVer == "6" {
				if col == "prot" {
					if num, ok := v.(float64); ok {
						v = getProtocolName(int(num))
					}
				}
			}

			entry = append(entry, v)
		}

		dataset = append(dataset, entry)
	}

	return dataset, nil
}

// getFuncCallResults 将函数调用查询结果转换为二维数组格式
func getFuncCallResults(rows *sql.Rows) ([]interface{}, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// 创建列值的切片
	values := make([]sql.RawBytes, len(columns))
	valuePtrs := make([]interface{}, len(columns))

	for rows.Next() {
		// 将值指针指向values切片
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// 扫描行
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		// 创建结果数组
		entry := make([]interface{}, 0)
		for i := range columns {
			var v interface{}
			val := values[i]
			if val == nil {
				v = nil
			} else {
				// 尝试转换为数字
				if num, err := strconv.ParseFloat(string(val), 64); err == nil {
					v = num
				} else {
					v = string(val)
				}
			}
			entry = append(entry, v)
		}

		dataset = append(dataset, entry)
	}

	return dataset, nil
}

// 辅助函数：从二维数组条目获取值
func getFloatValue(item interface{}, index int) (float64, bool) {
	arr, ok := item.([]interface{})
	if !ok || index >= len(arr) {
		return 0, false
	}
	v, ok := arr[index].(float64)
	return v, ok
}

func getIntValue(item interface{}, index int) (int64, bool) {
	arr, ok := item.([]interface{})
	if !ok || index >= len(arr) {
		return 0, false
	}
	// 可能是float64存储的int
	switch v := arr[index].(type) {
	case float64:
		return int64(v), true
	case int64:
		return v, true
	case int:
		return int64(v), true
	default:
		return 0, false
	}
}

// GetRecentPackets 获取最近的数据包
func GetRecentPackets(srcPort, dstPort, srcIP, dstIP, ipVer string, count int) (interface{}, error) {
	dbm := NewDBManager("PG_DBNAME_PACKET", "tcxprober")
	defer dbm.Close()

	if err := dbm.Connect(); err != nil {
		return nil, err
	}

	table := "ipv4packets"
	switch ipVer {
	case "6":
		table = "ipv6packets"
	case "other":
		table = "otherpackets"
	}

	// 根据不同表结构构建查询语句
	// otherpackets 表没有 srcport, dstport, srcip, dstip 字段
	if table == "otherpackets" {
		query := fmt.Sprintf("SELECT * FROM %s ORDER BY time DESC LIMIT $1", table)
		rows, err := dbm.Query(query, count)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return getPacketResults(rows, "other")
	}

	// 构建双向查询语句
	query1 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4 ORDER BY time DESC LIMIT $5", table)
	query2 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4 ORDER BY time DESC LIMIT $5", table)

	// 执行第一个查询（正向）
	rows1, err := dbm.Query(query1, srcPort, dstPort, srcIP, dstIP, count)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getPacketResults(rows1, ipVer)
	if err != nil {
		return nil, err
	}

	// 执行第二个查询（反向）
	rows2, err := dbm.Query(query2, dstPort, srcPort, dstIP, srcIP, count)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	result2, err := getPacketResults(rows2, ipVer)
	if err != nil {
		return nil, err
	}

	// 合并结果
	result := append(result1, result2...)

	return result, nil
}

// getQueryResults 保持旧的函数名，用于其他查询
func getQueryResults(rows *sql.Rows) ([]interface{}, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// 创建列值的切片
	values := make([]sql.RawBytes, len(columns))
	valuePtrs := make([]interface{}, len(columns))

	for rows.Next() {
		// 将值指针指向values切片
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// 扫描行
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		// 创建结果映射
		entry := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]
			if val == nil {
				v = nil
			} else {
				// 尝试转换为数字
				if num, err := strconv.ParseFloat(string(val), 64); err == nil {
					v = num
				} else {
					v = string(val)
				}
			}
			entry[col] = v
		}

		dataset = append(dataset, entry)
	}

	return dataset, nil
}
