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
    # srcport=sys.argv[1]
    # dstport=sys.argv[2]
    # srcip=sys.argv[3]
    # dstip=sys.argv[4]
def QueryAndGetFuncMapSend(srcport,dstport,srcip,dstip):
    # global database,attachtime
    database=sql.connect("./.cache/FunctionInfo.db")
    # global cursor
    cursor=database.cursor()

    # Step 1 :Extract all entries

    commandStep1="SELECT * FROM SpecfunctionCall WHERE ID in (200002,200003,200004,200005,200006,200007) and srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'".format(srcport,dstport,srcip,dstip)
    # commandStep1="SELECT * FROM SpecfunctionCall WHERE srcport = {}".format(srcport)

    # commandStep1Test="SELECT * FROM SpecfunctionCall WHERE PID = 610" ID in (200002,200003,200004,200005,200006,200007) and 
    # print(commandStep1)
    cursor.execute(commandStep1)
    result=cursor.fetchall()
    # print(result)
    #Step 2 :Extract all entries
    dataset=[]

    for item in result:
        timeStart=item[0]
        IDnow=item[2]
        PIDnow=item[3]
        commandStep2="SELECT * FROM functionCall WHERE time > {} and isRet = 1 and ID = {} and PID = {}".format(timeStart,IDnow,PIDnow)
        cursor.execute(commandStep2)
        result2=cursor.fetchall()
        # print(result2)
        if len(result2)<=0:
            continue
        timeEnd=result2[0][0]
        commandStep3="SELECT * FROM functionCall WHERE time >= {} and time<= {} and PID = {}".format(timeStart,timeEnd,PIDnow)
        cursor.execute(commandStep3)
        result3=cursor.fetchall()
        dataset.append(result3)
        # print(result3)
    # sys.stdout.write(js.dumps(dataset))
    cursor.close()
    return js.dumps(dataset)