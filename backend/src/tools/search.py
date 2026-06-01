import os
from src.config import TAVILY_API_KEY

def get_tavily_tool():
    """Lazily load and construct the Tavily Search tool if the API key is configured."""
    if TAVILY_API_KEY:
        from langchain_tavily import TavilySearch
        os.environ.setdefault("TAVILY_API_KEY", TAVILY_API_KEY)
        # Return a standard TavilySearch tool instance
        return TavilySearch(max_results=5, topic="general")
    return None
