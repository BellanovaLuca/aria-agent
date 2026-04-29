"""
Mock User Service — simulazione del sistema di gestione utenti (FastAPI, porta 8001).

Persiste utenti e cronologia reset su db.json nella stessa directory.
Al primo avvio, se db.json non esiste, carica tre utenti demo.
In produzione si sostituirebbe questo servizio con il sistema HR/LDAP reale.

Endpoints:
  GET    /users                     — lista utenti (filtro opzionale ?email=)
  GET    /users/{username}          — dettaglio singolo utente
  POST   /users                     — crea nuovo utente
  PUT    /users/{username}          — aggiorna email, nome o stato
  DELETE /users/{username}          — elimina utente
  POST   /reset-password            — esegue reset, genera password temporanea
  GET    /reset-history             — cronologia completa di tutti i reset
  GET    /reset-history/{username}  — cronologia reset per singolo utente
  DELETE /reset-history             — azzera la cronologia (usato dal frontend)
  GET    /token                     — genera JWT LiveKit per chiamata WebRTC via browser
  GET    /call                      — serve la pagina web di chiamata WebRTC
  GET    /transcripts               — lista file di trascrizione (per il frontend React)
  GET    /transcripts/{filename}    — contenuto testo di una singola trascrizione
"""
from __future__ import annotations

import json
import os
import random
import string
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel
from livekit.api import AccessToken, VideoGrants

# Carica .env dalla root del progetto (funziona sia con run_all.sh che in standalone)
load_dotenv(Path(__file__).parent.parent / ".env")

# Aggiunge la root del progetto al path per importare i modelli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.models import ResetHistoryEntry, ResetRequest, ResetResult, User

# Credenziali LiveKit per l'emissione di token WebRTC
_LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
_LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
_LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
_CALL_HTML = Path(__file__).parent / "call.html"

# ── Persistenza ───────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "db.json"

# Utenti pre-caricati al primo avvio (quando db.json non esiste ancora)
DEMO_USERS: list[dict] = [
    {
        "username": "mario.rossi",
        "email": "mario.rossi@example.com",
        "full_name": "Mario Rossi",
        "status": "active",
        "last_reset": None,
        "created_at": "2025-01-10T10:00:00+00:00",
    },
    {
        "username": "giulia.bianchi",
        "email": "giulia.bianchi@example.com",
        "full_name": "Giulia Bianchi",
        "status": "active",
        "last_reset": None,
        "created_at": "2025-02-14T09:30:00+00:00",
    },
    {
        "username": "luca.neri",
        "email": "luca.neri@example.com",
        "full_name": "Luca Neri",
        "status": "locked",
        "last_reset": None,
        "created_at": "2025-03-01T08:00:00+00:00",
    },
]

# Storage in-memory caricato da db.json all'avvio
users_db: dict[str, dict] = {}
reset_history: list[dict] = []


def _load_db() -> None:
    """Carica users_db e reset_history da db.json.

    Se il file non esiste (primo avvio), inizializza con i DEMO_USERS e salva.
    """
    global users_db, reset_history
    if DB_PATH.exists():
        data = json.loads(DB_PATH.read_text())
        users_db = {u["username"]: u for u in data.get("users", [])}
        reset_history = data.get("reset_history", [])
    else:
        users_db = {u["username"]: dict(u) for u in DEMO_USERS}
        reset_history = []
        _save_db()


def _save_db() -> None:
    """Persiste users_db e reset_history su db.json dopo ogni modifica."""
    DB_PATH.write_text(
        json.dumps(
            {"users": list(users_db.values()), "reset_history": reset_history},
            default=str,
            indent=2,
        )
    )


def _generate_temp_password() -> str:
    """Genera una password temporanea nel formato TmpXXXXXX! (6 cifre random)."""
    digits = "".join(random.choices(string.digits, k=6))
    return f"Tmp{digits}!"


# Carica il DB all'avvio del modulo (prima che FastAPI registri gli endpoint)
_load_db()

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Mock User Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Modelli di input ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    status: str = "active"


class UserUpdate(BaseModel):
    """Tutti i campi sono opzionali: aggiorna solo quelli presenti nel body."""
    email: Optional[str] = None
    full_name: Optional[str] = None
    status: Optional[str] = None


# ── Endpoints utenti ──────────────────────────────────────────────────────────

@app.get("/users", response_model=List[User])
def list_users(email: Optional[str] = Query(None)):
    """Restituisce tutti gli utenti, con filtro opzionale per indirizzo email.

    Il parametro ?email= è usato dai tool del voice agent per il lookup per email.
    """
    users = list(users_db.values())
    if email:
        users = [u for u in users if u["email"] == email]
    return [User(**u) for u in users]


@app.get("/users/{username}", response_model=User)
def get_user(username: str):
    """Restituisce il dettaglio di un singolo utente per username."""
    if username not in users_db:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return User(**users_db[username])


@app.post("/users", response_model=User, status_code=201)
def create_user(body: UserCreate):
    """Crea un nuovo utente. Restituisce 409 se lo username è già in uso."""
    if body.username in users_db:
        raise HTTPException(status_code=409, detail="Username già esistente")
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "username": body.username,
        "email": body.email,
        "full_name": body.full_name,
        "status": body.status,
        "last_reset": None,
        "created_at": now,
    }
    users_db[body.username] = user
    _save_db()
    return User(**user)


@app.put("/users/{username}", response_model=User)
def update_user(username: str, body: UserUpdate):
    """Aggiorna parzialmente un utente (email, nome completo, stato)."""
    if username not in users_db:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    user = users_db[username]
    if body.email is not None:
        user["email"] = body.email
    if body.full_name is not None:
        user["full_name"] = body.full_name
    if body.status is not None:
        user["status"] = body.status
    _save_db()
    return User(**user)


@app.delete("/users/{username}", status_code=204)
def delete_user(username: str):
    """Elimina un utente. La cronologia reset associata resta invariata."""
    if username not in users_db:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    del users_db[username]
    _save_db()


# ── Endpoint reset password ───────────────────────────────────────────────────

@app.post("/reset-password", response_model=ResetResult)
def reset_password(body: ResetRequest):
    """Esegue il reset della password per l'utente specificato.

    Logica:
    - Utente non trovato → errore (loggato in history)
    - Utente locked o suspended → errore con suggerimento supporto
    - Utente active → genera password temporanea, aggiorna last_reset, persiste

    Il campo channel ("voice" o "email") traccia da quale canale è arrivata
    la richiesta per le metriche nel frontend.
    """
    username = body.username
    if username not in users_db:
        entry = _make_history_entry(username, body.channel, False, "Utente non trovato")
        reset_history.append(entry)
        _save_db()
        return ResetResult(success=False, username=username, message="Utente non trovato")

    user = users_db[username]
    if user["status"] in ("locked", "suspended"):
        msg = f"Account {user['status']}. Contatta il supporto."
        entry = _make_history_entry(username, body.channel, False, msg)
        reset_history.append(entry)
        _save_db()
        return ResetResult(success=False, username=username, message=msg)

    new_pwd = _generate_temp_password()
    user["last_reset"] = datetime.now(timezone.utc).isoformat()
    msg = f"Password resettata con successo. Password temporanea: {new_pwd}"
    entry = _make_history_entry(username, body.channel, True, msg)
    reset_history.append(entry)
    _save_db()
    return ResetResult(success=True, username=username, message=msg, new_password=new_pwd)


def _make_history_entry(username: str, channel: str, success: bool, message: str) -> dict:
    """Costruisce una voce della cronologia reset con id univoco e timestamp UTC."""
    return {
        "id": str(uuid.uuid4()),
        "username": username,
        "channel": channel,
        "success": success,
        "message": message,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Endpoints cronologia reset ────────────────────────────────────────────────

@app.get("/reset-history", response_model=List[ResetHistoryEntry])
def get_reset_history():
    """Restituisce la cronologia completa di tutti i reset (tutti gli utenti)."""
    return [ResetHistoryEntry(**e) for e in reset_history]


@app.get("/reset-history/{username}", response_model=List[ResetHistoryEntry])
def get_reset_history_for_user(username: str):
    """Restituisce la cronologia reset filtrata per un singolo utente."""
    return [ResetHistoryEntry(**e) for e in reset_history if e["username"] == username]


@app.delete("/reset-history", status_code=204)
def clear_reset_history():
    """Azzera l'intera cronologia reset. Usato dal pulsante 'Reset metriche' nel frontend."""
    global reset_history
    reset_history = []
    _save_db()


# ── Endpoints WebRTC ──────────────────────────────────────────────────────────

@app.get("/token")
def get_webrtc_token():
    """Genera un JWT LiveKit per una chiamata WebRTC via browser.

    Crea una room con nome univoco e restituisce il token che il browser
    userà per connettersi. Quando il partecipante entra nella room, LiveKit
    auto-dispatcha il voice agent (stesso meccanismo delle chiamate SIP).

    Risposta: { token, url, room }
    """
    if not _LIVEKIT_URL or not _LIVEKIT_API_KEY or not _LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="LiveKit non configurato: controlla LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET nel .env",
        )

    room_name = f"web-{uuid.uuid4().hex[:8]}"
    token = (
        AccessToken(_LIVEKIT_API_KEY, _LIVEKIT_API_SECRET)
        .with_identity("user-web")
        .with_name("Utente Web")
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )
    return {"token": token, "url": _LIVEKIT_URL, "room": room_name}


@app.get("/call", response_class=HTMLResponse)
def get_call_page():
    """Serve la pagina HTML per effettuare una chiamata WebRTC con Sofia.

    Il browser carica il LiveKit JS SDK, ottiene un token da /token e si
    connette direttamente a LiveKit Cloud senza passare per la rete telefonica.
    """
    if not _CALL_HTML.exists():
        raise HTTPException(status_code=404, detail="call.html non trovato")
    return HTMLResponse(content=_CALL_HTML.read_text(encoding="utf-8"))


# ── Endpoints trascrizioni (per il frontend React) ────────────────────────────

_TRANSCRIPTS_DIR = Path(__file__).parent.parent / "transcripts"


def _transcript_label(filename: str) -> str:
    """Genera un'etichetta leggibile dal nome del file trascrizione."""
    import re
    m = re.match(r"(\d{8})_(\d{6})_(.+)\.txt", filename)
    if not m:
        return filename
    date_str, time_str, room = m.groups()
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
        dt_local = dt.astimezone(ZoneInfo("Europe/Rome"))
        date_label = dt_local.strftime("%d/%m/%Y %H:%M")
    except Exception:
        date_label = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str[:2]}:{time_str[2:4]}"

    if "web-" in room:
        return f"🌐 Web — {date_label}"
    caller_m = re.search(r"call-_([^_]+)_", room)
    caller = caller_m.group(1) if caller_m else ""
    return f"📞 Telefono — {date_label} — {caller}" if caller else f"📞 Telefono — {date_label}"


@app.get("/transcripts")
def list_transcripts():
    """Restituisce la lista dei file di trascrizione, dal più recente."""
    if not _TRANSCRIPTS_DIR.exists():
        return []
    files = sorted(_TRANSCRIPTS_DIR.glob("*.txt"), reverse=True)
    result = []
    for f in files:
        try:
            ts = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat()
            result.append({"filename": f.name, "label": _transcript_label(f.name), "timestamp": ts})
        except Exception:
            continue
    return result


@app.get("/transcripts/{filename}")
def get_transcript(filename: str):
    """Restituisce il contenuto testuale di una singola trascrizione."""
    safe = Path(filename).name  # Previene path traversal
    path = _TRANSCRIPTS_DIR / safe
    if not path.exists() or not path.is_file() or path.suffix != ".txt":
        raise HTTPException(status_code=404, detail="Trascrizione non trovata")
    return PlainTextResponse(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
