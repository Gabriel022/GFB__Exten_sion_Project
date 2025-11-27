console.log("TTL Extension: Content script initialized");

// Use external script file to bypass CSP restrictions
// Inline scripts are blocked by Telegram's Content Security Policy
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    console.log("TTL Extension: External script loaded successfully");
    this.remove(); // Clean up after injection
};
script.onerror = function() {
    console.error("TTL Extension: Failed to load inject.js");
};

// Inject the script into the page context
(document.head || document.documentElement).appendChild(script);
console.log("TTL Extension: Script injection initiated");
