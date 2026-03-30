"""
PacketScope Guarder API Client

This module provides a Python client for interacting with the Guarder API.
"""

import requests
import json
from typing import List, Dict, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum


class Protocol(Enum):
    TCP = "tcp"
    UDP = "udp"
    ICMP = "icmp"
    ANY = "any"


class Action(Enum):
    ALLOW = "allow"
    DROP = "drop"


class RuleType(Enum):
    BASIC = "basic"
    TCP = "tcp"
    UDP = "udp"
    ICMP = "icmp"


class AnalyzeType(Enum):
    SECURITY = "security"
    PERFORMANCE = "performance"
    CUSTOM = "custom"


@dataclass
class FilterRule:
    """Filter rule configuration"""
    src_ip: str = "any"
    dst_ip: str = "any"
    src_port: int = 0
    dst_port: int = 0
    protocol: str = "any"
    action: str = "drop"
    enabled: bool = True
    rule_type: str = "basic"
    comment: str = ""
    icmp_type: Optional[int] = None
    icmp_code: Optional[int] = None
    tcp_flags: Optional[int] = None
    tcp_flags_mask: Optional[int] = None
    inner_src_ip: Optional[str] = None
    inner_dst_ip: Optional[str] = None
    inner_protocol: Optional[str] = None
    id: Optional[int] = None


@dataclass
class AIConfig:
    """AI configuration"""
    provider: str = "openai"
    openai_endpoint: str = "https://api.openai.com/v1/chat/completions"
    api_key: str = ""
    model: str = "gpt-3.5-turbo"
    temperature: float = 0.7
    debug: bool = False
    timeout: int = 120
    anthropic_version: str = "2023-06-01"


@dataclass
class AIAnalyzeRequest:
    """AI analysis request"""
    custom_prompt: str = ""
    analyze_type: str = "security"
    include_icmp: bool = True
    include_tcp: bool = True
    include_stats: bool = True


class GuarderClient:
    """Client for Guarder API"""
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    # ============ Connection Monitoring ============
    
    def get_connections(self) -> List[Dict[str, Any]]:
        """
        Get all active TCP/UDP connections.
        
        Returns:
            List of connection entries with key and info fields.
        """
        resp = self.session.get(f"{self.base_url}/api/connections")
        resp.raise_for_status()
        return resp.json()
    
    def get_icmp_entries(self) -> List[Dict[str, Any]]:
        """
        Get all ICMP traffic entries.
        
        Returns:
            List of ICMP entries with key and info fields.
        """
        resp = self.session.get(f"{self.base_url}/api/icmp")
        resp.raise_for_status()
        return resp.json()
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get performance statistics.
        
        Returns:
            Statistics including packet counts, TCP metrics, ICMP counts.
        """
        resp = self.session.get(f"{self.base_url}/api/stats")
        resp.raise_for_status()
        return resp.json()
    
    # ============ Filter Rules Management ============
    
    def list_filters(self) -> List[Dict[str, Any]]:
        """
        Get all filter rules.
        
        Returns:
            List of filter rules.
        """
        resp = self.session.get(f"{self.base_url}/api/filters")
        resp.raise_for_status()
        return resp.json()
    
    def get_filter(self, rule_id: int) -> Dict[str, Any]:
        """
        Get a specific filter rule.
        
        Args:
            rule_id: The ID of the rule to get.
            
        Returns:
            Filter rule details.
        """
        resp = self.session.get(f"{self.base_url}/api/filters/{rule_id}")
        resp.raise_for_status()
        return resp.json()
    
    def create_filter(self, rule: FilterRule) -> Dict[str, Any]:
        """
        Create a new filter rule.
        
        Args:
            rule: The filter rule to create.
            
        Returns:
            Created filter rule with assigned ID.
        """
        data = {k: v for k, v in asdict(rule).items() if v is not None}
        resp = self.session.post(
            f"{self.base_url}/api/filters",
            json=data
        )
        resp.raise_for_status()
        return resp.json()
    
    def update_filter(self, rule_id: int, rule: FilterRule) -> Dict[str, Any]:
        """
        Update an existing filter rule.
        
        Args:
            rule_id: The ID of the rule to update.
            rule: Updated filter rule data.
            
        Returns:
            Updated filter rule.
        """
        data = {k: v for k, v in asdict(rule).items() if v is not None}
        resp = self.session.put(
            f"{self.base_url}/api/filters/{rule_id}",
            json=data
        )
        resp.raise_for_status()
        return resp.json()
    
    def delete_filter(self, rule_id: int) -> bool:
        """
        Delete a filter rule.
        
        Args:
            rule_id: The ID of the rule to delete.
            
        Returns:
            True if deletion was successful.
        """
        resp = self.session.delete(f"{self.base_url}/api/filters/{rule_id}")
        resp.raise_for_status()
        return resp.status_code == 204
    
    def enable_filter(self, rule_id: int) -> bool:
        """
        Enable a filter rule.
        
        Args:
            rule_id: The ID of the rule to enable.
            
        Returns:
            True if operation was successful.
        """
        resp = self.session.post(f"{self.base_url}/api/filters/{rule_id}/enable")
        resp.raise_for_status()
        return resp.status_code == 200
    
    def disable_filter(self, rule_id: int) -> bool:
        """
        Disable a filter rule.
        
        Args:
            rule_id: The ID of the rule to disable.
            
        Returns:
            True if operation was successful.
        """
        resp = self.session.post(f"{self.base_url}/api/filters/{rule_id}/disable")
        resp.raise_for_status()
        return resp.status_code == 200
    
    # ============ AI Configuration ============
    
    def get_ai_status(self) -> Dict[str, Any]:
        """
        Get AI configuration status.
        
        Returns:
            Status showing if AI is configured (has API key, endpoint, model).
        """
        resp = self.session.get(f"{self.base_url}/api/ai/status")
        resp.raise_for_status()
        return resp.json()
    
    def get_ai_config(self) -> Dict[str, Any]:
        """
        Get current AI configuration (without API key).
        
        Returns:
            AI configuration settings.
        """
        resp = self.session.get(f"{self.base_url}/api/ai/config")
        resp.raise_for_status()
        return resp.json()
    
    def update_ai_config(self, config: AIConfig) -> Dict[str, Any]:
        """
        Update AI configuration.
        
        Args:
            config: New AI configuration.
            
        Returns:
            Success status message.
        """
        resp = self.session.post(
            f"{self.base_url}/api/ai/config",
            json=asdict(config)
        )
        resp.raise_for_status()
        return resp.json()
    
    # ============ AI Analysis & Generation ============
    
    def ai_generate_filters(
        self,
        custom_prompt: str = "",
        analyze_type: str = "security",
        include_icmp: bool = True,
        include_tcp: bool = True,
        include_stats: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze current network traffic and generate filter rules using AI.
        
        Args:
            custom_prompt: Custom instructions for the AI.
            analyze_type: "security", "performance", or "custom".
            include_icmp: Include ICMP data in analysis.
            include_tcp: Include TCP/UDP connection data in analysis.
            include_stats: Include performance statistics in analysis.
            
        Returns:
            Generated filters, analysis summary, and suggestions.
        """
        data = {
            "custom_prompt": custom_prompt,
            "analyze_type": analyze_type,
            "include_icmp": include_icmp,
            "include_tcp": include_tcp,
            "include_stats": include_stats
        }
        resp = self.session.post(f"{self.base_url}/api/ai/generate", json=data)
        resp.raise_for_status()
        return resp.json()
    
    def ai_analyze(
        self,
        custom_prompt: str = "",
        include_icmp: bool = True,
        include_tcp: bool = True,
        include_stats: bool = True
    ) -> Dict[str, Any]:
        """
        Get AI analysis of current network connections.
        
        Args:
            custom_prompt: Custom instructions for the AI.
            include_icmp: Include ICMP data in analysis.
            include_tcp: Include TCP/UDP connection data in analysis.
            include_stats: Include performance statistics in analysis.
            
        Returns:
            AI analysis summary.
        """
        data = {
            "custom_prompt": custom_prompt,
            "include_icmp": include_icmp,
            "include_tcp": include_tcp,
            "include_stats": include_stats
        }
        resp = self.session.post(f"{self.base_url}/api/ai/analyze", json=data)
        resp.raise_for_status()
        return resp.json()
    
    # ============ PCAP Analysis ============
    
    def analyze_pcap(
        self,
        file_path: str,
        custom_prompt: str = "",
        analyze_type: str = "security"
    ) -> Dict[str, Any]:
        """
        Upload and analyze a PCAP file using AI.
        
        Args:
            file_path: Path to the PCAP file.
            custom_prompt: Custom instructions for the AI.
            analyze_type: "security", "performance", or "custom".
            
        Returns:
            Analysis results including threats, statistics, and suggestions.
        """
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {
                'custom_prompt': custom_prompt,
                'analyze_type': analyze_type
            }
            resp = self.session.post(
                f"{self.base_url}/api/pcap/analyze",
                files=files,
                data=data
            )
        resp.raise_for_status()
        return resp.json()
    
    def analyze_pcap_bytes(
        self,
        file_bytes: bytes,
        filename: str = "capture.pcap",
        custom_prompt: str = "",
        analyze_type: str = "security"
    ) -> Dict[str, Any]:
        """
        Analyze PCAP data from bytes using AI.
        
        Args:
            file_bytes: PCAP file content as bytes.
            filename: Name of the file.
            custom_prompt: Custom instructions for the AI.
            analyze_type: "security", "performance", or "custom".
            
        Returns:
            Analysis results including threats, statistics, and suggestions.
        """
        files = {'file': (filename, file_bytes, 'application/octet-stream')}
        data = {
            'custom_prompt': custom_prompt,
            'analyze_type': analyze_type
        }
        resp = self.session.post(
            f"{self.base_url}/api/pcap/analyze",
            files=files,
            data=data
        )
        resp.raise_for_status()
        return resp.json()


# ============== Convenience Functions ==============

def create_simple_filter(
    client: GuarderClient,
    src_ip: str = "any",
    dst_ip: str = "any",
    dst_port: int = 0,
    protocol: str = "any",
    action: str = "drop",
    comment: str = ""
) -> Dict[str, Any]:
    """
    Create a simple filter rule with minimal parameters.
    
    Args:
        client: GuarderClient instance
        src_ip: Source IP or "any"
        dst_ip: Destination IP or "any"
        dst_port: Destination port (0 = any)
        protocol: Protocol (tcp, udp, icmp, any)
        action: Action (allow, drop)
        comment: Rule description
        
    Returns:
        Created filter rule
    """
    rule = FilterRule(
        src_ip=src_ip,
        dst_ip=dst_ip,
        dst_port=dst_port,
        protocol=protocol,
        action=action,
        comment=comment,
        enabled=True
    )
    return client.create_filter(rule)


def block_ip(client: GuarderClient, ip: str, comment: str = "") -> Dict[str, Any]:
    """
    Block all traffic from/to an IP address.
    
    Args:
        client: GuarderClient instance
        ip: IP address to block
        comment: Optional comment
        
    Returns:
        Created filter rule
    """
    rule = FilterRule(
        src_ip=ip,
        protocol="any",
        action="drop",
        comment=comment or f"Block IP {ip}",
        enabled=True
    )
    return client.create_filter(rule)


def block_port(
    client: GuarderClient,
    port: int,
    protocol: str = "tcp",
    comment: str = ""
) -> Dict[str, Any]:
    """
    Block traffic to a specific port.
    
    Args:
        client: GuarderClient instance
        port: Port number to block
        protocol: Protocol (tcp, udp)
        comment: Optional comment
        
    Returns:
        Created filter rule
    """
    rule = FilterRule(
        dst_port=port,
        protocol=protocol,
        action="drop",
        comment=comment or f"Block port {port}/{protocol}",
        enabled=True
    )
    return client.create_filter(rule)


# ============== Example Usage ==============

if __name__ == "__main__":
    # Example usage
    client = GuarderClient("http://localhost:8080")
    
    # Get connections
    connections = client.get_connections()
    print(f"Active connections: {len(connections)}")
    
    # Get statistics
    stats = client.get_stats()
    print(f"Total packets: {stats.get('TotalPackets', 0)}")
    
    # Create a filter rule
    rule = FilterRule(
        src_ip="192.168.1.100",
        protocol="any",
        action="drop",
        comment="Block suspicious IP"
    )
    result = client.create_filter(rule)
    print(f"Created filter: {result}")
