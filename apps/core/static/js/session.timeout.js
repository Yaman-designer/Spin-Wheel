//***********************************************************************************************
// *** This script automatically logs the user out if there is no interaction for 30 minutes. ***
//***********************************************************************************************

// Events that detect user interaction
const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

let idleTime = 0;
const maxIdleTime = 30 * 60 * 1000; // 30 minutes

// Reset idleTime when the user interacts
function resetIdleTime() {
    idleTime = 0;
}

// Log out if the specified time has passed without interaction
function checkIdleTime() {
    idleTime += 1000;

    if (idleTime >= maxIdleTime) {
        logout();
    }
}

// Logout function (the session logout logic is implemented here)
function logout() {
    window.location.href = '/';
}

// Check idleTime every second
setInterval(checkIdleTime, 1000);

// Reset idleTime when the user interacts with the page
events.forEach(function(event) {
    window.addEventListener(event, resetIdleTime);
});

// Ensure page is refreshed when navigating back
window.addEventListener("pageshow", function(event) {
    if (event.persisted) {
        window.location.reload();
    }
});