"""Chrome Web Store status watcher for Scryfall Toolkit. Standard library only, no Claude.

Asks the Chrome Web Store which state the item is in (pending review, staged, published,
rejected...) and which version is live, remembers the answer, and sends a Telegram message
only when something changed, or when the check has failed several times in a row.

Sources, in order (``--source auto``):
  api   Chrome Web Store API v2 ``publishers/{publisher}/items/{item}:fetchStatus``.
        Needs CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID.
  page  The public listing page: only the published version, no review state.

Secrets come from environment variables or, if a variable is unset, from the Windows
Credential Manager entry of the same name (``cmdkey /generic:<NAME> /user:x /pass:<value>``).
Nothing secret is printed or written to disk.

    python -I -X utf8 tools/cws-status/cws_status.py --dry-run     # check, print, change nothing
    python -I -X utf8 tools/cws-status/cws_status.py               # what the scheduled task runs
    python -I -X utf8 tools/cws-status/cws_status.py --test-telegram
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

ITEM_ID = "ofpociogpmmgfjgjnfppnllabhjjnclf"
LISTING_URL = f"https://chromewebstore.google.com/detail/{ITEM_ID}?hl=en"
NAME = "Scryfall Toolkit"
HOME = Path(os.environ.get("CWS_STATUS_HOME") or Path.home() / ".scryfall-toolkit-cws")
STATE_FILE = HOME / "state.json"
LOG_FILE = HOME / "cws-status.log"
FAIL_ALERT_AFTER = 3          # consecutive failed checks before a Telegram alert
TIMEOUT = 30
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) cws-status-check"

SECRET_NAMES = ("CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_PUBLISHER_ID",
                "TG_BOT_TOKEN", "TG_CHAT_ID")

STATE_RU = {
    "PENDING_REVIEW": "на проверке",
    "STAGED": "одобрена, ждёт публикации",
    "PUBLISHED": "опубликована",
    "PUBLISHED_TO_TESTERS": "опубликована для тестеров",
    "REJECTED": "отклонена",
    "CANCELLED": "отправка отменена",
}

log = logging.getLogger("cws-status")


class CheckError(Exception):
    pass


# --- secrets ---------------------------------------------------------------------------

def _read_windows_credential(target: str) -> str | None:
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [
            ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
            ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
            ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)), ("Persist", wintypes.DWORD),
            ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
            ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR),
        ]

    advapi = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                 ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    advapi.CredReadW.restype = wintypes.BOOL
    advapi.CredFree.argtypes = [ctypes.c_void_p]
    pcred = ctypes.POINTER(CREDENTIAL)()
    if not advapi.CredReadW(target, 1, 0, ctypes.byref(pcred)):  # 1 = CRED_TYPE_GENERIC
        return None
    try:
        blob = bytes(pcred.contents.CredentialBlob[: pcred.contents.CredentialBlobSize])
    finally:
        advapi.CredFree(pcred)
    if len(blob) % 2 == 0 and b"\x00" in blob:  # cmdkey stores UTF-16LE
        return blob.decode("utf-16-le").strip()
    return blob.decode("utf-8").strip()


def _write_windows_credential(target: str, value: str) -> None:
    import ctypes
    from ctypes import wintypes

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [
            ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
            ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
            ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)), ("Persist", wintypes.DWORD),
            ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
            ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR),
        ]

    blob = value.encode("utf-16-le")
    buf = (ctypes.c_ubyte * len(blob)).from_buffer_copy(blob)
    cred = CREDENTIAL(Type=1, TargetName=target, CredentialBlobSize=len(blob),
                      CredentialBlob=ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)),
                      Persist=2, UserName="x")  # 2 = CRED_PERSIST_LOCAL_MACHINE
    advapi = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
    advapi.CredWriteW.restype = wintypes.BOOL
    if not advapi.CredWriteW(ctypes.byref(cred), 0):
        raise OSError(ctypes.get_last_error(), "CredWriteW failed")


def set_secrets() -> int:
    """Ask for each secret without echo and store it in the Windows Credential Manager."""
    import getpass
    print("Ввод не отображается. Пусто + Enter — оставить как есть.")
    for n in SECRET_NAMES:
        mark = "задан" if secret(n) else "нет"
        v = getpass.getpass(f"{n} [{mark}]: ").strip()
        if v:
            _write_windows_credential(n, v)
            print(f"  {n}: сохранён")
    print("Готово. Проверка: --secrets, затем --test-telegram")
    return 0


def secret(name: str) -> str | None:
    return (os.environ.get(name) or "").strip() or _read_windows_credential(name)


# --- HTTP ------------------------------------------------------------------------------

def http(url: str, *, data: dict | None = None, headers: dict | None = None) -> bytes:
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read()[:300].decode("utf-8", "replace")
        # Never echo the URL query or body: they may hold tokens.
        raise CheckError(f"HTTP {e.code} от {urllib.parse.urlsplit(url).netloc}: {detail}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise CheckError(f"сеть: {getattr(e, 'reason', e)}") from None


# --- sources ---------------------------------------------------------------------------

def api_ready() -> bool:
    return all(secret(n) for n in SECRET_NAMES[:4])


def check_api() -> dict:
    token = json.loads(http("https://oauth2.googleapis.com/token", data={
        "client_id": secret("CWS_CLIENT_ID"),
        "client_secret": secret("CWS_CLIENT_SECRET"),
        "refresh_token": secret("CWS_REFRESH_TOKEN"),
        "grant_type": "refresh_token",
    }))["access_token"]
    publisher = urllib.parse.quote(secret("CWS_PUBLISHER_ID") or "", safe="")
    raw = json.loads(http(
        f"https://chromewebstore.googleapis.com/v2/publishers/{publisher}/items/{ITEM_ID}:fetchStatus",
        headers={"Authorization": f"Bearer {token}"}))

    def rev(key: str) -> dict | None:
        r = raw.get(key)
        if not r:
            return None
        versions = sorted({c.get("crxVersion") for c in r.get("distributionChannels", []) if c.get("crxVersion")})
        return {"state": r.get("state"), "version": ", ".join(versions) or None}

    return {
        "source": "api",
        "published": rev("publishedItemRevisionStatus"),
        "submitted": rev("submittedItemRevisionStatus"),
        "upload": raw.get("lastAsyncUploadState"),
        "takenDown": bool(raw.get("takenDown")),
        "warned": bool(raw.get("warned")),
    }


def check_page() -> dict:
    html = http(LISTING_URL).decode("utf-8", "replace")
    m = re.search(r'Version</div><div class="[^"]*">([0-9][0-9.]*)', html)
    if not m:
        raise CheckError("на публичной странице не нашлась версия (разметка изменилась?)")
    return {"source": "page", "published": {"state": "PUBLISHED", "version": m.group(1)},
            "submitted": None, "upload": None, "takenDown": False, "warned": False}


def check(source: str) -> dict:
    if source == "api" or (source == "auto" and api_ready()):
        try:
            return check_api()
        except CheckError as e:
            if source == "api":
                raise
            log.warning("API не ответил (%s) — смотрю публичную страницу", e)
            result = check_page()
            result["apiError"] = str(e)
            return result
    return check_page()


# --- report ----------------------------------------------------------------------------

def fingerprint(s: dict) -> dict:
    """The fields whose change is worth a message. The source is left out on purpose."""
    return {k: s.get(k) for k in ("published", "submitted", "takenDown", "warned")}


def _rev_text(r: dict | None) -> str:
    if not r:
        return "—"
    st = STATE_RU.get(r.get("state") or "", r.get("state") or "?")
    return f"{r.get('version') or '?'} ({st})"


def describe(s: dict) -> str:
    lines = [f"Опубликована: {_rev_text(s.get('published'))}"]
    if s["source"] == "api":
        lines.append(f"Отправлена: {_rev_text(s.get('submitted'))}" if s.get("submitted")
                     else "Отправлена: нет новой отправки")
        if s.get("upload"):
            lines.append(f"Последняя загрузка: {s['upload']}")
        if s.get("takenDown"):
            lines.append("⚠ Расширение снято с публикации (takenDown)")
        if s.get("warned"):
            lines.append("⚠ У расширения предупреждение (warned)")
    else:
        lines.append("Источник: публичная страница (статус проверки не виден, только версия)")
    if s.get("apiError"):
        lines.append(f"API: {s['apiError']}")
    return "\n".join(lines)


def telegram(text: str) -> None:
    token, chat = secret("TG_BOT_TOKEN"), secret("TG_CHAT_ID")
    if not token or not chat:
        raise CheckError("нет TG_BOT_TOKEN или TG_CHAT_ID — сообщение не отправлено")
    try:
        http(f"https://api.telegram.org/bot{token}/sendMessage",
             data={"chat_id": chat, "text": text[:4000], "disable_web_page_preview": "true"})
    except CheckError as e:
        # The token is in the URL path; make sure it cannot reach the log.
        raise CheckError(str(e).replace(token, "***")) from None


# --- state -----------------------------------------------------------------------------

def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(st: dict) -> None:
    HOME.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def setup_logging(to_file: bool) -> None:
    # Under pythonw.exe (the scheduled task) there is no console: sys.stderr is None.
    handlers: list[logging.Handler] = [logging.StreamHandler()] if sys.stderr else []
    if to_file:
        HOME.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(LOG_FILE, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="проверить и показать; без Telegram и без записи состояния")
    ap.add_argument("--source", choices=("auto", "api", "page"), default="auto")
    ap.add_argument("--test-telegram", action="store_true", help="отправить пробное сообщение и выйти")
    ap.add_argument("--secrets", action="store_true", help="показать, какие секреты заданы (без значений)")
    ap.add_argument("--set-secrets", action="store_true", help="ввести секреты (без эха) в Диспетчер учётных данных")
    args = ap.parse_args(argv)
    if args.set_secrets:
        return set_secrets()
    setup_logging(to_file=not (args.dry_run or args.secrets))

    if args.secrets:
        for n in SECRET_NAMES:
            print(f"{n:18} {'задан' if secret(n) else 'НЕТ'}")
        return 0
    if args.test_telegram:
        try:
            telegram(f"{NAME}: проверка уведомлений CWS — работает.")
        except CheckError as e:
            log.error("%s", e)
            return 1
        log.info("Пробное сообщение отправлено")
        return 0

    prev = load_state()
    now = datetime.now().isoformat(timespec="seconds")
    try:
        cur = check(args.source)
    except CheckError as e:
        fails = int(prev.get("failures", 0)) + 1
        log.error("Проверка не удалась (%d подряд): %s", fails, e)
        if args.dry_run:
            return 1
        prev.update(failures=fails, lastError=str(e), lastAttempt=now)
        if fails == FAIL_ALERT_AFTER:
            try:
                telegram(f"{NAME}: проверка статуса Chrome Web Store не удаётся {fails} раза подряд.\nПоследняя ошибка: {e}")
            except CheckError as te:
                log.error("Telegram: %s", te)
        save_state(prev)
        return 1

    print(describe(cur))
    if args.dry_run:
        old = prev.get("status")
        print("\nИзменилось с прошлой проверки:" if old and fingerprint(old) != fingerprint(cur) else
              "\nПрошлого состояния нет." if not old else "\nС прошлой проверки без изменений.")
        return 0

    old = prev.get("status")
    msgs = []
    if prev.get("failures", 0) >= FAIL_ALERT_AFTER:
        msgs.append(f"{NAME}: проверка CWS снова работает.")
    if old is None:
        msgs.append(f"{NAME} — слежение за Chrome Web Store включено.\n{describe(cur)}")
    elif fingerprint(old) != fingerprint(cur) and not (old.get("source") != cur["source"]
                                                       and old.get("published") == cur.get("published")):
        # A switch between api and page alone (no version change) is not news.
        msgs.append(f"{NAME}: статус в Chrome Web Store изменился.\nБыло:\n{describe(old)}\n\nСтало:\n{describe(cur)}")

    sent_ok = True
    for m in msgs:
        try:
            telegram(m)
            log.info("Отправлено в Telegram: %s", m.splitlines()[0])
        except CheckError as e:
            sent_ok = False
            log.error("Telegram: %s", e)
    log.info("Статус: %s", describe(cur).replace("\n", " | "))
    # If the message could not go out, keep the old status so the next run tries again.
    save_state({"status": cur if sent_ok else old, "failures": 0, "lastOk": now, "lastAttempt": now})
    return 0


if __name__ == "__main__":
    sys.exit(main())
