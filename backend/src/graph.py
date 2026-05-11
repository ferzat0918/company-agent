"""LangGraph graph — entry point for LangGraph Server"""
from src.agent import agent
from src.auth import auth

agent.auth = auth
app = agent
