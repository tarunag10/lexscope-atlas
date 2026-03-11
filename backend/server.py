#!/usr/bin/env python3
import csv
import io
import json
import sqlite3
from datetime import date, datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_DIR = ROOT / "frontend"
DB_PATH = DATA_DIR / "regulations.db"
SEED_PATH = DATA_DIR / "regulations.seed.json"

OPTIONS = {
    "jurisdictions": [
        {"value": "EU", "label": "European Union"},
        {"value": "UK", "label": "United Kingdom"},
        {"value": "US", "label": "United States"},
        {"value": "SG", "label": "Singapore"},
        {"value": "UAE", "label": "United Arab Emirates"},
        {"value": "IN", "label": "India"},
        {"value": "CA", "label": "Canada"},
        {"value": "AU", "label": "Australia"},
        {"value": "JP", "label": "Japan"},
        {"value": "BR", "label": "Brazil"},
        {"value": "SA", "label": "Saudi Arabia"},
    ],
    "industries": [
        {"value": "TECHNOLOGY", "label": "Technology"},
        {"value": "ECOMMERCE", "label": "E-commerce / Marketplace"},
        {"value": "FINANCIAL_SERVICES", "label": "Financial Services"},
        {"value": "INSURANCE", "label": "Insurance"},
        {"value": "HEALTHCARE", "label": "Healthcare"},
        {"value": "MEDIA", "label": "Media"},
        {"value": "MANUFACTURING", "label": "Manufacturing"},
        {"value": "ENERGY", "label": "Energy"},
        {"value": "TELECOM", "label": "Telecommunications"},
        {"value": "EDTECH", "label": "Education Technology"},
        {"value": "PUBLIC_SECTOR", "label": "Public Sector"},
        {"value": "GAMING", "label": "Gaming"},
    ],
    "company_sizes": [
        {"value": "MICRO", "label": "Micro (<10 employees)"},
        {"value": "SME", "label": "SME (10-249 employees)"},
        {"value": "MID", "label": "Mid-Market (250-999 employees)"},
        {"value": "LARGE", "label": "Large (1,000-4,999 employees)"},
        {"value": "ENTERPRISE", "label": "Enterprise (5,000+ employees)"},
    ],
    "product_types": [
        {"value": "AI_MODEL", "label": "AI foundation model"},
        {"value": "AI_SAAS", "label": "AI SaaS application"},
        {"value": "AI_EMBEDDED", "label": "AI-enabled physical product"},
        {"value": "DIGITAL_PLATFORM", "label": "Digital platform"},
        {"value": "SOCIAL_PLATFORM", "label": "Social platform"},
        {"value": "SEARCH_SERVICE", "label": "Search service"},
        {"value": "MARKETPLACE", "label": "Marketplace"},
        {"value": "SAAS", "label": "General SaaS"},
        {"value": "MOBILE_APP", "label": "Mobile app"},
        {"value": "IOT_DEVICE", "label": "IoT device"},
        {"value": "FINANCIAL_SERVICE", "label": "Financial service"},
        {"value": "INVESTMENT_PRODUCT", "label": "Investment product"},
        {"value": "INSURANCE_PRODUCT", "label": "Insurance product"},
        {"value": "HEALTH_TECH", "label": "Health-tech solution"},
        {"value": "PAYMENTS", "label": "Payments service"},
        {"value": "CRYPTO_ASSET", "label": "Crypto-asset service"},
    ],
}


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [row["name"] for row in rows]


def _migrate_legacy_if_needed(conn: sqlite3.Connection) -> None:
    cols = _table_columns(conn, "regulations")
    if not cols or "conditions_json" not in cols:
        return

    legacy_rows = conn.execute(
        "SELECT code, name, authority, summary, source_url, conditions_json, created_at, updated_at FROM regulations"
    ).fetchall()

    conn.execute("ALTER TABLE regulations RENAME TO regulations_legacy")
    _create_tables(conn)

    for row in legacy_rows:
        conn.execute(
            """
            INSERT OR REPLACE INTO regulations (code, name, authority, summary, source_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
            """,
            (
                row["code"],
                row["name"],
                row["authority"],
                row["summary"],
                row["source_url"],
                row["created_at"],
                row["updated_at"],
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO regulation_versions
            (code, version, effective_from, repealed_on, status, conditions_json, notes)
            VALUES (?, 1, '2020-01-01', NULL, 'ACTIVE', ?, 'Migrated from legacy schema')
            """,
            (row["code"], row["conditions_json"]),
        )


def _create_tables(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS regulations (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            authority TEXT NOT NULL,
            summary TEXT NOT NULL,
            source_url TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS regulation_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            version INTEGER NOT NULL,
            effective_from TEXT NOT NULL,
            repealed_on TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            conditions_json TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(code, version),
            FOREIGN KEY(code) REFERENCES regulations(code)
        )
        """
    )


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS regulations (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                authority TEXT NOT NULL,
                summary TEXT NOT NULL,
                source_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        _migrate_legacy_if_needed(conn)
        _create_tables(conn)

        seed_data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        import_regulations(conn, seed_data)

        conn.commit()
    finally:
        conn.close()


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def normalize_conditions(conditions: Dict[str, Any]) -> Dict[str, List[str]]:
    keys = [
        "jurisdictions_any",
        "markets_any",
        "industries_any",
        "product_types_any",
        "company_sizes_any",
    ]
    normalized: Dict[str, List[str]] = {}
    for key in keys:
        raw = conditions.get(key, [])
        if raw is None:
            normalized[key] = []
        elif isinstance(raw, list):
            normalized[key] = [str(v).strip().upper() for v in raw if str(v).strip()]
        else:
            normalized[key] = [str(raw).strip().upper()] if str(raw).strip() else []
    return normalized


def canonical_item(raw: Dict[str, Any]) -> Dict[str, Any]:
    base = {
        "code": str(raw["code"]).strip().upper(),
        "name": str(raw["name"]).strip(),
        "authority": str(raw["authority"]).strip(),
        "summary": str(raw["summary"]).strip(),
        "source_url": str(raw["source_url"]).strip(),
    }

    versions = raw.get("versions")
    if versions is None:
        versions = [
            {
                "version": int(raw.get("version", 1)),
                "effective_from": str(raw.get("effective_from", "2020-01-01")),
                "repealed_on": raw.get("repealed_on"),
                "status": str(raw.get("status", "ACTIVE")).upper(),
                "notes": raw.get("notes", ""),
                "conditions": raw.get("conditions", {}),
            }
        ]

    cleaned_versions = []
    for version in versions:
        effective_from = str(version.get("effective_from", "2020-01-01"))
        parse_date(effective_from)

        repealed_on = version.get("repealed_on")
        if repealed_on:
            parse_date(str(repealed_on))

        cleaned_versions.append(
            {
                "version": int(version.get("version", 1)),
                "effective_from": effective_from,
                "repealed_on": str(repealed_on) if repealed_on else None,
                "status": str(version.get("status", "ACTIVE")).upper(),
                "notes": str(version.get("notes", "")).strip(),
                "conditions": normalize_conditions(version.get("conditions", {})),
            }
        )

    base["versions"] = cleaned_versions
    return base


def parse_csv_import(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    buckets: Dict[str, Dict[str, Any]] = {}

    for row in reader:
        code = str(row.get("code", "")).strip().upper()
        if not code:
            continue

        item = buckets.get(code)
        if item is None:
            item = {
                "code": code,
                "name": str(row.get("name", "")).strip(),
                "authority": str(row.get("authority", "")).strip(),
                "summary": str(row.get("summary", "")).strip(),
                "source_url": str(row.get("source_url", "")).strip(),
                "versions": [],
            }
            buckets[code] = item

        def split_multi(raw: str) -> List[str]:
            text_value = str(raw or "").replace("|", ",")
            return [part.strip().upper() for part in text_value.split(",") if part.strip()]

        item["versions"].append(
            {
                "version": int(row.get("version", "1") or 1),
                "effective_from": str(row.get("effective_from", "2020-01-01") or "2020-01-01"),
                "repealed_on": str(row.get("repealed_on", "") or "").strip() or None,
                "status": str(row.get("status", "ACTIVE") or "ACTIVE").upper(),
                "notes": str(row.get("notes", "") or "").strip(),
                "conditions": {
                    "jurisdictions_any": split_multi(row.get("jurisdictions_any", "")),
                    "markets_any": split_multi(row.get("markets_any", "")),
                    "industries_any": split_multi(row.get("industries_any", "")),
                    "product_types_any": split_multi(row.get("product_types_any", "")),
                    "company_sizes_any": split_multi(row.get("company_sizes_any", "")),
                },
            }
        )

    return list(buckets.values())


def import_regulations(conn: sqlite3.Connection, raw_items: List[Dict[str, Any]]) -> Dict[str, int]:
    inserted = 0
    updated = 0
    versions_upserted = 0

    for raw in raw_items:
        item = canonical_item(raw)

        exists = conn.execute("SELECT code FROM regulations WHERE code = ?", (item["code"],)).fetchone()

        conn.execute(
            """
            INSERT INTO regulations (code, name, authority, summary, source_url)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                authority = excluded.authority,
                summary = excluded.summary,
                source_url = excluded.source_url,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                item["code"],
                item["name"],
                item["authority"],
                item["summary"],
                item["source_url"],
            ),
        )
        if exists:
            updated += 1
        else:
            inserted += 1

        for version in item["versions"]:
            conn.execute(
                """
                INSERT INTO regulation_versions
                (code, version, effective_from, repealed_on, status, conditions_json, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(code, version) DO UPDATE SET
                    effective_from = excluded.effective_from,
                    repealed_on = excluded.repealed_on,
                    status = excluded.status,
                    conditions_json = excluded.conditions_json,
                    notes = excluded.notes,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    item["code"],
                    version["version"],
                    version["effective_from"],
                    version["repealed_on"],
                    version["status"],
                    json.dumps(version["conditions"]),
                    version["notes"],
                ),
            )
            versions_upserted += 1

    return {
        "regulations_inserted": inserted,
        "regulations_updated": updated,
        "versions_upserted": versions_upserted,
    }


def list_regulation_versions(as_of_date: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = _connect()
    try:
        sql = (
            """
            SELECT
                r.code,
                r.name,
                r.authority,
                r.summary,
                r.source_url,
                rv.version,
                rv.effective_from,
                rv.repealed_on,
                rv.status,
                rv.notes,
                rv.conditions_json
            FROM regulations r
            JOIN regulation_versions rv ON rv.code = r.code
            """
        )

        rows = conn.execute(sql).fetchall()
        by_code: Dict[str, List[sqlite3.Row]] = {}
        for row in rows:
            by_code.setdefault(row["code"], []).append(row)

        selected = []
        cutoff = parse_date(as_of_date) if as_of_date else date.today()

        for code_rows in by_code.values():
            candidates = []
            for row in code_rows:
                start = parse_date(row["effective_from"])
                end = parse_date(row["repealed_on"]) if row["repealed_on"] else None
                if start <= cutoff and (end is None or cutoff < end):
                    candidates.append(row)

            if not candidates:
                continue

            row = sorted(candidates, key=lambda r: r["version"], reverse=True)[0]
            selected.append(
                {
                    "code": row["code"],
                    "name": row["name"],
                    "authority": row["authority"],
                    "summary": row["summary"],
                    "source_url": row["source_url"],
                    "version": row["version"],
                    "effective_from": row["effective_from"],
                    "repealed_on": row["repealed_on"],
                    "status": row["status"],
                    "notes": row["notes"],
                    "conditions": json.loads(row["conditions_json"]),
                }
            )

        return sorted(selected, key=lambda item: item["name"])
    finally:
        conn.close()


def parse_import_payload(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str]:
    fmt = str(payload.get("format", "json")).lower()
    raw_data = payload.get("data")

    if not isinstance(raw_data, str):
        raise ValueError("Import payload requires string field 'data'")

    if fmt == "json":
        decoded = json.loads(raw_data)
        if isinstance(decoded, dict):
            decoded = decoded.get("items", [])
        if not isinstance(decoded, list):
            raise ValueError("JSON import must be a list or {items:[...]}")
        return decoded, "json"

    if fmt == "csv":
        return parse_csv_import(raw_data), "csv"

    raise ValueError("Unsupported import format. Use 'json' or 'csv'.")


def matches_rule(value: str, allowed: List[str]) -> bool:
    return not allowed or value in allowed


def evaluate_regulation(profile: Dict[str, Any], regulation: Dict[str, Any]) -> Dict[str, Any]:
    c = regulation["conditions"]

    checks = {
        "jurisdiction": matches_rule(profile["jurisdiction"], c.get("jurisdictions_any", [])),
        "market": any(m in c.get("markets_any", []) for m in profile.get("markets", []))
        if c.get("markets_any")
        else True,
        "industry": matches_rule(profile["industry"], c.get("industries_any", [])),
        "product_type": matches_rule(profile["product_type"], c.get("product_types_any", [])),
        "company_size": matches_rule(profile["company_size"], c.get("company_sizes_any", [])),
    }

    applicable = all(checks.values())
    met = [k for k, v in checks.items() if v]
    not_met = [k for k, v in checks.items() if not v]

    if applicable:
        reason = (
            f"In scope under v{regulation['version']} (effective {regulation['effective_from']}). "
            f"Matched dimensions: {', '.join(met)}."
        )
    else:
        reason = (
            f"Not in scope under v{regulation['version']} (effective {regulation['effective_from']}): failed on {', '.join(not_met)}. "
            f"Matched dimensions: {', '.join(met)}."
        )

    return {
        "code": regulation["code"],
        "name": regulation["name"],
        "authority": regulation["authority"],
        "summary": regulation["summary"],
        "source_url": regulation["source_url"],
        "applicable": applicable,
        "reason": reason,
        "confidence": round(len(met) / len(checks), 2),
        "version": regulation["version"],
        "effective_from": regulation["effective_from"],
        "repealed_on": regulation["repealed_on"],
        "notes": regulation.get("notes", ""),
    }


def validate_profile(profile: Dict[str, Any]) -> List[str]:
    errors = []

    def valid(option_name: str, value: str) -> bool:
        values = {item["value"] for item in OPTIONS[option_name]}
        return value in values

    for key in ["jurisdiction", "industry", "company_size", "product_type"]:
        if not profile.get(key):
            errors.append(f"Missing required field: {key}")

    if profile.get("jurisdiction") and not valid("jurisdictions", profile["jurisdiction"]):
        errors.append("Invalid jurisdiction")
    if profile.get("industry") and not valid("industries", profile["industry"]):
        errors.append("Invalid industry")
    if profile.get("company_size") and not valid("company_sizes", profile["company_size"]):
        errors.append("Invalid company size")
    if profile.get("product_type") and not valid("product_types", profile["product_type"]):
        errors.append("Invalid product type")

    markets = profile.get("markets") or []
    if not isinstance(markets, list):
        errors.append("Markets must be an array")
    else:
        valid_markets = {item["value"] for item in OPTIONS["jurisdictions"]}
        bad = [m for m in markets if m not in valid_markets]
        if bad:
            errors.append(f"Invalid markets: {', '.join(bad)}")

    as_of_date = profile.get("as_of_date")
    if as_of_date:
        try:
            parse_date(as_of_date)
        except ValueError:
            errors.append("Invalid as_of_date format. Use YYYY-MM-DD")

    return errors


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def _json_response(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == "/api/meta":
            regulations = list_regulation_versions()
            return self._json_response(
                HTTPStatus.OK,
                {
                    "app_name": "LexScope Global",
                    "supported_regulations": len(regulations),
                    "options": OPTIONS,
                    "today": date.today().isoformat(),
                },
            )

        if self.path == "/api/regulations":
            regulations = list_regulation_versions()
            return self._json_response(
                HTTPStatus.OK,
                {
                    "count": len(regulations),
                    "items": [
                        {
                            "code": r["code"],
                            "name": r["name"],
                            "authority": r["authority"],
                            "summary": r["summary"],
                            "source_url": r["source_url"],
                            "version": r["version"],
                            "effective_from": r["effective_from"],
                            "repealed_on": r["repealed_on"],
                        }
                        for r in regulations
                    ],
                },
            )

        return super().do_GET()

    def do_POST(self):  # noqa: N802
        content_len = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_len)

        try:
            payload = json.loads(body or b"{}")
        except json.JSONDecodeError:
            return self._json_response(HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON payload"})

        if self.path == "/api/check":
            profile = {
                "jurisdiction": payload.get("jurisdiction"),
                "industry": payload.get("industry"),
                "company_size": payload.get("company_size"),
                "product_type": payload.get("product_type"),
                "markets": payload.get("markets") or [payload.get("jurisdiction")],
                "as_of_date": payload.get("as_of_date") or date.today().isoformat(),
            }

            errors = validate_profile(profile)
            if errors:
                return self._json_response(HTTPStatus.BAD_REQUEST, {"errors": errors})

            regulations = list_regulation_versions(profile["as_of_date"])
            decisions = [evaluate_regulation(profile, regulation) for regulation in regulations]

            applicable = sorted(
                [d for d in decisions if d["applicable"]],
                key=lambda item: item["confidence"],
                reverse=True,
            )
            not_applicable = sorted(
                [d for d in decisions if not d["applicable"]],
                key=lambda item: item["confidence"],
                reverse=True,
            )

            return self._json_response(
                HTTPStatus.OK,
                {
                    "profile": profile,
                    "totals": {
                        "regulations_evaluated": len(decisions),
                        "applicable": len(applicable),
                        "not_applicable": len(not_applicable),
                    },
                    "applicable": applicable,
                    "not_applicable": not_applicable,
                },
            )

        if self.path == "/api/admin/import":
            try:
                items, parsed_format = parse_import_payload(payload)
            except (ValueError, json.JSONDecodeError) as err:
                return self._json_response(HTTPStatus.BAD_REQUEST, {"error": str(err)})

            conn = _connect()
            try:
                stats = import_regulations(conn, items)
                conn.commit()
            finally:
                conn.close()

            return self._json_response(
                HTTPStatus.OK,
                {
                    "message": "Import complete",
                    "format": parsed_format,
                    "stats": stats,
                },
            )

        return self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})


def main() -> None:
    init_db()
    port = 8080
    server = ThreadingHTTPServer(("127.0.0.1", port), AppHandler)
    print(f"LexScope Global running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
