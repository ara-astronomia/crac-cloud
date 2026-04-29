FROM python:3.13-slim-bookworm

# git required for the crac-protobuf git dependency
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Step 1 – install dependencies only (cached layer, unaffected by source changes)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Step 2 – copy source and install the package
COPY crac_cloud ./crac_cloud
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

RUN mkdir -p logs

EXPOSE 8000

CMD ["uvicorn", "crac_cloud.app:app", "--host", "0.0.0.0", "--port", "8000"]
