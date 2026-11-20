# Chrome Web Store status → Telegram

`cws_status.py` checks Scryfall Toolkit in the Chrome Web Store and sends a Telegram message
only when the state or version changed, or when the check failed 3 times in a row
(then once more when it works again). Standard library only; no Claude session involved.

- **API source** (preferred): Chrome Web Store API v2 `fetchStatus` — published version,
  submitted version and its state (`PENDING_REVIEW`, `STAGED`, `PUBLISHED`, `REJECTED`,
  `CANCELLED`…), taken-down / warned flags. The v1.1 API ended on 15 Oct 2026.
- **Page source** (fallback, no secrets): the public listing — published version only.

State and log: `%USERPROFILE%\.scryfall-toolkit-cws\` (`state.json`, `cws-status.log`).

## Run by hand

```
python -I -X utf8 tools/cws-status/cws_status.py --dry-run         # show status, change nothing
python -I -X utf8 tools/cws-status/cws_status.py --secrets         # which secrets are set (no values)
python -I -X utf8 tools/cws-status/cws_status.py --test-telegram   # one test message
python -I -X utf8 tools/cws-status/cws_status.py --source page     # force the public page
```

## Secrets

Easiest: `--auth <client_secret_*.json> [--full-scope]` signs in to Google (Desktop OAuth client) and stores the
three CWS keys (`--full-scope` adds upload rights, so the same token can go to the release
workflow secret). The consent screen must be "In production": in "Testing" tokens die after 7 days.
`--set-secrets` asks for each value without echo.
Otherwise: read from an environment variable, or else from the Windows Credential Manager entry with
the same name. Never commit them. With `/pass` and no value `cmdkey` asks for it, so it does
not end up in the shell history:

```
cmdkey /generic:CWS_CLIENT_ID     /user:x /pass
cmdkey /generic:CWS_CLIENT_SECRET /user:x /pass
cmdkey /generic:CWS_REFRESH_TOKEN /user:x /pass
cmdkey /generic:CWS_PUBLISHER_ID  /user:x /pass
cmdkey /generic:TG_BOT_TOKEN      /user:x /pass
cmdkey /generic:TG_CHAT_ID        /user:x /pass
```

- `CWS_CLIENT_ID` / `CWS_CLIENT_SECRET` / `CWS_REFRESH_TOKEN` — the same OAuth client and
  refresh token as the release workflow's GitHub secrets (scope `chromewebstore` or
  `chromewebstore.readonly`).
- `CWS_PUBLISHER_ID` — Developer Dashboard → Account (Publisher settings).
- `TG_BOT_TOKEN` — from @BotFather; `TG_CHAT_ID` — your chat id with that bot.

Without the four `CWS_*` values the script uses the public page. Remove one: `cmdkey /delete:<NAME>`.

## Scheduled task

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\cws-status\install-task.ps1            # create, disabled
powershell -NoProfile -ExecutionPolicy Bypass -File tools\cws-status\install-task.ps1 -Enable    # create and enable
```

`\ScryfallToolkit\CwsStatus`, every 2 hours (`-Hours N`), hidden via `pythonw.exe`, runs only
while the user is logged in. Turn on/off: `Enable-ScheduledTask` / `Disable-ScheduledTask
-TaskPath '\ScryfallToolkit\' -TaskName CwsStatus`.
