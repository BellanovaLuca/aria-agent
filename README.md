# Password Reset AI Agent

Agente AI multicanale per il reset automatico delle password. Gestisce richieste in arrivo sia tramite **chiamata telefonica** (conversazione vocale naturale in italiano) che tramite **email** (processamento automatico), usando il framework open source [LiveKit Agents](https://github.com/livekit/agents) e **Google Gemini Live** come modello unificato per LLM, STT e TTS.

---

## Indice

- [Panoramica architetturale](#panoramica-architetturale)
- [Componenti infrastrutturali: LiveKit](#componenti-infrastrutturali-livekit)
- [Componenti infrastrutturali: Twilio](#componenti-infrastrutturali-twilio)
- [Perché Zoiper e non il Twilio Dev Phone](#perché-zoiper-e-non-il-twilio-dev-phone)
- [Flusso completo di una chiamata telefonica](#flusso-completo-di-una-chiamata-telefonica)
- [Componenti applicativi](#componenti-applicativi)
- [Flusso canale email](#flusso-canale-email)
- [Trascrizione e logging delle chiamate](#trascrizione-e-logging-delle-chiamate)
- [Sofia: personalità dell'agente vocale](#sofia-personalità-dellagente-vocale)
- [Prerequisiti](#prerequisiti)
- [Installazione](#installazione)
- [Configurazione](#configurazione)
- [Avvio e arresto](#avvio-e-arresto)
- [Log e diagnostica](#log-e-diagnostica)
- [Utilizzo e test](#utilizzo-e-test)
- [Struttura del progetto](#struttura-del-progetto)
- [Estensibilità](#estensibilità)

---

## Panoramica architetturale

Il sistema integra **tre layer infrastrutturali esterni** (LiveKit Cloud, Twilio, Google Gemini) con **cinque processi applicativi Python** che girano in locale. Il canale telefonico e il canale email sono completamente indipendenti e condividono solo il Mock User Service.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CANALE TELEFONICO                                  │
│                                                                               │
│  [Telefono fisico]           o         [Zoiper - softphone SIP]              │
│          │                                        │                           │
│          │ PSTN (rete telefonica)                 │ SIP over TCP/UDP          │
│          ▼                                        ▼                           │
│  ┌───────────────────────────────────────────────────────┐                   │
│  │                       TWILIO                           │                   │
│  │  • Numero telefonico (+17124584090)                   │                   │
│  │  • SIP Domain (livekit-agents-poc.sip.twilio.com)     │                   │
│  │  • TwiML Bin (logica di instradamento)                │                   │
│  └───────────────────────┬───────────────────────────────┘                   │
│                          │ SIP over TCP                                       │
│                          ▼                                                    │
│  ┌───────────────────────────────────────────────────────┐                   │
│  │                   LIVEKIT CLOUD                        │                   │
│  │  • SIP Inbound Trunk (ST_h84pMyGNifi5)               │                   │
│  │  • Dispatch Rule → crea room "call-XXXX"              │                   │
│  │  • WebRTC media relay                                 │                   │
│  └───────────────────────┬───────────────────────────────┘                   │
│                          │ WebRTC / LiveKit protocol                          │
│                          ▼                                                    │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │       Voice Agent (Python)       │    │      Google Gemini Live          │  │
│  │  PasswordResetAgent             │◄──►│  gemini-2.5-flash-native-audio  │  │
│  │  tools: reset_user_password     │    │  STT + LLM + TTS in un modello  │  │
│  │                                 │    └─────────────────────────────────┘  │
│  └─────────────────┬───────────────┘                                          │
└────────────────────│────────────────────────────────────────────────────────┘
                     │
┌────────────────────│────────────────────────────────────────────────────────┐
│                    │ CANALE EMAIL                                             │
│                    │                                                          │
│    ┌───────────────▼──────────────────────────────────────────────────┐     │
│    │                   SERVIZI APPLICATIVI LOCALI                      │     │
│    │                                                                    │     │
│    │  Voice Agent ──────────────────────────────────┐                  │     │
│    │                                                 │ HTTP REST        │     │
│    │  Email Processor ──────────────────────────────┤                  │     │
│    │  (polling ogni 10s)                            ▼                  │     │
│    │                                    ┌──────────────────────┐       │     │
│    │                                    │  Mock User Service   │       │     │
│    │                                    │  FastAPI :8001       │       │     │
│    │                                    └──────────┬───────────┘       │     │
│    │                                               │                   │     │
│    │  Email Processor ◄─────────────────── Mock Email API             │     │
│    │                                        FastAPI :8002              │     │
│    │                                               │                   │     │
│    │                                    ┌──────────▼───────────┐       │     │
│    │                                    │  Frontend Streamlit  │       │     │
│    │                                    │  Dashboard + Admin   │       │     │
│    │                                    │  :8501               │       │     │
│    │                                    └──────────────────────┘       │     │
│    └────────────────────────────────────────────────────────────────── ┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Componenti infrastrutturali: LiveKit

### Cos'è LiveKit

[LiveKit](https://livekit.io) è un server WebRTC open source che gestisce comunicazione audio/video in tempo reale. In questo progetto è il **ponte tra la rete telefonica (SIP) e il voice agent Python**.

LiveKit può essere usato in due modalità:

| | LiveKit Cloud | Self-hosted |
|---|---|---|
| **Setup** | Zero — account gratuito su livekit.io | Docker + Redis + IP pubblico + porte UDP aperte |
| **SIP handling** | Incluso, gestito da LiveKit | Richiede il servizio separato `livekit/sip` |
| **Piano gratuito** | 1.000 minuti agente/mese | Nessun limite (costi infra a tuo carico) |
| **Scalabilità** | A pagamento oltre i 1.000 min | Dipende dall'infrastruttura che gestisci |
| **Adatto a** | POC, sviluppo, demo, piccoli volumi | Produzione, privacy totale, grandi volumi |

### Il piano gratuito di LiveKit Cloud è sufficiente?

**Sì, per questo POC e per volumi bassi.** 1.000 minuti/mese corrispondono a circa 16 ore di conversazione agente, più che sufficienti per sviluppo e demo.

**No, se vuoi scalare in produzione.** Oltre i 1.000 minuti il traffico è bloccato (o addebitato a seconda del piano). Per un'applicazione in produzione con più chiamate simultanee occorre un piano a pagamento LiveKit Cloud oppure passare al self-hosting.

> **LiveKit è sempre necessario** nel canale telefonico, sia nella versione cloud che self-hosted. È lui che riceve la chiamata SIP da Twilio, crea la room WebRTC e consegna l'audio al voice agent Python. Non esiste un percorso diretto da Twilio all'agente che non passi per un server LiveKit (o equivalente WebRTC/SIP).

### Cosa fa concretamente LiveKit Cloud in questo progetto

1. **Espone un endpoint SIP pubblico**: `2l6tw05h8wv.sip.livekit.cloud` — è l'indirizzo a cui Twilio invia la chiamata via protocollo SIP.
2. **Gestisce l'inbound SIP trunk**: riceve la chiamata, verifica le credenziali SIP (`SIP_USERNAME` / `SIP_PASSWORD`) e le IP autorizzate (range Twilio).
3. **Crea una room WebRTC** con prefisso `call-` (definito nella dispatch rule) e ci aggiunge il partecipante SIP (il chiamante).
4. **Notifica il voice agent** tramite il sistema di job dispatch di LiveKit Agents: il worker Python che è in ascolto (`python voice_agent/agent.py dev`) riceve il job, si connette alla room e inizia la conversazione.
5. **Fa da relay media**: l'audio del chiamante arriva via SIP → LiveKit lo converte in WebRTC e lo consegna all'agente; l'audio generato da Gemini Live torna all'indietro verso il chiamante.

### Configurazione LiveKit applicata in questo progetto

Due risorse create tramite LiveKit CLI (`lk`):

**1. Inbound SIP Trunk** (`telephony/inbound-trunk.json`):
```json
{
  "trunk": {
    "name": "Twilio Inbound Trunk — Password Reset Agent",
    "numbers": ["+17124584090"],
    "allowed_addresses": [
      "54.172.60.0/23", "54.244.51.0/24", "54.171.127.192/26",
      "35.156.191.128/25", "54.65.63.192/26", "54.169.127.128/26",
      "54.252.254.64/26", "177.71.206.192/26", "34.203.250.0/23",
      "3.122.181.0/24"
    ]
  }
}
```
- `numbers`: il numero Twilio da cui arriveranno le chiamate
- `allowed_addresses`: i range IP dei server Twilio — LiveKit accetta chiamate SIP solo da questi indirizzi (sicurezza)
- **Nota:** la configurazione NON include `auth_username`/`auth_password` perché nella configurazione finale le credenziali SIP sono gestite lato Twilio tramite il SIP Domain (non lato LiveKit trunk)

**2. Dispatch Rule** (`telephony/dispatch-rule.json`):
```json
{
  "dispatch_rule": {
    "rule": {
      "dispatchRuleIndividual": {
        "roomPrefix": "call-"
      }
    },
    "trunk_ids": ["ST_h84pMyGNifi5"]
  }
}
```
- Collega il trunk SIP (`ST_h84pMyGNifi5`) alla logica di dispatch
- `dispatchRuleIndividual`: ogni chiamata in ingresso crea una room separata (un agente per chiamante)
- `roomPrefix: "call-"`: le room si chiamano `call-<id-univoco>`

> **Come trovare l'ID trunk**: l'ID `ST_h84pMyGNifi5` è assegnato da LiveKit al momento della creazione del trunk. Per visualizzarlo: LiveKit Cloud Dashboard → Telephony → SIP Trunks. NON è derivabile dal nome del progetto.

> **Endpoint SIP critico**: L'endpoint SIP `2l6tw05h8wv.sip.livekit.cloud` è **specifico per ogni progetto LiveKit** e visibile solo nella dashboard (Telephony → SIP Trunks). Non coincide con il WebSocket URL del progetto (`agents-poc-ovzu2cz3.livekit.cloud`). Usare quello sbagliato produce errore Twilio 32011 o "404 No trunk found".

---

## Componenti infrastrutturali: Twilio

### Cos'è Twilio e perché serve

Twilio è una piattaforma di comunicazione cloud che fornisce numeri di telefono reali e API per gestire chiamate vocali, SMS e altro. In questo progetto il suo ruolo è quello di **PSTN gateway**: converte le chiamate dalla rete telefonica tradizionale in SIP e le instrada verso LiveKit Cloud.

Senza Twilio (o un provider equivalente), il voice agent è raggiungibile solo in console locale (`python voice_agent/agent.py console`) o via browser WebRTC — non tramite un numero di telefono reale.

### Tutto ciò che è stato configurato su Twilio

#### 1. Account Twilio (piano Trial)
- Credito iniziale gratuito: **$15** — sufficiente per settimane/mesi di test
- Limite principale del trial: puoi chiamare solo verso **numeri verificati** (quelli che aggiungi manualmente alla tua lista di numeri verificati)
- Il numero acquistato conta come numero in uscita solo per il Dev Phone, non per le chiamate reali in uscita verso altri numeri non verificati

#### 2. Numero di telefono acquistato
- **Numero**: `+17124584090` (US, circa $1/mese)
- I numeri italiani (+39) richiedono documentazione aggiuntiva su Twilio per motivi regolatori; per il POC è sufficiente un numero USA
- Configurato su: **Twilio Console → Phone Numbers → Manage → Active numbers**

#### 3. TwiML Bin

**Cos'è un TwiML Bin?**

TwiML (Twilio Markup Language) è un dialetto XML che dice a Twilio cosa fare quando riceve o effettua una chiamata. Un TwiML Bin è semplicemente un URL ospitato da Twilio che restituisce una risposta TwiML statica, senza bisogno di un tuo server web.

Quando il numero `+17124584090` riceve una chiamata, Twilio fa una richiesta HTTP al TwiML Bin associato e segue le istruzioni XML che riceve in risposta.

**TwiML configurato** (`telephony/twiml-template.xml`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip username="test1234" password="Password1234!">
      sip:+17124584090@2l6tw05h8wv.sip.livekit.cloud;transport=tcp
    </Sip>
  </Dial>
</Response>
```

Traduzione in italiano di ciò che fa:
- `<Dial>`: esegui una chiamata in uscita
- `<Sip>`: la destinazione è un endpoint SIP (non un numero telefonico)
- `username`/`password`: credenziali SIP per autenticarsi sull'endpoint LiveKit
- `sip:+17124584090@2l6tw05h8wv.sip.livekit.cloud`: l'indirizzo SIP di destinazione — numero@endpoint-LiveKit
- `;transport=tcp`: usa TCP invece di UDP (più affidabile su internet per questo caso d'uso)

**Dove è stato creato**: Twilio Console → Develop → TwiML Bins → Create new TwiML Bin

#### 4. Voice Configuration del numero

Il numero `+17124584090` è stato configurato per usare il TwiML Bin quando riceve una chiamata:

**Twilio Console → Phone Numbers → Manage → Active numbers → `+17124584090` → Voice Configuration**:
- "A call comes in" → **TwiML Bin** → (TwiML Bin creato al punto precedente)

Questo collega il numero alla logica di instradamento.

#### 5. SIP Domain

**Cos'è un SIP Domain Twilio?**

Un SIP Domain Twilio (`nomeprogetto.sip.twilio.com`) è un endpoint SIP gestito da Twilio che permette a **client SIP** (telefoni fisici, softphone, centralini VoIP) di registrarsi e fare chiamate *attraverso* Twilio, come se Twilio fosse il loro operatore telefonico.

In questo progetto è stato usato il SIP Domain `livekit-agents-poc.sip.twilio.com` per permettere a **Zoiper** (un softphone SIP) di effettuare chiamate tramite Twilio al numero `+17124584090`.

**Configurazione SIP Domain** (Twilio Console → Voice → SIP Domains):
- **SIP Domain**: `livekit-agents-poc.sip.twilio.com`
- **Credential List**: username `test1234`, password `Password1234!`
- **Voice Authentication**: abilitata con la Credential List sopra
- **SIP Registration**: abilitata (permette a client SIP come Zoiper di registrarsi)

**Come si collega al numero**: quando Zoiper chiama `+17124584090` passando per il SIP Domain, Twilio instrada la chiamata verso il numero → attiva il TwiML Bin → instrada verso LiveKit.

---

## Perché Zoiper e non il Twilio Dev Phone

### Il Twilio Dev Phone

Twilio Dev Phone è un telefono virtuale in-browser accessibile da Twilio Console → Dev Tools → Dev Phone. Permette di testare configurazioni vocali chiamando direttamente i propri numeri Twilio dal browser.

### Perché non funziona con un account Trial + un solo numero

Il problema è strutturale: **per fare una chiamata servono due numeri distinti** — uno che chiama e uno che riceve. Con un account Trial si ha di solito **un solo numero acquistato** (`+17124584090`).

Quando si usa Twilio Dev Phone:
1. Dev Phone seleziona il numero Twilio come identità del chiamante (caller ID)
2. Dev Phone tenta di chiamare lo stesso numero `+17124584090`
3. Twilio si trova a instradare una chiamata da `+17124584090` a `+17124584090`: **la stessa risorsa non può essere contemporaneamente chiamante e chiamata**
4. Risultato: la chiamata fallisce o si chiude immediatamente

In pratica: è come chiamare il proprio telefono da sé stessi — squilla (o non squilla) ma non c'è nessuno dall'altra parte ad alzare.

> Con un account a pagamento o con due numeri Twilio distinti, Dev Phone funzionerebbe normalmente.

### Cos'è Zoiper e perché l'abbiamo usato

**Zoiper** (https://www.zoiper.com) è un **softphone SIP** — un'applicazione che simula un telefono VoIP. È disponibile per Windows, macOS, Linux, iOS e Android, sia nella versione gratuita che a pagamento. La versione gratuita è sufficiente per questo caso d'uso.

Un softphone SIP si comporta esattamente come un telefono fisico VoIP: si registra presso un server SIP (in questo caso il SIP Domain Twilio `livekit-agents-poc.sip.twilio.com`) usando delle credenziali, e poi può effettuare e ricevere chiamate.

**Perché Zoiper risolve il problema:**

Zoiper si registra al SIP Domain Twilio come un client SIP indipendente, **non usando il numero Twilio come caller ID**. Quando chiama `+17124584090`:

1. Zoiper → SIP REGISTER + SIP INVITE al SIP Domain `livekit-agents-poc.sip.twilio.com`
2. Twilio accetta la chiamata (Zoiper è autenticato con le credenziali SIP)
3. Twilio instrada verso il numero `+17124584090` come se fosse una chiamata esterna
4. Il TwiML Bin scatta → Twilio apre una connessione SIP verso LiveKit Cloud
5. LiveKit crea la room e consegna la chiamata al voice agent

In questo modo il chiamante (Zoiper) e il destinatario (il numero Twilio) sono entità separate, e non si crea il conflitto del "numero che chiama se stesso".

**Configurazione di Zoiper:**
- SIP Account → Domain: `livekit-agents-poc.sip.twilio.com`
- Username: `test1234`
- Password: `Password1234!`
- Una volta registrato (status: "Registered"), basta digitare `+17124584090` e chiamare

---

## Flusso completo di una chiamata telefonica

Questo è il percorso esatto che segue ogni chiamata, dal momento in cui si compone il numero fino alla voce dell'agente:

```
1. ZOIPER
   Chiama: +17124584090
   Via: livekit-agents-poc.sip.twilio.com (SIP Domain Twilio)
   Credenziali: test1234 / Password1234!
         │
         │ SIP INVITE (TCP/UDP)
         ▼
2. TWILIO SIP DOMAIN
   Autentica Zoiper con la Credential List
   Instrada la chiamata verso il numero +17124584090
         │
         ▼
3. TWILIO — NUMERO +17124584090
   Riceve la chiamata in ingresso
   Interroga il TwiML Bin configurato (Voice Configuration)
         │
         │ HTTP GET → TwiML Bin
         ▼
4. TWIML BIN — risposta XML:
   <Dial><Sip username="test1234" password="Password1234!">
     sip:+17124584090@2l6tw05h8wv.sip.livekit.cloud;transport=tcp
   </Sip></Dial>

   Twilio apre una connessione SIP verso LiveKit Cloud
         │
         │ SIP INVITE over TCP
         ▼
5. LIVEKIT CLOUD — endpoint: 2l6tw05h8wv.sip.livekit.cloud
   Verifica che l'IP sorgente sia nei range Twilio autorizzati (inbound trunk)
   Abbina al trunk ST_h84pMyGNifi5 grazie alla dispatch rule
   Crea una nuova room WebRTC: es. "call-f3a9d2b1"
   Aggiunge il partecipante SIP (il chiamante) alla room
         │
         │ Notifica job dispatch a tutti i worker registrati
         ▼
6. VOICE AGENT (Python — processo locale)
   Riceve il job da LiveKit
   Si connette alla room "call-f3a9d2b1"
   Crea la sessione Gemini Live (audio bidirezionale)
         │
         ▼
7. SOFIA (agente) — on_enter()
   generate_reply("Sei Sofia. Saluta in modo caldo e naturale...")
   ➜ "Ciao, sono Sofia del supporto IT. Come posso aiutarti oggi?"
         │
         │ Audio bidirezionale in tempo reale
         ▼
8. GEMINI LIVE — gemini-2.5-flash-native-audio-preview-12-2025
   STT: trascrive l'audio del chiamante
   LLM: decide la risposta e quando invocare i tool
   TTS: genera audio in italiano (voce "Aoede", femminile)

   Quando l'utente dice "devo resettare la password per mario.rossi":
         │
         ▼
9. FUNCTION TOOL (singolo, atomico)
   reset_user_password("mario.rossi")
   → GET http://localhost:8001/users/mario.rossi     (verifica utente)
   → POST http://localhost:8001/reset-password       (esegue reset)
   → {"found": true, "status": "active", "success": true, "message": "..."}
         │
         ▼
10. SOFIA risponde vocalmente
    "Perfetto, ho resettato la password per mario.rossi. Riceverà a breve
     una email con la nuova password temporanea — ricordi di cambiarla al
     primo accesso entro 24 ore. Posso aiutarti con altro?"
         │
         ▼
11. FINE CHIAMATA
    Trascrizione salvata in: transcripts/YYYYMMDD_HHMMSS_call-XXXX.txt
```

---

## Componenti applicativi

### 1. Voice Agent (`voice_agent/`)

Agente LiveKit che gestisce le chiamate telefoniche in ingresso. Si presenta come **Sofia**, assistente vocale del supporto IT aziendale, con una personalità calda e naturale che riduce la percezione di parlare con un bot.

| Proprietà | Valore |
|-----------|--------|
| Framework | LiveKit Agents 1.5.5 |
| Modello | Google Gemini Live `gemini-2.5-flash-native-audio-preview-12-2025` |
| Voce | Aoede (it-IT, femminile) |
| Infrastruttura | LiveKit Cloud |
| Nome agente | Sofia |

Gemini Live gestisce **LLM + STT + TTS in un unico modello nativo audio** — non servono provider STT e TTS separati.

**Personalità e tono** (`voice_agent/agent.py` → `INSTRUCTIONS`):
Sofia non legge un copione: conduce una conversazione reale, mostra empatia se l'utente è frustrato, usa intercalari naturali ("certo", "nessun problema") e chiude la chiamata con un saluto genuino. Il nome e il tono sono configurabili modificando le costanti `AGENT_NAME` e `INSTRUCTIONS`.

**Tool functions esposte al LLM** (`voice_agent/tools.py`):
- `reset_user_password(username)` — unico tool atomico: verifica esistenza e stato dell'utente, ed esegue immediatamente il reset. Supporta lookup per username e per email. Un singolo tool elimina il rischio che l'utente interrompa Gemini Live tra una chiamata e l'altra.

### 2. Email Processor (`email_processor/`)

Loop asincrono che fa polling sull'inbox mock ogni N secondi. Per ogni email non processata:
1. Estrae username o indirizzo email dal corpo con regex
2. Chiama il User Service per il reset
3. Invia email di risposta (conferma o errore) tramite l'Email Service
4. Marca l'email come processata

**Formato email accettato nel corpo:**
```
Richiedo il reset della password per l'account: mario.rossi
Richiedo il reset della password per l'account: mario.rossi@example.com
```

### 3. Mock User Service (`user_service/` — porta 8001)

Microservizio FastAPI che simula il sistema esterno di gestione utenti. Persiste i dati su `user_service/db.json`.

| Endpoint | Descrizione |
|----------|-------------|
| `GET /users` | Lista tutti gli utenti (supporta `?email=` per lookup) |
| `GET /users/{username}` | Dettaglio singolo utente |
| `POST /users` | Crea nuovo utente |
| `PUT /users/{username}` | Aggiorna utente (stato, email, nome) |
| `DELETE /users/{username}` | Elimina utente |
| `POST /reset-password` | Esegue il reset, genera password temporanea |
| `GET /reset-history` | Cronologia completa di tutti i reset |
| `GET /reset-history/{username}` | Cronologia reset per utente |
| `DELETE /reset-history` | Azzera l'intera cronologia (usato dal frontend) |
| `GET /token` | Genera JWT LiveKit per chiamata WebRTC via browser |
| `GET /call` | Serve la pagina HTML per la chiamata WebRTC con Sofia |

**Documentazione interattiva:** http://localhost:8001/docs

**Chiamata WebRTC:** http://localhost:8001/call — pagina browser che permette di parlare con Sofia direttamente dal browser, senza telefono né Zoiper. Latenza ~1-1.5s contro i 2-3s della telefonia SIP.

**Utenti demo pre-caricati:**

| Username | Email | Stato |
|----------|-------|-------|
| `mario.rossi` | mario.rossi@example.com | active |
| `giulia.bianchi` | giulia.bianchi@example.com | active |
| `luca.neri` | luca.neri@example.com | locked |

**Logica reset:**
- Utente non trovato → errore
- Utente `locked` → errore con suggerimento di contattare il supporto
- Utente `active` → reset eseguito, password temporanea generata (`TmpXXXXXX!`)

### 4. Mock Email API (`email_service/` — porta 8002)

Microservizio FastAPI che simula un server email. Storage in memoria (si resetta al riavvio).

| Endpoint | Descrizione |
|----------|-------------|
| `GET /inbox` | Lista email ricevute (supporta `?unprocessed_only=true`) |
| `POST /inbox` | Simula ricezione di una email in ingresso |
| `PATCH /inbox/{id}/processed` | Marca email come processata |
| `DELETE /inbox/{id}` | Elimina email dall'inbox |
| `GET /sent` | Lista email inviate dall'agente |
| `POST /send` | Aggiunge email alla sent box |

**Documentazione interattiva:** http://localhost:8002/docs

### 5. Frontend Streamlit (`frontend/` — porta 8501)

Interfaccia web con **tre tab**.

**Tab Dashboard (monitoraggio):**
- Metriche in tempo reale: totale richieste, per canale (telefono/email), successi, falliti
- **Grafici Altair**: donut distribuzione canale, barre raggruppate successi/falliti per canale
- Tabella cronologia reset con timestamp, canale, username, esito e messaggio
- Inbox e sent box email mock visualizzate in tempo reale
- Pulsante **"Aggiorna"** per ricaricare i dati e pulsante **"Reset metriche"** per azzerare l'intera cronologia (chiama `DELETE /reset-history`)

**Tab Chiamate (trascrizioni e chiamata web):**
- Pulsante **"Avvia chiamata web con Sofia"** — apre `http://localhost:8001/call` in una nuova scheda, permettendo di chiamare Sofia direttamente dal browser senza telefono
- Lista di tutte le chiamate registrate (telefoniche e WebRTC), dalla più recente
- Ogni chiamata è visualizzata come una **chat a bolle**: messaggi dell'utente a destra (verde), risposte di Sofia a sinistra (azzurro)
- Testo grezzo della trascrizione disponibile come sotto-sezione espandibile
- I file sorgente sono in `transcripts/` e vengono letti direttamente dal filesystem

**Tab Admin (gestione):**
- Tabella utenti con stato (`active` / `locked`) e azioni (modifica stato, elimina)
- Form per aggiungere nuovi utenti (stati disponibili: `active`, `locked`)
- Form "Simula email di reset" per iniettare email di test nell'inbox mock
- Cronologia reset filtrabile per singolo utente

---

## Flusso canale email

```
1. Utente (o frontend Admin) → POST /inbox con corpo richiesta
2. Email Processor (ogni 10s) → GET /inbox?unprocessed_only=true
3. Estrae username/email con regex
4. POST http://localhost:8001/reset-password
5. POST http://localhost:8002/send (email di risposta al mittente)
6. PATCH /inbox/{id}/processed
7. Frontend Dashboard mostra l'email nella sent box
```

---

## Trascrizione e logging delle chiamate

Ogni chiamata telefonica viene automaticamente trascritta e salvata in un file di testo nella cartella `transcripts/`.

**Formato del file**: `transcripts/YYYYMMDD_HHMMSS_<room-name>.txt`

```
=== Chiamata: call-f3a9d2b1 — 2026-04-22T14:32:01 ===

AGENTE: Buongiorno! Sono l'assistente automatico per il reset delle password aziendali. Come posso aiutarla?
UTENTE: Buongiorno, devo resettare la mia password.
AGENTE: Certo, mi può fornire il suo username o il suo indirizzo email?
UTENTE: mario.rossi
AGENTE: La password è stata resettata con successo. Riceverà una email con la nuova password temporanea che dovrà cambiare al primo accesso. Posso aiutarla con altro?
UTENTE: No, grazie. Arrivederci.
AGENTE: Arrivederci! Buona giornata.

=== Fine chiamata: 2026-04-22T14:35:22 ===
```

**Come funziona internamente** (`voice_agent/agent.py`):

Il voice agent sottoscrive tre eventi di `AgentSession`:
- `user_input_transcribed` — emesso quando Gemini Live trascrive il parlato dell'utente (`is_final=True` per i turni completi)
- `conversation_item_added` — emesso quando l'agente completa un turno di risposta
- `close` — emesso al termine della chiamata, chiude il file

La trascrizione è visibile anche nei log del terminale con prefissi `[UTENTE]` e `[AGENTE]`.

> **Nota tecnica**: Gemini Live è un modello audio nativo — la trascrizione proviene dal sistema di speech recognition integrato nel modello, non da un STT esterno. La qualità della trascrizione dipende dalla qualità audio della chiamata SIP.

---

## Sofia: personalità dell'agente vocale

L'agente vocale si chiama **Sofia** ed è progettato per non sembrare un bot. Le istruzioni di sistema (`INSTRUCTIONS` in `voice_agent/agent.py`) definiscono:

- **Identità**: Sofia è un'assistente del supporto IT, non "un sistema automatico"
- **Empatia**: se l'utente sembra frustrato o confuso, Sofia lo riconosce prima di procedere con la verifica
- **Naturalezza**: usa intercalari ("certo", "nessun problema"), frasi brevi, niente burocratese
- **Tool call silenzioso**: appena riceve username o email, Sofia chiama immediatamente il tool `reset_user_password` **senza pronunciare frasi di annuncio** ("Verifico", "Eseguo", "Un momento…"). Solo dopo aver ricevuto il risultato risponde all'utente. Questo evita che un'eventuale risposta dell'utente interrompa Gemini Live nel mezzo della chiamata al tool, causando il mancato reset.
- **Chiusura**: saluto genuino, non una formula fissa

**Personalizzazione**: il nome è centralizzato nella costante `AGENT_NAME = "Sofia"`. Per cambiare nome o tono basta modificare quella costante e il blocco `INSTRUCTIONS` — nessuna altra modifica necessaria.

---

## Prerequisiti

- **Python 3.11+** con conda (ambiente `password-reset-agent`)
- **Account LiveKit Cloud** — gratuito su https://livekit.io (1.000 min agente/mese inclusi)
- **Google API Key** — gratuita su https://aistudio.google.com/apikey
- **Account Twilio** — solo per chiamate telefoniche reali; $15 di credito gratuito alla registrazione
- **Zoiper** — softphone SIP gratuito per testare le chiamate da PC/smartphone (https://www.zoiper.com)

> Per testare solo il canale email e il frontend non servono LiveKit, Google né Twilio.

---

## Installazione

### 1. Clona il repository

```bash
git clone <url-repo>
cd livekit-agents-poc
```

### 2. Crea l'ambiente conda e installa le dipendenze

```bash
conda create -n password-reset-agent python=3.11 -y
conda activate password-reset-agent

pip install -r user_service/requirements.txt
pip install -r email_service/requirements.txt
pip install -r email_processor/requirements.txt
pip install -r voice_agent/requirements.txt
pip install -r frontend/requirements.txt
```

### 3. Installa LiveKit CLI (solo per il setup telefonico)

```bash
curl -sSL https://get.livekit.io/cli | bash
```

---

## Configurazione

### 1. Crea il file `.env`

```bash
cp .env.example .env
```

### 2. Compila le chiavi

```env
# LiveKit Cloud — da https://cloud.livekit.io → Settings → API Keys
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Google Gemini Live — da https://aistudio.google.com/apikey
GOOGLE_API_KEY=your_google_api_key

# Twilio SIP — credentials inventate da te, usate sia nel TwiML Bin che nel SIP Domain
SIP_USERNAME=password-reset-agent
SIP_PASSWORD=una-password-sicura

# Numero Twilio acquistato (formato E.164)
TWILIO_PHONE_NUMBER=+17124584090

# Servizi interni (non modificare se usi le porte di default)
USER_SERVICE_URL=http://localhost:8001
EMAIL_SERVICE_URL=http://localhost:8002
EMAIL_POLL_INTERVAL=10
AGENT_EMAIL=agent@password-reset.local
```

### 3. Setup Twilio + LiveKit (prima volta)

**Su Twilio Console:**
1. Acquista un numero di telefono
2. Crea un TwiML Bin con il template in `telephony/twiml-template.xml` (sostituisci i placeholder con i valori reali del tuo `.env` e il tuo endpoint SIP LiveKit)
3. Collega il TwiML Bin al numero in Voice Configuration
4. Crea un SIP Domain e una Credential List con `SIP_USERNAME`/`SIP_PASSWORD`

**Su LiveKit:**
```bash
# Compila telephony/inbound-trunk.json con il tuo numero Twilio
# Poi esegui:
bash telephony/setup.sh
```

Lo script crea l'inbound trunk e la dispatch rule su LiveKit Cloud.

**Su Zoiper:**
1. Aggiungi un SIP account
2. Domain: `<nome-sip-domain>.sip.twilio.com`
3. Username e Password: quelli della Credential List Twilio (`SIP_USERNAME`/`SIP_PASSWORD`)
4. Verifica che lo status sia "Registered"

---

## Avvio e arresto

### Avvio completo

```bash
./run_all.sh
```

Avvia in background tutti e cinque i processi nell'ordine corretto:

| Ordine | Processo | Porta | Note |
|--------|----------|-------|------|
| 1 | User Service | 8001 | Avviato per primo — dipendenza di tutti gli altri |
| 2 | Email Service | 8002 | Avviato per secondo — dipendenza di email processor e frontend |
| — | *(pausa 2s)* | — | Tempo per completare l'avvio dei servizi HTTP |
| 3 | Email Processor | — | Polling inbox ogni 10s |
| 4 | Voice Agent | — | Si connette a LiveKit Cloud e resta in ascolto |
| 5 | Frontend Streamlit | 8501 | Avviato per ultimo |

Lo script usa i binari del conda environment `password-reset-agent` (configurato nella variabile `CONDA_ENV` in cima al file) e carica il `.env` esportandolo come variabili d'ambiente per tutti i processi figli.

`Ctrl+C` ferma tutto tramite il trap su `EXIT/INT/TERM`.

---

### Arresto completo

```bash
./stop_all.sh
```

Termina tutti i processi del sistema nell'ordine inverso (frontend → voice agent → email processor → email service → user service). Per ogni processo:

1. Cerca il PID con `pgrep -f <pattern>`
2. Invia `SIGTERM` (terminazione pulita)
3. Dopo 1 secondo, invia `SIGKILL` se il processo non è ancora terminato
4. Pulisce eventuali processi residui sulle porte 8001, 8002, 8501

Sicuro da eseguire anche se alcuni processi non sono in esecuzione — segnala semplicemente "non era in esecuzione".

```
$ ./stop_all.sh
Arresto del sistema Password Reset Agent...

  Fermando Frontend Streamlit (PID: 41234)...
  Frontend Streamlit fermato.
  Fermando Voice Agent (PID: 41210)...
  Voice Agent fermato.
  Fermando Email Processor (PID: 41198)...
  Email Processor fermato.
  Fermando Email Service (PID: 41187)...
  Email Service fermato.
  Fermando User Service (PID: 41176)...
  User Service fermato.

Sistema fermato. Per riavviare: ./run_all.sh
```

---

### Avvio manuale (un terminale per processo)

Utile per sviluppo: ogni processo ha il proprio output visibile e può essere riavviato singolarmente.

```bash
# Attiva il conda environment
conda activate password-reset-agent

# Terminale 1 — User Service
cd user_service && uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Terminale 2 — Email Service
cd email_service && uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Terminale 3 — Email Processor
python email_processor/processor.py

# Terminale 4 — Voice Agent (si connette a LiveKit Cloud)
python voice_agent/agent.py dev

# Terminale 5 — Frontend
streamlit run frontend/app.py --server.port 8501
```

### Avvio minimale (solo email + frontend, senza voice agent)

Per testare il canale email senza necessità di LiveKit o Google API Key:

```bash
conda activate password-reset-agent
cd user_service && uvicorn main:app --port 8001 --reload &
cd email_service && uvicorn main:app --port 8002 --reload &
python email_processor/processor.py &
streamlit run frontend/app.py
```

---

## Log e diagnostica

### Log unificato con `run_all.sh`

Quando si usa `run_all.sh`, tutti i log dei processi vengono scritti su `/tmp/run_all.log`.

```bash
# Visualizza gli ultimi 50 log in tempo reale
tail -50 /tmp/run_all.log

# Segui i log in tempo reale (come tail -f)
tail -f /tmp/run_all.log

# Filtra solo i log del voice agent
grep -E "livekit\.agents|AGENTE|UTENTE|TOOL CALL" /tmp/run_all.log

# Filtra solo errori
grep -iE "error|exception|traceback" /tmp/run_all.log

# Filtra le chiamate ai tool
grep "TOOL CALL" /tmp/run_all.log
```

### Log del voice agent separato

Per fare debug del voice agent in modo isolato (output diretto nel terminale, senza mescolarlo agli altri servizi):

```bash
# Prima ferma il voice agent avviato da run_all.sh
pkill -f "voice_agent/agent.py"

# Poi riavvialo in un terminale dedicato
conda activate password-reset-agent
python voice_agent/agent.py dev
```

L'output includerà:
- `registered worker` — conferma che il worker è connesso a LiveKit Cloud
- `[UTENTE] ...` — trascrizione del parlato dell'utente
- `[AGENTE] ...` — risposta di Sofia
- `>>> TOOL CALL: reset_user_password(...)` — invocazione del tool (verifica utente + reset atomico)

### Cosa cercare nei log per diagnosticare problemi

| Sintomo | Cosa cercare nel log | Causa probabile |
|---------|---------------------|-----------------|
| Il voice agent non si connette | `signal connection timed out` | Credenziali LiveKit errate nel `.env` |
| Sofia non risponde | Nessun `registered worker` | Il voice agent non è partito |
| Il tool non viene chiamato | `>>> TOOL CALL` assente nei log | Sofia ha pronunciato una frase di annuncio e l'utente ha interrotto la generazione |
| Reset non avvenuto | `POST /reset-password` assente in `/tmp/run_all.log` | Il tool `reset_user_password` non è stato invocato |
| Errore 503 su `/token` | `LiveKit non configurato` | `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` mancanti nel `.env` |

### Trascrizioni chiamate

Le trascrizioni di ogni chiamata (telefonica o WebRTC) sono salvate automaticamente in `transcripts/`:

```bash
# Lista trascrizioni dalla più recente
ls -lt transcripts/

# Leggi l'ultima trascrizione
cat transcripts/$(ls -t transcripts/ | head -1)
```

Le trascrizioni sono visibili anche nel frontend, tab **Chiamate**, con formato a chat a bolle.

---

## Utilizzo e test

### Test canale email (da browser)

1. Apri il frontend: http://localhost:8501
2. Vai nel tab **Admin**
3. Usa il form **"Simula email di reset"**:
   - Mittente: `utente@example.com`
   - Account da resettare: `mario.rossi`
4. Clicca **"Invia email di reset"**
5. Entro 10 secondi l'email processor la processa
6. Vai nel tab **Dashboard** → verifica la cronologia reset e l'email di risposta nella sent box

### Test canale voce (console mode, senza telefono)

Simula una chiamata usando microfono e altoparlanti locali. Non serve configurazione Twilio né LiveKit.

```bash
python -m voice_agent.agent console
```

### Chiamata telefonica reale (via Zoiper)

1. Avvia il voice agent: `python -m voice_agent.agent dev`
2. Apri Zoiper, verifica che sia registrato sul SIP Domain Twilio
3. Chiama `+17124584090` (o il tuo numero Twilio)
4. **Sofia** risponde dopo qualche secondo e conduce la conversazione in italiano
5. Al termine: controlla i log del terminale (`[UTENTE]` / `[AGENTE]`) e il file in `transcripts/`
6. La trascrizione è visualizzabile anche nel frontend, tab **Chiamate**

### API dirette (curl)

```bash
# Lista utenti
curl http://localhost:8001/users

# Reset password manuale
curl -X POST http://localhost:8001/reset-password \
  -H "Content-Type: application/json" \
  -d '{"username": "mario.rossi", "channel": "email"}'

# Inserisci email nell'inbox
curl -X POST http://localhost:8002/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "from_address": "utente@example.com",
    "to_address": "agent@password-reset.local",
    "subject": "Reset password",
    "body": "Richiedo il reset della password per l account: mario.rossi"
  }'

# Visualizza sent box
curl http://localhost:8002/sent
```

---

## Struttura del progetto

```
livekit-agents-poc/
│
├── shared/
│   ├── __init__.py
│   └── models.py              # Modelli Pydantic condivisi (User, Email, ResetRequest, ...)
│
├── user_service/
│   ├── main.py                # FastAPI: CRUD utenti + reset password + history + token WebRTC
│   ├── call.html              # Pagina browser per chiamata WebRTC con Sofia
│   ├── db.json                # Persistenza utenti (auto-generato al primo avvio)
│   └── requirements.txt
│
├── email_service/
│   ├── main.py                # FastAPI: inbox e sent box mock
│   └── requirements.txt
│
├── email_processor/
│   ├── processor.py           # Loop asincrono polling + reset via email
│   └── requirements.txt
│
├── voice_agent/
│   ├── agent.py               # Agente LiveKit con Gemini Live + trascrizione chiamate
│   ├── tools.py               # Tool function: reset_user_password (verifica + reset atomico)
│   └── requirements.txt
│
├── frontend/
│   ├── app.py                 # Streamlit: Dashboard (metriche + grafici) + Chiamate (trascrizioni) + Admin
│   └── requirements.txt
│
├── telephony/
│   ├── inbound-trunk.json     # Config trunk SIP LiveKit (compilare con valori reali)
│   ├── dispatch-rule.json     # Dispatch rule LiveKit (pronta all'uso)
│   ├── twiml-template.xml     # Template TwiML Bin per Twilio
│   └── setup.sh               # Script: crea trunk + dispatch rule via lk CLI
│
├── transcripts/               # Trascrizioni automatiche delle chiamate (auto-generata)
│
├── docs/
│   └── superpowers/
│       ├── specs/             # Design spec approvata
│       └── plans/             # Piano di implementazione
│
├── .env                       # Configurazione locale (non committare)
├── .env.example               # Template configurazione
├── run_all.sh                 # Script avvio unificato (tutti e 5 i processi)
└── stop_all.sh                # Script arresto unificato (ordine inverso)
```

---

## Estensibilità

Il progetto è progettato per essere esteso senza riscritture:

| Funzionalità | Come aggiungerla |
|---|---|
| Verifica identità (PIN, domanda segreta) | Aggiungi un tool in `voice_agent/tools.py` e un endpoint in `user_service/main.py` |
| Email reale (IMAP/SMTP) | Sostituisci `email_processor/processor.py` mantenendo la stessa interfaccia verso User Service |
| Nuovo canale (WhatsApp, Telegram, chat web) | Aggiungi un nuovo modulo indipendente che chiama `POST /reset-password` |
| Database reale (PostgreSQL, SQLite) | Sostituisci la persistenza in `user_service/main.py` |
| Deploy containerizzato | Ogni processo è indipendente e containerizzabile con Docker |
| Lingua aggiuntiva | Modifica `language` in `AgentSession` e `instructions` nell'agente |
| Trascrizione su database | Modifica i gestori di eventi in `voice_agent/agent.py` per scrivere su DB invece che su file |
| Numeri italiani reali | Acquista un numero italiano su Twilio (richiede documenti di identità per normativa italiana) e aggiorna il trunk LiveKit |
| LiveKit self-hosted | Configura `livekit/livekit` + `livekit/sip` con Docker Compose e aggiorna `LIVEKIT_URL` |
