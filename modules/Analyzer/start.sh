#!/bin/bash

# 以 root 权限执行（使用 sudo 调用此脚本时生效）
ulimit -n 65535

# 切换到项目目录
cd ./modules/Analyzer/ || exit 1

# 启动 Flask 服务
python flaskServer.py
