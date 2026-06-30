import os
import time
import asyncio
import io
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Request
from pydantic import BaseModel, Field
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
OPS_BOT_TOKEN = os.getenv("OPS_BOT_TOKEN")
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
SETTINGS_URL = os.getenv("TELEGRAM_SETTINGS_URL", "https://imba.bet/profile/settings")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is required in environment")

bot = Bot(token=BOT_TOKEN)
ops_bot = Bot(token=OPS_BOT_TOKEN) if OPS_BOT_TOKEN else bot
_resolved_chat_id: Optional[str] = None
_update_offset = 0
_command_cooldown: dict[str, float] = {}
BOT_RATE_LIMIT_SEC = 15

app = FastAPI(title="imba.bet Telegram Bot")

START_HINT = "Откройте https://t.me/imbabetalert_bot и нажмите Start"


def alerts_bot() -> Bot:
    return ops_bot


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

        if CHAT_ID and cid == str(CHAT_ID):
            global _resolved_chat_id
            if await validate_chat_id(cid, alerts_bot()):
                _resolved_chat_id = cid
                print(f"Telegram listener -> ops chat {cid}")
            await alerts_bot().send_message(
                chat["id"],
                "✅ imba.bet ops alerts включены\n\n"
                "Сюда приходят:\n"
                "• WC bet probe — ошибки ставок\n"
                "• smoke-check маркетов\n"
                "• пополнения",
            )
        else:
            await send_user_welcome(chat["id"])
        return

    if text.startswith("/"):
        if CHAT_ID and cid == str(CHAT_ID):
            return
        await handle_bot_command(chat, text.split()[0])
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


async def setup_webhook() -> None:
    secret = NOTIFY_SECRET or None
    await bot.set_webhook(
        url=TELEGRAM_WEBHOOK_URL,
        secret_token=secret,
        drop_pending_updates=True,
    )
    print(f"webhook set: {TELEGRAM_WEBHOOK_URL}")


@app.on_event("startup")
async def warmup_telegram_chat() -> None:
    if TELEGRAM_USE_WEBHOOK:
        await setup_webhook()
    else:
        asyncio.create_task(telegram_update_listener())

    try:
        me = await bot.get_me()
        print(f"imba-bot ready: @{me.username} (user bot)")
        if OPS_BOT_TOKEN:
            ops_me = await ops_bot.get_me()
            print(f"ops bot ready: @{ops_me.username}")
        if CHAT_ID:
            chat_id = await resolve_chat_id()
            print(f"imba-bot notify chat: {chat_id}")
    except Exception as exc:
        print(f"imba-bot startup: {exc}")


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
        "webhook": TELEGRAM_USE_WEBHOOK,
        "opsBotSeparated": bool(OPS_BOT_TOKEN),
        "chatId": _resolved_chat_id,
        "envChatId": CHAT_ID or None,
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
        tg = alerts_bot()
        try:
            chat_id = await resolve_chat_id()
            await tg.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
        except Exception:
            global _resolved_chat_id
            _resolved_chat_id = None
            chat_id = await resolve_chat_id(force_refresh=True)
            await tg.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
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
        tg = alerts_bot()
        chat_id = await resolve_chat_id()
        await tg.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
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


class UserNotification(BaseModel):
    telegramUserId: str = Field(..., description="Telegram chat/user id")
    message: str
    buttonUrl: Optional[str] = None
    buttonText: Optional[str] = None


PUBLIC_SITE = os.getenv("PUBLIC_SITE_URL", "https://imba.bet").rstrip("/")


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
