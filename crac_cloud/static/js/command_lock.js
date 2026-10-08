// command_lock.js - While a link is down no command button can be enabled.

let linkDown = false;

/** Dims the page and disables every command button, again at each call while
 *  the link stays down. Back up, each button waits for its own next reading. */
export function showLinkDown(isDown) {
    linkDown = isDown;
    if (linkDown) document.querySelectorAll('.status-button').forEach(btn => { btn.disabled = true; });
    document.body.classList.toggle('data-stale', linkDown);
}

/** The one way a reading or a command answer enables a command button. */
export function enableCommand(button, enabled) {
    button.disabled = linkDown || !enabled;
}
