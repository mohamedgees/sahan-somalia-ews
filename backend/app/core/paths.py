"""Filesystem anchors shared across the app.

Computed once here (at a known fixed depth: backend/app/core/paths.py) so
individual modules never have to re-derive `../..`-style relative paths from
their own `__file__` — which breaks silently whenever a file moves.
"""

import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

WATER_SOURCES_CSV = os.path.join(BACKEND_DIR, "water_sources.csv")

FLASH_FLOOD_DATA_DIR = os.path.join(PROJECT_ROOT, "flash floods base data")
