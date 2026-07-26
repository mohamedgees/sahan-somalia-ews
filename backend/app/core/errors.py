"""Shared error-response helper used by every router.

Logs the full exception server-side, but returns only a sanitized message to
the client so internal details (GEE tracebacks, file paths, etc.) never leak
in the response.
"""

import logging

logger = logging.getLogger("somalia_ews")


def api_error_response(e: Exception):
    logger.exception(f"Request failed: {e}")
    return {"error": "An internal error occurred while processing this request."}
