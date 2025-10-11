#!/bin/bash


# 以 root 权限执行（使用 sudo 调用此脚本时生效）
ulimit -n 65536

# 切换到项目目录
cd /home/ubuntu/packetScope/modules/Analyzer/ || exit 1

# 激活虚拟环境
source .venv/bin/activate

# 启动 Flask 服务
# python m.py
python monitor.py
# python moniter_Packet.py
# gunicorn -k gevent -w 7 -b 0.0.0.0:5000 moniter_Packet:app
