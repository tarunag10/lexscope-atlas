#!/usr/bin/env python3
import argparse
import csv
import io
import json
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCES = ROOT / "data" / "regulation_sources.json"
DEFAULT_OUTPUT = ROOT / "data" / "regulations.auto.json"


def read_text(location: str) -> str:
    if location.startswith("http://") or location.startswith("https://"):
        with urllib.request.urlopen(location, timeout=20) as response:
            return response.read().decode("utf-8")
    return Path(location).read_text(encoding="utf-8")


def parse_csv_records(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    grouped: Dict[str, Dict[str, Any]] = {}

    def split_values(raw: str) -> List[str]:
        normalized = (raw or "").replace("|", ",")
        return [part.strip().upper() for part in normalized.split(",") if part.strip()]

    for row in reader:
        code = (row.get("code") or "").strip().upper()
        if not code:
            continue

        if code not in grouped:
            grouped[code] = {
                "code": code,
                "name": (row.get("name") or "").strip(),
                "authority": (row.get("authority") or "").strip(),
                "summary": (row.get("summary") or "").strip(),
                "source_url": (row.get("source_url") or "").strip(),
                "versions": [],
            }

        grouped[code]["versions"].append(
            {
                "version": int((row.get("version") or "1").strip() or 1),
                "effective_from": (row.get("effective_from") or "2020-01-01").strip(),
                "repealed_on": ((row.get("repealed_on") or "").strip() or None),
                "status": ((row.get("status") or "ACTIVE").strip().upper()),
                "notes": (row.get("notes") or "").strip(),
                "conditions": {
                    "jurisdictions_any": split_values(row.get("jurisdictions_any") or ""),
                    "markets_any": split_values(row.get("markets_any") or ""),
                    "industries_any": split_values(row.get("industries_any") or ""),
                    "product_types_any": split_values(row.get("product_types_any") or ""),
                    "company_sizes_any": split_values(row.get("company_sizes_any") or ""),
                },
            }
        )

    return list(grouped.values())


def parse_items(raw_text: str, fmt: str) -> List[Dict[str, Any]]:
    if fmt == "json":
        payload = json.loads(raw_text)
        if isinstance(payload, dict):
            payload = payload.get("items", [])
        if not isinstance(payload, list):
            raise ValueError("JSON source must be a list or {items:[...]}")
        return payload

    if fmt == "csv":
        return parse_csv_records(raw_text)

    raise ValueError(f"Unsupported format: {fmt}")


def normalize_conditions(conditions: Dict[str, Any]) -> Dict[str, List[str]]:
    fields = [
        "jurisdictions_any",
        "markets_any",
        "industries_any",
        "product_types_any",
        "company_sizes_any",
    ]
    out: Dict[str, List[str]] = {}
    for field in fields:
        raw = conditions.get(field, [])
        if isinstance(raw, list):
            out[field] = [str(v).strip().upper() for v in raw if str(v).strip()]
        elif raw:
            out[field] = [str(raw).strip().upper()]
        else:
            out[field] = []
    return out


def canonicalize(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    canon = []
    for item in items:
        code = str(item.get("code", "")).strip().upper()
        if not code:
            continue
        versions = item.get("versions")
        if not isinstance(versions, list):
            versions = [
                {
                    "version": int(item.get("version", 1)),
                    "effective_from": str(item.get("effective_from", "2020-01-01")),
                    "repealed_on": item.get("repealed_on") or None,
                    "status": str(item.get("status", "ACTIVE")).upper(),
                    "notes": str(item.get("notes", "")),
                    "conditions": item.get("conditions", {}),
                }
            ]

        canon.append(
            {
                "code": code,
                "name": str(item.get("name", "")).strip(),
                "authority": str(item.get("authority", "")).strip(),
                "summary": str(item.get("summary", "")).strip(),
                "source_url": str(item.get("source_url", "")).strip(),
                "versions": [
                    {
                        "version": int(v.get("version", 1)),
                        "effective_from": str(v.get("effective_from", "2020-01-01")),
                        "repealed_on": (str(v.get("repealed_on")) if v.get("repealed_on") else None),
                        "status": str(v.get("status", "ACTIVE")).upper(),
                        "notes": str(v.get("notes", "")),
                        "conditions": normalize_conditions(v.get("conditions", {})),
                    }
                    for v in versions
                ],
            }
        )
    return canon


def load_sources(path: Path) -> List[Dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Source registry must be an array")
    return raw


def sync(sources_path: Path, output_path: Path) -> Dict[str, Any]:
    sources = load_sources(sources_path)

    merged: Dict[str, Dict[str, Any]] = {}
    processed = 0

    for source in sources:
        if not source.get("enabled", True):
            continue

        fmt = str(source.get("format", "json")).lower()
        location = str(source.get("location", "")).strip()
        kind = str(source.get("kind", "file")).lower()

        if not location:
            continue

        if kind == "file":
            location_path = str((ROOT / location).resolve()) if not Path(location).is_absolute() else location
            raw_text = read_text(location_path)
        else:
            raw_text = read_text(location)

        items = canonicalize(parse_items(raw_text, fmt))
        for item in items:
            merged[item["code"]] = item

        processed += 1

    payload = {
        "generated_at": __import__("datetime").datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source_registry": str(sources_path),
        "source_count": processed,
        "regulations": sorted(merged.values(), key=lambda x: x["code"]),
    }
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "sources_processed": processed,
        "regulations_written": len(payload["regulations"]),
        "output": str(output_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync regulations from configured country sources")
    parser.add_argument("--sources", default=str(DEFAULT_SOURCES), help="Path to source registry JSON")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output path for compiled regulations JSON")
    args = parser.parse_args()

    result = sync(Path(args.sources), Path(args.output))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
