"""
Tool functions esposte a Gemini Live durante le conversazioni telefoniche.

Ogni funzione decorata con @llm.function_tool viene registrata nel contesto
dell'agente e può essere invocata autonomamente dal modello quando lo ritiene
necessario nel flusso conversazionale.

Le funzioni comunicano esclusivamente con il Mock User Service via HTTP REST.
In produzione si sostituirebbe USER_SERVICE_URL con il servizio reale.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from livekit.agents import llm

load_dotenv(Path(__file__).parent.parent / ".env")

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8001")
log = logging.getLogger(__name__)


@llm.function_tool
async def reset_user_password(username: str) -> dict:
    """Verifica l'utente ed esegue il reset della password in un'unica operazione.

    Cerca l'utente per username o email, controlla che l'account sia attivo,
    e se lo è esegue immediatamente il reset restituendo la nuova password
    temporanea. Restituisce un messaggio chiaro in tutti i casi (non trovato,
    bloccato, oppure reset riuscito o fallito).

    Args:
        username: Username (es. "mario.rossi") o indirizzo email dell'utente.

    Returns:
        Dizionario con found, status, success, message e new_password (se reset riuscito).
    """
    log.info(">>> TOOL CALL: reset_user_password(username=%r)", username)
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Passo 1: verifica utente
        if "@" in username:
            resp = await client.get(f"{USER_SERVICE_URL}/users", params={"email": username})
            users = resp.json()
            if not users:
                log.info(">>> utente non trovato (email=%r)", username)
                return {"found": False, "message": "Nessun utente trovato con questa email."}
            user = users[0]
        else:
            resp = await client.get(f"{USER_SERVICE_URL}/users/{username}")
            if resp.status_code == 404:
                log.info(">>> utente non trovato (username=%r)", username)
                return {"found": False, "message": "Utente non trovato."}
            user = resp.json()

        # Delega tutto al backend: gestisce locked/suspended/active e registra
        # la cronologia in entrambi i casi (successo e fallimento).
        reset_resp = await client.post(
            f"{USER_SERVICE_URL}/reset-password",
            json={"username": user["username"], "channel": "voice"},
        )
        result = reset_resp.json()
        log.info(">>> reset result: %s", result)
        return {
            "found": True,
            "username": user["username"],
            "status": user["status"],
            **result,
        }
