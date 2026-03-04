# Guida alla Revisione del Codice - crac-cloud

Questa guida elenca le criticità riscontrate nella versione attuale del progetto e fornisce le azioni correttive da verificare o implementare dopo il merge del nuovo branch.

## 1. Gestione Risorse gRPC (Canali Ridondanti)
- **Problema:** I router (`roof`, `chart`, `telescope`) creano canali `insecure_channel` indipendenti.
- **Azione:** Unificare l'accesso ai client gRPC tramite il Singleton `grpc_container` in `grpc_service.py`.
- **Esempio:** Usare `Depends(get_grpc_container)` in FastAPI.

## 2. Concorrenza (Event Loop Blocking)
- **Problema:** Uso di `async def` con chiamate gRPC sincrone (blocca il server).
- **Azione:** 
    - Se si usa gRPC sincrono, definire gli endpoint come `def` (non `async`).
    - Se si vuole `async def`, migrare a `grpc.aio` (client asincroni).

## 3. Bug Logico in `telescope_cloud.py`
- **Problema:** Doppia chiamata a `self.stub.SetAction(request)` nel metodo `set_action`.
- **Azione:** Rimuovere la chiamata fuori dal blocco `try`.

## 4. Ottimizzazione Frontend (`script.js`)
- **Problema:** Polling UI troppo frequente (500ms).
- **Azione:** 
    - Portare l'intervallo a 2000ms o 5000ms.
    - Implementare `setTimeout` ricorsivo invece di `setInterval` per evitare sovrapposizioni di richieste.

## 5. Correzioni Strutturali
- **File System:** Rinominare `crac_cloud/retriever/__init__.oy` in `__init__.py`.
- **Validazione:** Assicurarsi che `RoofActionRequest` e simili usino Pydantic per validare i valori degli Enum.
- **Error Handling:** Sostituire i return di dizionari di errore con `raise HTTPException` di FastAPI.

## 6. Sicurezza
- **TLS/SSL:** Valutare il passaggio a `secure_channel` se il server è esposto pubblicamente.
- **Config:** Verificare che nessun dato sensibile sia hardcoded nei file `.ini` o `.py`.
