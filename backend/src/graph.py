"""LangGraph graph — entry point for LangGraph Server"""
from .agent import agent
from .auth import auth

agent.auth = auth
app = agent
