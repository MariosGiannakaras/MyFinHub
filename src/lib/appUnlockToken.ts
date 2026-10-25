// Memory-only browser-tab unlock token. Never persist in storage or cookies.
// A new tab or full reload starts without a ticket and must re-enter the PIN.
let unlockToken = '';
export function setAppUnlockToken(value:string) { unlockToken=value; }
export function getAppUnlockToken() { return unlockToken; }
export function clearAppUnlockToken() { const former=unlockToken; unlockToken=''; return former; }
