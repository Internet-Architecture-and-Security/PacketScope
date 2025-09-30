# Admin Priv Needed
# Finished - Into a splite Table to filter them
import sqlite3
import os
import time
import json
import sys

def TranV4intoP(inputStr:str):
    r=inputStr.split(":")
    firstByte=int(r[0][6:8],16)
    secByte=int(r[0][4:6],16)
    thridByte=int(r[0][2:4],16)
    lastByte=int(r[0][0:2],16)
    port=int(r[1],16)
    return str(firstByte)+"."+str(secByte)+"."+str(thridByte)+"."+str(lastByte)+":"+str(port)

def TranV6intoP(inputStr:str):
    r=inputStr.split(":")
    port=int(r[1],16)
    return r[0][0:4].lower()+":"+r[0][4:8].lower()+":"+r[0][8:12].lower()+":"+r[0][12:16].lower()+\
        ":"+r[0][16:20].lower()+":"+r[0][20:24].lower()+":"+r[0][24:28].lower()+":"+r[0][28:32].lower()+":"+str(port)

def TranStateintoSTR(inputint:int):
    if inputint==1:
        return "01(ESTABLISHED)"
    elif inputint==2:
        return "02(SYN_SENT)"
    elif inputint==3:
        return "03(SYN_RECV)"
    elif inputint==4:
        return "04(FIN_WAIT1)"
    elif inputint==5:
        return "05(FIN_WAIT2)"
    elif inputint==6:
        return "06(TIME_WAIT)"
    elif inputint==7:
        return "07(CLOSE)"
    elif inputint==8:
        return "08(CLOSE_WAIT)"
    elif inputint==9:
        return "09(LAST_ACK)"
    elif inputint==10:
        return "0A(LISTEN)"
    elif inputint==11:
        return "0B(CLOSING)"
    return str(inputint)+("(UNDEFINED)")
    
# os.remove("./socketList.db")

TotalData={}
def GetTcpInfo():
    # print("TCP Socket Overview:")
    # print("Ipv4Sock:")
    f=open("/proc/net/tcp","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS tcpipv4(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV4intoP((r[1])),TranV4intoP((r[2])),TranStateintoSTR(int(r[3],16))))
    # cursor.executemany("INSERT INTO tcpipv4 VALUES(?,?,?,?,?)",data)
    # print("\n")
    TotalData["tcpipv4"]=data
    f.close()
    # cursor.execute("CREATE TABLE IF NOT EXISTS tcpipv6(time,id, src, dst, st)")
    data=[]
    # print("Ipv6Sock:")
    f=open("/proc/net/tcp6","r")
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV6intoP(r[1]),TranV6intoP(r[2]),TranStateintoSTR(int(r[3],16))))
        # print(TranV6intoP(r[1]))
    # print("\n")
    TotalData["tcpipv6"]=data
    # cursor.executemany("INSERT INTO tcpipv6 VALUES(?,?,?,?,?)",data)
    f.close()
    pass

def GetUdpInfo():
    # print("UDP Socket Overview:")
    # print("Ipv4Sock:")
    f=open("/proc/net/udp","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS udpipv4(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV4intoP((r[1])),TranV4intoP((r[2])),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    # cursor.executemany("INSERT INTO udpipv4 VALUES(?,?,?,?,?)",data)
    TotalData["udpipv4"]=data
    f.close()
    # print("Ipv6Sock:")
    f=open("/proc/net/udp6","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS udpipv6(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV6intoP(r[1]),TranV6intoP(r[2]),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    TotalData["udpipv6"]=data
    # cursor.executemany("INSERT INTO udpipv6 VALUES(?,?,?,?,?)",data)
    f.close()
    pass

def GetIcmpInfo():
    # print("ICMP Socket Overview:")
    # print("Ipv4Sock:")
    f=open("/proc/net/icmp","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS icmpipv4(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV4intoP((r[1])),TranV4intoP((r[2])),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    # cursor.executemany("INSERT INTO icmpipv4 VALUES(?,?,?,?,?)",data)
    f.close()
    # print("Ipv6Sock:")
    TotalData["icmpipv4"]=data
    f=open("/proc/net/icmp6","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS icmpipv6(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV6intoP(r[1]),TranV6intoP(r[2]),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    TotalData["icmpipv6"]=data
    # cursor.executemany("INSERT INTO icmpipv6 VALUES(?,?,?,?,?)",data)
    f.close()
    pass

def GetRawInfo():
    # print("Raw Socket Overview:")
    # print("Ipv4Sock:")
    f=open("/proc/net/raw","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS rawipv4(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV4intoP((r[1])),TranV4intoP((r[2])),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    # cursor.executemany("INSERT INTO rawipv4 VALUES(?,?,?,?,?)",data)
    f.close()
    # print("Ipv6Sock:")
    TotalData["rawipv4"]=data
    f=open("/proc/net/raw6","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS rawipv6(time,id, src, dst, st)")
    data=[]
    for item in f.readlines()[1:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1],TranV6intoP(r[1]),TranV6intoP(r[2]),TranStateintoSTR(int(r[3],16))))
    # print("\n")
    TotalData["rawipv6"]=data
    # cursor.executemany("INSERT INTO rawipv6 VALUES(?,?,?,?,?)",data)
    f.close()
    pass

def GetDevInfo():
    # print("Dev Overview:")
    # print("Ipv4Sock:")
    f=open("/proc/net/dev","r")
    # cursor.execute("CREATE TABLE IF NOT EXISTS NetIF(time,netif)")
    data=[]
    for item in f.readlines()[2:]:
        # print(item,end="")
        r=item.split()
        data.append((curTime,r[0][:-1]))
    TotalData["dev"]=data
    # cursor.executemany("INSERT INTO NetIF VALUES(?,?)",data)
    # print("\n")
    f.close()
    pass

# def GetSocketBaseInfo():
#     print("Socket Overview:")
#     print("Ipv4Sock:")
#     f=open("/proc/net/sockstat","r")
#     for item in f.readlines():
#         print(item,end="")
#     # print("\n")
#     f.close()
#     print("Ipv6Sock:")
#     f=open("/proc/net/sockstat6","r")
#     for item in f.readlines():
#         print(item,end="")
#     # print("\n")
#     f.close()
#     pass


# if __name__ == "__main__":
def ListAll():
    # GetSocketBaseInfo()
    # curTime=time.time()
    # global database
    # global cursor
    global curTime
    curTime=time.time()
    # database=sqlite3.connect("./socketList.db")
    # cursor=database.cursor()
    GetDevInfo()
    GetTcpInfo()
    GetUdpInfo()
    GetRawInfo()
    GetIcmpInfo()
    # database.commit()
    # sys.stdout.write(json.dumps(TotalData))
    # database.close()
    return json.dumps(TotalData)
    # database.close()
    # TODO Extract more infomation - ref ss(system tool)

if __name__ == "__main__":
    # curTime=time.time()
    # while True:
    print(ListAll())
    # OutputAllData 
    # time.sleep(1)
        # TODO make 1 into parameter
    