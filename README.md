# CRaC Cloud

Web GUI for the CRaC (Control Remote Astro-Complex) system. 
This application provides a web interface to monitor and control the observatory, connecting to the CRaC server via gRPC and FastAPI.

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (recommended for dependency management)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ara-astronomia/crac-cloud.git
   cd crac-cloud
   ```

2. Install dependencies using `uv`:
   ```bash
   uv sync
   ```

### Running the Application

Start the FastAPI server with auto-reload:
```bash
uv run uvicorn crac_cloud.app:app --reload
```

The web interface will be available at `http://127.0.0.1:8000`.

## 🛠 Configuration

Configuration is managed via `crac_cloud/config.ini`. You can specify the gRPC server IP and port, as well as web server settings.

```ini
[server]
ip = 192.168.178.22
port = 50051
```

## 📖 Documentation

For detailed information about architecture, development standards, and gRPC integration, please refer to:
- [AGENTS.md](AGENTS.md): Main development guide and project standards.
- [REVISION_GUIDE.md](REVISION_GUIDE.md): Guide for revising and improving the codebase.
