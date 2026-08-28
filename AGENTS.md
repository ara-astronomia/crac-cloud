# AGENTS.md

## Project Overview

**crac-cloud** is a FastAPI web GUI for controlling an astronomical observatory (ARA – Ara Astronomia, Frasso Sabino). It talks to an external CRaC gRPC server to manage roof, telescope, curtains, power supplies, and lights.

## Commands

```bash
# Install (uv preferred)
uv sync
# or
pip install -e ".[dev]"

# Run development server
uvicorn crac_cloud.app:app --reload --host localhost --port 8000

# Regenerate protobuf stubs (when crac-protobuf changes)
python -m grpc_tools.protoc -I proto --python_out=. --grpc_python_out=. proto/*.proto

# Format code
autopep8 --in-place --recursive crac_cloud/
```

No automated test suite exists — testing is manual against a live or mocked gRPC server.

## Architecture

```
FastAPI app (app.py)
  ├─ 7 routers (crac_cloud/routers/)
  │    button, telescope, roof, curtains, ups, chart, map
  ├─ GrpcServiceContainer (grpc_service.py) — singleton holding all gRPC clients
  │    └─ 8 clients in crac_cloud/grpc_cloud/
  │         ButtonClient, TelescopeClient, RoofClient, CurtainsClient,
  │         UpsClient, ChartClient, GeographicClient, ImageConfigClient
  ├─ image_generator.py — generates sky maps / airmass plots via astropy + astroplan
  ├─ static/js/ — 13 JS modules for UI, API polling, gauges
  └─ templates/index.html — single-page UI with tabs (Tetto, Telescopio, Tende)
```

**Data flow**: Browser JS polls FastAPI endpoints → routers call gRPC clients → CRaC server at `config.ini [server]` ip:port.

**Key singleton**: `GrpcServiceContainer` in `grpc_service.py` is instantiated once at startup and injected via FastAPI dependency (`Depends(get_grpc_container)`). Never create manual gRPC channels directly in a router — always go through the container.

**Async/sync matching**: if a router endpoint uses a synchronous gRPC client call, define it as `def` (not `async def`); if `async def`, ensure the gRPC call is properly awaited (`grpc.aio`). The codebase currently mixes both depending on the specific client method being called — check the existing pattern in the router you're touching before assuming one or the other.

**Error handling convention**: input validation errors use `HTTPException` (e.g. invalid action name → 400). Backend/gRPC communication errors (server unreachable) instead return a 200 response with a `{"status": "ERROR", ...}` payload — this is intentional, not an inconsistency: it keeps the frontend's polling loop working (a raised exception would break the poll cycle) while still surfacing the error state in the UI.

## Configuration

`config.ini` is the primary config file. Sections: `[server]`, `[web_gui]`, `[automazione]`, `[encoder_step]`, `[tende]`.

Any config key can be overridden with env vars using the pattern `{SECTION}_{KEY}` (e.g., `AUTOMAZIONE_SLEEP=200`).

`.env` controls logging: `LOG_LEVEL` (default `WARNING`) and `LOG_TO_FILE` (default `false`; writes rotating logs to `logs/crac_cloud.log`).

## Protobuf / gRPC

Stubs are generated from the custom `crac-protobuf` package (GitHub dependency — check the exact branch/ref in `pyproject.toml`, it changes often during feature work; verify it matches the crac-protobuf branch you actually want to test against). The generated Python files live in `crac_cloud/grpc_cloud/`. When the proto definitions change, regenerate the stubs with `grpcio-tools`.

## Frontend

The UI is a single HTML page (`templates/index.html`) enhanced by ES module JS files in `static/js/`. There is no Node.js build step — files are served directly as static assets by FastAPI. CSS themes are in `static/css/` (default: `observatory-theme`, alternative: `blue-dark`).

Generated astronomical maps (sky charts, airmass plots, field images) are written to `static/maps/` at runtime by `image_generator.py`.

## Agent rules

- **Never run `git push`** unless it's the explicit step the user just asked for — it's not implied by an earlier approval.
- Verify `git config user.email` before committing, if relevant.
- Only commit if the relevant tests/manual checks pass (see "no automated test suite" above — this means a manual smoke check against a running/mocked server, not skipping verification).
- Prefer small, descriptive commits over one large catch-all commit.
- Never stage/commit config files (`config.ini`, `.env`) unless the change is a structural key addition/removal explicitly requested by the user.

## Repo correlati

Questo progetto è composto da più repo, clonati come sibling
(`../crac-server`, `../crac-protobuf`, `../RC_Cover`) o orchestrati insieme
da `../crac-test-stack`. Quando il lavoro tocca più di un repo:

1. **Cerca prima sul filesystem**: se `../<repo>` esiste come clone locale,
   usalo. Controlla `git -C ../<repo> branch --show-current` prima di
   leggere il suo file di contesto o il suo codice - i repo di questo
   progetto sono spesso su branch feature specifici (non `main`), e
   leggere main quando in realtà serve il branch in lavorazione dà un
   quadro sbagliato/obsoleto.
2. **Fallback su GitHub** se il repo non è clonato localmente:
   `https://github.com/ara-astronomia/<repo>` (org `ara-astronomia`).

Repo del progetto:
- `crac-server` - server gRPC consumato da questa GUI
- `crac-protobuf` - contratti `.proto` condivisi (dipendenza git di questo repo)
- `crac-test-stack` - stack Docker per testare tutto insieme in locale
- `RC_Cover` - driver INDIGO custom per la copertura a petali dello specchio
  (repo privato, C)
