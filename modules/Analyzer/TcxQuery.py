from pyroute2 import IPRoute
from bcc import BPF
import sys
# import timer
import time
import sqlite3 as sql
import json as js
from tqdm import tqdm
from PSUtil import U32ToIpv4
import time
import os

# def FormalizeOutput(input):
#     array=[]
#     for item in input:

def TcxQuery(srcport,dstport,srcip,dstip,ipver):
    # srcport=sys.argv[1]
    # dstport=sys.argv[2]
    # srcip=sys.argv[3]
    # dstip=sys.argv[4]
    # ipver=sys.argv[5]

    # global database,attachtime
    database=sql.connect("./.cache/PacketInfo.db")
    # global cursor
    cursor=database.cursor()
    Tabel="ipv4packets"
    if ipver == '4' or ipver == 4:
        Tabel="ipv4packets"
    elif ipver == '6' or ipver == 6:
        Tabel="ipv6packets"
    
    # Step 1 :Extract all entries

    commandStep1="SELECT * FROM {} WHERE srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'".format(Tabel,srcport,dstport,srcip,dstip)
    # print(commandStep1)
    # commandStep1Test="SELECT * FROM SpecfunctionCall WHERE PID = 610"
    cursor.execute(commandStep1)
    result=cursor.fetchall()
    commandStep1="SELECT * FROM {} WHERE srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'".format(Tabel,dstport,srcport,dstip,srcip)
    cursor.execute(commandStep1)
    result=result+(cursor.fetchall())
    cursor.close()
    # sys.stdout.write(js.dumps(result))
    return js.dumps(result)