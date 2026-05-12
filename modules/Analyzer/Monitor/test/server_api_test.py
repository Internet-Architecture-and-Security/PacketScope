#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test cases for server API endpoints
"""

import json
import requests
import unittest
from unittest.mock import patch

SERVER_URL = "http://localhost:8010"

class TestServerAPI(unittest.TestCase):
    """Test cases for server API endpoints"""

    def test_get_recent_packet_post(self):
        """Test POST /GetRecentPacket endpoint"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345",
            "ipver": "4",
            "count": "10"
        }
        
        response = requests.post(f"{SERVER_URL}/GetRecentPacket", data=payload)
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON array
        result = response.json()
        self.assertIsInstance(result, list)

    def test_get_recent_packet_get(self):
        """Test GET /GetRecentPacket endpoint (should return error)"""
        response = requests.get(f"{SERVER_URL}/GetRecentPacket")
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_get_recent_packet_invalid_count(self):
        """Test POST /GetRecentPacket with invalid count parameter"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345",
            "ipver": "4",
            "count": "invalid"
        }
        
        response = requests.post(f"{SERVER_URL}/GetRecentPacket", data=payload)
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_get_recent_map_post(self):
        """Test POST /GetRecentMap endpoint"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345",
            "count": "5",
            "timeDownLimit": "1600000000.0"
        }
        
        response = requests.post(f"{SERVER_URL}/GetRecentMap", data=payload)
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON array
        result = response.json()
        self.assertIsInstance(result, list)

    def test_get_recent_map_get(self):
        """Test GET /GetRecentMap endpoint (should return error)"""
        response = requests.get(f"{SERVER_URL}/GetRecentMap")
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_get_recent_map_invalid_count(self):
        """Test POST /GetRecentMap with invalid count parameter"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345",
            "count": "invalid",
            "timeDownLimit": "1600000000.0"
        }
        
        response = requests.post(f"{SERVER_URL}/GetRecentMap", data=payload)
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_get_func_table(self):
        """Test GET /GetFuncTable endpoint"""
        response = requests.get(f"{SERVER_URL}/GetFuncTable")
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON
        try:
            result = response.json()
            self.assertIsInstance(result, (dict, list))
        except json.JSONDecodeError:
            self.fail("Response is not valid JSON")

    def test_query_func_send_post(self):
        """Test POST /QueryFuncSend endpoint"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345"
        }
        
        response = requests.post(f"{SERVER_URL}/QueryFuncSend", data=payload)
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON array
        result = response.json()
        self.assertIsInstance(result, list)

    def test_query_func_send_get(self):
        """Test GET /QueryFuncSend endpoint (should return error)"""
        response = requests.get(f"{SERVER_URL}/QueryFuncSend")
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_query_func_recv_post(self):
        """Test POST /QueryFuncRecv endpoint"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345"
        }
        
        response = requests.post(f"{SERVER_URL}/QueryFuncRecv", data=payload)
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON array
        result = response.json()
        self.assertIsInstance(result, list)

    def test_query_func_recv_get(self):
        """Test GET /QueryFuncRecv endpoint (should return error)"""
        response = requests.get(f"{SERVER_URL}/QueryFuncRecv")
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_query_packet_post(self):
        """Test POST /QueryPacket endpoint"""
        payload = {
            "srcip": "192.168.1.1",
            "dstip": "192.168.1.2",
            "srcport": "80",
            "dstport": "12345",
            "ipver": "4"
        }
        
        response = requests.post(f"{SERVER_URL}/QueryPacket", data=payload)
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON array
        result = response.json()
        self.assertIsInstance(result, list)

    def test_query_packet_get(self):
        """Test GET /QueryPacket endpoint (should return error)"""
        response = requests.get(f"{SERVER_URL}/QueryPacket")
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, 400)
        
        # Should return error message
        result = response.json()
        self.assertIn("error", result)

    def test_query_sock_list(self):
        """Test GET /QuerySockList endpoint"""
        response = requests.get(f"{SERVER_URL}/QuerySockList")
        
        # Should return 200 OK
        self.assertEqual(response.status_code, 200)
        
        # Should return JSON
        try:
            result = response.json()
            self.assertIsInstance(result, (dict, list))
        except json.JSONDecodeError:
            self.fail("Response is not valid JSON")


if __name__ == "__main__":
    print("Running server API tests...")
    print(f"Testing against server: {SERVER_URL}")
    print("Note: Make sure the server is running before executing tests\n")
    unittest.main()
