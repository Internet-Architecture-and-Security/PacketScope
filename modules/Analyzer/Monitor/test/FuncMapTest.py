#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FunctionMap chain analysis following GetRecentMaps logic
"""

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

class FuncMapChainAnalyzer:
    """Analyzer for FunctionMap chains following GetRecentMaps logic"""
    
    def __init__(self):
        self.db_params = {
            "host": os.getenv("PG_HOST", "localhost"),
            "port": os.getenv("PG_PORT", "5432"),
            "user": os.getenv("PG_USER", "postgres"),
            "password": os.getenv("PG_PASSWORD", "password"),
            "dbname": os.getenv("PG_DBNAME_FUNCTION", "functioninfo")
        }
        self.conn = None
        self.cursor = None
    
    def connect(self):
        """Connect to database"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_params["host"],
                port=self.db_params["port"],
                user=self.db_params["user"],
                password=self.db_params["password"],
                dbname=self.db_params["dbname"]
            )
            self.conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            self.cursor = self.conn.cursor()
            return True
        except psycopg2.OperationalError as e:
            print(f"Database connection failed: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
    
    def find_recv_chains(self, limit=3, srcport=None, dstport=None, srcip=None, dstip=None):
        """
        Find receive FunctionMap chains following GetRecentMaps logic:
        1. Find Receive FunctionMap (ID 200000, 200001)
        2. Find corresponding Special Call (ID > 299999) with same PID, before the map
        3. Find Return Call (isRet=1) with same PID and ID
        4. Get all function calls within the time window
        """
        if not self.cursor:
            return []
        
        chains = []
        
        # Step 1: Find Receive FunctionMap entries (similar to GetRecentMaps line 18)
        query = """
            SELECT time, isret, id, pid, family, srcport, dstport, srcip, dstip, pkt
            FROM SpecfunctionCall 
            WHERE id IN (200000, 200001) AND isret = 0
        """
        
        params = []
        conditions = []
        
        # Add optional filters (similar to GetRecentMaps line 18)
        if srcport is not None or dstport is not None or srcip is not None or dstip is not None:
            # Bidirectional matching: (srcport, dstport, srcip, dstip) OR (dstport, srcport, dstip, srcip)
            if srcport is not None and dstport is not None:
                conditions.append("(srcport = %s AND dstport = %s)")
                params.extend([srcport, dstport])
            
        if conditions:
            query += " AND " + " AND ".join(conditions)
        
        query += " ORDER BY time DESC"
        
        self.cursor.execute(query, params)
        func_map_results = self.cursor.fetchall()
        
        # Reverse to process from oldest to newest (similar to GetRecentMaps line 21)
        func_map_results.reverse()
        
        count = 0
        for func_map in func_map_results:
            if count >= limit:
                break
                
            time_start = func_map[0]
            id_now = func_map[2]
            pid_now = func_map[3]
            fm_srcport = func_map[5]
            fm_dstport = func_map[6]
            fm_srcip = func_map[7]
            fm_dstip = func_map[8]
            
            # Step 2: Find corresponding Special Call (ID > 299999) with same PID (line 29)
            self.cursor.execute("""
                SELECT time, isret, id, pid, family, srcport, dstport, srcip, dstip, pkt
                FROM SpecfunctionCall 
                WHERE id > 299999 AND pid = %s AND time < %s AND isret = 0
                ORDER BY time DESC
            """, (pid_now, time_start))
            
            special_calls = self.cursor.fetchall()
            
            if not special_calls:
                continue
            
            # Take the latest special call before this function map (line 34)
            special_call = special_calls[0]
            time_start_r = special_call[0]
            special_id = special_call[2]
            special_pid = special_call[3]
            
            # Step 3: Find Return Call (isRet=1) with same PID and ID (line 38)
            self.cursor.execute("""
                SELECT time, isret, id, pid
                FROM functionCall 
                WHERE time > %s AND isret = 1 AND id = %s AND pid = %s
                ORDER BY time ASC
            """, (time_start_r, special_id, special_pid))
            
            return_calls = self.cursor.fetchall()
            
            if not return_calls:
                continue
            
            # Take the first return call after special call (line 43)
            time_end = return_calls[0][0]
            
            # Step 4: Get all function calls within the time window (line 44-46)
            self.cursor.execute("""
                SELECT time, isret, id, pid
                FROM functionCall 
                WHERE time >= %s AND time <= %s AND pid = %s
                ORDER BY time ASC
            """, (time_start_r, time_end, special_pid))
            
            function_calls = self.cursor.fetchall()
            
            chains.append({
                'type': 'receive',
                'pid': pid_now,
                'recv_id': id_now,
                'special_id': special_id,
                'time_start_r': time_start_r,
                'time_end': time_end,
                'time_gap': time_end - time_start_r,
                'srcport': fm_srcport,
                'dstport': fm_dstport,
                'srcip': fm_srcip,
                'dstip': fm_dstip,
                'func_call_count': len(function_calls),
                'function_calls': function_calls
            })
            
            count += 1
        
        return chains
    
    def find_send_chains(self, limit=3, srcport=None, dstport=None, srcip=None, dstip=None):
        """
        Find send FunctionMap chains following GetRecentMaps logic:
        1. Find Send FunctionMap (ID 200002-200007)
        2. Find Return Call (isRet=1) with same PID and ID
        3. Get all function calls within the time window
        """
        if not self.cursor:
            return []
        
        chains = []
        
        # Step 1: Find Send FunctionMap entries (similar to GetRecentMaps line 50)
        query = """
            SELECT time, isret, id, pid, family, srcport, dstport, srcip, dstip, pkt
            FROM SpecfunctionCall 
            WHERE id IN (200002, 200003, 200004, 200005, 200006, 200007) AND isret = 0
        """
        
        params = []
        
        query += " ORDER BY time DESC"
        
        self.cursor.execute(query, params)
        func_map_results = self.cursor.fetchall()
        
        # Reverse to process from oldest to newest (similar to GetRecentMaps line 53)
        func_map_results.reverse()
        
        count = 0
        for func_map in func_map_results:
            if count >= limit:
                break
                
            time_start = func_map[0]
            id_now = func_map[2]
            pid_now = func_map[3]
            fm_srcport = func_map[5]
            fm_dstport = func_map[6]
            fm_srcip = func_map[7]
            fm_dstip = func_map[8]
            
            # Step 2: Find Return Call (isRet=1) with same PID and ID (line 61)
            self.cursor.execute("""
                SELECT time, isret, id, pid
                FROM functionCall 
                WHERE time > %s AND isret = 1 AND id = %s AND pid = %s
                ORDER BY time ASC
            """, (time_start, id_now, pid_now))
            
            return_calls = self.cursor.fetchall()
            
            if not return_calls:
                continue
            
            # Take the first return call after function map (line 67)
            time_end = return_calls[0][0]
            
            # Step 3: Get all function calls within the time window (line 68)
            self.cursor.execute("""
                SELECT time, isret, id, pid
                FROM functionCall 
                WHERE time >= %s AND time <= %s AND pid = %s
                ORDER BY time ASC
            """, (time_start, time_end, pid_now))
            
            function_calls = self.cursor.fetchall()
            
            chains.append({
                'type': 'send',
                'pid': pid_now,
                'send_id': id_now,
                'time_start': time_start,
                'time_end': time_end,
                'time_gap': time_end - time_start,
                'srcport': fm_srcport,
                'dstport': fm_dstport,
                'srcip': fm_srcip,
                'dstip': fm_dstip,
                'func_call_count': len(function_calls),
                'function_calls': function_calls
            })
            
            count += 1
        
        return chains
    
    def analyze_chains(self):
        """Main analysis function - Find chains following GetRecentMaps logic"""
        print("=" * 60)
        print("FunctionMap Chain Analysis")
        print("(Following GetRecentMaps logic)")
        print("=" * 60)
        
        # Find receive chains
        print("\n[1] Receive Chains")
        print("-" * 60)
        recv_chains = self.find_recv_chains(limit=3)
        
        if recv_chains:
            print(f"Found {len(recv_chains)} receive chains:")
            for i, chain in enumerate(recv_chains, 1):
                print(f"\nChain #{i}")
                print(f"  Type: Receive")
                print(f"  PID: {chain['pid']}")
                print(f"  Recv FuncMap ID: {chain['recv_id']}")
                print(f"  Special Call ID: {chain['special_id']}")
                print(f"  Time Window: {chain['time_start_r']:.6f} -> {chain['time_end']:.6f}")
                print(f"  Duration: {chain['time_gap']:.6f}s")
                print(f"  Port: {chain['srcport']} -> {chain['dstport']}")
                print(f"  IP: {chain['srcip']} -> {chain['dstip']}")
                print(f"  Function Calls in window: {chain['func_call_count']}")
                
                # Print first few function calls (similar to GetRecentMaps return)
                if chain['func_call_count'] > 0:
                    print("  Sample function calls:")
                    for j, fc in enumerate(chain['function_calls'][:3], 1):
                        print(f"    [{j}] time={fc[0]:.4f}, isRet={fc[1]}, ID={fc[2]}")
        else:
            print("No receive chains found")
        
        # Find send chains
        print("\n" + "=" * 60)
        print("[2] Send Chains")
        print("-" * 60)
        send_chains = self.find_send_chains(limit=3)
        
        if send_chains:
            print(f"Found {len(send_chains)} send chains:")
            for i, chain in enumerate(send_chains, 1):
                print(f"\nChain #{i}")
                print(f"  Type: Send")
                print(f"  PID: {chain['pid']}")
                print(f"  Send FuncMap ID: {chain['send_id']}")
                print(f"  Time Window: {chain['time_start']:.6f} -> {chain['time_end']:.6f}")
                print(f"  Duration: {chain['time_gap']:.6f}s")
                print(f"  Port: {chain['srcport']} -> {chain['dstport']}")
                print(f"  IP: {chain['srcip']} -> {chain['dstip']}")
                print(f"  Function Calls in window: {chain['func_call_count']}")
                
                # Print first few function calls
                if chain['func_call_count'] > 0:
                    print("  Sample function calls:")
                    for j, fc in enumerate(chain['function_calls'][:3], 1):
                        print(f"    [{j}] time={fc[0]:.4f}, isRet={fc[1]}, ID={fc[2]}")
        else:
            print("No send chains found")
        
        # Summary
        print("\n" + "=" * 60)
        print("[3] Summary")
        print("-" * 60)
        
        self.cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE id IN (200000, 200001)")
        recv_count = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE id IN (200002, 200003, 200004, 200005, 200006, 200007)")
        send_count = self.cursor.fetchone()[0]
        
        self.cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE id > 299999")
        special_count = self.cursor.fetchone()[0]
        
        print(f"Receive FuncMap entries (ID 200000, 200001): {recv_count}")
        print(f"Send FuncMap entries (ID 200002-200007): {send_count}")
        print(f"Special call entries (ID > 299999): {special_count}")
        print("=" * 60)

if __name__ == "__main__":
    analyzer = FuncMapChainAnalyzer()
    if analyzer.connect():
        try:
            analyzer.analyze_chains()
        finally:
            analyzer.close()
    else:
        print("Failed to connect to database. Exiting.")