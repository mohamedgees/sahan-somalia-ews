"""AI insight cache and per-IP rate limiting for the DeepSeek-backed endpoints.

The cache is bounded and TTL'd (LRU eviction beyond CACHE_MAX_ENTRIES) so a
single worker's memory can't grow unbounded. The rate limiter is a simple
sliding window per client IP, used to bound API spend from unauthenticated
callers of the insight endpoints.
"""

import threading
import time
from collections import OrderedDict, defaultdict, deque

from fastapi import HTTPException, Request

AI_INSIGHT_CACHE = OrderedDict()

CACHE_TTL = 3600 * 6  # 6 hours

CACHE_MAX_ENTRIES = 500

_cache_lock = threading.Lock()


def cache_get(key):
    with _cache_lock:
        entry = AI_INSIGHT_CACHE.get(key)
        if entry is None:
            return None
        if time.time() - entry["time"] >= CACHE_TTL:
            del AI_INSIGHT_CACHE[key]
            return None
        AI_INSIGHT_CACHE.move_to_end(key)
        return entry["data"]


def cache_set(key, data):
    with _cache_lock:
        AI_INSIGHT_CACHE[key] = {"time": time.time(), "data": data}
        AI_INSIGHT_CACHE.move_to_end(key)
        while len(AI_INSIGHT_CACHE) > CACHE_MAX_ENTRIES:
            AI_INSIGHT_CACHE.popitem(last=False)


INSIGHT_RATE_LIMIT = 10  # max requests...

INSIGHT_RATE_WINDOW = 60  # ...per this many seconds, per client IP

_insight_request_log = defaultdict(deque)

_rate_lock = threading.Lock()


def rate_limit_insights(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    with _rate_lock:
        q = _insight_request_log[client_ip]
        while q and now - q[0] > INSIGHT_RATE_WINDOW:
            q.popleft()
        if len(q) >= INSIGHT_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Too many AI insight requests — please wait a minute and try again.",
            )
        q.append(now)
