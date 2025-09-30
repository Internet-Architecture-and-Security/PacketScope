
def U32ToIpv4(input):
    firstByte=(input>>24)&0x000000FF
    secondByte=(input>>16)&0x000000FF
    thirdByte=(input>>8)&0x000000FF
    lastByte=(input)&0x000000FF
    return str(lastByte)+"."+str(thirdByte)+"."+str(secondByte)+"."+str(firstByte)

def ArrayToIpv4(input):
    firstByte=input[3]
    secondByte=input[2]
    thirdByte=input[1]
    lastByte=input[0]
    return str(lastByte)+"."+str(thirdByte)+"."+str(secondByte)+"."+str(firstByte)


def ArrayToIpv6(input):
    strM=""
    for i in range(16):
        t=hex(input[i])[2:]
        if len(t)==1:
            t="0"+t
        strM+=t
        if i%2==1 and i!=15:
            strM+=":"
    return strM

def getInfoTypeName(id):
    if id==0:
        return "netif_receive_skb_entry"
    elif id==1:
        return "netif_receive_skb_exit"
    elif id==2:
        return "netif_rx_entry"
    elif id==3:
        return "netif_rx_exit"
    else:
        return "Illegal Code, Check Dev"
