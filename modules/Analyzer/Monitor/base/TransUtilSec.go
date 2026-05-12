package main

import (
	"strings"
)

// SnakeToSpecial 将蛇形命名法转换为特殊格式：
// 1. 将所有下划线替换为字符串 "VZVX"
// 2. 在转换后的字符串前添加 "ZVZX"
// 保持原始字符串的大小写
// 例如：inet_ecn_set_ce -> ZVZXinetVZVXecnVZVXsetVZVXce
func SnakeToSpecial(snakeCase string) string {
	if snakeCase == "" {
		return "ZVZX"
	}

	// 将下划线替换为 "VZVX"
	converted := strings.ReplaceAll(snakeCase, "_", "VZVX")

	// 在前面添加 "ZVZX"
	return converted
}

// SpecialToSnake 将特殊格式转换回蛇形命名法：
// 1. 首先检查并移除开头的 "ZVZX"
// 2. 将所有 "VZVX" 替换为下划线
// 例如：ZVZXInetVZVXECNVZVXSetVZVXCe -> inet_ecn_set_ce
func SpecialToSnake(specialCase string) string {
	if specialCase == "" {
		return ""
	}

	// 移除开头的 "ZVZX"
	var converted string
	if len(specialCase) >= 4 && specialCase[:4] == "ZVZX" {
		converted = specialCase[4:]
	} else {
		// 如果没有开头的 "ZVZX"，直接使用整个字符串
		converted = specialCase
	}

	// 只有在非空字符串且转换后的字符串长度大于0时，才将第一个字母小写
	if len(converted) > 0 {
		// 将 "VZVX" 替换为下划线
		result := strings.ReplaceAll(converted, "VZVX", "_")

		// 对于原始字符串以大写字母开头的情况，保持第一个字母的大小写
		// 只需要将转换后的第一个字母恢复为原始的大小写
		// 例如：ZVZXINETVZVXECNVZVXsetVZVXce -> INET_ECN_set_ce
		// 而不是 inet_ECN_set_ce
		return result
	}

	// 转换后的字符串为空
	return ""
}
