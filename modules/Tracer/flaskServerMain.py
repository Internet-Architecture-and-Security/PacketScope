from flask import Flask,request
from flask_cors import CORS
import subprocess
from ListSockets import ListAll
from ReadBTFandGetItsMember import ReadBTFandGetItsMember
from translateJSON import translateJSON
import TcxProber
from TcxQuery import TcxQuery
import AttachAndRunProbers
from QueryAndGetFuncMapRecv import QueryAndGetFuncMapRecv
from QueryAndGetFuncMapSend import QueryAndGetFuncMapSend
from GetRecentMaps import GetRecentMaps
from GetRecentPackets import GetRecentPackets
import sqlite3
import threading
import json
import os
import bcc

mainApp=Flask(__name__)
CORS(mainApp)

@mainApp.route("/IsAttachFinished",methods=["GET"])
def IsAttachFinished():
    try:
        return json.dumps([AttachAndRunProbers.is_attach_finished])
    except:
        # 当且仅当没有加载这个py文件时发生，此时一定没有加载完。
        return json.dumps([False])


@mainApp.route("/GetRecentPacket",methods=["GET","POST"])
def GetRecentPacket():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    ipver=request.form["ipver"]
    limit=int(request.form["count"])
    try:
        result=GetRecentPackets(src_port,dst_port,src_ip,dst_ip,ipver,limit)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result

@mainApp.route("/GetRecentMap",methods=["GET","POST"])
def GetRecentMap():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    limit=int(request.form["count"])
    try:
        result=GetRecentMaps(src_port,dst_port,src_ip,dst_ip,limit)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result

@mainApp.route("/SetFilter",methods=["GET","POST"])
def SetFilter():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    TcxProber.g_srcip=src_ip
    TcxProber.g_dstip=dst_ip
    TcxProber.g_dstport=int(dst_port)
    TcxProber.g_srcport=int(src_port)
    AttachAndRunProbers.g_srcip=src_ip
    AttachAndRunProbers.g_dstip=dst_ip
    AttachAndRunProbers.g_dstport=int(dst_port)
    AttachAndRunProbers.g_srcport=int(src_port)
    AttachAndRunProbers.g_status=0
    return "Filter Set!"

@mainApp.route("/UnsetFilter",methods=["GET"])
def UnsetFilter():
    TcxProber.g_srcip=""
    TcxProber.g_dstip=""
    TcxProber.g_dstport=-1
    TcxProber.g_srcport=-1
    AttachAndRunProbers.g_srcip=""
    AttachAndRunProbers.g_dstip=""
    AttachAndRunProbers.g_dstport=-1
    AttachAndRunProbers.g_srcport=-1
    AttachAndRunProbers.g_status=0
    return "Filter Unset!"

@mainApp.route("/ClearData",methods=["GET"])
def DeleteHistData():
    TcxProber.clear_flag_tcx=True
    AttachAndRunProbers.clear_flag_func=True
    return "Flag Set!"
    

@mainApp.route("/GetFuncTable",methods=["GET"])
def QueryFuncTable():
    fo=open("./.cache/FuncIDMap.json","r")
    # subprocess.Popen()
    # subprocess.run()
    return fo.readline()

@mainApp.route("/QueryFuncSend",methods=["GET","POST"])
def QueryFuncSend():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    # subprocess.Popen()
    # subprocess.run()
    try:
        result = QueryAndGetFuncMapSend(src_port,dst_port,src_ip,dst_ip)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result

@mainApp.route("/QueryFuncRecv",methods=["GET","POST"])
def QueryFuncRecv():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    try:
        result = QueryAndGetFuncMapRecv(src_port,dst_port,src_ip,dst_ip)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result

@mainApp.route("/QueryPacket",methods=["GET","POST"])
def QueryPacket():
    method = request.method
    if method == "GET":
        return "QueryFuncSend, Please Use POST",400
    src_ip=request.form["srcip"]
    dst_ip=request.form["dstip"]
    src_port=request.form["srcport"]
    dst_port=request.form["dstport"]
    ipver=request.form["ipver"]
    # subprocess.Popen()
    try:
        result = TcxQuery(src_port,dst_port,src_ip,dst_ip,ipver)
    except sqlite3.OperationalError:
        DeleteHistData()
        return []
    return result

@mainApp.route("/QuerySockList",methods=["GET"])
def QuerySockList():
    # Just So Easy
    return ListAll()

if __name__ == "__main__":
    cProberCache=os.path.exists("./.cache")
    if not cProberCache:
        os.makedirs("./.cache")
    if os.path.exists("./.cache/FunctionInfo.db"):
        os.remove("./.cache/FunctionInfo.db")
    if os.path.exists("./.cache/PacketInfo.db"):
        os.remove("./.cache/PacketInfo.db")
    bcc._probe_limit=20000
    bcc._default_probe_limit=20000
    # bpftool -j btf dump file /sys/kernel/btf/vmlinux > ./btf.json
    subprocess.run(["rm","-f","./.cache/btf.json"])
    fo=open("./.cache/btf.json","x")
    subprocess.run(["bpftool","-j","btf","dump","file","/sys/kernel/btf/vmlinux"],stdout=fo)
    # subprocess.run(["ulimit","-n","32768"],shell=True)
    # ulimit -n 32768
    ReadBTFandGetItsMember()
    translateJSON()
    contEvent = threading.Event()
    TcxThread=threading.Thread(target=TcxProber.TcxProber,args=(contEvent,),daemon=True)
    TcxThread.start()
    FuncThread=threading.Thread(target=AttachAndRunProbers.AttachAndRunProbers,args=(contEvent,),daemon=True)
    FuncThread.start()
    # TcxProber()
    mainApp.run(host="0.0.0.0", port=19999)
    # subprocess.run(["ulimit","-n","32768"],shell=True)