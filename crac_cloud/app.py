# crac_cloud/app.py
import os
import logging
import logging.handlers
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
    map_router
)
from fastapi.responses import HTMLResponse

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

@app.get("/")
async def get_root(request: Request):
    # Passa un dizionario vuoto per 'items' al template per prevenire l'errore
    items = {}
    return templates.TemplateResponse("index.html", {"request": request, "items": items})