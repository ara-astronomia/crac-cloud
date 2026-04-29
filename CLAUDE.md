# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Key singleton**: `GrpcServiceContainer` in `grpc_service.py` is instantiated once at startup and injected via FastAPI dependency. All routers import it through `app.state`.

## Configuration

`config.ini` is the primary config file. Sections: `[server]`, `[web_gui]`, `[automazione]`, `[encoder_step]`, `[tende]`.

Any config key can be overridden with env vars using the pattern `{SECTION}_{KEY}` (e.g., `AUTOMAZIONE_SLEEP=200`).

`.env` controls logging: `LOG_LEVEL` (default `WARNING`) and `LOG_TO_FILE` (default `false`; writes rotating logs to `logs/crac_cloud.log`).

## Protobuf / gRPC

Stubs are generated from the custom `crac-protobuf` package (GitHub dependency, branch `16-create-new-proto-geographic-and-data_image`). The generated Python files live in `crac_cloud/grpc_cloud/`. When the proto definitions change, regenerate the stubs with `grpcio-tools`.

## Frontend

The UI is a single HTML page (`templates/index.html`) enhanced by ES module JS files in `static/js/`. There is no Node.js build step — files are served directly as static assets by FastAPI. CSS themes are in `static/css/` (default: `observatory-theme`, alternative: `blue-dark`).

Generated astronomical maps (sky charts, airmass plots, field images) are written to `static/maps/` at runtime by `image_generator.py`.
