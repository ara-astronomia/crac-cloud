/** command_lock.js - When a command button may be enabled: never while the
 *  link is down, nor while the component it commands cannot be read. */

/** The command buttons each read endpoint feeds. Weather and UPS have none. */
const COMMANDS_BY_ENDPOINT = {
    telescope: ['btn-conn-telescopio', 'btn-park', 'btn-flat'],
    roof: ['btn-tetto'],
    curtains: ['btn-curtains'],
    cover_mirror: ['btn-cover-mirror'],
    buttons: ['btn-tele-switch', 'btn-ccd-switch', 'btn-flat-light', 'btn-dome-light'],
};

let linkDown = false;
const lockedByComponent = new Set();

/** Dims the page and disables every command button, again at each call while
 *  the link stays down. Back up, each button waits for its own next reading. */
export function showLinkDown(isDown) {
    linkDown = isDown;
    if (linkDown) document.querySelectorAll('.status-button').forEach(btn => { btn.disabled = true; });
    document.body.classList.toggle('data-stale', linkDown);
}

/** Disables the buttons of a component that cannot be read, and leaves the
 *  other panels alone. Back up, its buttons wait for its next reading. */
export function showComponentFailing(endpoint, isFailing) {
    (COMMANDS_BY_ENDPOINT[endpoint] || []).forEach(id => {
        if (!isFailing) return lockedByComponent.delete(id);
        lockedByComponent.add(id);
        const button = document.getElementById(id);
        if (button) button.disabled = true;
    });
}

/** The one way a reading or a command answer enables a command button. */
export function enableCommand(button, enabled) {
    button.disabled = linkDown || lockedByComponent.has(button.id) || !enabled;
}
