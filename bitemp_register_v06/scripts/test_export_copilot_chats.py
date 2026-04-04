import json
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("export-copilot-chats.py")
SPEC = spec_from_file_location("export_copilot_chats", SCRIPT_PATH)
MODULE = module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class ExportCopilotChatsTests(unittest.TestCase):
    def test_session_to_markdown_prefers_generated_title(self):
        session = {
            "creationDate": 1712232000000,
            "generatedTitle": "Nettere sessietitel",
            "_extracted_messages": [
                {"role": "user", "text": "eerste regel van de chat"},
                {"role": "assistant", "text": "antwoord"},
            ],
        }

        md = MODULE.session_to_markdown(session, "sessie-123")

        self.assertIn("# Chat: Nettere sessietitel", md)

    def test_find_workspace_storage_dirs_resolves_multiroot_workspace_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            storage_root = tmp_path / "workspaceStorage"
            ws_storage_dir = storage_root / "abc123"
            ws_storage_dir.mkdir(parents=True)

            workspace_file = tmp_path / "Workspaces" / "1775076652177" / "workspace.json"
            workspace_file.parent.mkdir(parents=True)
            workspace_file.write_text(
                json.dumps({"folders": [{"path": "D:/Git/Bitemporal_2026"}]}),
                encoding="utf-8",
            )

            workspace_uri = workspace_file.resolve().as_uri()
            (ws_storage_dir / "workspace.json").write_text(
                json.dumps({"workspace": workspace_uri}),
                encoding="utf-8",
            )

            with patch.object(MODULE.os.path, "expanduser", return_value=str(storage_root)):
                matches = MODULE.find_workspace_storage_dirs("Bitemporal_2026")

            self.assertEqual(matches, [str(ws_storage_dir)])


if __name__ == "__main__":
    unittest.main()
