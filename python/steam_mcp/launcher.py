"""Launch the steam-mcp MCP server.

The server itself is TypeScript (run natively by Node.js >= 26); this launcher
finds Node, attaches it to the current stdio, and replaces the Python process
with it. Nothing else happens here — all behavior lives in the bundled sources
under node/src/.
"""

import os
import shutil
import sys


def main() -> None:
    node = shutil.which("node")
    if node is None:
        sys.stderr.write(
            "steam-mcp: Node.js (>=26) is required to run the server. "
            "Install it from https://nodejs.org and retry.\n"
        )
        sys.exit(127)

    entry = os.path.join(os.path.dirname(os.path.abspath(__file__)), "node", "src", "index.ts")
    os.execv(node, [node, entry])


if __name__ == "__main__":
    main()