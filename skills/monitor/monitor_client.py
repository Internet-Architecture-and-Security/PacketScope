"""
PacketScope Monitor API Client

This module provides a Python client for interacting with the Monitor API.
"""

import requests
from typing import List, Dict, Optional, Any
from dataclasses import dataclass


@dataclass
class PacketQuery:
    """Packet query parameters"""
    src_ip: str = ""
    dst_ip: str = ""
    src_port: str = ""
    dst_port: str = ""
    ip_ver: str = ""
    count: str = ""
    time_down_limit: str = ""


class MonitorClient:
    """Client for Monitor API"""
    
    def __init__(self, base_url: str = "http://localhost:8010"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    # ============ Packet Queries ============
    
    def get_recent_packets(
        self,
        src_ip: str = "",
        dst_ip: str = "",
        src_port: str = "",
        dst_port: str = "",
        ip_ver: str = "",
        count: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Get recent network packets with optional filters.
        
        Args:
            src_ip: Source IP address filter
            dst_ip: Destination IP address filter
            src_port: Source port filter
            dst_port: Destination port filter
            ip_ver: IP version ("4" or "6")
            count: Number of packets to return
            
        Returns:
            List of packet entries.
        """
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        if ip_ver: data["ipver"] = ip_ver
        if count: data["count"] = count
        
        resp = self.session.post(f"{self.base_url}/GetRecentPacket", data=data)
        resp.raise_for_status()
        return resp.json()
    
    def query_packets(
        self,
        src_ip: str = "",
        dst_ip: str = "",
        src_port: str = "",
        dst_port: str = "",
        ip_ver: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Query packets matching specific criteria.
        
        Args:
            src_ip: Source IP address filter
            dst_ip: Destination IP address filter
            src_port: Source port filter
            dst_port: Destination port filter
            ip_ver: IP version ("4" or "6")
            
        Returns:
            List of packet entries.
        """
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        if ip_ver: data["ipver"] = ip_ver
        
        resp = self.session.post(f"{self.base_url}/QueryPacket", data=data)
        resp.raise_for_status()
        return resp.json()
    
    # ============ Function Call Tracking ============
    
    def get_recent_map(
        self,
        src_ip: str = "",
        dst_ip: str = "",
        src_port: str = "",
        dst_port: str = "",
        count: str = "",
        time_down_limit: str = ""
    ) -> List[Any]:
        """
        Get recent function call mappings.
        
        Args:
            src_ip: Source IP address filter
            dst_ip: Destination IP address filter
            src_port: Source port filter
            dst_port: Destination port filter
            count: Number of entries to return
            time_down_limit: Minimum timestamp
            
        Returns:
            List of function call entries.
        """
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        if count: data["count"] = count
        if time_down_limit: data["timeDownLimit"] = time_down_limit
        
        resp = self.session.post(f"{self.base_url}/GetRecentMap", data=data)
        resp.raise_for_status()
        return resp.json()
    
    def get_func_table(self) -> Dict[str, str]:
        """
        Get function ID to name mapping.
        
        Returns:
            Dictionary mapping function IDs to names.
        """
        resp = self.session.get(f"{self.base_url}/GetFuncTable")
        resp.raise_for_status()
        return resp.json()
    
    def query_func_send(
        self,
        src_ip: str = "",
        dst_ip: str = "",
        src_port: str = "",
        dst_port: str = ""
    ) -> List[Any]:
        """
        Query function calls related to send operations.
        
        Args:
            src_ip: Source IP address filter
            dst_ip: Destination IP address filter
            src_port: Source port filter
            dst_port: Destination port filter
            
        Returns:
            List of function call entries.
        """
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        
        resp = self.session.post(f"{self.base_url}/QueryFuncSend", data=data)
        resp.raise_for_status()
        return resp.json()
    
    def query_func_recv(
        self,
        src_ip: str = "",
        dst_ip: str = "",
        src_port: str = "",
        dst_port: str = ""
    ) -> List[Any]:
        """
        Query function calls related to receive operations.
        
        Args:
            src_ip: Source IP address filter
            dst_ip: Destination IP address filter
            src_port: Source port filter
            dst_port: Destination port filter
            
        Returns:
            List of function call entries.
        """
        data = {}
        if src_ip: data["srcip"] = src_ip
        if dst_ip: data["dstip"] = dst_ip
        if src_port: data["srcport"] = src_port
        if dst_port: data["dstport"] = dst_port
        
        resp = self.session.post(f"{self.base_url}/QueryFuncRecv", data=data)
        resp.raise_for_status()
        return resp.json()
    
    # ============ Socket Monitoring ============
    
    def get_socket_list(self) -> Dict[str, List[Any]]:
        """
        Get current network socket list.
        
        Returns:
            Dictionary with socket types as keys and lists of socket entries as values.
        """
        resp = self.session.get(f"{self.base_url}/QuerySockList")
        resp.raise_for_status()
        return resp.json()
    
    # ============ Status Check ============
    
    def is_attach_finished(self) -> bool:
        """
        Check if eBPF probes are attached.
        
        Returns:
            True if probes are attached.
        """
        resp = self.session.get(f"{self.base_url}/IsAttachFinished")
        resp.raise_for_status()
        result = resp.json()
        return bool(result[0]) if result else False


# ============== Convenience Functions ==============

def get_established_tcp_sockets(client: MonitorClient) -> List[List[Any]]:
    """
    Get all established TCP IPv4 sockets.
    
    Args:
        client: MonitorClient instance
        
    Returns:
        List of established TCP sockets
    """
    sockets = client.get_socket_list()
    if sockets is None:
        return []
    if isinstance(sockets, list):
        return [sock for sock in sockets if len(sock) > 4 and "ESTABLISHED" in sock[4]]
    if isinstance(sockets, dict):
        tcp_sockets = sockets.get("tcpipv4", [])
        return [sock for sock in tcp_sockets if len(sock) > 4 and "ESTABLISHED" in sock[4]]
    return []


def get_function_name(client: MonitorClient, func_id: int) -> Optional[str]:
    """
    Get function name from function ID.
    
    Args:
        client: MonitorClient instance
        func_id: Function ID to lookup
        
    Returns:
        Function name or None if not found
    """
    func_table = client.get_func_table()
    if func_table is None:
        return None
    entry = func_table.get(str(func_id))
    if entry is None:
        return None
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict) and "name" in entry:
        return entry["name"]
    return str(entry)


# ============== Example Usage ==============

if __name__ == "__main__":
    # Example usage
    client = MonitorClient("http://localhost:8010")
    
    # Check if attached
    attached = client.is_attach_finished()
    print(f"Probes attached: {attached}")
    
    # Get recent packets
    packets = client.get_recent_packets(count="5")
    print(f"Recent packets: {len(packets)}")
    
    # Get socket list
    sockets = client.get_socket_list()
    print(f"TCP IPv4 sockets: {len(sockets.get('tcpipv4', []))}")
    
    # Get function table
    func_table = client.get_func_table()
    print(f"Function table entries: {len(func_table)}")
