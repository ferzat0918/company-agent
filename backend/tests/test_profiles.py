"""Tests for profiles table query"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from backend.src.profiles import get_profile, UserProfile


@pytest.mark.asyncio
async def test_get_profile_found():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "user_id": "uuid-1",
            "dept": "marketing",
            "role": "经理",
            "region": "cn",
        }
    ]

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        profile = await get_profile("uuid-1")
        assert profile is not None
        assert profile.dept == "marketing"
        assert profile.region == "cn"
        assert profile.role == "经理"


@pytest.mark.asyncio
async def test_get_profile_not_found():
    mock_response = MagicMock()
    mock_response.status_code = 404

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        profile = await get_profile("nonexistent")
        assert profile is None


@pytest.mark.asyncio
async def test_get_profile_empty_response():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = []

    with patch("httpx.AsyncClient.get", return_value=mock_response):
        profile = await get_profile("empty-uuid")
        assert profile is None
