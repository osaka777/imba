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
if not CHAT_ID:
    raise RuntimeError("CHAT_ID is required in environment")

bot = Bot(token=BOT_TOKEN)
app = FastAPI(title="Kazik Deposit Notifier")


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
    return {"ok": True}


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
        await bot.send_message(chat_id=CHAT_ID, text=text, disable_web_page_preview=True)
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
                            chat_id=CHAT_ID,
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
