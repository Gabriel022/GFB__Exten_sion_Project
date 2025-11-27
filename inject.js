// This file runs in the page context and can access Telegram's globals
(function() {
    'use strict';
    console.log("TTL: Page script injected via external file");
    
    let patchAttempts = 0;
    const MAX_ATTEMPTS = 150;
    
    function tryPatch() {
        patchAttempts++;
        
        // Method 1: Intercept Object.assign (most reliable for Telegram)
        const origAssign = Object.assign;
        Object.assign = function(target, ...sources) {
            const result = origAssign.call(this, target, ...sources);
            
            // Check if we're building an InputMedia object
            if (result && result._ && typeof result._ === 'string') {
                if (result._.includes('inputMediaUploaded') && result.file) {
                    if (!result.ttl_seconds) {
                        result.ttl_seconds = 10;
                        result.flags = (result.flags || 0) | 2;
                        console.log('TTL: ✓ Injected ttl_seconds=10 via Object.assign');
                    }
                }
            }
            
            return result;
        };
        
        // Method 2: Intercept Object.defineProperty
        const origDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (obj && (prop === '_' || prop === 'flags') && descriptor && descriptor.value) {
                const value = descriptor.value;
                
                if (typeof value === 'string' && value.includes('inputMedia')) {
                    console.log('TTL: Detected InputMedia construction:', value);
                    
                    setTimeout(() => {
                        if (obj.file && !obj.ttl_seconds) {
                            obj.ttl_seconds = 10;
                            if (typeof obj.flags === 'number') {
                                obj.flags = obj.flags | 2;
                            } else {
                                obj.flags = 2;
                            }
                            console.log('TTL: ✓ Injected ttl_seconds=10 via defineProperty');
                        }
                    }, 0);
                }
            }
            
            return origDefineProperty.call(this, obj, prop, descriptor);
        };
        
        // Method 3: Promise hook for async operations
        const origThen = Promise.prototype.then;
        Promise.prototype.then = function(onFulfilled, onRejected) {
            const wrappedFulfilled = onFulfilled && function(value) {
                if (value && typeof value === 'object' && value._) {
                    if (value._.includes('inputMedia') && value.file && !value.ttl_seconds) {
                        value.ttl_seconds = 10;
                        value.flags = (value.flags || 0) | 2;
                        console.log('TTL: ✓ Injected ttl_seconds=10 via Promise hook');
                    }
                }
                return onFulfilled.call(this, value);
            };
            return origThen.call(this, wrappedFulfilled || onFulfilled, onRejected);
        };
        
        console.log('TTL: Hooks installed (attempt ' + patchAttempts + '/' + MAX_ATTEMPTS + ')');
        
        if (patchAttempts < MAX_ATTEMPTS) {
            setTimeout(tryPatch, 100);
        }
    }
    
    // Start patching
    tryPatch();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryPatch);
    }
})();
