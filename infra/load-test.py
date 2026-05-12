"""
Company Agent 压力测试脚本
模拟多个并发用户同时与 agent 对话，测量响应时间和成功率
"""
import asyncio
import aiohttp
import time
import json
import statistics
import sys
import io

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# === 配置 ===
BASE_URL = "http://localhost:2024"
SUPABASE_URL = "http://localhost:8000"
AUTH_EMAIL = "Freddyferzat@gmail.com"
AUTH_PASSWORD = "Freddy918-"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.oAZkSZnYZ6iN4ycyHYA6WI81Qyx0VFqDyqrs9aEu8nk"
ASSISTANT_ID = "company_agent"
TEST_MESSAGE = "你好"

# 测试参数
CONCURRENCY_LEVELS = [1, 3, 5, 10]
TIMEOUT_SECONDS = 120


async def get_auth_token(session):
    async with session.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    ) as resp:
        data = await resp.json()
        return data["access_token"]


async def create_thread(session, token):
    async with session.post(
        f"{BASE_URL}/threads",
        json={"metadata": {}},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    ) as resp:
        data = await resp.json()
        return data["thread_id"]


async def send_message_and_wait(session, token, thread_id, message):
    """Send message via /threads/{id}/runs/stream with values stream mode"""
    start = time.time()
    first_token_time = None
    full_response = ""
    error = None

    body = {
        "assistant_id": ASSISTANT_ID,
        "input": {
            "messages": [
                {"type": "human", "content": message}
            ]
        },
        "stream_mode": ["values"],
        "stream_subgraphs": True,
    }

    try:
        async with session.post(
            f"{BASE_URL}/threads/{thread_id}/runs/stream",
            json=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS),
        ) as resp:
            if resp.status != 200:
                resp_text = await resp.text()
                error = f"HTTP {resp.status}: {resp_text[:200]}"
                return {
                    "success": False,
                    "error": error,
                    "total_time": time.time() - start,
                }

            async for line in resp.content:
                decoded = line.decode("utf-8", errors="ignore").strip()
                if decoded.startswith("data:"):
                    if first_token_time is None:
                        first_token_time = time.time() - start
                    data_str = decoded[5:].strip()
                    if data_str:
                        try:
                            chunk = json.loads(data_str)
                            if isinstance(chunk, dict) and "messages" in chunk:
                                msgs = chunk["messages"]
                                if isinstance(msgs, list):
                                    for m in msgs:
                                        if isinstance(m, dict) and m.get("type") == "ai":
                                            c = m.get("content", "")
                                            if isinstance(c, str):
                                                full_response = c
                        except (json.JSONDecodeError, IndexError):
                            pass

    except asyncio.TimeoutError:
        error = "TIMEOUT"
    except Exception as e:
        error = str(e)[:200]

    total_time = time.time() - start
    return {
        "success": error is None,
        "error": error,
        "total_time": round(total_time, 2),
        "first_token_time": round(first_token_time, 2) if first_token_time else None,
        "response_length": len(full_response),
    }


async def run_single_user(session, token, user_id):
    try:
        thread_id = await create_thread(session, token)
        result = await send_message_and_wait(session, token, thread_id, TEST_MESSAGE)
        result["user_id"] = user_id
        result["thread_id"] = thread_id
        return result
    except Exception as e:
        return {
            "user_id": user_id,
            "success": False,
            "error": str(e)[:200],
            "total_time": 0,
        }


async def run_load_test(concurrency):
    print(f"\n{'='*60}")
    print(f"  [*] Concurrent Users: {concurrency}")
    print(f"{'='*60}")

    async with aiohttp.ClientSession() as session:
        token = await get_auth_token(session)
        print(f"  [OK] Auth success")

        print(f"  [..] Starting {concurrency} users...")
        start = time.time()
        tasks = [run_single_user(session, token, i + 1) for i in range(concurrency)]
        results = await asyncio.gather(*tasks)
        wall_time = time.time() - start

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        print(f"\n  --- Results ---")
        print(f"  Success: {len(successes)}/{len(results)}")
        print(f"  Failed:  {len(failures)}/{len(results)}")
        print(f"  Wall:    {wall_time:.1f}s")

        if successes:
            times = [r["total_time"] for r in successes]
            first_tokens = [r["first_token_time"] for r in successes if r.get("first_token_time")]
            resp_lens = [r["response_length"] for r in successes]

            print(f"\n  Response Time:")
            print(f"    Min:    {min(times):.1f}s")
            print(f"    Max:    {max(times):.1f}s")
            print(f"    Avg:    {statistics.mean(times):.1f}s")
            if len(times) > 1:
                print(f"    Median: {statistics.median(times):.1f}s")

            if first_tokens:
                print(f"\n  First Token Latency:")
                print(f"    Min:    {min(first_tokens):.1f}s")
                print(f"    Max:    {max(first_tokens):.1f}s")
                print(f"    Avg:    {statistics.mean(first_tokens):.1f}s")

            print(f"\n  Response Length (chars):")
            print(f"    Avg:    {statistics.mean(resp_lens):.0f}")

        if failures:
            print(f"\n  Failures:")
            for f in failures:
                print(f"    User {f['user_id']}: {f.get('error', 'unknown')}")

        return {
            "concurrency": concurrency,
            "total": len(results),
            "success": len(successes),
            "failed": len(failures),
            "wall_time": round(wall_time, 1),
            "avg_time": round(statistics.mean([r["total_time"] for r in successes]), 1) if successes else 0,
        }


async def main():
    print("=" * 60)
    print("  Company Agent Load Test")
    print("=" * 60)
    print(f"  Target:      {BASE_URL}")
    print(f"  Message:     {TEST_MESSAGE}")
    print(f"  Timeout:     {TIMEOUT_SECONDS}s")
    print(f"  Levels:      {CONCURRENCY_LEVELS}")

    summary = []
    for level in CONCURRENCY_LEVELS:
        result = await run_load_test(level)
        summary.append(result)
        if level != CONCURRENCY_LEVELS[-1]:
            print(f"\n  [..] Cooldown 5s...")
            await asyncio.sleep(5)

    print(f"\n\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"  {'Conc':>4} | {'OK':>4} | {'Fail':>4} | {'Wall(s)':>8} | {'Avg(s)':>8}")
    print(f"  {'----':>4} | {'----':>4} | {'----':>4} | {'--------':>8} | {'--------':>8}")
    for s in summary:
        print(f"  {s['concurrency']:>4} | {s['success']:>4} | {s['failed']:>4} | {s['wall_time']:>8.1f} | {s['avg_time']:>8.1f}")

    max_ok = max((s for s in summary if s["failed"] == 0), key=lambda x: x["concurrency"], default=None)
    if max_ok:
        print(f"\n  Max stable concurrency: {max_ok['concurrency']} users")
    else:
        print(f"\n  WARNING: All levels had failures")


if __name__ == "__main__":
    asyncio.run(main())
