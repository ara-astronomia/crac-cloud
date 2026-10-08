from html.parser import HTMLParser

from fastapi.testclient import TestClient

import crac_cloud.app as app_module

http = TestClient(app_module.app)

COMMAND_BUTTONS = {
    "btn-tetto": "Chiuso",
    "btn-conn-telescopio": "Disconnesso",
    "btn-park": "Park",
    "btn-flat": "Flat",
    "btn-cover-mirror": "Chiuso",
    "btn-curtains": "Disattive",
    "btn-tele-switch": "Spento",
    "btn-ccd-switch": "Spento",
    "btn-flat-light": "Spento",
    "btn-dome-light": "Spento",
}


class ButtonCollector(HTMLParser):
    """Collects every <button> of the page by id: attributes and text."""

    def __init__(self):
        super().__init__()
        self.buttons = {}
        self._current = None

    def handle_starttag(self, tag, attrs):
        if tag == "button":
            attributes = dict(attrs)
            self._current = attributes.get("id")
            self.buttons[self._current] = {"attrs": attributes, "text": ""}

    def handle_data(self, data):
        if self._current is not None:
            self.buttons[self._current]["text"] += data

    def handle_endtag(self, tag):
        if tag == "button":
            self._current = None


def page_buttons():
    resp = http.get("/")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    collector = ButtonCollector()
    collector.feed(resp.text)
    return collector.buttons


def test_every_command_button_starts_disabled():
    buttons = page_buttons()
    enabled = [btn_id for btn_id in COMMAND_BUTTONS if "disabled" not in buttons[btn_id]["attrs"]]
    assert enabled == []


def test_command_buttons_keep_their_startup_labels():
    buttons = page_buttons()
    labels = {btn_id: buttons[btn_id]["text"].strip() for btn_id in COMMAND_BUTTONS}
    assert labels == COMMAND_BUTTONS
