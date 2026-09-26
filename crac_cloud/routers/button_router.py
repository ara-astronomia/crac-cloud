import logging
from concurrent.futures import ThreadPoolExecutor
import grpc
from fastapi import APIRouter,Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from crac_protobuf import button_pb2, telescope_pb2
from crac_cloud.grpc_service import get_grpc_container
from crac_cloud.grpc_cloud.rpc import COMMAND_TIMEOUT

logger = logging.getLogger(__name__)

class ButtonActionRequest(BaseModel):
    action: str
    key: str | None = None
    type: str = None
    value: Optional[bool] = None

router = APIRouter(
    prefix="/buttons",
    tags=["Button Actions"]
)

KEY_TO_TYPE_MAP = {
        "KEY_TELE_SWITCH": "TELE_SWITCH",
        "KEY_CCD_SWITCH": "CCD_SWITCH",
        "KEY_FLAT_LIGHT": "FLAT_LIGHT",
        "KEY_DOME_LIGHT": "DOME_LIGHT",
        "KEY_PARK": "TELE_SWITCH",
        "KEY_FLAT": "TELE_SWITCH",
    }

def set_autolight_action(autolight_value: bool, telescope_stub):
    """Builds and sends the Autolight gRPC request to the TelescopeService,
    using CHECK_TELESCOPE as a placeholder action."""
    ACTION_FOR_AUTOLIGHT = 'CHECK_TELESCOPE'

    request = telescope_pb2.TelescopeRequest(
        action=telescope_pb2.TelescopeAction.Value(ACTION_FOR_AUTOLIGHT),
        autolight=autolight_value
    )

    try:
        logger.info(f"Sending autolight with action {ACTION_FOR_AUTOLIGHT}: {autolight_value}")
        telescope_stub.SetAction(request, timeout=COMMAND_TIMEOUT)
        return {"status": "ok", "message": "Autolight impostato"}

    except grpc.RpcError as e:
        logger.error(f"❌ RPC error (autolight): {e.details()}")
        return {"status": "error", "message": f"Errore gRPC Autolight: {e.details()}"}


def _toggle_switch(request: ButtonActionRequest, action_enum, service):
    """TURN_ON/TURN_OFF on a switch or light: sends the opposite of its current state."""
    try:
        button_type_str = KEY_TO_TYPE_MAP[request.key]
        type_enum = button_pb2.ButtonType.Value(button_type_str)
    except KeyError:
        logger.warning(f"Key not found in KEY_TO_TYPE_MAP: {request.key}")
        return {"status": "error", "message": f"Unknown key '{request.key}' in KEY_TO_TYPE_MAP."}
    except ValueError:
        logger.warning(f"Type not found in ButtonType: {button_type_str}")
        return {"status": "error", "message": f"Type '{button_type_str}' not found in ButtonType enum."}

    try:
        status_data = service.button_client.get_single_switch_status(request.key, type_enum)
        current_status = status_data.get("status")
        logger.debug(f"Current status for {request.key} is {current_status}")
    except Exception as e:
        logger.error(f" ❌ Error while fetching the status of {request.key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check current status on server: {e}")

    if current_status == "ON":
        action_to_send_enum = button_pb2.ButtonAction.TURN_OFF
    elif current_status == "OFF":
        action_to_send_enum = button_pb2.ButtonAction.TURN_ON
    else:
        action_to_send_enum = action_enum

    action_name = button_pb2.ButtonAction.Name(action_to_send_enum)
    type_name = button_pb2.ButtonType.Name(type_enum)
    logger.info(f"Sending gRPC action: {action_name} on type {type_name}")

    response_data = service.button_client.set_switch_action(
        action=action_to_send_enum,
        button_type=type_enum
    )
    logger.debug(f"Final gRPC response: {response_data}")
    return response_data


def _set_autolight(request: ButtonActionRequest, service):
    """CHECK_BUTTON on the Autolight checkbox."""
    if request.key != 'KEY_AUTOLIGHT':
        logger.warning(f"CHECK_BUTTON action received for an unsupported key: {request.key}")
        return {"status": "error", "message": f"SET_VALUE non supportato per la chiave: {request.key}"}

    if request.value is None:
        return {"status": "error", "message": "Il campo 'value' (boolean) è mancante per SET_VALUE."}

    logger.debug(f"Autolight value received: {request.value}")
    try:
        response_data = set_autolight_action(request.value, service.telescope_client.stub)
        logger.debug(f"Final gRPC autolight response: {response_data}")
        return response_data
    except Exception as e:
        logger.error(f" ❌ Error while setting the autolight: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set Autolight status: {e}")


def _run_default_action(request: ButtonActionRequest, action_enum, service):
    """BUTTON_DEFAULT_ACTION: single actions such as PARK and FLAT."""
    try:
        button_type_str = KEY_TO_TYPE_MAP[request.key]
        type_enum_value = button_pb2.ButtonType.Value(button_type_str)
    except (KeyError, ValueError):
        logger.warning(f"Invalid key or type for the default action: {request.key}")
        return {"status": "error", "message": f"Unknown key or type for default action: {request.key}"}

    return service.button_client.set_switch_action(
        action=action_enum,
        button_type=type_enum_value
    )


@router.post("/set_action")
def set_action(request: ButtonActionRequest, service: get_grpc_container = Depends(get_grpc_container)):
    """Handles all button actions based on what the frontend requests."""
    logger.debug(f"Action requested: {request.action}")
    try:
        action_enum = button_pb2.ButtonAction.Value(request.action)
    except ValueError:
        logger.warning(f"Unknown action: {request.action}")
        return {"status": "error", "message": f"Unknown action: {request.action}"}

    if request.action in ["TURN_ON", "TURN_OFF"]:
        return _toggle_switch(request, action_enum, service)
    if request.action == "CHECK_BUTTON":
        return _set_autolight(request, service)
    if request.action == "BUTTON_DEFAULT_ACTION":
        return _run_default_action(request, action_enum, service)
    return {"status": "error", "message": f"Action '{request.action}' not handled by this router."}

SWITCH_KEYS = {
    "KEY_TELE_SWITCH": "TELE_SWITCH",
    "KEY_CCD_SWITCH": "CCD_SWITCH",
    "KEY_FLAT_LIGHT": "FLAT_LIGHT",
    "KEY_DOME_LIGHT": "DOME_LIGHT",
}


def _switch_status(service, key_str, type_str):
    try:
        return service.button_client.get_single_switch_status(key_str, button_pb2.ButtonType.Value(type_str))
    except Exception as e:
        logger.error(f"❌ Error while fetching the status for {key_str}: {e}")
        return {"key": key_str, "status": "ERROR", "button_gui": {}}


def _autolight_status(service):
    try:
        return service.telescope_client.get_autolight_status()
    except Exception as e:
        logger.error(f"❌ Error while fetching the autolight: {e}")
        return None


@router.get("/status")
def get_all_button_statuses(service: get_grpc_container = Depends(get_grpc_container)):
    """Fetches all switch statuses and the autolight in parallel, so the poll
    waits at most one read timeout."""
    with ThreadPoolExecutor(max_workers=len(SWITCH_KEYS) + 1) as pool:
        switches = [pool.submit(_switch_status, service, key, type_str) for key, type_str in SWITCH_KEYS.items()]
        autolight = pool.submit(_autolight_status, service)

    all_statuses = [switch.result() for switch in switches]
    if autolight.result() is not None:
        all_statuses.append(autolight.result())
    return {"buttons": all_statuses}
