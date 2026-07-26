"""Tests for the AI insight cache (TTL + LRU eviction) and the per-IP
sliding-window rate limiter in app.core.cache. Pure Python — no GEE
credentials or network access needed."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core import cache as cache_module
from app.core.cache import cache_get, cache_set, rate_limit_insights


@pytest.fixture(autouse=True)
def reset_shared_state():
    """The cache and rate-limit log are module-level globals shared across
    requests in production — reset them before each test so tests don't
    leak state into one another."""
    cache_module.AI_INSIGHT_CACHE.clear()
    cache_module._insight_request_log.clear()
    yield
    cache_module.AI_INSIGHT_CACHE.clear()
    cache_module._insight_request_log.clear()


def make_request(ip="1.2.3.4"):
    return SimpleNamespace(client=SimpleNamespace(host=ip))


class TestCache:
    def test_get_on_missing_key_returns_none(self):
        assert cache_get("nope") is None

    def test_set_then_get_round_trips(self):
        cache_set("key1", {"situation": "normal"})
        assert cache_get("key1") == {"situation": "normal"}

    def test_expired_entry_returns_none_and_is_evicted(self, monkeypatch):
        cache_set("key1", {"a": 1})
        # Jump the clock forward past CACHE_TTL.
        real_time = cache_module.time.time
        monkeypatch.setattr(
            cache_module.time, "time", lambda: real_time() + cache_module.CACHE_TTL + 1
        )
        assert cache_get("key1") is None
        assert "key1" not in cache_module.AI_INSIGHT_CACHE

    def test_lru_eviction_beyond_max_entries(self, monkeypatch):
        monkeypatch.setattr(cache_module, "CACHE_MAX_ENTRIES", 3)
        cache_set("a", 1)
        cache_set("b", 2)
        cache_set("c", 3)
        cache_set("d", 4)  # should evict "a", the oldest
        assert cache_get("a") is None
        assert cache_get("b") == 2
        assert cache_get("d") == 4
        assert len(cache_module.AI_INSIGHT_CACHE) == 3

    def test_get_refreshes_recency_so_it_survives_eviction(self, monkeypatch):
        monkeypatch.setattr(cache_module, "CACHE_MAX_ENTRIES", 2)
        cache_set("a", 1)
        cache_set("b", 2)
        cache_get("a")  # "a" is now most-recently-used; "b" is now oldest
        cache_set("c", 3)  # should evict "b", not "a"
        assert cache_get("a") == 1
        assert cache_get("b") is None
        assert cache_get("c") == 3


class TestRateLimiter:
    def test_requests_within_limit_are_allowed(self):
        for _ in range(cache_module.INSIGHT_RATE_LIMIT):
            rate_limit_insights(make_request())  # should not raise

    def test_exceeding_limit_raises_429(self):
        for _ in range(cache_module.INSIGHT_RATE_LIMIT):
            rate_limit_insights(make_request())
        with pytest.raises(HTTPException) as exc_info:
            rate_limit_insights(make_request())
        assert exc_info.value.status_code == 429

    def test_different_ips_have_independent_limits(self):
        for _ in range(cache_module.INSIGHT_RATE_LIMIT):
            rate_limit_insights(make_request(ip="1.1.1.1"))
        # A different IP should still be allowed.
        rate_limit_insights(make_request(ip="2.2.2.2"))

    def test_old_requests_fall_out_of_the_window(self, monkeypatch):
        real_time = cache_module.time.time
        current = real_time()
        monkeypatch.setattr(cache_module.time, "time", lambda: current)
        for _ in range(cache_module.INSIGHT_RATE_LIMIT):
            rate_limit_insights(make_request())
        # Advance time past the window — the old timestamps should be pruned.
        monkeypatch.setattr(
            cache_module.time, "time", lambda: current + cache_module.INSIGHT_RATE_WINDOW + 1
        )
        rate_limit_insights(make_request())  # should not raise
