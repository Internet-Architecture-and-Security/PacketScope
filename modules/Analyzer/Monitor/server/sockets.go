package main

import (
	"bufio"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

var totalData map[string]interface{}

// 转换IPv4地址格式
func tranV4intoP(inputStr string) string {
	r := strings.Split(inputStr, ":")

	// 解析IPv4地址
	ipBytes, err := hex.DecodeString(r[0])
	if err != nil {
		return inputStr
	}

	// 解析端口
	port, err := strconv.ParseUint(r[1], 16, 16)
	if err != nil {
		return inputStr
	}

	return fmt.Sprintf("%d.%d.%d.%d:%d", ipBytes[3], ipBytes[2], ipBytes[1], ipBytes[0], port)
}

// 转换IPv6地址格式
func tranV6intoP(inputStr string) string {
	r := strings.Split(inputStr, ":")

	// 解析端口
	port, err := strconv.ParseUint(r[1], 16, 16)
	if err != nil {
		return inputStr
	}

	// 格式化IPv6地址
	ipHex := r[0]
	ipParts := make([]string, 8)
	for i := 0; i < 8; i++ {
		ipParts[i] = strings.ToLower(ipHex[i*4 : (i+1)*4])
	}

	return fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s:%s:%d",
		ipParts[0], ipParts[1], ipParts[2], ipParts[3],
		ipParts[4], ipParts[5], ipParts[6], ipParts[7], port)
}

// 转换状态为字符串
func tranStateintoSTR(inputInt int) string {
	stateMap := map[int]string{
		1:  "01(ESTABLISHED)",
		2:  "02(SYN_SENT)",
		3:  "03(SYN_RECV)",
		4:  "04(FIN_WAIT1)",
		5:  "05(FIN_WAIT2)",
		6:  "06(TIME_WAIT)",
		7:  "07(CLOSE)",
		8:  "08(CLOSE_WAIT)",
		9:  "09(LAST_ACK)",
		10: "0A(LISTEN)",
		11: "0B(CLOSING)",
	}

	if state, exists := stateMap[inputInt]; exists {
		return state
	}

	return fmt.Sprintf("%d(UNDEFINED)", inputInt)
}

// 获取TCP信息
func getTCPInfo(curTime float64) {
	// 获取IPv4 TCP信息
	f, err := os.Open("/proc/net/tcp")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV4intoP(r[1])
			dst := tranV4intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["tcpipv4"] = data
	}

	// 获取IPv6 TCP信息
	f, err = os.Open("/proc/net/tcp6")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV6intoP(r[1])
			dst := tranV6intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["tcpipv6"] = data
	}
}

// 获取UDP信息
func getUDPInfo(curTime float64) {
	// 获取IPv4 UDP信息
	f, err := os.Open("/proc/net/udp")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV4intoP(r[1])
			dst := tranV4intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["udpipv4"] = data
	}

	// 获取IPv6 UDP信息
	f, err = os.Open("/proc/net/udp6")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV6intoP(r[1])
			dst := tranV6intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["udpipv6"] = data
	}
}

// 获取ICMP信息
func getICMPInfo(curTime float64) {
	// 获取IPv4 ICMP信息
	f, err := os.Open("/proc/net/icmp")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV4intoP(r[1])
			dst := tranV4intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["icmpipv4"] = data
	}

	// 获取IPv6 ICMP信息
	f, err = os.Open("/proc/net/icmp6")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV6intoP(r[1])
			dst := tranV6intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["icmpipv6"] = data
	}
}

// 获取Raw信息
func getRawInfo(curTime float64) {
	// 获取IPv4 Raw信息
	f, err := os.Open("/proc/net/raw")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV4intoP(r[1])
			dst := tranV4intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["rawipv4"] = data
	}

	// 获取IPv6 Raw信息
	f, err = os.Open("/proc/net/raw6")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过标题行

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 4 {
				continue
			}

			id := r[0][:len(r[0])-1]
			src := tranV6intoP(r[1])
			dst := tranV6intoP(r[2])
			state, _ := strconv.ParseInt(r[3], 16, 32)

			data = append(data, []interface{}{curTime, id, src, dst, tranStateintoSTR(int(state))})
		}

		totalData["rawipv6"] = data
	}
}

// 获取设备信息
func getDevInfo(curTime float64) {
	f, err := os.Open("/proc/net/dev")
	if err == nil {
		defer f.Close()

		var data []interface{}
		scanner := bufio.NewScanner(f)
		scanner.Scan() // 跳过第一行标题
		scanner.Scan() // 跳过第二行标题

		for scanner.Scan() {
			line := scanner.Text()
			r := strings.Fields(line)
			if len(r) < 1 {
				continue
			}

			netif := r[0][:len(r[0])-1]
			data = append(data, []interface{}{curTime, netif})
		}

		totalData["dev"] = data
	}
}

// ListAll 获取所有网络信息
func ListAll() (map[string]interface{}, error) {
	curTime := time.Now().UnixNano() / 1e9

	totalData = make(map[string]interface{})

	getDevInfo(float64(curTime))
	getTCPInfo(float64(curTime))
	getUDPInfo(float64(curTime))
	getRawInfo(float64(curTime))
	getICMPInfo(float64(curTime))

	return totalData, nil
}
