# crac_cloud/app.py
import os
import logging
import logging.handlers
from datetime import datetime

from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Assicurati di avere tutti i router importati qui
from .routers import (
    button_router,
    roof_router,
    chart_router,
    curtains_router,
    telescope_router,
    ups_router,
    map_router,
    cover_mirror_router,
)
from fastapi.responses import HTMLResponse

load_dotenv()
log_level = getattr(logging, os.getenv('LOG_LEVEL', 'WARNING').upper(), logging.WARNING)
log_to_file = os.getenv('LOG_TO_FILE', 'false').lower() == 'true'

handlers = [logging.StreamHandler()]
if log_to_file:
    import logging.handlers
    handlers.append(
        logging.handlers.RotatingFileHandler(
            'logs/crac_cloud.log', maxBytes=5242880, backupCount=3
        )
    )

logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(filename)s - %(lineno)d - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=handlers
)

app = FastAPI()

# Monta la cartella statica
app.mount("/static", StaticFiles(directory="crac_cloud/static"), name="static")

# Disabilita la cache dei file statici in modo da caricare sempre la versione aggiornata del JS
@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Configura il motore di template, puntando alla cartella dei template
templates = Jinja2Templates(directory="crac_cloud/templates")

# Includi tutti i router
app.include_router(button_router.router)
app.include_router(roof_router.router)
app.include_router(chart_router.router)
app.include_router(curtains_router.router)
app.include_router(telescope_router.router)
app.include_router(ups_router.router)
app.include_router(map_router.router) #, prefix="/maps", tags=["maps"])
app.include_router(cover_mirror_router.router)

@app.get("/")
async def get_root(request: Request):
    # Passa un dizionario vuoto per 'items' al template per prevenire l'errore
    items = {}
    static_version = int(datetime.utcnow().timestamp())
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "items": items, "static_version": static_version},
    )