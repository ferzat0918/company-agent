import sys
import json
import psycopg

def log(msg):
    sys.stderr.write(f"[MCP Database Server] {msg}\n")
    sys.stderr.flush()

class DatabaseJsonEncoder(json.JSONEncoder):
    def default(self, obj):
        import uuid
        from datetime import date, datetime
        from decimal import Decimal
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)  # Kept as string to preserve precision
        return super().default(obj)

def handle_execute_query(sql):
    sql_stripped = sql.strip().upper()
    # Enforce read-only constraint by allowing ONLY SELECT statements
    if not sql_stripped.startswith("SELECT"):
        return {"content": [{"type": "text", "text": "Error: Only SELECT statements are allowed (Read-Only mode)."}]}
        
    # Block access to LangGraph internal / system tables
    _BLOCKED_TABLES = {
        "CHECKPOINTS", "CHECKPOINT_BLOBS", "CHECKPOINT_MIGRATIONS", "CHECKPOINT_WRITES",
        "STORE", "STORE_MIGRATIONS", "CHANGELOG_ENTRIES", "APP_MIGRATIONS",
    }
    for tbl in _BLOCKED_TABLES:
        if tbl in sql_stripped:
            return {"content": [{"type": "text", "text": f"Error: Accessing system table '{tbl.lower()}' is strictly prohibited."}]}

    # Also keep a lowercase set for result-filtering (hide from schema discovery)
    _BLOCKED_LOWER = {t.lower() for t in _BLOCKED_TABLES}

    try:
        # Connect to local Postgres inside docker network using standard connection string
        conn = psycopg.connect('postgresql://postgres:dev-dev-dev-dev-dev-2026!!@postgres:5432/postgres')
        with conn.cursor() as cur:
            cur.execute(sql)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                results = [dict(zip(columns, row)) for row in rows]
                # Filter out any rows that reference blocked system tables
                # so the model can never discover them via information_schema / pg_tables etc.
                filtered = []
                for row in results:
                    row_vals = " ".join(str(v) for v in row.values()).lower()
                    if not any(bt in row_vals for bt in _BLOCKED_LOWER):
                        filtered.append(row)
                return {"content": [{"type": "text", "text": json.dumps(filtered, cls=DatabaseJsonEncoder, indent=2, ensure_ascii=False)}]}
            return {"content": [{"type": "text", "text": "Query executed successfully with no returned rows."}]}
    except Exception as e:
        return {"content": [{"type": "text", "text": f"Database error: {str(e)}"}]}

def main():
    log("Started and waiting for stdio JSON-RPC messages...")
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")
            
            if method == "initialize":
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "supabase-mcp-server", "version": "1.0"}
                    }
                }
            elif method == "notifications/initialized":
                continue
            elif method == "tools/list":
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": [
                            {
                                "name": "supabase_read_query",
                                "description": "Execute a read-only SELECT query against the Supabase database. Only SELECT queries are permitted.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "sql": {
                                            "type": "string",
                                            "description": "The SQL SELECT query string to execute. Example: SELECT * FROM fin_inventory LIMIT 10;"
                                        }
                                    },
                                    "required": ["sql"]
                                }
                            }
                        ]
                    }
                }
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name")
                arguments = params.get("arguments", {})
                
                if name == "supabase_read_query":
                    sql = arguments.get("sql", "")
                    result = handle_execute_query(sql)
                    resp = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": result
                    }
                else:
                    resp = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32601, "message": "Method not found"}
                    }
            else:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Method {method} not found"}
                }
                
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            log(f"Error handling request: {str(e)}")

if __name__ == "__main__":
    main()
