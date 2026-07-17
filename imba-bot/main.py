import json
import os
import re
import time
import asyncio
import io
import secrets
import mimetypes
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import BadRequest

import support_meta as sm

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
OPS_BOT_TOKEN = os.getenv("OPS_BOT_TOKEN")
SUPPORT_BOT_TOKEN = os.getenv("SUPPORT_BOT_TOKEN") or os.getenv("TELEGRAM_SUPPORT_BOT_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")
NOTIFY_SECRET = os.getenv("NOTIFY_SECRET")
BACKEND_API = os.getenv("BACKEND_API", "https://imba.bet/")
TELEGRAM_LINK_API = os.getenv(
    "TELEGRAM_LINK_API",
    urljoin(BACKEND_API.rstrip("/") + "/", "api/telegram/complete-link"),
)
TELEGRAM_BOT_API = os.getenv(
    "TELEGRAM_BOT_API",
    urljoin(BACKEND_API.rstrip("/") + "/", "api/telegram/bot/command"),
)
TELEGRAM_USE_WEBHOOK = os.getenv("TELEGRAM_USE_WEBHOOK", "").lower() in ("1", "true", "yes")
TELEGRAM_WEBHOOK_URL = os.getenv("TELEGRAM_WEBHOOK_URL", "https://imba.bet/tg/webhook")
TELEGRAM_SUPPORT_WEBHOOK_URL = os.getenv(
    "TELEGRAM_SUPPORT_WEBHOOK_URL",
    "https://imba.bet/tg/support/webhook",
)
SETTINGS_URL = os.getenv("TELEGRAM_SETTINGS_URL", "https://imba.bet/profile/settings")
SUPPORT_TELEGRAM_URL = os.getenv("SUPPORT_TELEGRAM_URL", "https://t.me/imbabetchat")
SUPPORT_CHAT_ID = os.getenv("TELEGRAM_SUPPORT_CHAT_ID") or os.getenv("TELEGRAM_CHAT_ID") or CHAT_ID
def _parse_admin_ids() -> set[str]:
    raw_parts = [
        os.getenv("TELEGRAM_SUPPORT_ADMIN_ID", "") or "",
        os.getenv("TELEGRAM_SUPPORT_ADMIN_IDS", "") or "",
    ]
    ids: set[str] = set()
    for part in raw_parts:
        for value in part.replace(";", ",").split(","):
            cleaned = value.strip()
            if cleaned:
                ids.add(cleaned)
    return ids


SUPPORT_ADMIN_IDS = _parse_admin_ids()
CHAT_ID_PERSIST_PATH = os.getenv("CHAT_ID_PERSIST_PATH", "/app/data/chat_id")
SUPPORT_SESSIONS_DIR = os.getenv("SUPPORT_SESSIONS_DIR", "/app/data/support_sessions")
OPERATOR_SESSIONS_PATH = os.getenv("OPERATOR_SESSIONS_PATH", "/app/data/operator_sessions.json")
USER_SESSIONS_PATH = os.getenv("USER_SESSIONS_PATH", "/app/data/user_sessions.json")
SUPPORT_UPLOADS_DIR = os.getenv("SUPPORT_UPLOADS_DIR", "/app/data/support_uploads")
SUPPORT_ESCALATION_SEC = int(os.getenv("SUPPORT_ESCALATION_SEC", "480"))
SUPPORT_MONITOR_ALERTS = os.getenv("SUPPORT_MONITOR_ALERTS", "").lower() in ("1", "true", "yes")
SUPPORT_ESCALATION_ALERTS = os.getenv("SUPPORT_ESCALATION_ALERTS", "").lower() in ("1", "true", "yes")
SUPPORT_TEMPLATES: dict[str, str] = {
    "/deposit": (
        "Для проверки пополнения укажите ID заявки из раздела «История финансов» "
        "и приложите скрин чека. Зачисление обычно занимает до 15 минут."
    ),
    "/withdraw": (
        "По выводу проверьте статус заявки в «Истории финансов». "
        "Если статус «В обработке» более 24 часов — пришлите ID заявки и скрин."
    ),
    "/bonus": (
        "Бонусы начисляются после выполнения условий акции. "
        "Проверьте раздел «Промокоды» и пришлите код акции, если бонус не пришёл."
    ),
}
_escalation_schedule: dict[str, float] = {}
_last_health_alert_at = 0.0
SUPPORT_MONITOR_INTERVAL_SEC = int(os.getenv("SUPPORT_MONITOR_INTERVAL_SEC", "120"))
AUTO_REPLY_TEXT = os.getenv(
    "SUPPORT_AUTO_REPLY_TEXT",
    "Спасибо! Мы получили ваше сообщение — оператор ответит в ближайшие минуты.\n\n"
    "Полезно:\n"
    "• [Пополнение](https://imba.bet/profile/wallets)\n"
    "• [Вывод](https://imba.bet/profile)\n"
    "• [Бонусы](https://imba.bet/profile/promocodes)\n"
    "• [Telegram](https://t.me/Imbabetsupport_bot)",
)
PUBLIC_SITE = os.getenv("PUBLIC_SITE_URL", "https://imba.bet").rstrip("/")
_persisted_support_chat_id: Optional[str] = None
SESSION_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{6,32}$")
SID_TAG_RE = re.compile(r"#sid:([a-zA-Z0-9_-]{6,32})")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is required in environment")

bot = Bot(token=BOT_TOKEN)
ops_bot = Bot(token=OPS_BOT_TOKEN) if OPS_BOT_TOKEN else bot
support_chat_bot_instance = Bot(token=SUPPORT_BOT_TOKEN) if SUPPORT_BOT_TOKEN else ops_bot
_resolved_chat_id: Optional[str] = None
_update_offset = 0
_command_cooldown: dict[str, float] = {}
BOT_RATE_LIMIT_SEC = 15

app = FastAPI(title="imba.bet Telegram Bot")

START_HINT = "Откройте https://t.me/imbabetalert_bot и нажмите Start"


def alerts_bot() -> Bot:
    """Legacy ops bot — do not use for new system alerts when support bot is configured."""
    return ops_bot


def system_bot() -> Bot:
    """System/ops alerts (deposits, smoke, monitors) — only @Imbabetsupport_bot."""
    if SUPPORT_BOT_TOKEN:
        return support_chat_bot_instance
    return ops_bot


def support_chat_bot() -> Bot:
    return support_chat_bot_instance


async def deliver_system_alert(text: str) -> str:
    """Post internal alert to the support ops chat (never @imbabetalert_bot users)."""
    tg = system_bot()
    chat_id = await resolve_support_chat_id()
    await tg.send_message(chat_id=chat_id, text=text[:4000], disable_web_page_preview=True)
    return chat_id


def support_site_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("💬 Чат поддержки", url=SUPPORT_TELEGRAM_URL)],
        [InlineKeyboardButton("🌐 imba.bet", url=PUBLIC_SITE)],
    ])


async def send_support_welcome(chat_id: int) -> None:
    await bot.send_message(
        chat_id,
        "🛟 Поддержка imba.bet\n\n"
        "Напишите сообщение здесь — оператор увидит его в Telegram.\n"
        "Или откройте чат поддержки:",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("💬 Открыть чат", url=SUPPORT_TELEGRAM_URL)],
        ]),
        disable_web_page_preview=True,
    )


def load_persisted_chat_id() -> Optional[str]:
    global _persisted_support_chat_id
    if _persisted_support_chat_id:
        return _persisted_support_chat_id
    try:
        with open(CHAT_ID_PERSIST_PATH, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
            if value:
                _persisted_support_chat_id = value
                return value
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"chat id persist read error: {exc}")
    return None


def save_persisted_chat_id(chat_id: str) -> None:
    global _persisted_support_chat_id, _resolved_chat_id
    _persisted_support_chat_id = chat_id
    _resolved_chat_id = chat_id
    try:
        os.makedirs(os.path.dirname(CHAT_ID_PERSIST_PATH), exist_ok=True)
        with open(CHAT_ID_PERSIST_PATH, "w", encoding="utf-8") as handle:
            handle.write(chat_id)
        print(f"Telegram support chat persisted: {chat_id}")
    except Exception as exc:
        print(f"chat id persist write error: {exc}")


def clear_persisted_chat_id() -> None:
    global _persisted_support_chat_id, _resolved_chat_id
    _persisted_support_chat_id = None
    _resolved_chat_id = None
    try:
        os.remove(CHAT_ID_PERSIST_PATH)
        print("Telegram support chat id cleared")
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"chat id persist clear error: {exc}")


def is_private_operator_chat(chat_id: str) -> bool:
    if not str(chat_id).lstrip("-").isdigit():
        return False
    if str(chat_id).startswith("-"):
        return False
    if chat_id in SUPPORT_ADMIN_IDS:
        return True
    persisted = load_persisted_chat_id()
    return bool(persisted and chat_id == persisted)


async def can_register_support_operator(chat_id: str) -> bool:
    if SUPPORT_ADMIN_IDS and chat_id not in SUPPORT_ADMIN_IDS:
        return False
    persisted = load_persisted_chat_id()
    if persisted and persisted != chat_id:
        return False
    return True


def ops_chat_candidates() -> list[str]:
    ids: list[str] = []
    for value in (
        os.getenv("TELEGRAM_SUPPORT_CHAT_ID"),
        os.getenv("TELEGRAM_CHAT_ID"),
        CHAT_ID,
        *SUPPORT_ADMIN_IDS,
        _resolved_chat_id,
        load_persisted_chat_id(),
    ):
        if value and str(value) not in ids:
            ids.append(str(value))
    return ids


def is_support_operator(chat_id: str) -> bool:
    if chat_id in SUPPORT_ADMIN_IDS:
        return True
    persisted = load_persisted_chat_id()
    return bool(persisted and chat_id == persisted)


def is_ops_chat(chat_id: str) -> bool:
    return chat_id in ops_chat_candidates()


def normalize_session_id(session_id: str) -> str:
    value = (session_id or "").strip()
    if not SESSION_ID_RE.fullmatch(value):
        raise ValueError("invalid session id")
    return value


def session_file_path(session_id: str) -> str:
    return os.path.join(SUPPORT_SESSIONS_DIR, f"{session_id}.json")


def read_session_messages(session_id: str) -> list[dict[str, Any]]:
    path = session_file_path(session_id)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            return data
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"support session read error ({session_id}): {exc}")
    return []


def append_session_message(
    session_id: str,
    role: str,
    text: str,
    *,
    auto_reply: bool = False,
    image_url: Optional[str] = None,
) -> dict[str, Any]:
    safe_id = normalize_session_id(session_id)
    entry = {
        "id": f"{int(time.time() * 1000)}-{role}",
        "role": role,
        "text": text.strip()[:2000],
        "at": int(time.time() * 1000),
    }
    if auto_reply:
        entry["autoReply"] = True
    if image_url:
        entry["imageUrl"] = image_url
    messages = read_session_messages(safe_id)
    messages.append(entry)
    messages = messages[-120:]
    os.makedirs(SUPPORT_SESSIONS_DIR, exist_ok=True)
    with open(session_file_path(safe_id), "w", encoding="utf-8") as handle:
        json.dump(messages, handle, ensure_ascii=False)
    if role == "agent" and not auto_reply:
        cancel_support_escalation(safe_id)
        sm.record_agent_response_time(safe_id, read_session_messages)
    return entry


def get_session_status(session_id: str) -> str:
    messages = read_session_messages(session_id)
    last_user_at = 0
    last_agent_at = 0
    for item in messages:
        at_val = int(item.get("at") or 0)
        if item.get("role") == "user":
            last_user_at = max(last_user_at, at_val)
        elif item.get("role") == "agent" and not item.get("autoReply"):
            last_agent_at = max(last_agent_at, at_val)
    if last_user_at <= 0:
        return "online"
    if last_agent_at >= last_user_at:
        return "online"
    age_ms = int(time.time() * 1000) - last_user_at
    if age_ms < 15_000:
        return "delivered"
    return "reading"


def schedule_support_escalation(session_id: str) -> None:
    if not SUPPORT_ESCALATION_ALERTS:
        return
    _escalation_schedule[session_id] = time.time() + SUPPORT_ESCALATION_SEC


def cancel_support_escalation(session_id: str) -> None:
    _escalation_schedule.pop(session_id, None)


async def send_support_escalation(session_id: str) -> None:
    if not SUPPORT_ESCALATION_ALERTS:
        return
    messages = read_session_messages(session_id)
    last_user = next(
        (item for item in reversed(messages) if item.get("role") == "user"),
        None,
    )
    if not last_user:
        return
    for item in reversed(messages):
        if item.get("role") == "agent" and not item.get("autoReply"):
            if int(item.get("at") or 0) >= int(last_user.get("at") or 0):
                return
    preview = (last_user.get("text") or "—")[:200]
    body = (
        "⚠️ Support: оператор не ответил\n"
        f"#sid:{session_id}\n\n"
        f"Клиент: {preview}\n\n"
        f"Ответ: /r {session_id} ваш текст"
    )
    try:
        chat_id = await deliver_system_alert(body)
        print(f"support escalation sent to {chat_id} for {session_id}")
    except Exception as exc:
        print(f"support escalation failed: {exc}")


async def support_escalation_worker() -> None:
    while True:
        await asyncio.sleep(30)
        now = time.time()
        for session_id, due_at in list(_escalation_schedule.items()):
            if now < due_at:
                continue
            await send_support_escalation(session_id)
            _escalation_schedule.pop(session_id, None)


def needs_auto_reply(session_id: str) -> bool:
    messages = read_session_messages(session_id)
    if not messages or messages[-1].get("role") != "user":
        return False
    for item in reversed(messages[:-1]):
        role = item.get("role")
        if role == "agent":
            if item.get("autoReply"):
                return False
            return True
        if role == "user":
            continue
    return True


def maybe_append_auto_reply(session_id: str) -> None:
    if not needs_auto_reply(session_id):
        return
    append_session_message(session_id, "agent", AUTO_REPLY_TEXT, auto_reply=True)


def read_user_sessions() -> dict[str, str]:
    try:
        with open(USER_SESSIONS_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return {str(key): str(value) for key, value in data.items()}
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"user sessions read error: {exc}")
    return {}


def link_user_session(user_id: str, session_id: str, *, preview: str = "", tag: str = "other") -> None:
    safe_session = normalize_session_id(session_id)
    mapping = read_user_sessions()
    mapping[str(user_id)] = safe_session
    try:
        os.makedirs(os.path.dirname(USER_SESSIONS_PATH), exist_ok=True)
        with open(USER_SESSIONS_PATH, "w", encoding="utf-8") as handle:
            json.dump(mapping, handle, ensure_ascii=False)
    except Exception as exc:
        print(f"user sessions write error: {exc}")
    meta = sm.read_session_meta(safe_session)
    sm.upsert_user_appeal(
        user_id,
        safe_session,
        tag=str(meta.get("tag") or tag),
        preview=preview,
        closed=bool(meta.get("closed")),
        csat=meta.get("csat"),
    )


def get_user_session_id(user_id: str) -> Optional[str]:
    session_id = read_user_sessions().get(str(user_id))
    if not session_id:
        return None
    try:
        normalize_session_id(session_id)
    except ValueError:
        return None
    return session_id


def list_session_messages(session_id: str, since: int = 0) -> list[dict[str, Any]]:
    safe_id = normalize_session_id(session_id)
    messages = read_session_messages(safe_id)
    if since > 0:
        return [item for item in messages if int(item.get("at") or 0) > since]
    return messages


def read_operator_sessions() -> dict[str, str]:
    try:
        with open(OPERATOR_SESSIONS_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return {str(key): str(value) for key, value in data.items()}
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f"operator sessions read error: {exc}")
    return {}


def remember_operator_session(operator_chat_id: str, session_id: str) -> None:
    safe_session = normalize_session_id(session_id)
    mapping = read_operator_sessions()
    mapping[str(operator_chat_id)] = safe_session
    try:
        os.makedirs(os.path.dirname(OPERATOR_SESSIONS_PATH), exist_ok=True)
        with open(OPERATOR_SESSIONS_PATH, "w", encoding="utf-8") as handle:
            json.dump(mapping, handle, ensure_ascii=False)
    except Exception as exc:
        print(f"operator sessions write error: {exc}")


def get_operator_last_session(operator_chat_id: str) -> Optional[str]:
    session_id = read_operator_sessions().get(str(operator_chat_id))
    if not session_id:
        return None
    try:
        normalize_session_id(session_id)
    except ValueError:
        return None
    return session_id


def extract_session_id_from_message(message: Any) -> Optional[str]:
    text = getattr(message, "text", None) or getattr(message, "caption", None) or ""
    match = SID_TAG_RE.search(text)
    return match.group(1) if match else None


def format_site_support_message(
    session_id: str,
    text: str,
    client_ip: Optional[str] = None,
    page_url: Optional[str] = None,
    page_title: Optional[str] = None,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    user_login: Optional[str] = None,
    balance_summary: Optional[str] = None,
    is_authenticated: Optional[bool] = None,
) -> str:
    lines = ["💬 Чат imba.bet", f"#sid:{session_id}"]
    meta = sm.read_session_meta(session_id)
    tag = meta.get("tag") or sm.detect_session_tag(page_url, page_title, text)
    lines.append(f"Тема: {sm.TAG_LABELS.get(tag, tag)}")
    if is_authenticated is False:
        lines.append("Клиент: гость (не авторизован)")
    elif user_id:
        identity = user_login or user_email or f"id {user_id}"
        lines.append(f"Клиент: {identity} (id {user_id})")
        if balance_summary:
            lines.append(f"Баланс: {balance_summary}")
    if client_ip:
        lines.append(f"IP: {client_ip}")
    if page_url:
        lines.append(f"Страница: {page_url}")
    if page_title:
        lines.append(f"Раздел: {page_title}")
    lines.extend(["", text.strip(), "", f"Ответ: reply или /r {session_id} ваш текст"])
    return "\n".join(lines)


async def register_support_operator(chat_id: str, chat_type: str) -> None:
    save_persisted_chat_id(chat_id)
    tg = support_chat_bot()
    me = await tg.get_me()
    if chat_type in ("group", "supergroup"):
        await tg.send_message(
            chat_id,
            f"✅ imba.bet support подключён (@{me.username})\n\n"
            "Сюда приходят сообщения с сайта imba.bet.\n"
            "Ответ: reply на сообщение или /r SESSION_ID текст",
            disable_web_page_preview=True,
        )
        return
    await tg.send_message(
        chat_id,
        "✅ Вы подключены как оператор поддержки imba.bet\n\n"
        "• Сообщения с сайта будут приходить сюда\n"
        "• Ответьте reply на сообщение клиента — или просто напишите текст\n"
        "• Команда: /r SESSION_ID ваш текст\n"
        "• Шаблоны: /deposit /withdraw /bonus\n"
        "• Закрыть диалог: /close SESSION_ID\n"
        "• Статистика: /stats",
        disable_web_page_preview=True,
    )


async def handle_ops_support_reply(chat_id: str, session_id: str, reply_text: str) -> None:
    text = reply_text.strip()
    if len(text) < 1:
        await support_chat_bot().send_message(chat_id, "⚠️ Пустой ответ.")
        return
    append_session_message(session_id, "agent", text)
    cancel_support_escalation(session_id)
    sm.record_agent_response_time(session_id, read_session_messages)
    await support_chat_bot().send_message(
        chat_id,
        f"✅ Ответ отправлен на сайт (#{session_id})",
        disable_web_page_preview=True,
    )


async def handle_support_template(chat_id: str, cmd: str, session_id: Optional[str]) -> None:
    template = SUPPORT_TEMPLATES.get(cmd)
    if not template:
        return
    target_session = session_id or get_operator_last_session(chat_id)
    if not target_session:
        await support_chat_bot().send_message(
            chat_id,
            "⚠️ Укажите session: /deposit SESSION_ID или reply на сообщение клиента.",
            disable_web_page_preview=True,
        )
        return
    await handle_ops_support_reply(chat_id, target_session, template)


async def handle_support_close(chat_id: str, session_id: Optional[str]) -> None:
    target_session = session_id or get_operator_last_session(chat_id)
    if not target_session:
        await support_chat_bot().send_message(
            chat_id,
            "⚠️ Укажите session: /close SESSION_ID",
            disable_web_page_preview=True,
        )
        return
    try:
        safe_session = normalize_session_id(target_session)
    except ValueError:
        await support_chat_bot().send_message(chat_id, "⚠️ Неверный session id.", disable_web_page_preview=True)
        return
    sm.close_session(safe_session)
    append_session_message(
        safe_session,
        "agent",
        "Диалог закрыт. Если вопрос решён — оцените поддержку в чате на сайте.",
    )
    cancel_support_escalation(safe_session)
    await support_chat_bot().send_message(
        chat_id,
        f"✅ Диалог #{safe_session} закрыт",
        disable_web_page_preview=True,
    )


async def handle_support_stats(chat_id: str) -> None:
    stats = sm.compute_support_stats(read_session_messages)
    await support_chat_bot().send_message(
        chat_id,
        sm.format_stats_message(stats),
        disable_web_page_preview=True,
    )


async def forward_user_text_to_support(chat: dict, text: str) -> None:
    try:
        target_chat_id = await resolve_support_chat_id()
    except RuntimeError:
        return
    username = chat.get("username")
    name = " ".join(
        part for part in [chat.get("first_name"), chat.get("last_name")] if part
    ).strip()
    header = ["📩 Сообщение в бот @Imbabetsupport_bot"]
    if username:
        header.append(f"От: @{username} (id {chat['id']})")
    else:
        header.append(f"От: {name or 'пользователь'} (id {chat['id']})")
    header.append("")
    body = "\n".join(header) + text.strip()
    tg = support_chat_bot()
    await tg.send_message(
        chat_id=target_chat_id,
        text=body[:4000],
        disable_web_page_preview=True,
    )


async def handle_account_link(chat: dict, token: str) -> None:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if NOTIFY_SECRET:
        headers["X-Notify-Secret"] = NOTIFY_SECRET
    payload = {
        "token": token,
        "telegramUserId": str(chat["id"]),
        "telegramUsername": chat.get("username"),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(TELEGRAM_LINK_API, json=payload, headers=headers)
        if resp.is_success:
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("⚙️ Настройки на imba.bet", url=SETTINGS_URL)],
            ])
            await bot.send_message(
                chat["id"],
                "✅ Telegram привязан к imba.bet\n\n"
                "• сброс пароля через бота\n"
                "• уведомления о пополнениях, выводах и ставках\n"
                "• /balance, /bets, /help\n\n"
                "Настройки уведомлений — в профиле на сайте.",
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
            return
        print(f"link failed {resp.status_code}: {resp.text[:300]}")
    except Exception as exc:
        print(f"link error: {exc}")
    await bot.send_message(
        chat["id"],
        "❌ Не удалось привязать аккаунт.\n\n"
        "Ссылка могла устареть или этот Telegram уже привязан к другому аккаунту.\n"
        "Запросите новую ссылку в настройках imba.bet → Профиль.",
        disable_web_page_preview=True,
    )


async def send_user_welcome(chat_id: int) -> None:
    await bot.send_message(
        chat_id,
        "👋 imba.bet\n\n"
        "Чтобы привязать аккаунт, откройте ссылку из настроек профиля на сайте.\n\n"
        "После привязки:\n"
        "• сброс пароля через бота\n"
        "• уведомления о пополнениях, выводах и ставках\n\n"
        "Команды: /balance /bets /help",
        disable_web_page_preview=True,
    )


def unlink_confirm_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Да, отвязать", callback_data="unlink_yes"),
            InlineKeyboardButton("Отмена", callback_data="unlink_no"),
        ],
    ])


async def handle_bot_command(chat: dict, command: str) -> None:
    chat_id = str(chat["id"])
    cmd = command.split()[0].lower()
    now = time.time()
    if cmd in ("/balance", "/bets"):
        last = _command_cooldown.get(f"{chat_id}:{cmd}", 0)
        if now - last < BOT_RATE_LIMIT_SEC:
            wait = int(BOT_RATE_LIMIT_SEC - (now - last)) + 1
            await bot.send_message(chat_id, f"Подождите {wait} сек. перед повтором команды.")
            return
        _command_cooldown[f"{chat_id}:{cmd}"] = now

    if cmd == "/unlink":
        await bot.send_message(
            chat_id,
            "Отвязать Telegram от imba.bet?\n\n"
            "Уведомления и сброс пароля через бота перестанут работать.",
            reply_markup=unlink_confirm_keyboard(),
            disable_web_page_preview=True,
        )
        return

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if NOTIFY_SECRET:
        headers["X-Notify-Secret"] = NOTIFY_SECRET
    payload = {"telegramUserId": chat_id, "command": command}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(TELEGRAM_BOT_API, json=payload, headers=headers)
        if resp.is_success:
            data = resp.json()
            if data.get("unlinkConfirm"):
                await bot.send_message(
                    chat_id,
                    data.get("message") or "Отвязать Telegram?",
                    reply_markup=unlink_confirm_keyboard(),
                    disable_web_page_preview=True,
                )
                return
            message = (data.get("message") or "").strip() or "Готово."
            await bot.send_message(chat_id, message, disable_web_page_preview=True)
            return
        print(f"bot command failed {resp.status_code}: {resp.text[:300]}")
    except Exception as exc:
        print(f"bot command error: {exc}")
    await bot.send_message(
        chat_id,
        "Не удалось выполнить команду. Попробуйте позже или откройте imba.bet.",
        disable_web_page_preview=True,
    )


async def process_support_update(update_data: dict[str, Any]) -> None:
    tg = support_chat_bot()
    update = Update.de_json(update_data, tg)

    message = update.message
    if not message or not message.chat:
        return

    chat = message.chat.to_dict()
    cid = str(chat["id"])
    text = message.text or ""

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        payload = (parts[1] if len(parts) > 1 else "").strip().lower()
        chat_type = chat.get("type") or "private"

        if chat_type in ("group", "supergroup"):
            if await can_bot_post_to_chat(cid, tg):
                await register_support_operator(cid, chat_type)
            else:
                me = await tg.get_me()
                await tg.send_message(
                    chat["id"],
                    f"⚠️ Добавьте @{me.username} в группу с правом отправки сообщений.",
                    disable_web_page_preview=True,
                )
            return

        if payload in ("admin", "operator", "ops") or not payload:
            if await can_register_support_operator(cid):
                await register_support_operator(cid, chat_type)
            else:
                await tg.send_message(
                    chat["id"],
                    "🛟 Imba Support\n\n"
                    "Напишите вопрос — передадим оператору.\n"
                    f"Или откройте чат на {PUBLIC_SITE}",
                    disable_web_page_preview=True,
                )
            return

        await tg.send_message(
            chat["id"],
            "🛟 Imba Support\n\n"
            "Оператор: /start\n"
            "Клиент: напишите вопрос — передадим в поддержку.",
            disable_web_page_preview=True,
        )
        return

    if text.startswith("/"):
        cmd_parts = text.split(maxsplit=2)
        cmd = cmd_parts[0].lower()
        if cmd in ("/admin", "/operator") and not is_support_operator(cid):
            if await can_register_support_operator(cid):
                await register_support_operator(cid, chat.get("type") or "private")
            return
        if cmd in SUPPORT_TEMPLATES:
            rest = text.split(maxsplit=1)[1].strip() if len(text.split(maxsplit=1)) > 1 else ""
            session_hint = rest.split()[0] if rest else None
            if session_hint and not SESSION_ID_RE.fullmatch(session_hint):
                session_hint = None
            await handle_support_template(cid, cmd, session_hint)
            return
        if cmd == "/close":
            rest = text.split(maxsplit=1)[1].strip() if len(text.split(maxsplit=1)) > 1 else ""
            session_hint = rest.split()[0] if rest else None
            if session_hint and not SESSION_ID_RE.fullmatch(session_hint):
                session_hint = None
            await handle_support_close(cid, session_hint)
            return
        if cmd == "/stats":
            await handle_support_stats(cid)
            return
        if cmd in ("/r", "/reply"):
            rest = text.split(maxsplit=1)[1] if len(text.split(maxsplit=1)) > 1 else ""
            parts = rest.split(maxsplit=1)
            if len(parts) >= 2:
                try:
                    await handle_ops_support_reply(cid, parts[0], parts[1])
                except ValueError:
                    await tg.send_message(
                        cid,
                        "⚠️ Неверный session id. Формат: /r SESSION_ID текст",
                        disable_web_page_preview=True,
                    )
            else:
                await tg.send_message(
                    cid,
                    "⚠️ Формат: /r SESSION_ID ваш текст",
                    disable_web_page_preview=True,
                )
            return

    if text.strip():
        reply_to = message.reply_to_message
        if reply_to:
            session_from_reply = extract_session_id_from_message(reply_to)
            if session_from_reply:
                try:
                    await handle_ops_support_reply(cid, session_from_reply, text)
                except ValueError:
                    await tg.send_message(
                        cid,
                        "⚠️ Неверный session id.",
                        disable_web_page_preview=True,
                    )
                return

        if is_support_operator(cid):
            last_session = get_operator_last_session(cid)
            if last_session:
                try:
                    await handle_ops_support_reply(cid, last_session, text)
                except ValueError:
                    await tg.send_message(
                        cid,
                        "⚠️ Не удалось отправить ответ. Используйте reply на сообщение клиента.",
                        disable_web_page_preview=True,
                    )
                return
            await tg.send_message(
                chat["id"],
                "Чтобы ответить клиенту с сайта — reply на его сообщение или /r SESSION_ID текст",
                disable_web_page_preview=True,
            )
            return

        try:
            await forward_user_text_to_support(chat, text)
            await tg.send_message(
                chat["id"],
                "✅ Сообщение передано оператору. Ответим здесь.",
                disable_web_page_preview=True,
            )
        except RuntimeError:
            await tg.send_message(
                chat["id"],
                "Оператор пока offline. Напишите позже или на imba.bet в чате поддержки.",
                disable_web_page_preview=True,
            )
        return


async def process_update(update_data: dict[str, Any]) -> None:
    update = Update.de_json(update_data, bot)

    callback = update.callback_query
    if callback and callback.message:
        chat = callback.message.chat
        data = callback.data or ""
        await callback.answer()
        if data == "unlink_yes":
            await handle_bot_command(chat.to_dict(), "/unlink_confirm")
            return
        if data == "unlink_no":
            await bot.send_message(chat.id, "Отвязка отменена.")
            return

    message = update.message
    if not message or not message.chat:
        return

    chat = message.chat.to_dict()
    cid = str(chat["id"])
    text = message.text or ""

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        payload = parts[1] if len(parts) > 1 else ""
        if payload.startswith("link_"):
            await handle_account_link(chat, payload[5:])
            return
        if payload == "support":
            await send_support_welcome(chat["id"])
            return

        chat_type = chat.get("type")
        if chat_type in ("group", "supergroup"):
            await bot.send_message(
                chat["id"],
                "ℹ️ @imbabetalert_bot — только личные уведомления пользователям "
                "(ставки, пополнения, сброс пароля).\n\n"
                "Системные алерты, пополнения для операторов и чат поддержки — "
                "в @Imbabetsupport_bot (команда /start оператору).",
                disable_web_page_preview=True,
            )
            return

        await send_user_welcome(chat["id"])
        return

    if text.startswith("/"):
        if SUPPORT_BOT_TOKEN and is_ops_chat(cid):
            return
        if is_ops_chat(cid):
            cmd_parts = text.split(maxsplit=2)
            cmd = cmd_parts[0].lower()
            if cmd in ("/r", "/reply") and len(cmd_parts) >= 3:
                try:
                    await handle_ops_support_reply(cid, cmd_parts[1], cmd_parts[2])
                except ValueError:
                    await alerts_bot().send_message(
                        cid,
                        "⚠️ Неверный session id. Формат: /r SESSION_ID текст",
                        disable_web_page_preview=True,
                    )
                return
            return
        cmd = text.split()[0].lower()
        if cmd == "/support":
            await send_support_welcome(chat["id"])
            return
        await handle_bot_command(chat, text.split()[0])
        return

    if text.strip():
        if SUPPORT_BOT_TOKEN and is_ops_chat(cid):
            return
        if is_ops_chat(cid):
            reply_to = message.reply_to_message
            if reply_to and reply_to.text:
                match = SID_TAG_RE.search(reply_to.text)
                if match:
                    try:
                        await handle_ops_support_reply(cid, match.group(1), text)
                    except ValueError:
                        await alerts_bot().send_message(
                            cid,
                            "⚠️ Неверный session id.",
                            disable_web_page_preview=True,
                        )
                    return
            return
        await forward_user_text_to_support(chat, text)
        await bot.send_message(
            chat["id"],
            "✅ Сообщение передано в поддержку. Ответим здесь в Telegram.\n"
            f"Также можно написать в чат: {SUPPORT_TELEGRAM_URL}",
            reply_markup=support_site_keyboard(),
            disable_web_page_preview=True,
        )
        return


async def validate_chat_id(chat_id: str, tg_bot: Bot | None = None) -> bool:
    tg = tg_bot or alerts_bot()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.telegram.org/bot{tg.token}/getChat",
            params={"chat_id": chat_id},
        )
        data = resp.json()
        return bool(data.get("ok"))


async def can_bot_post_to_chat(chat_id: str, tg_bot: Bot | None = None) -> bool:
    tg = tg_bot or alerts_bot()
    if not await validate_chat_id(chat_id, tg):
        return False
    if is_private_operator_chat(chat_id):
        return True
    try:
        me = await tg.get_me()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{tg.token}/getChatMember",
                params={"chat_id": chat_id, "user_id": me.id},
            )
            data = resp.json()
            if not data.get("ok"):
                return False
            status = data.get("result", {}).get("status")
            return status in ("administrator", "member", "creator")
    except Exception as exc:
        print(f"getChatMember error for {chat_id}: {exc}")
        return False


async def resolve_support_chat_id(force_refresh: bool = False) -> str:
    global _resolved_chat_id
    if force_refresh:
        _resolved_chat_id = None

    candidates = ops_chat_candidates()
    tg = support_chat_bot()
    for chat_id in candidates:
        if await can_bot_post_to_chat(chat_id, tg):
            _resolved_chat_id = chat_id
            return chat_id

    bot_hint = "@Imbabetsupport_bot" if SUPPORT_BOT_TOKEN else "@imbabetalert_bot"
    raise RuntimeError(
        f"Support chat is not configured. Add {bot_hint} to ops/support group "
        "and send /start, or set TELEGRAM_SUPPORT_CHAT_ID."
    )


async def resolve_chat_id(force_refresh: bool = False) -> str:
    global _resolved_chat_id
    if not force_refresh and _resolved_chat_id:
        if await validate_chat_id(_resolved_chat_id):
            return _resolved_chat_id
        _resolved_chat_id = None

    if CHAT_ID and await validate_chat_id(str(CHAT_ID)):
        _resolved_chat_id = str(CHAT_ID)
        print(f"Telegram alerts -> chat {_resolved_chat_id}")
        return _resolved_chat_id

    raise RuntimeError(START_HINT)


async def telegram_update_listener() -> None:
    global _update_offset
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
    async with httpx.AsyncClient(timeout=35.0) as client:
        while True:
            try:
                resp = await client.get(
                    url,
                    params={"offset": _update_offset, "timeout": 25},
                )
                resp.raise_for_status()
                updates = resp.json().get("result", [])
                for update in updates:
                    _update_offset = update["update_id"] + 1
                    await process_update(update)
            except Exception as exc:
                print(f"telegram poll error: {exc}")
                await asyncio.sleep(3)


async def validate_support_operator_on_startup() -> None:
    persisted = load_persisted_chat_id()
    if not persisted:
        for admin_id in SUPPORT_ADMIN_IDS:
            if await can_bot_post_to_chat(admin_id, support_chat_bot()):
                save_persisted_chat_id(admin_id)
                print(f"imba-bot support operator from env: {admin_id}")
                return
        return

    if not await can_bot_post_to_chat(persisted, support_chat_bot()):
        print(f"imba-bot stale support chat id removed: {persisted}")
        clear_persisted_chat_id()


async def setup_webhook() -> None:
    secret = NOTIFY_SECRET or None
    await bot.set_webhook(
        url=TELEGRAM_WEBHOOK_URL,
        secret_token=secret,
        drop_pending_updates=True,
    )
    print(f"webhook set: {TELEGRAM_WEBHOOK_URL}")


async def setup_support_webhook() -> None:
    if not SUPPORT_BOT_TOKEN:
        return
    secret = NOTIFY_SECRET or None
    await support_chat_bot().set_webhook(
        url=TELEGRAM_SUPPORT_WEBHOOK_URL,
        secret_token=secret,
        drop_pending_updates=False,
    )
    print(f"support webhook set: {TELEGRAM_SUPPORT_WEBHOOK_URL}")


@app.on_event("startup")
async def warmup_telegram_chat() -> None:
    if TELEGRAM_USE_WEBHOOK:
        await setup_webhook()
        await setup_support_webhook()
    else:
        asyncio.create_task(telegram_update_listener())

    try:
        me = await bot.get_me()
        print(f"imba-bot ready: @{me.username} (user bot)")
        if OPS_BOT_TOKEN:
            ops_me = await ops_bot.get_me()
            print(f"ops bot ready: @{ops_me.username}")
        if SUPPORT_BOT_TOKEN:
            support_me = await support_chat_bot().get_me()
            print(f"support bot ready: @{support_me.username}")
            await validate_support_operator_on_startup()
        persisted = load_persisted_chat_id()
        if persisted:
            print(f"imba-bot persisted support chat: {persisted}")
        try:
            support_chat = await resolve_support_chat_id()
            print(f"imba-bot system alerts -> support chat {support_chat}")
        except RuntimeError as exc:
            print(f"imba-bot startup: {exc}")
        if CHAT_ID:
            print(
                "imba-bot: CHAT_ID is legacy; system alerts use @Imbabetsupport_bot only"
            )
    except Exception as exc:
        print(f"imba-bot startup: {exc}")

    asyncio.create_task(support_escalation_worker())
    if SUPPORT_MONITOR_ALERTS:
        asyncio.create_task(support_monitor_worker())


async def support_monitor_worker() -> None:
    global _last_health_alert_at
    while True:
        await asyncio.sleep(SUPPORT_MONITOR_INTERVAL_SEC)
        try:
            stats = sm.compute_support_stats(read_session_messages)
            if stats.get("pendingOver10m", 0) <= 0:
                continue
            now = time.time()
            if now - _last_health_alert_at < 900:
                continue
            _last_health_alert_at = now
            body = (
                "⚠️ Support monitor\n"
                f"Диалогов без ответа >10 мин: {stats['pendingOver10m']}\n"
                f"Открытых: {stats.get('openCount', 0)}\n\n"
                "Команда: /stats"
            )
            await deliver_system_alert(body)
        except Exception as exc:
            print(f"support monitor error: {exc}")


@app.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(default=None),
):
    if NOTIFY_SECRET:
        if not x_telegram_bot_api_secret_token or x_telegram_bot_api_secret_token != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    payload = await request.json()
    await process_update(payload)
    return {"ok": True}


@app.post("/support/webhook")
async def support_telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: Optional[str] = Header(default=None),
):
    if not SUPPORT_BOT_TOKEN:
        raise HTTPException(status_code=404, detail="Support bot is not configured")
    if NOTIFY_SECRET:
        if not x_telegram_bot_api_secret_token or x_telegram_bot_api_secret_token != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    payload = await request.json()
    await process_support_update(payload)
    return {"ok": True}


class DepositNotification(BaseModel):
    depositId: int = Field(..., description="Internal deposit ID")
    userId: int
    amount: float
    currency: str
    status: str = Field(..., description="pending|approved|rejected|processing|success|failed")
    method: Optional[str] = None
    imageUrl: Optional[str] = None
    voucher: Optional[str] = None
    createdAt: Optional[str] = None


def format_message(n: DepositNotification) -> str:
    lines = [
        "⚡️ Новое событие пополнения",
        f"ID: {n.depositId}",
        f"Пользователь: {n.userId}",
        f"Сумма: {n.amount:.2f} {n.currency}",
        f"Статус: {n.status.upper()}",
    ]
    if n.method:
        lines.append(f"Метод: {n.method}")
    if n.voucher:
        lines.append(f"Ваучер: {n.voucher}")
    if n.createdAt:
        lines.append(f"Создано: {n.createdAt}")
    return "\n".join(lines)


def make_absolute(u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    parsed = urlparse(u)
    if parsed.scheme in ("http", "https"):
        return u
    base = BACKEND_API.rstrip("/") + "/" if BACKEND_API else ""
    if base:
        return urljoin(base, u.lstrip("/"))
    return u


@app.get("/health")
async def health():
    return {
        "ok": True,
        "bot": "imbabetalert_bot",
        "userNotifyBot": "imbabetalert_bot",
        "systemAlertBot": "Imbabetsupport_bot" if SUPPORT_BOT_TOKEN else "imbabetalert_bot",
        "webhook": TELEGRAM_USE_WEBHOOK,
        "opsBotSeparated": bool(OPS_BOT_TOKEN),
        "supportBotSeparated": bool(SUPPORT_BOT_TOKEN),
        "chatId": _resolved_chat_id,
        "envChatId": CHAT_ID or None,
        "persistedChatId": load_persisted_chat_id(),
        "supportChatConfigured": bool(ops_chat_candidates()),
    }


class SmokeAlert(BaseModel):
    message: str = Field(..., description="Short alert headline")
    details: Optional[str] = Field(default=None, description="Test output or error details")
    exitCode: Optional[int] = None


def format_smoke_message(n: SmokeAlert) -> str:
    headline = (n.message or "").strip() or "WC alert"
    if headline.startswith("🚨") or headline.startswith("⚠️"):
        lines = [headline]
    else:
        lines = [f"🚨 {headline}"]
    if n.exitCode is not None:
        lines.append(f"Exit code: {n.exitCode}")
    if n.details:
        lines.append("")
        lines.append(n.details[:3500])
    return "\n".join(lines)


@app.post("/notify-smoke")
async def notify_smoke(
    payload: SmokeAlert,
    x_notify_secret: Optional[str] = Header(default=None, alias="X-Notify-Secret"),
):
    if NOTIFY_SECRET:
        if not x_notify_secret or x_notify_secret != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        text = format_smoke_message(payload)
        try:
            await deliver_system_alert(text)
        except Exception:
            global _resolved_chat_id
            _resolved_chat_id = None
            await deliver_system_alert(text)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notify")
async def notify(
    payload: DepositNotification,
    x_notify_secret: Optional[str] = Header(default=None, alias="X-Notify-Secret"),
):
    if NOTIFY_SECRET:
        if not x_notify_secret or x_notify_secret != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        text = format_message(payload)
        tg = system_bot()
        chat_id = await deliver_system_alert(text)
        if payload.imageUrl:
            full_url = make_absolute(payload.imageUrl)
            if full_url:
                try:
                    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                        resp = await client.get(full_url)
                        resp.raise_for_status()
                        buf = io.BytesIO(resp.content)
                        buf.name = "receipt.jpg"
                        await tg.send_photo(
                            chat_id=chat_id,
                            photo=buf,
                            caption=f"Чек по пополнению #{payload.depositId}",
                        )
                except Exception as e:
                    print("photo send error:", repr(e))
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SupportNotification(BaseModel):
    message: str = Field(default="", description="Support message from imba.bet site")
    sessionId: Optional[str] = Field(default=None, description="Browser chat session id")
    pageUrl: Optional[str] = None
    pageTitle: Optional[str] = None
    clientIp: Optional[str] = None
    userId: Optional[int] = None
    userEmail: Optional[str] = None
    userLogin: Optional[str] = None
    balanceSummary: Optional[str] = None
    isAuthenticated: Optional[bool] = None
    imageUrl: Optional[str] = None


@app.get("/support/user-session/{user_id}")
async def get_user_support_session(user_id: str):
    session_id = sm.resolve_active_user_session(user_id, get_user_session_id, read_session_messages)
    if not session_id:
        return {"ok": True, "sessionId": None, "messages": [], "meta": None}
    messages = list_session_messages(session_id, since=0)
    meta = sm.public_meta(sm.read_session_meta(session_id))
    return {"ok": True, "sessionId": session_id, "messages": messages, "meta": meta}


@app.get("/support/user-appeals/{user_id}")
async def get_user_support_appeals(user_id: str):
    appeals = sm.list_user_appeals(user_id)
    enriched: list[dict[str, Any]] = []
    for item in appeals:
        session_id = item.get("sessionId")
        if not session_id:
            continue
        try:
            normalize_session_id(str(session_id))
        except ValueError:
            continue
        meta = sm.public_meta(sm.read_session_meta(str(session_id)))
        enriched.append({**item, **meta})
    return {"ok": True, "appeals": enriched}


@app.get("/support/stats")
async def get_support_stats():
    stats = sm.compute_support_stats(read_session_messages)
    return {"ok": True, **stats}


class SupportCsatPayload(BaseModel):
    sessionId: str
    rating: int = Field(..., ge=1, le=5)


@app.post("/support/csat")
async def submit_support_csat(payload: SupportCsatPayload):
    try:
        safe_session = normalize_session_id(payload.sessionId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    meta = sm.submit_csat(safe_session, payload.rating)
    append_session_message(
        safe_session,
        "agent",
        f"Спасибо за оценку {payload.rating}/5!",
        auto_reply=True,
    )
    return {"ok": True, "meta": sm.public_meta(meta)}


@app.get("/support-messages/{session_id}")
async def get_support_messages(session_id: str, since: int = 0):
    try:
        messages = list_session_messages(session_id, since=since)
        status = get_session_status(session_id)
        meta = sm.public_meta(sm.read_session_meta(session_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "messages": messages, "status": status, "meta": meta}


@app.post("/notify-support")
async def notify_support(
    payload: SupportNotification,
    x_notify_secret: Optional[str] = Header(default=None, alias="X-Notify-Secret"),
):
    if NOTIFY_SECRET:
        if not x_notify_secret or x_notify_secret != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    text = payload.message.strip()
    if not text and not payload.imageUrl:
        raise HTTPException(status_code=400, detail="Message or image is required")
    if text and len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message must be up to 2000 chars")
    if payload.imageUrl and not text:
        text = "📎 Скриншот"
    session_id = payload.sessionId
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required")
    try:
        safe_session = normalize_session_id(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    append_session_message(safe_session, "user", text, image_url=payload.imageUrl)
    session_meta = sm.touch_session_on_user_message(
        safe_session,
        page_url=payload.pageUrl,
        page_title=payload.pageTitle,
        text=text,
        user_id=str(payload.userId) if payload.userId else None,
    )
    if payload.userId:
        link_user_session(
            str(payload.userId),
            safe_session,
            preview=text,
            tag=str(session_meta.get("tag") or "other"),
        )
    tg_text = format_site_support_message(
        safe_session,
        text + (f"\n\n📎 {payload.imageUrl}" if payload.imageUrl else ""),
        client_ip=payload.clientIp,
        page_url=payload.pageUrl,
        page_title=payload.pageTitle,
        user_id=payload.userId,
        user_email=payload.userEmail,
        user_login=payload.userLogin,
        balance_summary=payload.balanceSummary,
        is_authenticated=payload.isAuthenticated,
    )

    try:
        tg = support_chat_bot()
        try:
            chat_id = await resolve_support_chat_id()
            await tg.send_message(
                chat_id=chat_id,
                text=tg_text[:4000],
                disable_web_page_preview=True,
            )
            if payload.imageUrl:
                image_abs = make_absolute(payload.imageUrl) or payload.imageUrl
                try:
                    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                        resp = await client.get(image_abs)
                        resp.raise_for_status()
                        buf = io.BytesIO(resp.content)
                        buf.name = "support.jpg"
                        await tg.send_photo(
                            chat_id=chat_id,
                            photo=buf,
                            caption=f"📎 Скрин (#{safe_session})",
                        )
                except Exception as exc:
                    print(f"support photo send error: {exc}")
            remember_operator_session(str(chat_id), safe_session)
            maybe_append_auto_reply(safe_session)
            schedule_support_escalation(safe_session)
        except RuntimeError as exc:
            offline_hint = "@Imbabetsupport_bot" if SUPPORT_BOT_TOKEN else "@imbabetchat"
            append_session_message(
                safe_session,
                "agent",
                f"Сейчас операторы offline. Откройте {offline_hint} и отправьте /start оператору.",
            )
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except BadRequest as exc:
            if "chat not found" in str(exc).lower():
                clear_persisted_chat_id()
            raise HTTPException(
                status_code=503,
                detail="Support operator is offline. Send /start to @Imbabetsupport_bot",
            ) from exc
        except Exception:
            global _resolved_chat_id
            _resolved_chat_id = None
            chat_id = await resolve_support_chat_id(force_refresh=True)
            await tg.send_message(
                chat_id=chat_id,
                text=tg_text[:4000],
                disable_web_page_preview=True,
            )
            if payload.imageUrl:
                image_abs = make_absolute(payload.imageUrl) or payload.imageUrl
                try:
                    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                        resp = await client.get(image_abs)
                        resp.raise_for_status()
                        buf = io.BytesIO(resp.content)
                        buf.name = "support.jpg"
                        await tg.send_photo(
                            chat_id=chat_id,
                            photo=buf,
                            caption=f"📎 Скрин (#{safe_session})",
                        )
                except Exception as exc:
                    print(f"support photo send error: {exc}")
            remember_operator_session(str(chat_id), safe_session)
            maybe_append_auto_reply(safe_session)
            schedule_support_escalation(safe_session)
        return {"ok": True, "sessionId": safe_session}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


ALLOWED_UPLOAD_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@app.post("/support/upload")
async def support_upload(
    file: UploadFile = File(...),
    x_notify_secret: Optional[str] = Header(default=None, alias="X-Notify-Secret"),
):
    if NOTIFY_SECRET:
        if not x_notify_secret or x_notify_secret != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP or GIF allowed")
    raw = await file.read()
    if not raw or len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File must be 1..5 MB")
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    media_id = secrets.token_hex(12)
    os.makedirs(SUPPORT_UPLOADS_DIR, exist_ok=True)
    path = os.path.join(SUPPORT_UPLOADS_DIR, f"{media_id}{ext}")
    with open(path, "wb") as handle:
        handle.write(raw)
    public_url = f"{PUBLIC_SITE}/support-chat/media/{media_id}"
    return {"ok": True, "mediaId": media_id, "url": public_url}


@app.get("/support/media/{media_id}")
async def support_media(media_id: str):
    if not re.fullmatch(r"[a-f0-9]{24}", media_id):
        raise HTTPException(status_code=400, detail="Invalid media id")
    prefix = os.path.join(SUPPORT_UPLOADS_DIR, media_id)
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        candidate = prefix + ext
        if os.path.isfile(candidate):
            media_type = mimetypes.guess_type(candidate)[0] or "application/octet-stream"
            return FileResponse(candidate, media_type=media_type)
    raise HTTPException(status_code=404, detail="Not found")


class UserNotification(BaseModel):
    telegramUserId: str = Field(..., description="Telegram chat/user id")
    message: str
    buttonUrl: Optional[str] = None
    buttonText: Optional[str] = None


def normalize_public_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        path = url.strip().lstrip("/")
        return f"{PUBLIC_SITE}/{path}"
    if parsed.hostname in ("localhost", "127.0.0.1"):
        return f"{PUBLIC_SITE}{parsed.path or ''}" + (f"?{parsed.query}" if parsed.query else "")
    return url.strip()


@app.post("/notify-user")
async def notify_user(
    payload: UserNotification,
    x_notify_secret: Optional[str] = Header(default=None, alias="X-Notify-Secret"),
):
    if NOTIFY_SECRET:
        if not x_notify_secret or x_notify_secret != NOTIFY_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        keyboard = None
        if payload.buttonUrl:
            btn_url = normalize_public_url(payload.buttonUrl)
            btn_text = (payload.buttonText or "Открыть матч").strip() or "Открыть матч"
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(btn_text, url=btn_url)],
            ])
        await bot.send_message(
            chat_id=payload.telegramUserId,
            text=payload.message,
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8088")), reload=True)
