import os
import json
import unittest
import subprocess
from pathlib import Path

class TestDescriptionLinks(unittest.TestCase):
    def setUp(self):
        self.root_dir = Path(__file__).resolve().parent.parent
        self.frontend_dir = self.root_dir / "frontend"
        self.test_script = self.frontend_dir / "test_description_links.mjs"

    def test_node_description_links_suite(self):
        """Run frontend Node.js description links test suite covering all 8 criteria."""
        self.assertTrue(self.test_script.exists(), "test_description_links.mjs must exist")
        result = subprocess.run(
            ["node", "--experimental-strip-types", "test_description_links.mjs"],
            cwd=str(self.frontend_dir),
            capture_output=True,
            text=True
        )
        self.assertEqual(
            result.returncode, 0,
            f"Node description link tests failed with code {result.returncode}:\n{result.stderr}\n{result.stdout}"
        )
        self.assertIn("pass 8", result.stdout, "All 8 tests must pass")

    def test_real_fallback_events_with_urls(self):
        """Verify real events with URLs in fallback_events.json are found and valid."""
        fallback_file = self.frontend_dir / "public" / "fallback_events.json"
        self.assertTrue(fallback_file.exists(), "fallback_events.json must exist")

        with open(fallback_file, "r", encoding="utf-8") as f:
            events = json.load(f)

        events_with_urls = [
            e for e in events if e.get("description") and ("http://" in e["description"] or "https://" in e["description"])
        ]
        self.assertGreater(len(events_with_urls), 0, "There must be real events with URLs in their descriptions")

        # Confirm specific known events exist in this list
        titles = [e.get("title", "") for e in events_with_urls]
        self.assertTrue(any("breakpoint" in t.lower() for t in titles), "Breakpoint event should have URLs")

if __name__ == "__main__":
    unittest.main()
