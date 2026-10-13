#!/usr/bin/env python3
"""Copy the Node sources into the Python package tree before building.

Keeps the repo single-source: the .ts files under src/ are the product; the
Python wheel embeds a copy under python/steam_mcp/node/ at build time.
"""

import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parents[1]
dst = root / "python" / "steam_mcp" / "node"

if dst.exists():
    shutil.rmtree(dst)
for sub in ("src", "docs", "keys"):
    shutil.copytree(root / sub, dst / sub)

print(f"synced node assets -> {dst}")