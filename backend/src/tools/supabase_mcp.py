import json
from langchain_core.tools import tool
from src.mcp_db_server import handle_execute_query


@tool
def supabase_read_query(sql: str) -> str:
    """Execute a read-only SQL SELECT query against the Supabase database.
    You can query tables like:
      - fin_products (code, name, price, min_stock, max_stock, note)
      - fin_materials (code, name, unit_price, min_stock, max_stock, note)
      - fin_boms (id, product_code, material_code, qty, loss_rate, note)
      - fin_stock_moves (id, kind, code, move_type, qty, unit_price, platform, customer, ref_product_code, occurred_at)
      - fin_inventory (kind, code, name, min_stock, max_stock, in_qty, out_qty, stock)
    Example: SELECT * FROM fin_inventory WHERE stock <= min_stock;
    """
    try:
        result = handle_execute_query(sql)
        content = result.get("content", [])
        if content:
            return content[0].get("text", "No output returned.")
        return "No content returned."
    except Exception as e:
        return f"Database query error: {str(e)}"
