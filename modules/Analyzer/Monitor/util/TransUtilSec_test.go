package util

import (
	"encoding/json"
	"io/ioutil"
	"strings"
	"testing"
)

// 定义JSON结构
var funcList []struct {
	ID      int    `json:"id"`
	Kind    string `json:"kind"`
	Linkage string `json:"linkage"`
	Name    string `json:"name"`
	TypeID  int    `json:"type_id"`
}

// 初始化测试数据
func init() {
	// 读取relatedFuncD5.json文件
	data, err := ioutil.ReadFile("./relatedFuncD5.json")
	if err != nil {
		panic("Failed to read relatedFuncD5.json: " + err.Error())
	}

	// 解析JSON数据
	err = json.Unmarshal(data, &funcList)
	if err != nil {
		panic("Failed to parse relatedFuncD5.json: " + err.Error())
	}
}

// TestSnakeToSpecial 测试SnakeToSpecial函数
func TestSnakeToSpecial(t *testing.T) {
	for _, f := range funcList {
		// 跳过空名称
		if f.Name == "" {
			continue
		}

		// 测试转换
		special := SnakeToSpecial(f.Name)

		// 验证结果格式：以ZVZX开头，不包含下划线
		if !strings.HasPrefix(special, "ZVZX") {
			t.Errorf("SnakeToSpecial(%q) should start with 'ZVZX', got %q", f.Name, special)
		}

		if strings.Contains(special, "_") {
			t.Errorf("SnakeToSpecial(%q) should not contain underscores, got %q", f.Name, special)
		}

		// 验证可逆转换
		recovered := SpecialToSnake(special)
		if recovered != f.Name {
			t.Errorf("Reversible test failed for %q: %q -> %q -> %q", f.Name, f.Name, special, recovered)
		}
	}
}

// TestSpecialToSnake 测试SpecialToSnake函数
func TestSpecialToSnake(t *testing.T) {
	// 测试一些已知的转换
	testCases := []struct {
		special  string
		expected string
	}{
		{"ZVZXinetVZVXecnVZVXsetVZVXce", "inet_ecn_set_ce"},
		{"ZVZX__dev_forward_skb", "__dev_forward_skb"},
		{"ZVZX", ""}, // 空字符串的情况
		{"ZVZXtest", "test"},
	}

	for _, tc := range testCases {
		snake := SpecialToSnake(tc.special)
		if snake != tc.expected {
			t.Errorf("SpecialToSnake(%q) = %q, expected %q", tc.special, snake, tc.expected)
		}
	}
}

// TestReversibility 全面测试可逆性
func TestReversibility(t *testing.T) {
	for _, f := range funcList {
		// 跳过空名称
		if f.Name == "" {
			continue
		}

		// 正向转换
		special := SnakeToSpecial(f.Name)

		// 反向转换
		recovered := SpecialToSnake(special)

		// 验证结果
		if recovered != f.Name {
			t.Errorf("Reversibility failed for %q: %q -> %q -> %q", f.Name, f.Name, special, recovered)
		}
	}
}
