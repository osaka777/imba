import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from typing import Optional
import asyncio
import io
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
from telegram import Bot

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")  # numeric id or @channelusername if bot is admin
NOTIFY_SECRET = os.getenv("NOTIFY_SECRET")
BACKEND_API = os.getenv("BACKEND_API", "https://imba.bet/")  # e.g. http://localhost:3000

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is required in environment")

bot = Bot(token=BOT_TOKEN)
_resolved_chat_id: Optional[str] = None
_update_offset = 0
app = FastAPI(title="Kazik Deposit Notifier")

START_HINT = "Откройте https://t.me/imbabetalert_bot и нажмите Start"


async def validate_chat_id(chat_id: str) -> bool:
    """True if bot can message this chat (user pressed Start)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getChat",
            params={"chat_id": chat_id},
        )
        data = resp.json()
        return bool(data.get("ok"))


async def resolve_chat_id(force_refresh: bool = False) -> str:
    """Deliver alerts to CHAT_ID or the latest user who pressed /start (via listener)."""
    global _resolved_chat_id
    if not force_refresh and _resolved_chat_id:
        if await validate_chat_id(_resolved_chat_id):
            return _resolved_chat_id
        _resolved_chat_id = None

    candidates: list[str] = []
    if CHAT_ID:
        candidates.append(str(CHAT_ID))

    last_error: Exception | None = None
    for cid in candidates:
        try:
            if await validate_chat_id(cid):
                _resolved_chat_id = cid
                print(f"Telegram alerts -> chat {cid}")
                return cid
            last_error = RuntimeError("chat not found")
        except Exception as exc:
            last_error = exc

    if last_error:
        raise RuntimeError(f"{last_error}. {START_HINT}") from last_error
    raise RuntimeError(START_HINT)


async def telegram_update_listener() -> None:
    global _resolved_chat_id, _update_offset
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
                    message = update.get("message") or {}
                    chat = message.get("chat") or update.get("callback_query", {}).get("message", {}).get("chat")
                    if not chat:
                        continue
                    cid = str(chat["id"])
                    if await validate_chat_id(cid):
                        _resolved_chat_id = cid
                        print(f"Telegram listener -> chat {cid}")
                    text = message.get("text") or ""
                    if text.startswith("/start"):
                        await bot.send_message(
                            chat["id"],
                            "✅ imba.bet alerts включены\n\n"
                            "Сюда приходят:\n"
                            "• WC bet probe — ошибки ставок\n"
                            "• smoke-check маркетов\n"
                            "• пополнения",
                        )
            except Exception as exc:
                print(f"telegram poll error: {exc}")
                await asyncio.sleep(3)


@app.on_event("startup")
async def warmup_telegram_chat() -> None:
    asyncio.create_task(telegram_update_listener())
    try:
        me = await bot.get_me()
        print(f"imba-bot ready: @{me.username}")
        chat_id = await resolve_chat_id()
        print(f"imba-bot notify chat: {chat_id}")
    except Exception as exc:
        print(f"imba-bot startup: {exc}")


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
    # If already absolute, keep as-is (trust backend absolute URLs)
    parsed = urlparse(u)
    if parsed.scheme in ("http", "https"):
        return u
    # Relative URL -> join with BACKEND_API if provided
    base = BACKEND_API.rstrip("/") + "/" if BACKEND_API else ""
    if base:
        return urljoin(base, u.lstrip("/"))
    return u


@app.get("/health")
async def health():
    return {
        "ok": True,
        "bot": "imbabetalert_bot",
        "chatId": _resolved_chat_id,
        "needsStart": _resolved_chat_id is None,
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
        try:
            chat_id = await resolve_chat_id()
            await bot.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
        except Exception:
            global _resolved_chat_id
            _resolved_chat_id = None
            chat_id = await resolve_chat_id(force_refresh=True)
            await bot.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
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
        # Debug: show env and URL resolution
        print("BACKEND_API:", BACKEND_API)
        print("incoming imageUrl:", payload.imageUrl)
        if payload.voucher:
            print("incoming voucher:", payload.voucher)
        # Try to send photo first to avoid exposing raw links
        text = format_message(payload)
        chat_id = await resolve_chat_id()
        await bot.send_message(chat_id=chat_id, text=text, disable_web_page_preview=True)
        if payload.imageUrl:
            full_url = make_absolute(payload.imageUrl)
            print("resolved imageUrl:", full_url)
            if full_url:
                try:
                    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                        resp = await client.get(full_url)
                        print("download status:", resp.status_code)
                        resp.raise_for_status()
                        buf = io.BytesIO(resp.content)
                        buf.name = "receipt.jpg"
                        await bot.send_photo(
                            chat_id=chat_id,
                            photo=buf,
                            caption=f"Чек по пополнению #{payload.depositId}"
                        )
                except Exception as e:
                    # Photo failed; continue with text message only
                    print("photo send error:", repr(e))
                    pass

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# Local runner: uvicorn main:app --reload --port 8088
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8088")), reload=True)
