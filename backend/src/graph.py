"""LangGraph graph — entry point for LangGraph Server.

The auth handler (auth.py) injects user_profile into the runtime context.
This module accesses it via RunnableConfig and passes it to the agent's
system prompt for personalized routing.
"""
from src.agent import agent
from src.auth import auth

# Bind auth to the agent
agent.auth = auth

app = agent
