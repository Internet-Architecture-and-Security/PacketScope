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

def GetRecentMaps(srcport,dstport,srcip,dstip,count,time:float):
    # global database,attachtime
    database=sql.connect("./.cache/FunctionInfo.db")
    # global cursor
    cursor=database.cursor()
    commandStep1="SELECT * FROM SpecfunctionCall WHERE ID in (200000,200001) and time > {} and ((srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}') or (srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'))".format(time,srcport,dstport,srcip,dstip,dstport,srcport,dstip,srcip)
    cursor.execute(commandStep1)
    result=cursor.fetchall()
    result.reverse()
    dataset=[]
    Ncount=0
    for item in result:
        Ncount+=1
        timeStart=item[0]
        IDnow=item[2]
        PIDnow=item[3]
        commandStep2="SELECT * FROM SpecfunctionCall WHERE ID > 299999 and PID = {} and time < {}".format(PIDnow,timeStart)
        cursor.execute(commandStep2)
        result2=cursor.fetchall()
        if len(result2)<=0:
            continue
        CorCall=result2[-1]
        timeStartR=CorCall[0]
        IDnow=CorCall[2]
        PIDnow=CorCall[3]
        commandStep3="SELECT * FROM functionCall WHERE time > {} and isRet = 1 and ID = {} and PID = {}".format(timeStartR,IDnow,PIDnow)
        cursor.execute(commandStep3)
        result3=cursor.fetchall()
        if len(result3)<=0:
            continue
        timeEnd=result3[0][0]
        commandStep4="SELECT * FROM functionCall WHERE time >= {} and time<= {} and PID = {}".format(timeStartR,timeEnd,PIDnow)
        cursor.execute(commandStep4)
        result4=cursor.fetchall()
        dataset.append(result4)
        if Ncount>=count:
            break
    commandStep1="SELECT * FROM SpecfunctionCall WHERE ID in (200002,200003,200004,200005,200006,200007) and time > {} and ((srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}') or (srcport = {} and dstport = {} and srcip = '{}' and dstip = '{}'))".format(time, dstport, srcport, dstip, srcip, srcport, dstport, srcip, dstip)
    cursor.execute(commandStep1)
    result=cursor.fetchall()
    result.reverse()
    Ncount=0
    dataset2=[]
    for item in result:
        Ncount+=1
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
        dataset2.append(result3)
        if Ncount>=count:
            break
    return js.dumps([dataset,dataset2])