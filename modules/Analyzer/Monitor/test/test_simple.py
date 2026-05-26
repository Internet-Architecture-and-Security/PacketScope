#!/usr/bin/env python3
import os
import psycopg2

db_params = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": os.getenv("PG_PORT", "5432"),
    "user": os.getenv("PG_USER", "postgres"),
    "password": os.getenv("PG_PASSWORD", "password"),
    "dbname": os.getenv("PG_DBNAME_FUNCTION", "functioninfo")
}

conn = psycopg2.connect(**db_params)
conn.autocommit = True
cursor = conn.cursor()

# Test with the actual parameters from the server
srcport = 443
dstport = 54698
srcip = "101.126.55.244"
dstip = "192.168.79.128"

print(f"Testing with: srcport={srcport}, dstport={dstport}, srcip={srcip}, dstip={dstip}")

# Step 1: Find Receive FunctionMap entries
query = """
    SELECT time, isret, id, pid, family, srcport, dstport, srcip, dstip, pkt
    FROM SpecfunctionCall 
    WHERE id IN (200000, 200001) AND isret = 0 
    AND ((srcport = %s AND dstport = %s AND srcip = %s AND dstip = %s) 
         OR (srcport = %s AND dstport = %s AND srcip = %s AND dstip = %s))
    ORDER BY time DESC
"""
cursor.execute(query, (srcport, dstport, srcip, dstip, dstport, srcport, dstip, srcip))
func_map_results = cursor.fetchall()

print(f"\nStep 1: Found {len(func_map_results)} Receive FuncMap entries")
if func_map_results:
    for i, fm in enumerate(func_map_results[:3]):
        print(f"  [{i+1}] time={fm[0]}, id={fm[2]}, pid={fm[3]}, srcport={fm[5]}, dstport={fm[6]}")
        
        # Step 2: Find Special Call
        time_start = fm[0]
        pid_now = fm[3]
        cursor.execute("""
            SELECT time, isret, id, pid FROM SpecfunctionCall 
            WHERE id > 299999 AND pid = %s AND time < %s AND isret = 0
            ORDER BY time DESC LIMIT 1
        """, (pid_now, time_start))
        special_calls = cursor.fetchall()
        
        if special_calls:
            sc = special_calls[0]
            print(f"    -> Special Call found: id={sc[2]}, time={sc[0]}")
            
            # Step 3: Find Return Call
            sc_time = sc[0]
            sc_id = sc[2]
            cursor.execute("""
                SELECT time, isret, id, pid FROM functionCall 
                WHERE time > %s AND isret = 1 AND id = %s AND pid = %s
                ORDER BY time ASC LIMIT 1
            """, (sc_time, sc_id, pid_now))
            return_calls = cursor.fetchall()
            
            if return_calls:
                rc = return_calls[0]
                print(f"    -> Return Call found: id={rc[2]}, time={rc[0]}")
            else:
                print(f"    -> No Return Call found for id={sc_id}, pid={pid_now}")
        else:
            print(f"    -> No Special Call found for pid={pid_now}")
else:
    print("  No FuncMap entries found")

# Step 1: Find Send FunctionMap entries
query = """
    SELECT time, isret, id, pid, family, srcport, dstport, srcip, dstip, pkt
    FROM SpecfunctionCall 
    WHERE id IN (200002, 200003, 200004, 200005, 200006, 200007) AND isret = 0 
    AND ((srcport = %s AND dstport = %s AND srcip = %s AND dstip = %s) 
         OR (srcport = %s AND dstport = %s AND srcip = %s AND dstip = %s))
    ORDER BY time DESC
"""
cursor.execute(query, (srcport, dstport, srcip, dstip, dstport, srcport, dstip, srcip))
send_results = cursor.fetchall()

print(f"\nStep 2: Found {len(send_results)} Send FuncMap entries")
if send_results:
    for i, fm in enumerate(send_results[:3]):
        print(f"  [{i+1}] time={fm[0]}, id={fm[2]}, pid={fm[3]}, srcport={fm[5]}, dstport={fm[6]}")
else:
    print("  No Send FuncMap entries found")

cursor.close()
conn.close()
