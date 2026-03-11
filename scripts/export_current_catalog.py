#!/usr/bin/env python3
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "regulations.seed.json"
AUTO = ROOT / "data" / "regulations.auto.json"
OUT = ROOT / "data" / "regulations.current.master.json"


def normalize_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip().upper() for v in value if str(v).strip()]
    return [str(value).strip().upper()] if str(value).strip() else []


def normalize_conditions(raw: Dict[str, Any]) -> Dict[str, List[str]]:
    return {
        "jurisdictions_any": normalize_list(raw.get("jurisdictions_any", [])),
        "markets_any": normalize_list(raw.get("markets_any", [])),
        "industries_any": normalize_list(raw.get("industries_any", [])),
        "product_types_any": normalize_list(raw.get("product_types_any", [])),
        "company_sizes_any": normalize_list(raw.get("company_sizes_any", [])),
    }


def canonicalize(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
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

        out.append(
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
                        "repealed_on": str(v.get("repealed_on")) if v.get("repealed_on") else None,
                        "status": str(v.get("status", "ACTIVE")).upper(),
                        "notes": str(v.get("notes", "")),
                        "conditions": normalize_conditions(v.get("conditions", {})),
                    }
                    for v in versions
                ],
            }
        )

    return out


def main() -> None:
    seed = json.loads(SEED.read_text(encoding="utf-8"))

    auto_raw = []
    if AUTO.exists():
        payload = json.loads(AUTO.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            auto_raw = payload
        elif isinstance(payload, dict):
            auto_raw = payload.get("regulations", [])

    all_items = canonicalize(seed + auto_raw)

    merged: Dict[str, Dict[str, Any]] = {}
    for item in all_items:
        merged[item["code"]] = item

    output = {
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "description": "Master snapshot of current app regulation catalog (seed + auto-sourced)",
        "regulation_count": len(merged),
        "items": sorted(merged.values(), key=lambda x: x["code"]),
    }

    OUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(OUT), "regulation_count": output["regulation_count"]}, indent=2))


if __name__ == "__main__":
    main()
