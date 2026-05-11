package main

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"

	_ "github.com/lib/pq"
)

// TcxQuery 查询指定条件的数据包
func TcxQuery(srcPort, dstPort, srcIP, dstIP, ipVer string) (interface{}, error) {
	// PostgreSQL连接参数
	host := os.Getenv("PG_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("PG_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("PG_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("PG_PASSWORD")
	if password == "" {
		password = "password"
	}
	dbname := os.Getenv("PG_DBNAME_PACKET")
	if dbname == "" {
		dbname = "packetinfo"
	}
	sslmode := os.Getenv("PG_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	table := "ipv4packets"
	if ipVer == "6" {
		table = "ipv6packets"
	}

	// 构建查询语句
	query1 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4", table)
	query2 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4", table)

	// 执行第一个查询
	rows1, err := db.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getQueryResults(rows1)
	if err != nil {
		return nil, err
	}

	// 执行第二个查询（反向）
	rows2, err := db.Query(query2, dstPort, srcPort, dstIP, srcIP)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	result2, err := getQueryResults(rows2)
	if err != nil {
		return nil, err
	}

	// 合并结果
	result := append(result1, result2...)

	return result, nil
}

// QueryAndGetFuncMapRecv 查询接收函数映射
func QueryAndGetFuncMapRecv(srcPort, dstPort, srcIP, dstIP string) (interface{}, error) {
	// PostgreSQL连接参数
	host := os.Getenv("PG_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("PG_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("PG_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("PG_PASSWORD")
	dbname := os.Getenv("PG_DBNAME_FUNCTION")
	if dbname == "" {
		dbname = "functioninfo"
	}
	sslmode := os.Getenv("PG_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// Step 1: 提取所有ID为200000/200001的条目
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200000, 200001) AND srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4"
	rows1, err := db.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getQueryResults(rows1)
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// Step 2: 处理每个结果
	for _, item := range result1 {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		timeStart, ok := itemMap["time"].(float64)
		if !ok {
			continue
		}

		PIDnow, ok := itemMap["PID"].(int64)
		if !ok {
			continue
		}

		// Step 3: 获取ID>299999且PID相同且时间小于timeStart的最后一条记录
		query2 := "SELECT * FROM SpecfunctionCall WHERE ID > 299999 AND PID = $1 AND time < $2 ORDER BY time DESC LIMIT 1"
		rows2, err := db.Query(query2, PIDnow, timeStart)
		if err != nil {
			continue
		}

		result2, err := getQueryResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			continue
		}

		corCall := result2[0]
		corCallMap, ok := corCall.(map[string]interface{})
		if !ok {
			continue
		}

		timeStartR, ok := corCallMap["time"].(float64)
		if !ok {
			continue
		}

		IDnow, ok := corCallMap["ID"].(int64)
		if !ok {
			continue
		}

		// Step 4: 获取functionCall中对应的返回记录
		query3 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows3, err := db.Query(query3, timeStartR, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result3, err := getQueryResults(rows3)
		rows3.Close()
		if err != nil || len(result3) == 0 {
			continue
		}

		timeEnd, ok := result3[0].(map[string]interface{})["time"].(float64)
		if !ok {
			continue
		}

		// Step 5: 获取该时间段内的所有functionCall记录
		query4 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3"
		rows4, err := db.Query(query4, timeStartR, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result4, err := getQueryResults(rows4)
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
	// PostgreSQL连接参数
	host := os.Getenv("PG_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("PG_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("PG_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("PG_PASSWORD")
	dbname := os.Getenv("PG_DBNAME_FUNCTION")
	if dbname == "" {
		dbname = "functioninfo"
	}
	sslmode := os.Getenv("PG_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// Step 1: 提取所有指定ID的条目
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007) AND srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4"
	rows1, err := db.Query(query1, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getQueryResults(rows1)
	if err != nil {
		return nil, err
	}

	dataset := make([]interface{}, 0)

	// Step 2: 处理每个结果
	for _, item := range result1 {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		timeStart, ok := itemMap["time"].(float64)
		if !ok {
			continue
		}

		PIDnow, ok := itemMap["PID"].(int64)
		if !ok {
			continue
		}

		IDnow, ok := itemMap["ID"].(int64)
		if !ok {
			continue
		}

		// Step 3: 获取对应的返回记录
		query2 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows2, err := db.Query(query2, timeStart, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result2, err := getQueryResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			continue
		}

		timeEnd, ok := result2[0].(map[string]interface{})["time"].(float64)
		if !ok {
			continue
		}

		// Step 4: 获取该时间段内的所有functionCall记录
		query3 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3"
		rows3, err := db.Query(query3, timeStart, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result3, err := getQueryResults(rows3)
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
	// PostgreSQL连接参数
	host := os.Getenv("PG_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("PG_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("PG_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("PG_PASSWORD")
	dbname := os.Getenv("PG_DBNAME_FUNCTION")
	if dbname == "" {
		dbname = "functioninfo"
	}
	sslmode := os.Getenv("PG_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	dataset1 := make([]interface{}, 0)
	dataset2 := make([]interface{}, 0)

	// Step 1: 处理接收方向
	query1 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200000, 200001) AND time > $1 AND ((srcport = $2 AND dstport = $3 AND srcip = $4 AND dstip = $5) OR (srcport = $6 AND dstport = $7 AND srcip = $8 AND dstip = $9)) ORDER BY time DESC"
	rows1, err := db.Query(query1, timeDownLimit, srcPort, dstPort, srcIP, dstIP, dstPort, srcPort, dstIP, srcIP)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getQueryResults(rows1)
	if err != nil {
		return nil, err
	}

	// 处理结果
	Ncount := 0
	for _, item := range result1 {
		if Ncount >= count {
			break
		}

		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		timeStart, ok := itemMap["time"].(float64)
		if !ok {
			continue
		}

		PIDnow, ok := itemMap["PID"].(int64)
		if !ok {
			continue
		}

		// 获取对应的SpecfunctionCall记录
		query2 := "SELECT * FROM SpecfunctionCall WHERE ID > 299999 AND PID = $1 AND time < $2 ORDER BY time DESC LIMIT 1"
		rows2, err := db.Query(query2, PIDnow, timeStart)
		if err != nil {
			continue
		}

		result2, err := getQueryResults(rows2)
		rows2.Close()
		if err != nil || len(result2) == 0 {
			continue
		}

		corCall := result2[0]
		corCallMap, ok := corCall.(map[string]interface{})
		if !ok {
			continue
		}

		timeStartR, ok := corCallMap["time"].(float64)
		if !ok {
			continue
		}

		IDnow, ok := corCallMap["ID"].(int64)
		if !ok {
			continue
		}

		// 获取对应的返回记录
		query3 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows3, err := db.Query(query3, timeStartR, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result3, err := getQueryResults(rows3)
		rows3.Close()
		if err != nil || len(result3) == 0 {
			continue
		}

		timeEnd, ok := result3[0].(map[string]interface{})["time"].(float64)
		if !ok {
			continue
		}

		// 获取该时间段内的所有functionCall记录
		query4 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3"
		rows4, err := db.Query(query4, timeStartR, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result4, err := getQueryResults(rows4)
		rows4.Close()
		if err != nil {
			continue
		}

		dataset1 = append(dataset1, result4)
		Ncount++
	}

	// Step 2: 处理发送方向
	query5 := "SELECT * FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007) AND time > $1 AND ((srcport = $2 AND dstport = $3 AND srcip = $4 AND dstip = $5) OR (srcport = $6 AND dstport = $7 AND srcip = $8 AND dstip = $9)) ORDER BY time DESC"
	rows5, err := db.Query(query5, timeDownLimit, dstPort, srcPort, dstIP, srcIP, srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		return nil, err
	}
	defer rows5.Close()

	result5, err := getQueryResults(rows5)
	if err != nil {
		return nil, err
	}

	// 处理结果
	Ncount = 0
	for _, item := range result5 {
		if Ncount >= count {
			break
		}

		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		timeStart, ok := itemMap["time"].(float64)
		if !ok {
			continue
		}

		PIDnow, ok := itemMap["PID"].(int64)
		if !ok {
			continue
		}

		IDnow, ok := itemMap["ID"].(int64)
		if !ok {
			continue
		}

		// 获取对应的返回记录
		query6 := "SELECT * FROM functionCall WHERE time > $1 AND isRet = 1 AND ID = $2 AND PID = $3 ORDER BY time ASC LIMIT 1"
		rows6, err := db.Query(query6, timeStart, IDnow, PIDnow)
		if err != nil {
			continue
		}

		result6, err := getQueryResults(rows6)
		rows6.Close()
		if err != nil || len(result6) == 0 {
			continue
		}

		timeEnd, ok := result6[0].(map[string]interface{})["time"].(float64)
		if !ok {
			continue
		}

		// 获取该时间段内的所有functionCall记录
		query7 := "SELECT * FROM functionCall WHERE time >= $1 AND time <= $2 AND PID = $3"
		rows7, err := db.Query(query7, timeStart, timeEnd, PIDnow)
		if err != nil {
			continue
		}

		result7, err := getQueryResults(rows7)
		rows7.Close()
		if err != nil {
			continue
		}

		dataset2 = append(dataset2, result7)
		Ncount++
	}

	return []interface{}{dataset1, dataset2}, nil
}

// GetRecentPackets 获取最近的数据包
func GetRecentPackets(srcPort, dstPort, srcIP, dstIP, ipVer string, count int) (interface{}, error) {
	// PostgreSQL连接参数
	host := os.Getenv("PG_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("PG_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("PG_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("PG_PASSWORD")
	dbname := os.Getenv("PG_DBNAME_PACKET")
	if dbname == "" {
		dbname = "packetinfo"
	}
	sslmode := os.Getenv("PG_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	table := "ipv4packets"
	if ipVer == "6" {
		table = "ipv6packets"
	}

	// 构建查询语句
	query1 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4 ORDER BY time DESC LIMIT $5", table)
	query2 := fmt.Sprintf("SELECT * FROM %s WHERE srcport = $1 AND dstport = $2 AND srcip = $3 AND dstip = $4 ORDER BY time DESC LIMIT $5", table)

	// 执行第一个查询
	rows1, err := db.Query(query1, srcPort, dstPort, srcIP, dstIP, count)
	if err != nil {
		return nil, err
	}
	defer rows1.Close()

	result1, err := getQueryResults(rows1)
	if err != nil {
		return nil, err
	}

	// 执行第二个查询（反向）
	rows2, err := db.Query(query2, dstPort, srcPort, dstIP, srcIP, count)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	result2, err := getQueryResults(rows2)
	if err != nil {
		return nil, err
	}

	// 合并结果
	result := append(result1, result2...)

	return result, nil
}

// getQueryResults 将查询结果转换为JSON可序列化的格式
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
