from pyroute2 import IPRoute
from bcc import BPF
import ctypes
# import timer
import time
import sqlite3 as sql
from PSUtil import ArrayToIpv4,ArrayToIpv6
import threading
# global clear_flag_tcx
# clear_flag_tcx=False
# Reference program :
# socketio from Brendan Gregg

# Build Data struct
def __init__Func():
    global database
    database=sql.connect("./.cache/PacketInfo.db")
    global cursor
    cursor=database.cursor()
    # cursor.execute("CREATE TABLE IF NOT EXISTS packets(time, netif, direction, length ,content, srcmac, dstmac, prot ,srcip, dstip, srcport, dstport)")
    cursor.execute("CREATE TABLE IF NOT EXISTS ipv6packets(time, netif, direction, length ,content, srcip, dstip, header ,srcport, dstport)")
    cursor.execute("CREATE TABLE IF NOT EXISTS ipv4packets(time, netif, direction, length ,content, srcip, dstip, srcport, dstport, prot, ipid, ttl, frag, option)")
    cursor.execute("CREATE TABLE IF NOT EXISTS otherpackets(time, netif, direction, length ,content)")
    database.commit()
    global netifname
    netifname=[]
    f=open("/proc/net/dev","r")
        # cursor.execute("CREATE TABLE IF NOT EXISTS NetIF(time,netif)")
    for item in f.readlines()[2:]:
        # print(item,end="")
        r=item.split()
        # if r[0][:-1]=="lo":
        #     continue
        netifname.append(r[0][:-1])
    # cursor.executemany("INSERT INTO NetIF VALUES(?,?)",data)
    # print("\n")
    print(netifname)
    f.close()
    # netifname=["ens33"]
    global start
    start = 0
    global g_srcport,g_dstport,g_srcip,g_dstip
    g_srcip=""
    g_dstip=""
    g_srcport=-1
    g_dstport=-1


def buildBPFSocketCounter():
# Build eBPF Program
    # socketTracertext=""

    global bpfTcxTracer,iprouter,attachtime
    bpfTcxTracer=BPF(src_file="./tcxProber.c")
    # https://docs.pyroute2.org/iproute_linux.html
    fn=bpfTcxTracer.load_func("tcx_ingress",BPF.SCHED_CLS)
    fn2=bpfTcxTracer.load_func("tcx_egress",BPF.SCHED_CLS)
    iprouter=IPRoute()
    
    for item in netifname:
        ens33=iprouter.link_lookup(ifname=item)[0]
        print(ens33)
        try:
            iprouter.tc("delete", "ingress", ens33, "ffff:")
            iprouter.tc("delete", "sfq", ens33, "fffe:")
            pass
        except:
            pass
        finally:
            pass
        iprouter.tc("add", "ingress", ens33, "ffff:")
        iprouter.tc("add-filter", "bpf", ens33, ":1",fd=fn.fd,name=fn.name,parent="ffff:", action="ok", classid=1)
        iprouter.tc("add", "sfq", ens33, "fffe:")
        iprouter.tc("add-filter", "bpf", ens33, ":1",fd=fn2.fd,name=fn2.name,parent="fffe:", action="ok", classid=1)
    attachtime=time.time()



def print_event(cpu,data,size):
    global start
    event = bpfTcxTracer["events"].event(data)
    if start == 0:
        start =event.timestamp
    time_s=(float(event.timestamp-start))/1000000000
    payloadlen = event.payloadlen
    payload=event.payload[:payloadlen]
    direction=event.direction
    srcmac=payload[0:6]
    dstmac=payload[6:12]
    ethernetType=payload[12]*256+payload[13]
    if ethernetType != 0x0800 and ethernetType != 0x86dd:
        # Not IPv4 nor IPv6
        cursor.execute("INSERT INTO otherpackets VALUES(?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload)))
        return
    prottype=payload[14]&0xf0
    # subtype=payload[22]
    # print(prottype)
    if prottype == 64:
        protip=4
        # 1 ICMP 6 TCP 17 UDP
        srcip=ArrayToIpv4(payload[26:30])
        dstip=ArrayToIpv4(payload[30:34])
        if (srcip!=g_srcip or dstip!=g_dstip) and (srcip!=g_dstip or dstip!=g_srcip) and (g_srcport>=0):
            return
        headerlen=(payload[14]&0x0f)*4
        nextprotstart=headerlen+14
        subprot=payload[23]
        ttl=payload[22]
        ipid=payload[19]+payload[18]*256
        fragconfig=payload[20:22]
        optionSeg=payload[34:nextprotstart]
        # (time, netif, direction, length ,content, srcip, dstip, srcport, dstport, prot, ipid, ttl)
        if subprot == 17 or subprot == 6:
            # UDP or TCP 
            srcport=payload[nextprotstart+1]+payload[nextprotstart]*256
            dstport=payload[nextprotstart+3]+payload[nextprotstart+2]*256
            if (srcport!=g_srcport or dstport!=g_dstport) and (g_srcport>=0):
                return
            cursor.execute("INSERT INTO ipv4packets VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex(),srcip,dstip,srcport,dstport,subprot,ipid,ttl,bytes(fragconfig).hex(),bytes(optionSeg).hex()))
        elif subprot == 1:
            # ICMP
            cursor.execute("INSERT INTO ipv4packets VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex(),srcip,dstip,0,0,subprot,ipid,ttl,bytes(fragconfig).hex(),bytes(optionSeg).hex()))
        #  extract TTL/ipid/Config
        else:
            cursor.execute("INSERT INTO otherpackets VALUES(?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload)))
    elif prottype==96:
        protip=6
        headertype=payload[20]
        srcip=ArrayToIpv6(payload[22:38])
        dstip=ArrayToIpv6(payload[38:54])
        if (srcip!=g_srcip or dstip!=g_dstip) and (srcip!=g_dstip or dstip!=g_srcip) and (g_srcport>=0):
            return
        if headertype == 6:
            # TCP
            srcport=payload[55]+payload[54]*256
            dstport=payload[56]+payload[57]*256
            if (srcport!=g_srcport or dstport!=g_dstport) and (srcport!=g_dstport or dstport!=g_srcport) and (g_srcport>=0):
                return
            cursor.execute("INSERT INTO ipv6packets VALUES(?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex(),(srcip),(dstip),headertype,srcport,dstport))
            return
        if headertype == 17:
            srcport=payload[55]+payload[54]*256
            dstport=payload[56]+payload[57]*256
            if (srcport!=g_srcport or dstport!=g_dstport) and (srcport!=g_dstport or dstport!=g_srcport) and (g_srcport>=0):
                return
            # UDP
            cursor.execute("INSERT INTO ipv6packets VALUES(?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex(),(srcip),(dstip),headertype,srcport,dstport))
            return
        # TODO : Append other headers/ Or do it in frontend?
        if headertype == 58:
            # ICMPv6
            cursor.execute("INSERT INTO ipv6packets VALUES(?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex(),(srcip),(dstip),headertype,0,0))
        else:
            cursor.execute("INSERT INTO otherpackets VALUES(?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload).hex()))
            return
        # For ipv6,it's necessary to commit and query how to get subsquent layer
        # srcport=
        # dstport=
    else:
        cursor.execute("INSERT INTO otherpackets VALUES(?,?,?,?,?)",(attachtime+time_s,0,direction,\
            payloadlen,bytes(payload)))
        # Not ipv4 Nor ipv6
        return
    # 96 = ipv6, 69 = ipv4
    # srcip=""
    # dstip=""
    
    # print(bytes(payload))
    # Manually extract
    # print("DestIP:"+daddr+" SendIP:"+saddr)
    # print(payloadlen,attachtime+time_s)
    # cursor.execute("INSERT INTO packets VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",(attachtime+time_s,"ens33",direction,payloadlen,bytes(payload),bytes(srcmac),bytes(dstmac),protip,bytes(srcip),bytes(dstip),"",""))
        # TODO Data Tramsmission


def TcxProber(event):
    # stopEvent:threading.Event
    __init__Func()
    buildBPFSocketCounter()
    event.set()
    ringbuf = bpfTcxTracer.get_table("events")
    ringbuf.open_ring_buffer(print_event)
    starttime=time.time()
    global clear_flag_tcx
    clear_flag_tcx=False
    
    # print(t)
    # bpfTcxTracer["events"].open_perf_buffer(print_event,page_cnt=16)
    # bpfProgSocketCounter["eventsSend"].open_perf_buffer(print_event2)
    # 
    while True:
        try:
            if(time.time()-starttime>1):
                starttime=time.time()
                if clear_flag_tcx:
                    # ipv4packets,ipv6packets,otherpackets
                    cursor.execute("DELETE FROM ipv4packets WHERE time < {}".format(starttime))
                    cursor.execute("DELETE FROM ipv6packets WHERE time < {}".format(starttime))
                    cursor.execute("DELETE FROM otherpackets WHERE time < {}".format(starttime))
                    # database.commit()
                    clear_flag_tcx=False
                database.commit()
            # Not Commit TOO many times
            bpfTcxTracer.ring_buffer_poll()
        except KeyboardInterrupt:
            break
        finally:
            pass

if __name__ == "__main__":
    # exit()
    __init__Func()
    buildBPFSocketCounter()

    ringbuf = bpfTcxTracer.get_table("events")
    ringbuf.open_ring_buffer(print_event)
    starttime=time.time()
    # print(t)
    # bpfTcxTracer["events"].open_perf_buffer(print_event,page_cnt=16)
    # bpfProgSocketCounter["eventsSend"].open_perf_buffer(print_event2)
    # 
    while True:
        try:
            if(time.time()-starttime>1):
                starttime=time.time()
                database.commit()
            # Not Commit TOO many times
            bpfTcxTracer.ring_buffer_poll()
        except KeyboardInterrupt:
            break
        finally:
            pass



# Attach to relative syscall
# According to reference
# sock_recvmsg and sock_sendmsg should be kprobed
# 

# Attach to relative tracepoint
