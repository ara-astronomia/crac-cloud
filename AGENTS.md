# AGENTS.md - Development Guide for CRAC Cloud

This document provides comprehensive guidelines for any agent or developer working on the CRAC Cloud codebase. It is designed to be the single point of truth for project standards, web interface management, and gRPC integration.

## 1. Project Overview
CRAC Cloud is a web-based dashboard for the CRAC observatory. It acts as a gateway between web browsers and the `crac-server`, providing a modern interface using FastAPI and Vanilla JavaScript.

### Main Technologies
- **Language:** Python 3.12+
- **Backend Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **Frontend:** HTML5, Vanilla CSS, JavaScript (ES6+).
- **Communication:** gRPC using the `crac-protobuf` library.
- **Dependency Management:** [uv](https://github.com/astral-sh/uv).
- **Environment:** Designed for cloud deployment or local monitoring.

---

## 2. Commands (using uv)

### Installation
```bash
# Sync dependencies
uv sync
```

### Execution
```bash
# Start the FastAPI server with auto-reload
uvicorn crac_cloud.app:app --reload
```
The web interface is available at `http://127.0.0.1:8000`.

---

## 3. Architecture & Project Structure

The project follows a modular router-based architecture.

```
crac_cloud/
├── app.py                  # Entry point: FastAPI app and router mounting
├── grpc_service.py         # SINGLETON: Centralized gRPC client container
├── config.py / config.ini  # Configuration management
├── routers/                # Modular API endpoints
│   ├── roof_router.py
│   ├── telescope_router.py
│   └── ...
├── grpc_cloud/             # gRPC Client Logic
│   ├── roof_cloud.py       # Handles proto parsing and error mapping
│   └── ...
├── static/                 # Frontend assets
│   ├── css/
│   └── js/
│       ├── script.js       # Main UI update loop (polling)
│       └── ...
└── templates/              # Jinja2 templates (index.html)
```

---

## 4. Development Standards & Best Practices

### gRPC Service Management
- **Singleton Container**: Always use the `grpc_container` from `grpc_service.py` via FastAPI's `Depends(get_grpc_container)`. Never create manual gRPC channels in routers.
- **Async/Sync Matching**: 
    - If using a synchronous gRPC client, define the router endpoint as `def` (not `async def`).
    - If using `async def`, ensure the gRPC call is properly awaited using `grpc.aio`.

### Frontend Polling
- **`updateUI` Loop**: The frontend polls the backend for status updates.
- **Standardization**: Ensure the backend returns consistent JSON structures (matching the `REVISION_GUIDE.md` recommendations for `repeated buttons`).

### Code Style
- **Separation of Concerns**: Routers handle HTTP logic; `grpc_cloud` classes handle gRPC communication and parsing.
- **Error Handling**: Use FastAPI's `HTTPException` to return proper status codes (e.g., 503 for gRPC unavailable) instead of returning error strings in 200 OK responses.

---

---

## 6. Agent Autonomy & Safeguards

To ensure efficiency and safety, the following rules apply to AI agents working on this project:

- **Autonomy**: Once a high-level plan is approved by the user, the agent is authorized to proceed through **Plan -> Act -> Validate** cycles without per-step confirmation.
- **Git User Email**: Always verify that `git config user.email` is set to `alkcxy@gmail.com` before making any commit.
- **No Remote Push**: Agents are **strictly forbidden** from executing `git push`. This action is reserved for the human user.
- **Mandatory Testing**: A commit can only be made if all relevant unit tests pass. 
- **Autonomous Fixes**: If tests fail after a modification, the agent should attempt up to **3 iterations** of autonomous fixing before stopping to consult the user.
- **Atomic Commits**: Prefer small, descriptive commits over large "catch-all" updates.
- **Config Protection**: NEVER stage or commit configuration files (e.g., `config.ini`, `.env`). You may only propose a commit if keys have been added or removed (structural changes), and explicit user permission is mandatory.
- **Strict Scope**: I am strictly forbidden from modifying any files or directories outside the explicitly authorized project directories without confirmation. I must NEVER delete an entire directory outside the work projects.

