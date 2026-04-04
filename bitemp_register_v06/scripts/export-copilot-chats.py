#!/usr/bin/env python3
"""
Export VS Code Copilot Chat sessies naar leesbare Markdown bestanden.

Zoekt de JSONL chat-sessiebestanden in VS Code's workspace storage
en converteert ze naar Markdown in docs/copilot-chats/exports/.

Gebruik:
    python3 scripts/export-copilot-chats.py

Draait vanuit de root van bitemp_register_v06/.
"""

import json
import os
import sys
import glob
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse


def decode_file_uri(value: str) -> str:
    """Zet een file:// URI om naar een lokaal pad als dat nodig is."""
    if not isinstance(value, str):
        return ""
    if not value.startswith("file://"):
        return value

    parsed = urlparse(value)
    path = unquote(parsed.path or "")
    if re.match(r"^/[A-Za-z]:", path):
        path = path[1:]
    return path.replace("/", os.sep)


def workspace_contains_project(workspace_meta: dict, project_path: str) -> bool:
    """Check of een workspace naar dit project verwijst, ook bij multi-root workspaces."""
    needle = project_path.replace("\\", "/").lower().rstrip("/")
    candidate_paths = []

    for key in ("folder", "workspace"):
        value = workspace_meta.get(key)
        if isinstance(value, str):
            candidate_paths.append(decode_file_uri(value))

    for folder in workspace_meta.get("folders", []):
        if isinstance(folder, dict) and isinstance(folder.get("path"), str):
            candidate_paths.append(decode_file_uri(folder["path"]))

    workspace_ref = workspace_meta.get("workspace")
    workspace_file = decode_file_uri(workspace_ref) if isinstance(workspace_ref, str) else ""
    if workspace_file and os.path.isfile(workspace_file):
        try:
            with open(workspace_file, "r", encoding="utf-8") as wf:
                nested_workspace = json.load(wf)
            for folder in nested_workspace.get("folders", []):
                if isinstance(folder, dict) and isinstance(folder.get("path"), str):
                    candidate_paths.append(decode_file_uri(folder["path"]))
        except (json.JSONDecodeError, IOError):
            pass

    for candidate in candidate_paths:
        normalized = candidate.replace("\\", "/").lower().rstrip("/")
        if needle and needle in normalized:
            return True
    return False


def find_workspace_storage_dirs(project_path: str) -> list[str]:
    """Vind VS Code workspace storage directories voor dit project."""
    vscode_storage = os.path.expanduser(
        "~/Library/Application Support/Code/User/workspaceStorage"
    )
    if not os.path.isdir(vscode_storage):
        # Windows pad
        appdata = os.environ.get("APPDATA", "")
        vscode_storage = os.path.join(appdata, "Code", "User", "workspaceStorage")
    if not os.path.isdir(vscode_storage):
        # Linux pad
        vscode_storage = os.path.expanduser(
            "~/.config/Code/User/workspaceStorage"
        )
    if not os.path.isdir(vscode_storage):
        print("Kan VS Code workspace storage niet vinden.")
        return []

    matches = []
    for entry in os.listdir(vscode_storage):
        ws_json = os.path.join(vscode_storage, entry, "workspace.json")
        if os.path.isfile(ws_json):
            try:
                with open(ws_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if workspace_contains_project(data, project_path):
                    matches.append(os.path.join(vscode_storage, entry))
            except (json.JSONDecodeError, IOError):
                continue
    return sorted(set(matches))


def replay_jsonl_state(filepath: str) -> dict:
    """
    Replay een JSONL state-journal naar bruikbare conversatie-data.

    VS Code slaat chatsessies op als append-only JSONL:
    - kind=0: volledige snapshot (initieel, requests is meestal leeg)
    - kind=1: scalar patches (user input, titels, metadata)
    - kind=2: list patches (request markers, response parts)

    We extraheren user berichten en assistant responses uit de patches.
    """
    session_header = None
    messages = []
    current_response_parts = []
    latest_generated_title = ""

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            kind = obj.get("kind")
            v = obj.get("v")

            if kind == 0:
                session_header = v or {}
                for key in ("customTitle", "sessionTitle", "generatedTitle", "title"):
                    value = session_header.get(key, "")
                    if isinstance(value, str) and value.strip():
                        latest_generated_title = " ".join(value.split()).strip()
                        break
                continue

            if kind == 2 and isinstance(v, list):
                for item in v:
                    if not isinstance(item, dict):
                        continue
                    generated_title = item.get("generatedTitle", "")
                    if isinstance(generated_title, str) and generated_title.strip():
                        latest_generated_title = " ".join(generated_title.split()).strip()

                    # Request marker — bevat requestId en het user-bericht
                    if "requestId" in item:
                        if current_response_parts:
                            messages.append({
                                "role": "assistant",
                                "text": "".join(current_response_parts)
                            })
                            current_response_parts = []
                        msg_data = item.get("message", {})
                        if isinstance(msg_data, dict):
                            user_text = msg_data.get("text", "")
                        elif isinstance(msg_data, str):
                            user_text = msg_data
                        else:
                            user_text = ""
                        if user_text.strip():
                            messages.append({
                                "role": "user",
                                "text": user_text.strip()
                            })
                    # Response content
                    elif "value" in item and isinstance(item["value"], str):
                        item_kind = item.get("kind", "")
                        if (item_kind in ("", "markdownContent")
                                or "supportThemeIcons" in item):
                            current_response_parts.append(item["value"])

    if current_response_parts:
        messages.append({
            "role": "assistant",
            "text": "".join(current_response_parts)
        })

    if not session_header:
        session_header = {}

    if latest_generated_title:
        session_header["generatedTitle"] = latest_generated_title

    session_header["_extracted_messages"] = messages
    return session_header


def extract_messages(session: dict) -> list[dict]:
    """
    Extraheer user/assistant berichten uit een chat-sessie.

    Returns: lijst van {"role": "user"|"assistant", "text": str}
    """
    # Gebruik de berichten die we uit de JSONL patches geëxtraheerd hebben
    return session.get("_extracted_messages", [])


def build_session_title(session: dict, messages: list[dict], session_id: str) -> str:
    """Gebruik bij voorkeur de echte sessietitel uit VS Code, met fallback naar het eerste user-bericht."""
    for key in ("customTitle", "sessionTitle", "generatedTitle", "title"):
        value = session.get(key, "")
        if isinstance(value, str):
            cleaned = " ".join(value.split()).strip()
            if cleaned:
                if len(cleaned) > 80:
                    return cleaned[:80].rstrip() + "..."
                return cleaned

    first_user = next((m["text"] for m in messages if m["role"] == "user"), "")
    title = first_user[:80].replace("\n", " ").strip()
    if len(first_user) > 80:
        title += "..."
    if title:
        return title
    return session_id[:8]


def session_to_markdown(session: dict, session_id: str) -> str:
    """Converteer een chat-sessie naar leesbaar Markdown."""
    created_ms = session.get("creationDate", 0)
    try:
        created_dt = datetime.fromtimestamp(created_ms / 1000)
        date_str = created_dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, OSError):
        date_str = "onbekend"

    messages = extract_messages(session)
    if not messages:
        return ""

    # Titel: gebruik de echte sessietitel als die beschikbaar is in VS Code
    title = build_session_title(session, messages, session_id)

    lines = [
        f"# Chat: {title}",
        f"",
        f"- **Datum**: {date_str}",
        f"- **Sessie-ID**: `{session_id}`",
        f"- **Berichten**: {len(messages)}",
        f"",
        f"---",
        f"",
    ]

    for msg in messages:
        if msg["role"] == "user":
            lines.append(f"## 🧑 User\n")
        else:
            lines.append(f"## 🤖 Assistant\n")
        lines.append(msg["text"])
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    # Bepaal project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # bitemp_register_v06/
    repo_root = os.path.dirname(project_root)   # Bitemporal_2026/

    export_dir = os.path.join(project_root, "docs", "copilot-chats", "exports")
    os.makedirs(export_dir, exist_ok=True)

    # Zoek workspace storage dirs
    ws_dirs = find_workspace_storage_dirs("Bitemporal_2026")
    if not ws_dirs:
        print("Geen VS Code workspace storage gevonden voor Bitemporal_2026.")
        sys.exit(1)

    print(f"Gevonden workspace storage directories: {len(ws_dirs)}")

    exported = 0
    skipped = 0

    for ws_dir in ws_dirs:
        chat_dir = os.path.join(ws_dir, "chatSessions")
        if not os.path.isdir(chat_dir):
            continue

        for jsonl_file in glob.glob(os.path.join(chat_dir, "*.jsonl")):
            session_id = os.path.basename(jsonl_file).replace(".jsonl", "")

            # Replay de sessie-state
            session = replay_jsonl_state(jsonl_file)
            if not session:
                print(f"  Overgeslagen (leeg): {session_id[:8]}")
                skipped += 1
                continue

            messages = extract_messages(session)
            if not messages:
                print(f"  Overgeslagen (geen berichten): {session_id[:8]}")
                skipped += 1
                continue

            # Bestandsnaam: datum-korte-titel
            created_ms = session.get("creationDate", 0)
            try:
                created_dt = datetime.fromtimestamp(created_ms / 1000)
                date_prefix = created_dt.strftime("%Y-%m-%d")
            except (ValueError, OSError):
                date_prefix = "onbekend"

            # Maak een korte slug van de sessietitel; fallback blijft het eerste user-bericht
            title_for_filename = build_session_title(session, messages, session_id)
            slug = re.sub(r"[^a-z0-9]+", "-", title_for_filename[:50].lower()).strip("-")
            if not slug:
                slug = session_id[:8]

            filename = f"{date_prefix}-{slug}.md"
            filepath = os.path.join(export_dir, filename)

            # Check of er al een export is met dezelfde sessie-ID.
            # Als die bestaat, vergelijk het berichtenaantal:
            # is de chat gegroeid → herexporteer (overschrijf).
            existing_files = glob.glob(os.path.join(export_dir, "*.md"))
            existing_filepath = None
            existing_msg_count = 0
            for ef in existing_files:
                try:
                    with open(ef, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(600)
                    if session_id in content:
                        existing_filepath = ef
                        # Lees het opgeslagen berichtenaantal uit de header
                        m = re.search(r"\*\*Berichten\*\*:\s*(\d+)", content)
                        if m:
                            existing_msg_count = int(m.group(1))
                        break
                except IOError:
                    continue

            current_msg_count = len(messages)

            if existing_filepath and current_msg_count <= existing_msg_count:
                print(f"  Ongewijzigd ({current_msg_count} berichten): {session_id[:8]} → {os.path.basename(existing_filepath)}")
                skipped += 1
                continue

            # Gebruik bestaand bestandspad bij update, anders nieuw pad
            if existing_filepath:
                filepath = existing_filepath
                action = f"Bijgewerkt ({existing_msg_count}→{current_msg_count} berichten)"
            else:
                # Voorkom naambotsing bij nieuw bestand
                counter = 1
                base_filepath = filepath
                while os.path.exists(filepath):
                    name, ext = os.path.splitext(base_filepath)
                    filepath = f"{name}-{counter}{ext}"
                    counter += 1
                action = "Geëxporteerd"

            # Schrijf markdown
            md = session_to_markdown(session, session_id)
            if md:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(md)
                print(f"  {action}: {session_id[:8]} → {os.path.basename(filepath)}")
                exported += 1

    export_dir_display = os.path.relpath(export_dir, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print(f"\nKlaar: {exported} geëxporteerd/bijgewerkt, {skipped} overgeslagen.")
    print(f"Map:   {export_dir}")


if __name__ == "__main__":
    main()
