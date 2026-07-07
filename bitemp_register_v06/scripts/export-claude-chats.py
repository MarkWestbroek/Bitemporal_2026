#!/usr/bin/env python3
"""Exporteer Claude Code-sessies naar leesbare Markdown.

Tegenhanger van ``export-copilot-chats.py`` voor Claude Code (Fable/Opus/...).
Claude bewaart zijn sessies als JSONL onder
``~/.claude/projects/<geëncodeerde-projectpad>/<session-id>.jsonl``. Dit script
leest zo'n sessie en schrijft een export naar
``bitemp_register_v06/docs/copilot-chats/exports/`` (historische mapnaam), zodat
belangrijke AI-chats via Git bewaard blijven — conform de afspraken in
``CLAUDE.md``.

Gebruiker- en assistentteksten worden letterlijk overgenomen. Tool-aanroepen
komen als compacte ``🔧``-annotaties mee (hun vaak megabytes grote output niet).
Interne redeneerblokken (thinking) worden weggelaten.

Voorbeelden (draai vanuit de repo-root of van waar dan ook binnen de repo):

    # Laatste sessie exporteren met een nette titel
    python bitemp_register_v06/scripts/export-claude-chats.py \
        --latest --title backend-code-review-en-hardening-be

    # Eén specifieke sessie
    python bitemp_register_v06/scripts/export-claude-chats.py --session <id>

    # Alle sessies van dit project bijwerken (naam op datum + session-id)
    python bitemp_register_v06/scripts/export-claude-chats.py --all

    # Ook een samenvattingsstub aanmaken (nooit een bestaande overschrijven)
    python bitemp_register_v06/scripts/export-claude-chats.py --latest \
        --title mijn-onderwerp --summary

De projectmap wordt automatisch bepaald via de git-hoofd-repo-root (werkt ook
vanuit een git worktree). Override desnoods met ``--project-dir``.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Projectmap-detectie ──────────────────────────────────────────────────────


def _encode_project_path(path: str) -> str:
    """Codeer een absoluut pad zoals Claude dat als mapnaam gebruikt:
    elk niet-alfanumeriek teken (``: \\ / _`` etc.) wordt een ``-``."""
    return re.sub(r"[^A-Za-z0-9]", "-", path)


def _git_main_repo_root() -> Path | None:
    """Geef de hoofd-repo-root, ook wanneer we in een worktree draaien.

    ``git rev-parse --git-common-dir`` wijst naar de gedeelde ``.git`` van de
    hoofdcheckout; de parent daarvan is de root waar Claude z'n sessies onder
    heeft opgeslagen.
    """
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--git-common-dir"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    if not out:
        return None
    common = Path(out)
    if not common.is_absolute():
        common = (Path.cwd() / common).resolve()
    # <root>/.git → <root>
    if common.name == ".git":
        return common.parent
    return common.parent if common.parent != common else common


def _projects_base() -> Path:
    return Path.home() / ".claude" / "projects"


def find_project_dir(explicit: str | None) -> Path:
    base = _projects_base()
    if explicit:
        d = Path(explicit)
        if not d.is_absolute():
            d = base / explicit
        if not d.is_dir():
            sys.exit(f"Opgegeven --project-dir bestaat niet: {d}")
        return d

    root = _git_main_repo_root()
    candidates: list[str] = []
    if root is not None:
        # Probeer beide slash-varianten en drive-letter casings; Claude gebruikt
        # het pad zoals het werd gestart (op Windows meestal met backslashes en
        # kleine driveletter).
        raw_variants = {
            str(root),
            str(root).replace("/", "\\"),
            str(root).replace("\\", "/"),
        }
        for raw in raw_variants:
            enc = _encode_project_path(raw)
            candidates.append(enc)
            if enc[:1].isalpha():
                candidates.append(enc[:1].lower() + enc[1:])
                candidates.append(enc[:1].upper() + enc[1:])

    if base.is_dir():
        existing = {p.name: p for p in base.iterdir() if p.is_dir()}
        # 1. Exacte match op een van de kandidaten.
        for cand in candidates:
            if cand in existing:
                return existing[cand]
        # 2. Case-insensitieve match.
        lower = {name.lower(): p for name, p in existing.items()}
        for cand in candidates:
            if cand.lower() in lower:
                return lower[cand.lower()]
        # 3. Token-match op de repo-mapnaam (bijv. "Bitemporal-2026").
        if root is not None:
            token = _encode_project_path(root.name).lower()
            hits = [p for name, p in existing.items() if token in name.lower()]
            if len(hits) == 1:
                return hits[0]
            if len(hits) > 1:
                namen = ", ".join(sorted(p.name for p in hits))
                sys.exit(
                    "Meerdere projectmappen matchen; kies expliciet met "
                    f"--project-dir. Kandidaten: {namen}"
                )

    hint = f"\nBeschikbaar onder {base}:\n  " + "\n  ".join(
        sorted(p.name for p in base.iterdir() if p.is_dir())
    ) if base.is_dir() else f"\n(map {base} bestaat niet)"
    sys.exit("Kon de Claude-projectmap niet bepalen; geef --project-dir op." + hint)


# ── Sessie inlezen ───────────────────────────────────────────────────────────


def _iter_records(jsonl_path: Path):
    with io.open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _tool_hint(block: dict) -> str:
    naam = block.get("name", "?")
    inp = block.get("input", {}) or {}
    hint = (
        inp.get("description")
        or inp.get("file_path")
        or inp.get("pattern")
        or inp.get("skill")
        or ""
    )
    if not hint and naam == "TodoWrite":
        hint = "takenlijst bijgewerkt"
    hint = str(hint).replace("\n", " ").strip()
    if len(hint) > 110:
        hint = hint[:107] + "..."
    regel = f"> 🔧 `{naam}` — {hint}" if hint else f"> 🔧 `{naam}`"
    return regel + "\n"


def _strip_reminders(tekst: str) -> str:
    return re.sub(r"<system-reminder>.*?</system-reminder>", "", tekst, flags=re.S).strip()


def _is_ruis(tekst: str) -> bool:
    t = tekst.strip()
    if not t:
        return True
    return t.startswith(("<system-reminder>", "<command-", "<local-command-", "Caveat:"))


def _first_meta(jsonl_path: Path) -> tuple[str, str]:
    """Geef (datum ``YYYY-MM-DD``, git-branch) van het eerste user-bericht."""
    datum = datetime.fromtimestamp(jsonl_path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")
    branch = ""
    for rec in _iter_records(jsonl_path):
        if rec.get("type") == "user" and not rec.get("isMeta"):
            ts = rec.get("timestamp")
            if ts:
                try:
                    datum = datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%Y-%m-%d")
                except ValueError:
                    pass
            branch = rec.get("gitBranch", "") or ""
            break
    return datum, branch


def render_session(jsonl_path: Path, session_id: str) -> str:
    datum, branch = _first_meta(jsonl_path)
    blokken: list[str] = []
    beurt = 0

    for rec in _iter_records(jsonl_path):
        rtype = rec.get("type")
        msg = rec.get("message") or {}
        content = msg.get("content")

        if rtype == "user" and not rec.get("isMeta"):
            teksten: list[str] = []
            if isinstance(content, str):
                teksten.append(content)
            elif isinstance(content, list):
                for blok in content:
                    if isinstance(blok, dict) and blok.get("type") == "text":
                        teksten.append(blok.get("text", ""))
                    # tool_result-blokken (tool-output) bewust overslaan
            for t in teksten:
                t = _strip_reminders(t)
                if _is_ruis(t):
                    continue
                beurt += 1
                blokken.append(f"\n---\n\n## 👤 Gebruiker ({beurt})\n\n{t}\n")

        elif rtype == "assistant" and isinstance(content, list):
            for blok in content:
                if not isinstance(blok, dict):
                    continue
                btype = blok.get("type")
                if btype == "text":
                    t = blok.get("text", "").strip()
                    if t:
                        blokken.append(f"\n**🤖 Claude:**\n\n{t}\n")
                elif btype == "tool_use":
                    blokken.append(_tool_hint(blok))
                # thinking-blokken bewust weggelaten

    branch_regel = f"\n> - **Branch:** `{branch}`" if branch else ""
    kop = (
        "# Claude Code-sessie-export\n\n"
        "> **Let op:** export van een **Claude Code**-sessie (geen Copilot-chat; "
        "de map heet historisch `copilot-chats`). Gebruiker- en assistentteksten "
        "zijn letterlijk overgenomen uit de sessielog; tool-aanroepen staan als "
        "compacte `🔧`-annotaties (hun output niet). Interne redeneerblokken zijn "
        "weggelaten.\n>\n"
        f"> - **Datum:** {datum}\n"
        f"> - **Sessie-id:** `{session_id}`"
        f"{branch_regel}\n"
    )
    return kop + "".join(blokken) + "\n"


# ── Naamgeving + output ──────────────────────────────────────────────────────


def _slugify(tekst: str) -> str:
    tekst = tekst.strip().lower()
    tekst = re.sub(r"[^a-z0-9]+", "-", tekst)
    return tekst.strip("-")


def _output_stem(jsonl_path: Path, session_id: str, title: str | None) -> str:
    datum, _ = _first_meta(jsonl_path)
    if title:
        return f"{datum}-{_slugify(title)}"
    return f"{datum}-claude-{session_id[:8]}"


def _write_summary_stub(summaries_dir: Path, stem: str, jsonl_path: Path, session_id: str, title: str | None) -> Path | None:
    dst = summaries_dir / f"{stem}.md"
    if dst.exists():
        return None  # nooit een bestaande (handgeschreven) samenvatting overschrijven
    datum, branch = _first_meta(jsonl_path)
    template = summaries_dir.parent / "templates" / "chat-summary-template.md"
    body = template.read_text(encoding="utf-8") if template.exists() else "# Chat Samenvatting\n"
    titel = title or f"claude-{session_id[:8]}"
    body = body.replace("- Datum:", f"- Datum: {datum}", 1)
    body = body.replace("- Titel:", f"- Titel: {titel}", 1)
    body = body.replace("- Bestandstamnaam:", f"- Bestandstamnaam: {stem}", 1)
    body = body.replace("- Gerelateerde export:", f"- Gerelateerde export: ../exports/{stem}.md", 1)
    if branch:
        body = body.replace("- Gerelateerde branch/commit:", f"- Gerelateerde branch/commit: {branch}", 1)
    summaries_dir.mkdir(parents=True, exist_ok=True)
    dst.write_text(body, encoding="utf-8", newline="\n")
    return dst


# ── CLI ──────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Exporteer Claude Code-sessies naar Markdown.")
    sel = parser.add_mutually_exclusive_group()
    sel.add_argument("--session", metavar="ID", help="Session-id (bestandsnaam zonder .jsonl)")
    sel.add_argument("--latest", action="store_true", help="Meest recent gewijzigde sessie (default)")
    sel.add_argument("--all", action="store_true", help="Alle sessies van dit project")
    parser.add_argument("--title", help="Titelslug voor de bestandsnaam (alleen bij één sessie)")
    parser.add_argument("--project-dir", help="Override ~/.claude/projects/<...> map")
    parser.add_argument("--out-dir", help="Output-map (default: docs/copilot-chats/exports naast dit script)")
    parser.add_argument("--summary", action="store_true", help="Maak ook een samenvattingsstub (nooit overschrijven)")
    args = parser.parse_args()

    project_dir = find_project_dir(args.project_dir)
    sessions = sorted(project_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not sessions:
        sys.exit(f"Geen sessies (*.jsonl) gevonden in {project_dir}")

    if args.all:
        gekozen = sessions
        if args.title:
            sys.exit("--title kan niet met --all (elke sessie krijgt een eigen naam).")
    elif args.session:
        pad = project_dir / f"{args.session}.jsonl"
        if not pad.exists():
            sys.exit(f"Sessie niet gevonden: {pad}")
        gekozen = [pad]
    else:  # default of --latest
        gekozen = [sessions[0]]

    scripts_dir = Path(__file__).resolve().parent
    chats_dir = scripts_dir.parent / "docs" / "copilot-chats"
    out_dir = Path(args.out_dir) if args.out_dir else chats_dir / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)

    for pad in gekozen:
        session_id = pad.stem
        markdown = render_session(pad, session_id)
        stem = _output_stem(pad, session_id, args.title if len(gekozen) == 1 else None)
        dst = out_dir / f"{stem}.md"
        dst.write_text(markdown, encoding="utf-8", newline="\n")
        print(f"geëxporteerd: {dst.relative_to(scripts_dir.parent.parent)}")
        if args.summary:
            stub = _write_summary_stub(chats_dir / "summaries", stem, pad, session_id, args.title if len(gekozen) == 1 else None)
            if stub is not None:
                print(f"  samenvattingsstub: {stub.relative_to(scripts_dir.parent.parent)}")


if __name__ == "__main__":
    main()
