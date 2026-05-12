#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test cases for database tables and data status
"""

import os
import unittest
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

class TestDatabaseTables(unittest.TestCase):
    """Test cases for database tables and data status"""
    
    def setUp(self):
        """Set up database connection before each test"""
        # Get database connection parameters from environment variables
        self.db_params = {
            "host": os.getenv("PG_HOST", "localhost"),
            "port": os.getenv("PG_PORT", "5432"),
            "user": os.getenv("PG_USER", "postgres"),
            "password": os.getenv("PG_PASSWORD", "password"),
            "dbname_function": os.getenv("PG_DBNAME_FUNCTION", "functioninfo"),
            "dbname_packet": os.getenv("PG_DBNAME_PACKET", "tcxprober")
        }
        
    def get_db_connection(self, dbname):
        """Get database connection for a specific database"""
        try:
            conn = psycopg2.connect(
                host=self.db_params["host"],
                port=self.db_params["port"],
                user=self.db_params["user"],
                password=self.db_params["password"],
                dbname=dbname
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            return conn
        except psycopg2.OperationalError as e:
            self.skipTest(f"Cannot connect to database {dbname}: {e}")
            return None

    def test_functioninfo_database_exists(self):
        """Test if functioninfo database exists"""
        # Connect to default postgres database to check if our database exists
        try:
            conn = psycopg2.connect(
                host=self.db_params["host"],
                port=self.db_params["port"],
                user=self.db_params["user"],
                password=self.db_params["password"],
                dbname="postgres"
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", 
                          (self.db_params["dbname_function"],))
            exists = cursor.fetchone()
            
            self.assertIsNotNone(exists, f"Database {self.db_params['dbname_function']} does not exist")
            
            cursor.close()
            conn.close()
        except psycopg2.OperationalError as e:
            self.skipTest(f"Cannot connect to postgres database: {e}")

    def test_tcxprober_database_exists(self):
        """Test if tcxprober database exists"""
        # Connect to default postgres database to check if our database exists
        try:
            conn = psycopg2.connect(
                host=self.db_params["host"],
                port=self.db_params["port"],
                user=self.db_params["user"],
                password=self.db_params["password"],
                dbname="postgres"
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", 
                          (self.db_params["dbname_packet"],))
            exists = cursor.fetchone()
            
            self.assertIsNotNone(exists, f"Database {self.db_params['dbname_packet']} does not exist")
            
            cursor.close()
            conn.close()
        except psycopg2.OperationalError as e:
            self.skipTest(f"Cannot connect to postgres database: {e}")

    def test_functionCall_table_exists(self):
        """Test if functionCall table exists in functioninfo database"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'functioncall'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table functionCall does not exist in functioninfo database")
        
        cursor.close()
        conn.close()

    def test_SpecfunctionCall_table_exists(self):
        """Test if SpecfunctionCall table exists in functioninfo database"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'specfunctioncall'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table SpecfunctionCall does not exist in functioninfo database")
        
        cursor.close()
        conn.close()

    def test_packets_table_exists(self):
        """Test if packets table exists in tcxprober database"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'packets'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table packets does not exist in tcxprober database")
        
        cursor.close()
        conn.close()

    def test_functionCall_table_structure(self):
        """Test structure of functionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'functioncall'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on kbatch.go
        expected_columns = [
            ('time', 'double precision'),
            ('isret', 'bigint'),
            ('id', 'bigint'),
            ('pid', 'integer')
        ]
        
        self.assertEqual(columns, expected_columns, "functionCall table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_SpecfunctionCall_table_structure(self):
        """Test structure of SpecfunctionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'specfunctioncall'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on kbatch.go
        expected_columns = [
            ('time', 'double precision'),
            ('isret', 'bigint'),
            ('id', 'bigint'),
            ('pid', 'integer'),
            ('family', 'bigint'),
            ('srcport', 'bigint'),
            ('dstport', 'bigint'),
            ('srcip', 'character varying'),
            ('dstip', 'character varying'),
            ('pkt', 'character varying')
        ]
        
        self.assertEqual(columns, expected_columns, "SpecfunctionCall table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_packets_table_structure(self):
        """Test structure of packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'packets'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on tcxprober.go
        expected_columns = [
            ('id', 'integer'),
            ('direction', 'bigint'),
            ('timestamp', 'bigint'),
            ('netifidx', 'bigint'),
            ('payloadlen', 'bigint'),
            ('payload', 'bytea')
        ]
        
        self.assertEqual(columns, expected_columns, "packets table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_functionCall_data_count(self):
        """Test data count in functionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM functionCall")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"functionCall table has {count} records")
        
        cursor.close()
        conn.close()

    def test_SpecfunctionCall_data_count(self):
        """Test data count in SpecfunctionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"SpecfunctionCall table has {count} records")
        
        cursor.close()
        conn.close()

    def test_packets_data_count(self):
        """Test data count in packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM packets")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"packets table has {count} records")
        
        cursor.close()
        conn.close()

    def test_functionCall_data_sample(self):
        """Test sample data from functionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM functionCall ORDER BY time DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 4, "functionCall row should have 4 columns")
            print(f"functionCall sample data: {rows}")
        
        cursor.close()
        conn.close()

    def test_SpecfunctionCall_data_sample(self):
        """Test sample data from SpecfunctionCall table"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM SpecfunctionCall ORDER BY time DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 10, "SpecfunctionCall row should have 10 columns")
            print(f"SpecfunctionCall sample data: {rows}")
        
        cursor.close()
        conn.close()

    def test_packets_data_sample(self):
        """Test sample data from packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM packets ORDER BY timestamp DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 6, "packets row should have 6 columns")
            print(f"packets sample data: {rows}")
        
        cursor.close()
        conn.close()

    # ============ New table tests for ipv4packets, ipv6packets, otherpackets ============

    def test_ipv4packets_table_exists(self):
        """Test if ipv4packets table exists in tcxprober database"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'ipv4packets'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table ipv4packets does not exist in tcxprober database")
        
        cursor.close()
        conn.close()

    def test_ipv6packets_table_exists(self):
        """Test if ipv6packets table exists in tcxprober database"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'ipv6packets'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table ipv6packets does not exist in tcxprober database")
        
        cursor.close()
        conn.close()

    def test_otherpackets_table_exists(self):
        """Test if otherpackets table exists in tcxprober database"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'otherpackets'
        """)
        exists = cursor.fetchone()
        
        self.assertIsNotNone(exists, "Table otherpackets does not exist in tcxprober database")
        
        cursor.close()
        conn.close()

    def test_ipv4packets_table_structure(self):
        """Test structure of ipv4packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ipv4packets'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on TcxProber.py and tcxProber.go
        expected_columns = [
            ('time', 'double precision'),
            ('netif', 'integer'),
            ('direction', 'integer'),
            ('length', 'integer'),
            ('content', 'text'),
            ('srcip', 'text'),
            ('dstip', 'text'),
            ('srcport', 'integer'),
            ('dstport', 'integer'),
            ('prot', 'integer'),
            ('ipid', 'integer'),
            ('ttl', 'integer'),
            ('frag', 'text'),
            ('option', 'text')
        ]
        
        self.assertEqual(columns, expected_columns, "ipv4packets table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_ipv6packets_table_structure(self):
        """Test structure of ipv6packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ipv6packets'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on TcxProber.py and tcxProber.go
        expected_columns = [
            ('time', 'double precision'),
            ('netif', 'integer'),
            ('direction', 'integer'),
            ('length', 'integer'),
            ('content', 'text'),
            ('srcip', 'text'),
            ('dstip', 'text'),
            ('header', 'integer'),
            ('srcport', 'integer'),
            ('dstport', 'integer')
        ]
        
        self.assertEqual(columns, expected_columns, "ipv6packets table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_otherpackets_table_structure(self):
        """Test structure of otherpackets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'otherpackets'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        # Expected columns based on TcxProber.py and tcxProber.go
        expected_columns = [
            ('time', 'double precision'),
            ('netif', 'integer'),
            ('direction', 'integer'),
            ('length', 'integer'),
            ('content', 'text')
        ]
        
        self.assertEqual(columns, expected_columns, "otherpackets table structure is incorrect")
        
        cursor.close()
        conn.close()

    def test_ipv4packets_data_count(self):
        """Test data count in ipv4packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ipv4packets")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"ipv4packets table has {count} records")
        
        cursor.close()
        conn.close()

    def test_ipv6packets_data_count(self):
        """Test data count in ipv6packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ipv6packets")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"ipv6packets table has {count} records")
        
        cursor.close()
        conn.close()

    def test_otherpackets_data_count(self):
        """Test data count in otherpackets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM otherpackets")
        count = cursor.fetchone()[0]
        
        # Just check that we can retrieve count, don't assert a specific value
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"otherpackets table has {count} records")
        
        cursor.close()
        conn.close()

    def test_ipv4packets_data_sample(self):
        """Test sample data from ipv4packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ipv4packets ORDER BY time DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 14, "ipv4packets row should have 14 columns")
            print(f"ipv4packets sample data: {rows}")
        
        cursor.close()
        conn.close()

    def test_ipv6packets_data_sample(self):
        """Test sample data from ipv6packets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ipv6packets ORDER BY time DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 10, "ipv6packets row should have 10 columns")
            print(f"ipv6packets sample data: {rows}")
        
        cursor.close()
        conn.close()

    def test_otherpackets_data_sample(self):
        """Test sample data from otherpackets table"""
        conn = self.get_db_connection(self.db_params["dbname_packet"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM otherpackets ORDER BY time DESC LIMIT 5")
        rows = cursor.fetchall()
        
        # Check if we can retrieve sample data (if any exists)
        if rows:
            self.assertEqual(len(rows[0]), 5, "otherpackets row should have 5 columns")
            print(f"otherpackets sample data: {rows}")
        
        cursor.close()
        conn.close()

    # ============ FunctionMap 测试用例 ============

    def test_FunctionMap_recv_count(self):
        """Test count of receive FunctionMap entries (ID 200000, 200001)"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE ID IN (200000, 200001)")
        count = cursor.fetchone()[0]
        
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"Receive FunctionMap entries (ID 200000, 200001): {count} records")
        
        cursor.close()
        conn.close()

    def test_FunctionMap_send_count(self):
        """Test count of send FunctionMap entries (ID 200002-200007)"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007)")
        count = cursor.fetchone()[0]
        
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"Send FunctionMap entries (ID 200002-200007): {count} records")
        
        cursor.close()
        conn.close()

    def test_FunctionMap_special_calls_count(self):
        """Test count of special function calls (ID > 299999)"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE ID > 299999")
        count = cursor.fetchone()[0]
        
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"Special function calls (ID > 299999): {count} records")
        
        cursor.close()
        conn.close()

    def test_FunctionMap_unique_pids(self):
        """Test unique PIDs in FunctionMap entries"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT PID) FROM SpecfunctionCall WHERE ID IN (200000, 200001, 200002, 200003, 200004, 200005, 200006, 200007)")
        count = cursor.fetchone()[0]
        
        self.assertIsInstance(count, int, "Count should be an integer")
        print(f"Unique PIDs in FunctionMap entries: {count}")
        
        cursor.close()
        conn.close()

    def test_FunctionMap_analysis(self):
        """Analyze FunctionMap data and count valid mappings"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Count valid receive mappings (with matching special calls)
        cursor.execute("""
            SELECT COUNT(DISTINCT s1.PID) 
            FROM SpecfunctionCall s1
            WHERE s1.ID IN (200000, 200001)
            AND EXISTS (
                SELECT 1 FROM SpecfunctionCall s2 
                WHERE s2.ID > 299999 
                AND s2.PID = s1.PID 
                AND s2.time < s1.time
            )
        """)
        valid_recv = cursor.fetchone()[0]
        
        # Count valid send mappings (with matching return calls)
        cursor.execute("""
            SELECT COUNT(DISTINCT s1.PID) 
            FROM SpecfunctionCall s1
            WHERE s1.ID IN (200002, 200003, 200004, 200005, 200006, 200007)
            AND EXISTS (
                SELECT 1 FROM functionCall f 
                WHERE f.isRet = 1 
                AND f.ID = s1.ID 
                AND f.PID = s1.PID 
                AND f.time > s1.time
            )
        """)
        valid_send = cursor.fetchone()[0]
        
        # Get overall statistics
        cursor.execute("SELECT COUNT(*) FROM SpecfunctionCall WHERE ID >= 200000 AND ID < 300000")
        total_maps = cursor.fetchone()[0]
        
        print(f"\n=== FunctionMap Analysis ===")
        print(f"Total FunctionMap entries (ID 200000-299999): {total_maps}")
        print(f"Valid receive mappings (with matching special calls): {valid_recv}")
        print(f"Valid send mappings (with matching return calls): {valid_send}")
        
        self.assertIsInstance(valid_recv, int)
        self.assertIsInstance(valid_send, int)
        
        cursor.close()
        conn.close()

    def test_FunctionMap_sample_data(self):
        """Test sample data from FunctionMap entries"""
        conn = self.get_db_connection(self.db_params["dbname_function"])
        if not conn:
            return
            
        cursor = conn.cursor()
        
        # Get sample receive FunctionMap entries
        cursor.execute("SELECT * FROM SpecfunctionCall WHERE ID IN (200000, 200001) ORDER BY time DESC LIMIT 10")
        recv_samples = cursor.fetchall()
        
        print(f"\n=== FunctionMap Sample Data ===")
        print(f"Receive FunctionMap samples (ID 200000, 200001): {len(recv_samples)} records")
        if recv_samples:
            print("Sample entry format: (time, isRet, ID, PID, family, srcport, dstport, srcip, dstip, pkt)")
            for sample in recv_samples[:3]:
                print(f"  {sample}")
        
        # Get sample send FunctionMap entries
        cursor.execute("SELECT * FROM SpecfunctionCall WHERE ID IN (200002, 200003, 200004, 200005, 200006, 200007) ORDER BY time DESC LIMIT 10")
        send_samples = cursor.fetchall()
        
        print(f"\nSend FunctionMap samples (ID 200002-200007): {len(send_samples)} records")
        if send_samples:
            for sample in send_samples[:3]:
                print(f"  {sample}")
        
        # Get sample special calls
        cursor.execute("SELECT * FROM SpecfunctionCall WHERE ID > 299999 ORDER BY time DESC LIMIT 5")
        special_samples = cursor.fetchall()
        
        print(f"\nSpecial function calls (ID > 299999): {len(special_samples)} records")
        if special_samples:
            for sample in special_samples[:3]:
                print(f"  {sample}")
        
        cursor.close()
        conn.close()


if __name__ == "__main__":
    print("Running database table tests...")
    print("Note: Make sure PostgreSQL is running and accessible\n")
    unittest.main()
