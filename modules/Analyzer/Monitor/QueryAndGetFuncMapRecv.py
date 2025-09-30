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
def QueryAndGetFuncMapRecv(srcport,dstport,srcip,dstip):
    # global database,attachtime
    database=sql.connect("./.cache/FunctionInfo.db")
    # global cursor
    cursor=database.cursor()
# Step 1: Extract all entries with ID 200001/200002/300000/300001/300002/300003
# Step 2: Filter all entries with 200001/200002
# Step 3: Get all 30000x entries with same PID and just before 200001 -> -1 of list
# Step 4: Query that entry and match that packet

    commandStep1="SELECT * FROM SpecfunctionCall WHERE ID in (200000,200001) and srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'".format(srcport,dstport,srcip,dstip)
    # commandStep1Test="SELECT * FROM SpecfunctionCall WHERE PID = 610"
    cursor.execute(commandStep1)
    result=cursor.fetchall()
    # print(result)
    #Step 2 :Extract all entries
    dataset=[]

    for item in result:
        timeStart=item[0]
        IDnow=item[2]
        PIDnow=item[3]
        commandStep2="SELECT * FROM SpecfunctionCall WHERE ID > 299999 and PID = {} and time < {}".format(PIDnow,timeStart)
        cursor.execute(commandStep2)
        result2=cursor.fetchall()
        # print(result2)
        if len(result2)<=0:
            continue
        # print(result2)
        CorCall=result2[-1]
        timeStartR=CorCall[0]
        IDnow=CorCall[2]
        PIDnow=CorCall[3]
        commandStep3="SELECT * FROM functionCall WHERE time > {} and isRet = 1 and ID = {} and PID = {}".format(timeStartR,IDnow,PIDnow)
        cursor.execute(commandStep3)
        result3=cursor.fetchall()
        # print(result3)
        # print(result2)
        if len(result3)<=0:
            continue
        timeEnd=result3[0][0]
        commandStep4="SELECT * FROM functionCall WHERE time >= {} and time<= {} and PID = {}".format(timeStartR,timeEnd,PIDnow)
        cursor.execute(commandStep4)
        result4=cursor.fetchall()
        dataset.append(result4)
        # print(result3)
    # sys.stdout.write(js.dumps(dataset))
    cursor.close()
    return js.dumps(dataset)