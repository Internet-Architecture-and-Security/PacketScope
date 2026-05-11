package main

import (
	"log"

	"github.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/kbatch"
	"github.com/Internet-Architecture-and-Security/PacketScope/modules/Analyzer/Monitor/tcxprober"
)

func main() {

	// 使用goroutine进行异步调用
	go func() {
		if err := tcxprober.TcxExample(); err != nil {
			log.Fatalf("TcxExample failed: %v", err)
		}
		log.Println("TcxExample completed")
	}()
	// 等待tcxprober.TcxExample()完成
	// time.Sleep(10 * time.Second)
	if err := kbatch.Runkbatch(); err != nil {
		log.Fatalf("Runkbatch failed: %v", err)
	}
	log.Println("Runkbatch completed")

	log.Println("All steps finished successfully")
}
