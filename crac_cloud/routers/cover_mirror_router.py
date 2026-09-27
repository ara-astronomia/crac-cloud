import logging
from fastapi import APIRouter
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient
from crac_cloud.config import Config
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class CoverMirrorActionRequest(BaseModel):
    action: str


router = APIRouter(
    prefix="/cover_mirror",
    tags=["Cover Mirror Action"]
)

config = Config.get_section("server")
grpc_host = config.get("ip", "localhost")
grpc_port = int(config.get("port", "50051"))

cover_mirror_client = CoverMirrorClient(host=grpc_host, port=grpc_port)


@router.get("/status")
def get_cover_mirror_status():
    """Fetches the mirror cover's current status."""
    return cover_mirror_client.get_status()


OPERATOR_ACTIONS = ("OPEN_COVER_MIRROR", "CLOSE_COVER_MIRROR")


@router.post("/set_action")
def set_action(request: CoverMirrorActionRequest):
    if request.action not in OPERATOR_ACTIONS:
        return {"status": "error", "message": f"Azione non valida: {request.action}"}
    logger.info(f"Action requested on the mirror cover: {request.action}")
    return cover_mirror_client.set_action(request.action)
