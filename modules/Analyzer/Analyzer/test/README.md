# Server API and Database Tests

This directory contains Python test cases for:
1. Server API endpoints
2. Database tables and data status

## Prerequisites

1. Python 3.6 or higher
2. Required Python libraries: `requests` and `psycopg2-binary`
3. For API tests: The server must be running on `http://localhost:8010`
4. For database tests: PostgreSQL must be running and accessible

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Running Tests

### Server API Tests

```bash
# Run all API tests
python server_api_test.py

# Run specific API test case
python -m unittest server_api_test.TestServerAPI.test_get_recent_packet_post
```

### Database Tests

```bash
# Run all database tests
python database_test.py

# Run specific database test case
python -m unittest database_test.TestDatabaseTables.test_functionCall_table_exists
```

## API Test Coverage

### POST Endpoints
- `/GetRecentPacket` - Get recent packets with parameters validation
- `/GetRecentMap` - Get recent maps with parameters validation
- `/QueryFuncSend` - Query function send data
- `/QueryFuncRecv` - Query function receive data
- `/QueryPacket` - Query packet data

### GET Endpoints  
- `/GetFuncTable` - Get function table data
- `/QuerySockList` - Get socket list data

### Error Cases
- Invalid HTTP methods for POST-only endpoints
- Invalid parameters validation

## Database Test Coverage

### Database Existence
- Check if `functioninfo` database exists
- Check if `tcxprober` database exists

### Table Existence
- Check if `functionCall` table exists in `functioninfo` database
- Check if `SpecfunctionCall` table exists in `functioninfo` database
- Check if `packets` table exists in `tcxprober` database

### Table Structure
- Validate column names and data types for `functionCall` table
- Validate column names and data types for `SpecfunctionCall` table
- Validate column names and data types for `packets` table

### Data Status
- Verify data count retrieval for all tables
- Check sample data from all tables

## Test Structure

### API Tests
Each test case verifies:
1. Correct HTTP status code
2. Valid JSON response format
3. Parameter validation

### Database Tests
Each test case verifies:
1. Database/table existence
2. Proper table structure
3. Data accessibility

## Configuration

### API Tests
The server URL is configured in `server_api_test.py`:
```python
SERVER_URL = "http://localhost:8010"
```

### Database Tests
Database connection parameters are read from environment variables:
- `PG_HOST` - Database host (default: localhost)
- `PG_PORT` - Database port (default: 5432)
- `PG_USER` - Database user (default: postgres)
- `PG_PASSWORD` - Database password (default: empty)
- `PG_DBNAME_FUNCTION` - Function database name (default: functioninfo)
- `PG_DBNAME_PACKET` - Packet database name (default: tcxprober)

You can set these environment variables or modify the default values in the test file.
