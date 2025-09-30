# Assume that all func in a single tid will run in order
# Then just use tid - we can get all info, without stack.
# Because for ret probe, a closed set will be extremely useful
# export BCC_PROBE_LIMIT=20000
# ulimit -n 32768
from pyroute2 import IPRoute
from bcc import BPF
import ctypes
# import timer
import time
import sqlite3 as sql
import json as js
from tqdm import tqdm
from PSUtil import U32ToIpv4,ArrayToIpv6
import time
import os

start = 0

DisabledList=["____sys_recvmsg","___sys_recvmsg","sock_recvmsg","security_socket_recvmsg",
            "apparmor_socket_recvmsg","unix_stream_recvmsg","consume_skb",
            "__skb_datagram_iter","skb_copy_datagram_iter","skb_put","skb_release_data",
            "skb_release_head_state","kfree_skbmem","skb_free_head","__build_skb_around",
            "sock_def_readable","skb_queue_tail","sock_alloc_send_pskb","skb_set_owner_w",
            "sock_wfree","skb_copy_datagram_from_iter","unix_scm_to_skb","skb_unlink",
            "apparmor_socket_sendmsg","security_socket_sendmsg","security_socket_getpeersec_dgram",
            "____sys_sendmsg","___sys_sendmsg","unix_stream_sendmsg","tcp_poll","tcp_stream_memory_free",
            "lock_sock_nested","tcp_release_cb","map_sock_addr","security_socket_getpeername","inet_label_sock_perm",
            "aa_inet_sock_perm","apparmor_socket_getpeername","sock_do_ioctl",
            "udp_poll",
            ]
SpecList=["icmp_push_reply","rawv6_sendmsg",
        "raw_sendmsg","udp_sendmsg","udpv6_sendmsg","tcp_sendmsg","ip_rcv_core","ip6_rcv_core",
        "ipv6_rcv","ip_rcv","ip_list_rcv","ipv6_list_rcv"
        ]
AttachedFuncName=[]
rcvID=[]
sendID=[]
g_status=0

def __init_Func():
    global jsonf
    jsonf=js.load(open("./.cache/relatedFuncD5.json","r"))
    global database,attachtime
    database=sql.connect("./.cache/FunctionInfo.db")
    global cursor
    cursor=database.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS functionCall(time, isRet, ID ,PID)")
    cursor.execute("CREATE TABLE IF NOT EXISTS SpecfunctionCall(time, isRet, ID ,PID,family,srcport,dstport,srcip,dstip,pkt)")
    

def detachBPFFunc():
    print("[LOG]End Kprober")
    for item in tqdm(AttachedFuncName):
        bpfProgSocketCounter.detach_kprobe(event=item["name"],fn_name="ktprobe_{}".format(item["name"]))
        bpfProgSocketCounter.detach_kretprobe(event=item["name"],fn_name="ktretprobe_{}".format(item["name"]))
    print("[LOG]Finish Detach Kprobe and Kretprobe")

def buildBPFSocketCounter():
# Build eBPF Program
    # socketTracertext=""
    print("[LOG]Begin Build Kprobe and Kretprobe")
    global bpfProgSocketCounter,attachtime,ringbuf
    bpfProgSocketCounter=BPF(src_file="./.cache/kProberFunc.c")
    # https://docs.pyroute2.org/iproute_linux.html
    ringbuf = bpfProgSocketCounter.get_table("events")
    ringbuf.open_ring_buffer(print_event)
    print("[LOG]Finish Build Kprobe and Kretprobe")
    for item in tqdm(jsonf):
        if item["name"].find("bpf")!=-1 or item["name"] in DisabledList:
            continue
        keywordList=["tcp","udp","icmp","recv","send","xmit","ip","sk","sock"]
        # keywordList=["tcp"]
        found=0
        for ket in keywordList:
            if item["name"].find(ket)!=-1:
                found=1
        if found == 1:
            if item["name"] in SpecList:
        # continue
                rcvID.append(item["id"])
            # continue
            try:
                # if(item["name"]=="tcp_recvmsg"):
                bpfProgSocketCounter.attach_kprobe(event=item["name"],fn_name="ktprobe_{}".format(item["name"]))
                bpfProgSocketCounter.attach_kretprobe(event=item["name"],fn_name="ktretprobe_{}".format(item["name"]))
                AttachedFuncName.append(item["name"])
                # time.sleep(0.25)
            except BaseException as e:
                print(e)
                continue
            finally:
                # if(len(AttachedFuncName)>300):
                    # break
                # AttachedFuncName.append(item["name"])
                pass
    print("[LOG]Finish Attach Kprobe and Kretprobe")
    print(rcvID)
    # print(AttachedFuncName)
    print(len(AttachedFuncName))
    attachtime=time.time()



def print_event(cpu,data,size):
    global start
    global g_status
    # print(2)
    event = bpfProgSocketCounter["events"].event(data)
    pid=event.pid
    if start == 0:
        start =event.kernelTime
    time_s=(float(event.kernelTime-start))/1000000000
    id=event.FuncID
    ret=event.ret
    pid=event.pid
    if id >= 200000 and ret == 0:
        if id >=300000:
            cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
            cursor.execute("INSERT INTO SpecfunctionCall VALUES(?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,ret,id,pid,0,0,0,"","",""))
            # Always Needed
            return
        family=event.family
        dport=event.dport
        lport=event.lport
        if lport>65536 or dport>65536:
            cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
            return
        dstip=""
        srcip=""
        if family==4:
            dstip=U32ToIpv4(event.ipv4__recvaddr)
            srcip=U32ToIpv4(event.ipv4__sendaddr)
        elif family==6:
            dstip=ArrayToIpv6(event.ipv6__recvaddr)
            srcip=ArrayToIpv6(event.ipv6__sendaddr)
        else:
            cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
            return
        if (srcip==g_srcip and dstip==g_dstip) or (srcip==g_dstip and dstip==g_srcip):
            if (lport==g_srcport and dport==g_dstport) or (lport==g_dstport and dport==g_srcport):
                if ret==0:
                    g_status+=1
                elif ret==1 and g_status>0:
                    g_status-=1
        # else:
            # dstip=""
            # srcip=""
            # cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
            # print("No family?")
            # cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
            # return
        cursor.execute("INSERT INTO SpecfunctionCall VALUES(?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,ret,id,pid,family,lport,dport,srcip,dstip,""))
        cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
        return
    if id >= 200000 and ret == 1:
        cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
        return
    # if id in sendID:
    #     continue
    # TODO Filter Data Storage -> Use Pid
    if g_status>0 or (g_srcport<0):
        cursor.execute("INSERT INTO functionCall VALUES(?,?,?,?)",(attachtime+time_s,ret,id,pid))
    return 
        # TODO Data Tramsmission


def AttachAndRunProbers(event):
    event.wait()
    __init_Func()
    global is_attach_finished
    is_attach_finished=False
    buildBPFSocketCounter()
    global clear_flag_func
    clear_flag_func = False
    global g_status
    g_status=0
    global g_srcport,g_dstport,g_srcip,g_dstip
    
    g_srcip=""
    g_dstip=""
    g_srcport=-1
    g_dstport=-1
    # ringbuf = bpfTcxTracer.get_table("events")
    # ringbuf = bpfProgSocketCounter.get_table("events")
    # ringbuf.open_ring_buffer(print_event)
    starttime=time.time()
    is_attach_finished=True
    # tid=os.getpid()
    # process = psutil.Process(tid)
    # open_files = process.open_files()
    # print(open_files)
    while True:
        try:
            if(time.time()-starttime>1):
                starttime=time.time()
                database.commit()
                if clear_flag_func:
                    cursor.execute("DELETE FROM functionCall WHERE time < {}".format(starttime))
                    cursor.execute("DELETE FROM SpecfunctionCall WHERE time < {}".format(starttime))
                    # database.commit()
                    clear_flag_func=False
                database.commit()
            # Not Commit TOO many times
            # print(1)
            bpfProgSocketCounter.ring_buffer_poll()
        except KeyboardInterrupt:
            break
        finally:
            pass
    # jsonf.close()



if __name__ == "__main__":
    # exit()
    buildBPFSocketCounter()

    # ringbuf = bpfTcxTracer.get_table("events")
    # ringbuf = bpfProgSocketCounter.get_table("events")
    # ringbuf.open_ring_buffer(print_event)
    starttime=time.time()
    # tid=os.getpid()
    # process = psutil.Process(tid)
    # open_files = process.open_files()
    # print(open_files)
    while True:
        try:
            if(time.time()-starttime>1):
                starttime=time.time()
                database.commit()
            # Not Commit TOO many times
            # print(1)
            bpfProgSocketCounter.ring_buffer_poll()
        except KeyboardInterrupt:
            break
        finally:
            pass
