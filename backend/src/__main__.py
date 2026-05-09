"""Entry point: python -m backend"""
from .graph import app
if __name__ == "__main__":
    from langgraph.server import serve
    serve(app)
