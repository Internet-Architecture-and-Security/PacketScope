package main

import (
	"net/http"
	"os"
	"strconv"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	// 创建Gin引擎
	router := gin.Default()

	// 启用CORS
	router.Use(cors.Default())

	// 定义路由
	router.GET("/GetRecentPacket", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QueryFuncSend, Please Use POST"})
	})
	router.POST("/GetRecentPacket", getRecentPacket)

	router.GET("/GetRecentMap", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QueryFuncSend, Please Use POST"})
	})
	router.POST("/GetRecentMap", getRecentMap)

	router.GET("/GetFuncTable", getFuncTable)

	router.GET("/QueryFuncSend", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QueryFuncSend, Please Use POST"})
	})
	router.POST("/QueryFuncSend", queryFuncSend)

	router.GET("/QueryFuncRecv", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QueryFuncSend, Please Use POST"})
	})
	router.POST("/QueryFuncRecv", queryFuncRecv)

	router.GET("/QueryPacket", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QueryFuncSend, Please Use POST"})
	})
	router.POST("/QueryPacket", queryPacket)

	router.GET("/QuerySockList", querySockList)

	router.GET("/IsAttachFinished", func(c *gin.Context) {
		c.JSON(http.StatusOK, []bool{true})
	})
	// 启动服务器
	router.Run(":8010")
}

// API处理函数
func getRecentPacket(c *gin.Context) {
	srcIP := c.PostForm("srcip")
	dstIP := c.PostForm("dstip")
	srcPort := c.PostForm("srcport")
	dstPort := c.PostForm("dstport")
	ipVer := c.PostForm("ipver")
	countStr := c.PostForm("count")

	count, err := strconv.Atoi(countStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid count parameter"})
		return
	}

	result, err := GetRecentPackets(srcPort, dstPort, srcIP, dstIP, ipVer, count)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	c.JSON(http.StatusOK, result)
}

func getRecentMap(c *gin.Context) {
	srcIP := c.PostForm("srcip")
	dstIP := c.PostForm("dstip")
	srcPort := c.PostForm("srcport")
	dstPort := c.PostForm("dstport")
	countStr := c.PostForm("count")
	timeDownLimitStr := c.PostForm("timeDownLimit")

	count, err := strconv.Atoi(countStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid count parameter"})
		return
	}

	timeDownLimit := -1.0
	if timeDownLimitStr != "" {
		timeDownLimit, err = strconv.ParseFloat(timeDownLimitStr, 64)
		if err != nil {
			timeDownLimit = -1.0
		}
	}

	result, err := GetRecentMaps(srcPort, dstPort, srcIP, dstIP, count, timeDownLimit)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	c.JSON(http.StatusOK, result)
}

func getFuncTable(c *gin.Context) {
	file, err := os.Open("./.cache/FuncIDMap.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open FuncIDMap.json"})
		return
	}
	defer file.Close()

	var line []byte
	buffer := make([]byte, 1024)
	for {
		n, err := file.Read(buffer)
		if err != nil || n == 0 {
			break
		}
		line = append(line, buffer[:n]...)
		if n < 1024 {
			break
		}
	}

	c.Data(http.StatusOK, "application/json", line)
}

func queryFuncSend(c *gin.Context) {
	srcIP := c.PostForm("srcip")
	dstIP := c.PostForm("dstip")
	srcPort := c.PostForm("srcport")
	dstPort := c.PostForm("dstport")

	result, err := QueryAndGetFuncMapSend(srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	c.JSON(http.StatusOK, result)
}

func queryFuncRecv(c *gin.Context) {
	srcIP := c.PostForm("srcip")
	dstIP := c.PostForm("dstip")
	srcPort := c.PostForm("srcport")
	dstPort := c.PostForm("dstport")

	result, err := QueryAndGetFuncMapRecv(srcPort, dstPort, srcIP, dstIP)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	c.JSON(http.StatusOK, result)
}

func queryPacket(c *gin.Context) {
	srcIP := c.PostForm("srcip")
	dstIP := c.PostForm("dstip")
	srcPort := c.PostForm("srcport")
	dstPort := c.PostForm("dstport")
	ipVer := c.PostForm("ipver")

	result, err := TcxQuery(srcPort, dstPort, srcIP, dstIP, ipVer)
	if err != nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	c.JSON(http.StatusOK, result)
}

func querySockList(c *gin.Context) {
	result, err := ListAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get socket list"})
		return
	}

	c.JSON(http.StatusOK, result)
}
