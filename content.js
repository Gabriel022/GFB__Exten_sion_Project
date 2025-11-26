console.log("TTL Extension: Content script initialized");

// Inject into page context to access Telegram's internal objects
const script = document.createElement('script');
script.textContent = `
(function() {
    'use strict';
    console.log("TTL: Page script injected");
    
    // Strategy: Intercept the constructor or factory function that creates InputMedia objects
    // Before encryption, Telegram constructs TL objects like inputMediaUploadedPhoto
    // We need to add ttl_seconds field when these are created
    
    let patchAttempts = 0;
    const MAX_ATTEMPTS = 150;
    
    function tryPatch() {
        patchAttempts++;
        
        // Method 1: Proxy all object creations to catch InputMedia
        const origDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            // Intercept when properties are set on objects
            // Look for TL schema indicators like "_" property or "flags"
            if (obj && (prop === '_' || prop === 'flags') && descriptor.value) {
                const value = descriptor.value;
                
                // Check if this is an InputMedia object being constructed
                if (typeof value === 'string' && value.includes('inputMedia')) {
                    console.log('TTL: Detected InputMedia construction:', value);
                    
                    // Add a hook to inject ttl_seconds when the object is complete
                    setTimeout(() => {
                        if (obj.file && !obj.ttl_seconds) {
                            obj.ttl_seconds = 10;
                            // Update flags to include bit 1 (ttl_seconds flag)
                            if (typeof obj.flags === 'number') {
                                obj.flags = obj.flags | 2; // Set bit 1
                            } else {
                                obj.flags = 2;
                            }
                            console.log('TTL: Injected ttl_seconds=10 into InputMedia');
                        }
                    }, 0);
                }
            }
            
            return origDefineProperty.call(this, obj, prop, descriptor);
        };
        
        // Method 2: Hook into Promise.prototype.then to catch async media operations
        const origThen = Promise.prototype.then;
        Promise.prototype.then = function(onFulfilled, onRejected) {
            const wrappedFulfilled = onFulfilled && function(value) {
                // Check if the resolved value is an InputMedia object
                if (value && typeof value === 'object' && value._) {
                    if (value._.includes('inputMedia') && value.file && !value.ttl_seconds) {
                        value.ttl_seconds = 10;
                        value.flags = (value.flags || 0) | 2;
                        console.log('TTL: Injected ttl_seconds via Promise hook');
                    }
                }
                return onFulfilled.call(this, value);
            };
            return origThen.call(this, wrappedFulfilled || onFulfilled, onRejected);
        };
        
        // Method 3: Intercept Object.assign which Telegram uses to build objects
        const origAssign = Object.assign;
        Object.assign = function(target, ...sources) {
            const result = origAssign.call(this, target, ...sources);
            
            // Check if we're assigning to an InputMedia object
            if (result && result._ && typeof result._ === 'string') {
                if (result._.includes('inputMediaUploaded') && result.file) {
                    if (!result.ttl_seconds) {
                        result.ttl_seconds = 10;
                        result.flags = (result.flags || 0) | 2;
                        console.log('TTL: Injected ttl_seconds via Object.assign');
                    }
                }
            }
            
            return result;
        };
        
        console.log('TTL: Hooks installed (attempt ' + patchAttempts + ')');
        
        // Keep trying in case Telegram redefines things
        if (patchAttempts < MAX_ATTEMPTS) {
            setTimeout(tryPatch, 100);
        }
    }
    
    // Start immediately
    tryPatch();
    
    // Also start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryPatch);
    }
})();
`;

document.documentElement.appendChild(script);
console.log("TTL Extension: Injection complete");
