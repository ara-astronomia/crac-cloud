import logging
from fastapi import APIRouter
from crac_cloud.grpc_cloud.cover_mirror_cloud import CoverMirrorClient
from crac_protobuf import cover_mirror_pb2
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


@router.post("/set_action")
def set_action(request: CoverMirrorActionRequest):
    if request.action == "OPEN_COVER_MIRROR":
        logger.info("Action requested: open the mirror cover")
        return cover_mirror_client.set_action(cover_mirror_pb2.CoverMirrorAction.OPEN_COVER_MIRROR)
    elif request.action == "CLOSE_COVER_MIRROR":
        logger.info("Action requested: close the mirror cover")
        return cover_mirror_client.set_action(cover_mirror_pb2.CoverMirrorAction.CLOSE_COVER_MIRROR)
    return {"status": "error", "message": f"Azione non valida: {request.action}"}