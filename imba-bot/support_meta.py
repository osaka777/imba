from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Callable, Optional

SESSION_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{6,32}$")
SUPPORT_SESSIONS_DIR = os.getenv("SUPPORT_SESSIONS_DIR", "/app/data/support_sessions")
USER_APPEALS_PATH = os.getenv("USER_APPEALS_PATH", "/app/data/user_appeals.json")
SUPPORT_SESSION_TTL_SEC = int(os.getenv("SUPPORT_SESSION_TTL_SEC", str(2 * 3600)))

TAG_LABELS = {
    "deposit": "#deposit",
    "withdraw": "#withdraw",
    "bonus": "#bonus",
    "other": "#other",
}


def session_file_path(session_id: str) -> str:
    return os.path.join(SUPPORT_SESSIONS_DIR, f"{session_id}.json")


def session_meta_path(session_id: str) -> str:
    return os.path.join(SUPPORT_SESSIONS_DIR, f"{session_id}.meta.json")


def default_meta() -> dict[str, Any]:
    now = int(time.time() * 1000)
    return {
        "createdAt": now,
        "updatedAt": now,
        "closed": False,
        "closedAt": None,
        "tag": "other",
        "responseTimesMs": [],
        "csat": None,
        "csatAt": None,
    }


def read_session_meta(session_id: str) -> dict[str, Any]:
    path = session_meta_path(session_id)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            merged = default_meta()
            merged.update(data)
            return merged
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"support meta read error ({session_id}): {exc}")
    return default_meta()


def write_session_meta(session_id: str, meta: dict[str, Any]) -> None:
    meta["updatedAt"] = int(time.time() * 1000)
    os.makedirs(SUPPORT_SESSIONS_DIR, exist_ok=True)
    with open(session_meta_path(session_id), "w", encoding="utf-8") as handle:
        json.dump(meta, handle, ensure_ascii=False)


def ensure_session_meta(session_id: str) -> dict[str, Any]:
    meta = read_session_meta(session_id)
    if not os.path.isfile(session_meta_path(session_id)):
        write_session_meta(session_id, meta)
    return meta


def detect_session_tag(
    page_url: Optional[str] = None,
    page_title: Optional[str] = None,
    text: str = "",
) -> str:
    haystack = " ".join(
        part for part in [page_url or "", page_title or "", text] if part
    ).lower()
    if any(token in haystack for token in ("/deposit", "пополн", "deposit", "wallets", "kaspi")):
        return "deposit"
    if any(token in haystack for token in ("/withdraw", "вывод", "financehistory", "finance-history")):
        return "withdraw"
    if any(token in haystack for token in ("bonus", "бонус", "promocode", "промокод")):
        return "bonus"
    return "other"


def get_session_last_activity(read_messages: Callable[[str], list[dict[str, Any]]], session_id: str) -> int:
    messages = read_messages(session_id)
    if not messages:
        meta = read_session_meta(session_id)
        return int(meta.get("updatedAt") or 0)
    return max(int(item.get("at") or 0) for item in messages)


def resolve_active_user_session(
    user_id: str,
    get_user_session_id: Callable[[str], Optional[str]],
    read_messages: Callable[[str], list[dict[str, Any]]],
) -> Optional[str]:
    session_id = get_user_session_id(user_id)
    if not session_id:
        return None
    last_at = get_session_last_activity(read_messages, session_id)
    if last_at <= 0:
        return session_id
    age_sec = (int(time.time() * 1000) - last_at) / 1000
    if age_sec > SUPPORT_SESSION_TTL_SEC:
        return None
    return session_id


def touch_session_on_user_message(
    session_id: str,
    *,
    page_url: Optional[str],
    page_title: Optional[str],
    text: str,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    meta = ensure_session_meta(session_id)
    tag = detect_session_tag(page_url, page_title, text)
    meta["tag"] = tag
    if user_id:
        meta["userId"] = str(user_id)
    if meta.get("closed"):
        meta["closed"] = False
        meta["closedAt"] = None
    write_session_meta(session_id, meta)
    return meta


def record_agent_response_time(
    session_id: str,
    read_messages: Callable[[str], list[dict[str, Any]]],
) -> None:
    messages = read_messages(session_id)
    last_user_at = 0
    for item in reversed(messages):
        if item.get("role") == "user":
            last_user_at = int(item.get("at") or 0)
            break
    if last_user_at <= 0:
        return
    delta = int(time.time() * 1000) - last_user_at
    if delta <= 0:
        return
    meta = ensure_session_meta(session_id)
    times = list(meta.get("responseTimesMs") or [])
    times.append(delta)
    meta["responseTimesMs"] = times[-30:]
    write_session_meta(session_id, meta)


def close_session(session_id: str) -> dict[str, Any]:
    meta = ensure_session_meta(session_id)
    meta["closed"] = True
    meta["closedAt"] = int(time.time() * 1000)
    write_session_meta(session_id, meta)
    user_id = meta.get("userId")
    if user_id:
        upsert_user_appeal(
            str(user_id),
            session_id,
            tag=str(meta.get("tag") or "other"),
            preview="",
            closed=True,
            csat=meta.get("csat"),
        )
    return meta


def submit_csat(session_id: str, rating: int) -> dict[str, Any]:
    meta = ensure_session_meta(session_id)
    meta["csat"] = max(1, min(5, rating))
    meta["csatAt"] = int(time.time() * 1000)
    write_session_meta(session_id, meta)
    return meta


def public_meta(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "closed": bool(meta.get("closed")),
        "closedAt": meta.get("closedAt"),
        "tag": meta.get("tag") or "other",
        "csat": meta.get("csat"),
        "awaitingCsat": bool(meta.get("closed")) and meta.get("csat") is None,
    }


def read_user_appeals() -> dict[str, list[dict[str, Any]]]:
    try:
        with open(USER_APPEALS_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return {str(key): list(value) for key, value in data.items() if isinstance(value, list)}
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"user appeals read error: {exc}")
    return {}


def write_user_appeals(data: dict[str, list[dict[str, Any]]]) -> None:
    os.makedirs(os.path.dirname(USER_APPEALS_PATH), exist_ok=True)
    with open(USER_APPEALS_PATH, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)


def upsert_user_appeal(
    user_id: str,
    session_id: str,
    *,
    tag: str,
    preview: str,
    closed: bool,
    csat: Optional[int],
) -> None:
    mapping = read_user_appeals()
    items = mapping.get(str(user_id), [])
    now = int(time.time() * 1000)
    entry = {
        "sessionId": session_id,
        "tag": tag,
        "preview": preview[:160],
        "updatedAt": now,
        "closed": closed,
        "csat": csat,
    }
    updated = False
    for index, item in enumerate(items):
        if item.get("sessionId") == session_id:
            items[index] = {**item, **entry}
            updated = True
            break
    if not updated:
        items.insert(0, entry)
    mapping[str(user_id)] = items[:40]
    write_user_appeals(mapping)


def list_user_appeals(user_id: str) -> list[dict[str, Any]]:
    return read_user_appeals().get(str(user_id), [])


def iter_session_ids() -> list[str]:
    if not os.path.isdir(SUPPORT_SESSIONS_DIR):
        return []
    ids: list[str] = []
    for name in os.listdir(SUPPORT_SESSIONS_DIR):
        if not name.endswith(".json") or name.endswith(".meta.json"):
            continue
        session_id = name[:-5]
        if SESSION_ID_RE.fullmatch(session_id):
            ids.append(session_id)
    return ids


def compute_support_stats(
    read_messages: Callable[[str], list[dict[str, Any]]],
) -> dict[str, Any]:
    session_ids = iter_session_ids()
    response_times: list[int] = []
    under_5m = 0
    open_count = 0
    pending_over_10m = 0
    tag_counts: dict[str, int] = {}
    csat_values: list[int] = []
    now_ms = int(time.time() * 1000)

    for session_id in session_ids:
        meta = read_session_meta(session_id)
        tag = str(meta.get("tag") or "other")
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
        if meta.get("csat") is not None:
            csat_values.append(int(meta["csat"]))
        for value in meta.get("responseTimesMs") or []:
            response_times.append(int(value))
        if meta.get("closed"):
            continue
        open_count += 1
        messages = read_messages(session_id)
        last_user_at = 0
        last_agent_at = 0
        for item in messages:
            at_val = int(item.get("at") or 0)
            if item.get("role") == "user":
                last_user_at = max(last_user_at, at_val)
            elif item.get("role") == "agent" and not item.get("autoReply"):
                last_agent_at = max(last_agent_at, at_val)
        if last_user_at > last_agent_at and now_ms - last_user_at > 10 * 60 * 1000:
            pending_over_10m += 1

    for value in response_times:
        if value <= 5 * 60 * 1000:
            under_5m += 1

    avg_ms = int(sum(response_times) / len(response_times)) if response_times else 0
    avg_min = max(1, round(avg_ms / 60000)) if avg_ms else 3
    under_5m_pct = int(round((under_5m / len(response_times)) * 100)) if response_times else 0
    top_tags = sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:3]
    avg_csat = round(sum(csat_values) / len(csat_values), 1) if csat_values else None

    return {
        "avgResponseMin": avg_min,
        "under5mPct": under_5m_pct,
        "openCount": open_count,
        "pendingOver10m": pending_over_10m,
        "topTags": [{"tag": tag, "count": count} for tag, count in top_tags],
        "avgCsat": avg_csat,
        "sampleSize": len(response_times),
    }


def format_stats_message(stats: dict[str, Any]) -> str:
    top = stats.get("topTags") or []
    top_line = ", ".join(f"{TAG_LABELS.get(item['tag'], item['tag'])}: {item['count']}" for item in top) or "—"
    csat = stats.get("avgCsat")
    csat_line = f"{csat}/5" if csat is not None else "—"
    return (
        "📊 Support stats\n\n"
        f"Открытых диалогов: {stats.get('openCount', 0)}\n"
        f"Без ответа >10 мин: {stats.get('pendingOver10m', 0)}\n"
        f"Среднее время ответа: ~{stats.get('avgResponseMin', 3)} мин\n"
        f"Ответы <5 мин: {stats.get('under5mPct', 0)}%\n"
        f"Средняя оценка CSAT: {csat_line}\n"
        f"Топ темы: {top_line}"
    )
