"""Puts src/ on the import path, so `pytest` works from the folder root.

The Test Suite imports the module under test the way the learner's own code
would — `from retrieval import chunk, retrieve` — and this is the one line of
plumbing that makes that work without installing anything. It is the Python
counterpart of the C# folders' <ProjectReference> from tests/ to src/.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
