import sys
from pathlib import Path

HERE = Path(__file__).resolve()
for parent in [HERE.parent, *HERE.parents]:
    if (parent / 'server').exists():
        sys.path.insert(0, str(parent))
        break


# This code adds the project folder to Python’s path so the tests can import the "server" package correctly.