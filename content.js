console.log("Hello from content script :)");
// Inject directly into the webpage context from the content script
const script = document.createElement('script');
script.textContent = `
(function() {
    // Try to find and patch Telegram function that sends media messages
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && this.responseURL.includes('/apiw1/')) {
                // Inspect outgoing media payload here if needed
            }
        });
        origOpen.apply(this, arguments);
    };

    // Intercept WebSocket messages
    const origSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        try {
            // Telegram A uses WebSocket frames for many actions.
            // Intercept outgoing message data
            let str;
            if (typeof data === 'string') {
                str = data;
            } else if (data instanceof ArrayBuffer) {
                str = new TextDecoder().decode(data);
            }

            if (str && str.includes('"media":')) {
                try {
                    // Parse outgoing message
                    let obj = JSON.parse(str);
                    if (obj.media && !obj.media.ttl_seconds) {
                        // Set TTL seconds, e.g. 10 for 10 seconds
                        obj.media.ttl_seconds = 10;
                        arguments[0] = JSON.stringify(obj);
                        // Now the outgoing photo includes self-destruct!
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return origSend.apply(this, arguments);
    };
})();
`;
document.documentElement.appendChild(script);
