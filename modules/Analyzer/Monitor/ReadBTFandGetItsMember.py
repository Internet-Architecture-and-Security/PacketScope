import json as js
import tqdm as tq

def rebuild_json(inputlist):
    dictnow={}
    for item in inputlist:
        dictnow[item["id"]]=item
    return dictnow

def ReadBTFandGetItsMember():
# This file is to get all items that 
    fo=open("./.cache/btf.json","r")
    # stro=fo.read()

    btfFile=js.load(fo)
    L1list=btfFile["types"]
    L1Dict=rebuild_json(L1list)
    for item in L1list:
        print(item["name"])
        if item["name"]=="sk_buff":
            skbid=item["id"]
            print("get")
            break
        # break
    Updated=True
    Depth=1
    relatedTypes=[skbid]
    while Updated:
        Updated=False
        for item in L1list:
            if item["id"] in relatedTypes:
                continue
            # if item["kind"] == "STRUCT" or item["kind"] == "UNION":
            if item["kind"] == "STRUCT":
                for subitem in item["members"]:
                    if subitem["type_id"] in relatedTypes:
                        relatedTypes.append(item["id"])
                        Updated=True
                        break
            elif item["kind"] == "ARRAY" or item["kind"]=="VOLATILE" \
                or item["kind"]=="CONST" or item["kind"] == "PTR":
                if item["type_id"] in relatedTypes:
                    relatedTypes.append(item["id"])
                    Updated=True
                # continue
        Depth+=1
        if Depth>5:
            break
        print(len(relatedTypes))
    # print(relatedTypes)
        
    # exit()
    relatedFunc=[]

    # First level is load a1 dict whose key is "types"
    for item in tq.tqdm(L1list):
        # iterate all items
        if item["kind"]!="FUNC":
            continue
            # Just check FUNC
        find_skb=False
        p=L1Dict[item["type_id"]]
        if p["kind"]=="FUNC_PROTO":
            t=p["params"]
            for para in t:
                if para["type_id"] in relatedTypes:
                    relatedFunc.append(item)
                    find_skb==True
                    break

    ftw=open("./.cache/relatedFuncD5.json","w")
    js.dump(relatedFunc,ftw)
    ftw.close()
        

