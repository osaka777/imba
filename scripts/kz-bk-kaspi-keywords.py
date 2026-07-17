#!/usr/bin/env python3
"""
Топ-запросы КЗ: пополнение БК через Kaspi и всё вокруг букмекеров.

Режимы:
  1) wordstat  — живые частоты Яндекс Wordstat (нужны ключи)
  2) trends    — относительный интерес Google Trends по КЗ (бесплатно)
  3) seeds     — готовое SEO-ядро без API (всегда работает)

Ключи Wordstat (Yandex Cloud Search API / AI Studio):
  export YANDEX_AI_API_KEY="..."
  export YANDEX_FOLDER_ID="..."

Запуск:
  python3 kz-bk-kaspi-keywords.py
  python3 kz-bk-kaspi-keywords.py --mode trends
  python3 kz-bk-kaspi-keywords.py --mode wordstat
  python3 kz-bk-kaspi-keywords.py --mode wordstat --out /tmp/kz-bk-keywords.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Wordstat region: Казахстан
KZ_REGION = "159"
WORDSTAT_ROOT = "https://searchapi.api.cloud.yandex.net/v2/wordstat"

# Ядро для YouTube / SEO в КЗ (без бренда Imba в приоритете)
SEED_PHRASES = [
    # Kaspi + пополнение
    "пополнить бк через каспи",
    "пополнение бк каспи",
    "пополнить букмекера через каспи",
    "каспи банк букмекерская контора",
    "пополнение через каспи банк",
    "как пополнить счет в бк через каспи",
    "каспи платежи букмекеры",
    "пополнить счет каспи бк",
    "перевод каспи букмекер",
    "kaspi пополнение бк",
    # БК общее КЗ
    "букмекерская контора казахстан",
    "ставки на спорт казахстан",
    "лучшие бк казахстан",
    "букмекеры казахстан 2026",
    "онлайн ставки казахстан",
    "как сделать ставку",
    "ставки на футбол казахстан",
    "ставки на чм 2026",
    # Вывод / бонусы
    "вывод с бк на каспи",
    "вывести деньги с бк каспи",
    "бонус за регистрацию бк",
    "промокод букмекер казахстан",
    # Бренды (отдельно — узкий трафик)
    "1xbet каспи",
    "olimpbet каспи",
    "mostbet каспи",
    "fonbet каспи",
    "imba.bet",
    "imba bet каспи",
]

# Группы для Google Trends (макс ~5 фраз за запрос)
TRENDS_BATCHES = [
    [
        "пополнить бк через каспи",
        "пополнение бк каспи",
        "каспи банк букмекер",
        "букмекерская контора казахстан",
        "ставки на спорт казахстан",
    ],
    [
        "вывод с бк на каспи",
        "ставки на чм 2026",
        "1xbet каспи",
        "olimpbet каспи",
        "mostbet каспи",
    ],
]


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def wordstat_call(path: str, body: dict, api_key: str) -> dict:
    url = f"{WORDSTAT_ROOT}/{path.lstrip('/')}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Api-Key {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_wordstat(phrases: list[str], api_key: str, folder_id: str, num: int = 30) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()

    for i, phrase in enumerate(phrases, 1):
        eprint(f"[wordstat] {i}/{len(phrases)}: {phrase}")
        body = {
            "phrase": phrase,
            "numPhrases": num,
            "regions": [KZ_REGION],
            "folderId": folder_id,
        }
        try:
            payload = wordstat_call("topRequests", body, api_key)
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="replace")
            eprint(f"  ERROR {err.code}: {detail[:300]}")
            continue
        except Exception as err:  # noqa: BLE001
            eprint(f"  ERROR: {err}")
            continue

        total = payload.get("totalCount") or payload.get("total_count")
        if total is not None:
            key = phrase.lower().strip()
            if key not in seen:
                seen.add(key)
                rows.append(
                    {
                        "query": phrase,
                        "count": int(total),
                        "source": "seed_total",
                        "seed": phrase,
                    }
                )

        for item in payload.get("results") or []:
            q = (item.get("phrase") or item.get("text") or "").strip()
            c = item.get("count") or item.get("shows") or 0
            if not q:
                continue
            key = q.lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "query": q,
                    "count": int(c),
                    "source": "related",
                    "seed": phrase,
                }
            )

        for item in payload.get("associations") or []:
            q = (item.get("phrase") or item.get("text") or "").strip()
            c = item.get("count") or item.get("shows") or 0
            if not q:
                continue
            key = q.lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "query": q,
                    "count": int(c),
                    "source": "association",
                    "seed": phrase,
                }
            )

        time.sleep(0.35)

    rows.sort(key=lambda r: (-r["count"], r["query"]))
    return rows


def _ensure_pytrends():
    try:
        from pytrends.request import TrendReq
        return TrendReq
    except ImportError:
        pass

    import subprocess
    from pathlib import Path as P

    venv_dir = P("/tmp/kz-keywords-venv")
    py = venv_dir / "bin" / "python"
    eprint("pytrends не установлен — ставлю во временный venv...")
    if not py.exists():
        subprocess.check_call([sys.executable, "-m", "venv", str(venv_dir)])
    subprocess.check_call(
        [str(py), "-m", "pip", "install", "--quiet", "pytrends", "requests"],
    )
    if Path(sys.executable).resolve() != py.resolve():
        os.execv(str(py), [str(py), *sys.argv])
    from pytrends.request import TrendReq
    return TrendReq


def fetch_trends(batches: list[list[str]]) -> list[dict]:
    try:
        TrendReq = _ensure_pytrends()
    except Exception as err:  # noqa: BLE001
        eprint(f"Не удалось поставить pytrends: {err}")
        return []

    pytrends = TrendReq(hl="ru-KZ", tz=300)
    scores: dict[str, float] = defaultdict(float)

    for batch in batches:
        eprint(f"[trends] batch: {', '.join(batch)}")
        try:
            pytrends.build_payload(batch, timeframe="today 12-m", geo="KZ")
            df = pytrends.interest_over_time()
        except Exception as err:  # noqa: BLE001
            eprint(f"  ERROR: {err}")
            time.sleep(2)
            continue

        if df is None or df.empty:
            eprint("  пусто")
            continue

        for phrase in batch:
            if phrase not in df.columns:
                continue
            # среднее за год = относительный интерес 0–100
            scores[phrase] = float(df[phrase].mean())

        time.sleep(1.2)

    rows = [
        {
            "query": q,
            "count": round(v, 1),
            "source": "google_trends_kz",
            "seed": q,
        }
        for q, v in scores.items()
    ]
    rows.sort(key=lambda r: (-r["count"], r["query"]))
    return rows


def seed_rows() -> list[dict]:
    """Приоритетное SEO-ядро без API — для съёмки/контента прямо сейчас."""
    priority = {
        "пополнить бк через каспи": 100,
        "пополнение бк каспи": 95,
        "как пополнить счет в бк через каспи": 92,
        "пополнить букмекера через каспи": 90,
        "каспи банк букмекерская контора": 88,
        "каспи платежи букмекеры": 85,
        "пополнение через каспи банк": 82,
        "вывод с бк на каспи": 80,
        "букмекерская контора казахстан": 78,
        "ставки на спорт казахстан": 75,
        "ставки на чм 2026": 72,
        "лучшие бк казахстан": 70,
        "онлайн ставки казахстан": 68,
        "вывести деньги с бк каспи": 65,
        "бонус за регистрацию бк": 60,
        "промокод букмекер казахстан": 55,
        "1xbet каспи": 50,
        "olimpbet каспи": 48,
        "mostbet каспи": 45,
        "fonbet каспи": 40,
        "imba bet каспи": 20,
        "imba.bet": 15,
    }
    rows = []
    for i, phrase in enumerate(SEED_PHRASES, 1):
        rows.append(
            {
                "query": phrase,
                "count": priority.get(phrase, max(10, 40 - i)),
                "source": "seed_priority",
                "seed": phrase,
            }
        )
    rows.sort(key=lambda r: (-r["count"], r["query"]))
    return rows


def print_table(rows: list[dict], limit: int = 40) -> None:
    if not rows:
        print("Нет данных.")
        return
    print(f"{'#':<4} {'count':>8}  {'source':<18}  query")
    print("-" * 90)
    for i, row in enumerate(rows[:limit], 1):
        print(f"{i:<4} {row['count']:>8}  {row['source']:<18}  {row['query']}")


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["rank", "query", "count", "source", "seed"])
        writer.writeheader()
        for i, row in enumerate(rows, 1):
            writer.writerow(
                {
                    "rank": i,
                    "query": row["query"],
                    "count": row["count"],
                    "source": row["source"],
                    "seed": row["seed"],
                }
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="KZ BK/Kaspi keyword research")
    parser.add_argument(
        "--mode",
        choices=("auto", "wordstat", "trends", "seeds"),
        default="auto",
        help="auto: wordstat если есть ключи, иначе trends+seeds",
    )
    parser.add_argument("--out", type=Path, default=None, help="CSV путь")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    api_key = os.environ.get("YANDEX_AI_API_KEY", "").strip()
    folder_id = os.environ.get("YANDEX_FOLDER_ID", "").strip()

    mode = args.mode
    if mode == "auto":
        mode = "wordstat" if api_key and folder_id else "trends"

    print(f"Режим: {mode}")
    print(f"Регион: Казахстан (Wordstat {KZ_REGION})")
    print(f"Время: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print()

    rows: list[dict] = []

    if mode == "wordstat":
        if not api_key or not folder_id:
            eprint("Нужны YANDEX_AI_API_KEY и YANDEX_FOLDER_ID")
            eprint("Ключ: https://aistudio.yandex.ru/ → API keys")
            return 1
        rows = fetch_wordstat(SEED_PHRASES, api_key, folder_id)
    elif mode == "trends":
        rows = fetch_trends(TRENDS_BATCHES)
        if not rows:
            eprint("Trends пустой — показываю seed-ядро")
            rows = seed_rows()
    else:
        rows = seed_rows()

    print_table(rows, limit=args.limit)

    out = args.out
    if out is None:
        stamp = datetime.now().strftime("%Y%m%d-%H%M")
        out = Path(f"/tmp/kz-bk-kaspi-keywords-{mode}-{stamp}.csv")
    write_csv(rows, out)
    print()
    print(f"CSV: {out}")

    if mode != "wordstat":
        print()
        print("Чтобы получить живые частоты Wordstat (Яндекс, КЗ):")
        print('  export YANDEX_AI_API_KEY="..."')
        print('  export YANDEX_FOLDER_ID="..."')
        print("  python3 scripts/kz-bk-kaspi-keywords.py --mode wordstat")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
