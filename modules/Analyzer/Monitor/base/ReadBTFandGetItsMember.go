//go:build linux
// +build linux

package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// ReadBTFandGetItsMember 导出函数：读取 ./.cache/btf.json，寻找与 sk_buff 相关的 types（深度5），
// 并把所有参数中包含这些类型的 FUNC 项保存到 ./.cache/relatedFuncD5.json，返回这些函数项。
func ReadBTFandGetItsMember() ([]map[string]interface{}, error) {
	btfPath := "./.cache/btf.json"
	raw, err := os.ReadFile(btfPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", btfPath, err)
	}

	var btfFile map[string]interface{}
	if err := json.Unmarshal(raw, &btfFile); err != nil {
		return nil, fmt.Errorf("invalid json in %s: %w", btfPath, err)
	}

	typesIface, ok := btfFile["types"]
	if !ok {
		return nil, fmt.Errorf("no 'types' key in %s", btfPath)
	}

	typesList, ok := typesIface.([]interface{})
	if !ok {
		return nil, fmt.Errorf("'types' is not an array in %s", btfPath)
	}

	// build list and map[id]item
	L1List := make([]map[string]interface{}, 0, len(typesList))
	L1Dict := make(map[int]map[string]interface{})
	for _, it := range typesList {
		m, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		L1List = append(L1List, m)
		if idVal, found := m["id"]; found {
			if id := toInt(idVal); id >= 0 {
				L1Dict[id] = m
			}
		}
	}

	// find sk_buff id
	skbid := -1
	for _, item := range L1List {
		if nameVal, ok := item["name"]; ok {
			if nameStr, ok := nameVal.(string); ok && nameStr == "sk_buff" {
				if idVal, ok := item["id"]; ok {
					skbid = toInt(idVal)
					break
				}
			}
		}
	}
	if skbid < 0 {
		return nil, fmt.Errorf("sk_buff not found in btf types")
	}

	related := make(map[int]struct{})
	related[skbid] = struct{}{}

	updated := true
	depth := 0
	for updated && depth < 5 {
		updated = false
		for _, item := range L1List {
			id := -1
			if idv, ok := item["id"]; ok {
				id = toInt(idv)
			}
			if id < 0 {
				continue
			}
			if _, exists := related[id]; exists {
				continue
			}
			kind, _ := item["kind"].(string)
			switch kind {
			case "STRUCT":
				if members, ok := item["members"].([]interface{}); ok {
					for _, mv := range members {
						if mm, ok := mv.(map[string]interface{}); ok {
							if tidv, ok := mm["type_id"]; ok {
								if tid := toInt(tidv); tid >= 0 {
									if _, ok := related[tid]; ok {
										related[id] = struct{}{}
										updated = true
										break
									}
								}
							}
						}
					}
				}
			case "ARRAY", "VOLATILE", "CONST", "PTR":
				if tidv, ok := item["type_id"]; ok {
					if tid := toInt(tidv); tid >= 0 {
						if _, ok := related[tid]; ok {
							related[id] = struct{}{}
							updated = true
						}
					}
				}
			}
		}
		depth++
	}

	// find related functions
	relatedFunc := make([]map[string]interface{}, 0)
	for _, item := range L1List {
		kind, _ := item["kind"].(string)
		if kind != "FUNC" {
			continue
		}
		// look up type proto
		tpid := -1
		if tidv, ok := item["type_id"]; ok {
			tpid = toInt(tidv)
		}
		p, ok := L1Dict[tpid]
		if !ok {
			continue
		}
		if pk, _ := p["kind"].(string); pk == "FUNC_PROTO" {
			if params, ok := p["params"].([]interface{}); ok {
				for _, pv := range params {
					if pm, ok := pv.(map[string]interface{}); ok {
						if ptidv, ok := pm["type_id"]; ok {
							if ptid := toInt(ptidv); ptid >= 0 {
								if _, ok := related[ptid]; ok {
									relatedFunc = append(relatedFunc, item)
									break
								}
							}
						}
					}
				}
			}
		}
	}

	// write out
	outPath := "./.cache/relatedFuncD5.json"
	outDir := "./.cache"
	if _, err := os.Stat(outDir); os.IsNotExist(err) {
		if err := os.MkdirAll(outDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create %s: %w", outDir, err)
		}
	}

	outRaw, err := json.MarshalIndent(relatedFunc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal related func: %w", err)
	}
	if err := os.WriteFile(outPath, outRaw, 0644); err != nil {
		return nil, fmt.Errorf("failed to write %s: %w", outPath, err)
	}

	return relatedFunc, nil
}

// toInt 从 interface{} 安全转换到 int，失败返回 -1
func toInt(v interface{}) int {
	switch vv := v.(type) {
	case float64:
		return int(vv)
	case int:
		return vv
	case int64:
		return int(vv)
	case json.Number:
		i64, err := vv.Int64()
		if err != nil {
			return -1
		}
		return int(i64)
	case string:
		// 尝试解析数字字符串
		var i int
		if _, err := fmt.Sscanf(vv, "%d", &i); err == nil {
			return i
		}
		return -1
	default:
		return -1
	}
}
