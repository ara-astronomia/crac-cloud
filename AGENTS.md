# AGENTS.md

## Project Overview

**crac-cloud** is a FastAPI web GUI for controlling an astronomical observatory (ARA – Ara Astronomia, Frasso Sabino). It talks to an external CRaC gRPC server to manage roof, telescope, curtains, power supplies, and lights.

## Commands

```bash
# Install (uv preferred)
uv sync --extra dev

# Run development server
uv run uvicorn crac_cloud.app:app --reload --host localhost --port 8000

# Python tests (pytest, testpaths = tests/)
uv run pytest

# JS tests (node:test, no package.json and no npm install needed)
node --test tests/js/

# Format code
uv run autopep8 --in-place --recursive crac_cloud/

# Container against the local simulated stack (never the repo's own
# docker-compose.yml, see below)
docker compose -f ../crac-test-stack/docker-compose.yml up -d crac-cloud
```

**The repo's own `docker-compose.yml` points at the real observatory**
(`SERVER_IP=192.168.178.22`): bringing it up gives a GUI whose buttons drive
the real roof, curtains and telescope. For development use
`../crac-test-stack`, which builds this same `Dockerfile` against the
simulated `crac-server` (`SERVER_IP=crac-server`) and bind-mounts
`static/` and `templates/`, so CSS/JS/template edits need only a browser
reload.

There are two test suites and both are quick, so run both before calling a change done. Neither talks to a real gRPC server: the Python ones stub the client stubs, the JS ones stub `fetch`. What they cannot cover — the UI actually reacting to a live server — stays a manual check against `../crac-test-stack`.

## Architecture

```
FastAPI app (app.py)
  ├─ 8 routers (crac_cloud/routers/*_router.py)
  │    button, telescope, roof, curtains, ups, chart, map, cover_mirror
  ├─ GrpcServiceContainer (grpc_service.py) — singleton holding all 9 gRPC clients
  │    └─ crac_cloud/grpc_cloud/
  │         ButtonClient, TelescopeClient, RoofClient, CurtainsClient,
  │         UpsClient, ChartClient, GeographicClient, ImageConfigClient,
  │         CoverMirrorClient
  ├─ image_generator.py — generates sky maps / airmass plots via astropy + astroplan
  ├─ static/js/ — 16 ES modules for UI, API polling, gauges
  └─ templates/index.html — single page, sections Tetto / Telescopio / Tende
```

**Data flow**: Browser JS polls FastAPI endpoints → routers call gRPC clients → CRaC server at `config.ini [server]` ip:port.

**Key singleton**: `GrpcServiceContainer` in `grpc_service.py` is instantiated once at import and injected via FastAPI dependency (`Depends(get_grpc_container)`). Only `button_router.py` actually uses it: the other seven routers build their own client at module level, so those channels exist twice. The container is the direction to converge on — use it in new routers, and when you touch an old one — but do not expect to find it there.

**Async/sync matching**: if a router endpoint uses a synchronous gRPC client call, define it as `def` (not `async def`); if `async def`, ensure the gRPC call is properly awaited (`grpc.aio`). The codebase currently mixes both depending on the specific client method being called — check the existing pattern in the router you're touching before assuming one or the other.

**Error handling convention**: input validation errors use `HTTPException` (e.g. invalid action name → 400). Backend/gRPC communication errors (server unreachable) instead return a 200 response carrying an `error` key, `{"error": "<grpc details>"}` — this is intentional, not an inconsistency: it keeps the frontend's polling loop working (a raised exception would break the poll cycle) while still surfacing the error state in the UI. The key is the contract: `isError()` in `static/js/api.js` decides on the presence of `error`, so a client that swallows a gRPC failure and returns a plausible-looking payload makes the UI show stale data as if it were fresh.

## Configuration

`crac_cloud/config.ini` is the primary config file — inside the package, not at the repo root, and it is committed. Sections: `[server]`, `[web_gui]`, `[automazione]`, `[encoder_step]`, `[tende]`.

Any config key can be overridden with env vars using the pattern `{SECTION}_{KEY}` (e.g. `AUTOMAZIONE_SLEEP=200`, `SERVER_IP=...`). That is how the container is pointed at a gRPC server without editing the file.

`.env` (untracked, loaded by `Config`) controls logging: `LOG_LEVEL` (code default `WARNING`) and `LOG_TO_FILE` (default `false`; writes rotating logs to `logs/crac_cloud.log`). The local `.env` sets `CRITICAL`, so an app that looks silent is usually just configured that way.

## Protobuf / gRPC

Stubs are generated from the custom `crac-protobuf` package (GitHub dependency pinned to a **tag** in `pyproject.toml`, e.g. `@0.1.22` — never `@main`: moving to a new contract must be an explicit commit, not a side effect of `uv lock --upgrade`. To test against work in progress, point it at that branch temporarily and put the tag back before merging). The generated Python files live in `crac_cloud/grpc_cloud/`. When the proto definitions change, regenerate the stubs with `grpcio-tools`.

## Frontend

The UI is a single HTML page (`templates/index.html`) enhanced by ES modules in `static/js/`. There is no Node.js build step and no `package.json` — files are served directly as static assets by FastAPI, and the JS tests run on the stdlib `node:test` runner. Two stylesheets, both loaded together: `static/style.css` and `static/observatory-theme-crac.css`.

Generated astronomical maps (sky charts, airmass plots, field images) are written to `static/maps/` at runtime by `image_generator.py`.

## Agent rules

- **Never run `git push`** unless it's the explicit step the user just asked for — it's not implied by an earlier approval.
- Verify `git config user.email` before committing, if relevant.
- Only commit if `uv run pytest` and `node --test tests/js/` pass, plus a manual check against `../crac-test-stack` for anything the suites cannot reach (real gRPC traffic, browser behaviour).
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
