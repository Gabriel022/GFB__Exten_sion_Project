# GitHub Copilot Instructions

## Project Overview
Chrome extension that programmatically adds self-destruct timers to photo messages on Telegram Web (version A).

**Core Challenge**: Telegram Web UI doesn't expose disappearing photos, but the underlying MTProto protocol supports `ttl_seconds`. This extension intercepts at the **application layer** (before encryption) to inject this parameter.

## Architecture

### Content Script Injection Pattern (`content.js`)
- **Two-layer injection**: Content script → injected `<script>` tag
- **Why**: Chrome extensions' content scripts run in isolated world. Direct DOM injection required to access page's JavaScript context where Telegram constructs TL objects
- Script injected into `document.documentElement` to run in page context

### TL Object Interception (SAFE APPROACH)
**Critical**: Do NOT modify WebSocket frames directly - they're encrypted with MTProto and tampering triggers account freezes.

**Correct Strategy**: Hook into JavaScript object construction BEFORE encryption:
```javascript
// Intercept when Telegram creates inputMediaUploadedPhoto objects
Object.assign = function(target, ...sources) {
    const result = origAssign.call(this, target, ...sources);
    if (result._ === 'inputMediaUploadedPhoto' && result.file) {
        result.ttl_seconds = 10;
        result.flags = (result.flags || 0) | 2; // Set bit 1 for ttl_seconds
    }
    return result;
};
```

**TL Schema**: `inputMediaUploadedPhoto#1e287d04 flags:# file:InputFile ttl_seconds:flags.1?int`
- `ttl_seconds` is a conditional field controlled by bit 1 of flags
- Must set both `ttl_seconds` value AND update `flags` bitmask

### Why This Works
1. Telegram Web constructs TL (Type Language) objects in JavaScript
2. These objects represent MTProto API calls (e.g., `messages.sendMedia`)
3. Modification happens pre-encryption, so message integrity is preserved
4. Server accepts the ttl_seconds parameter as valid protocol field

## Development Workflow

### Testing Locally
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select project directory
4. Navigate to `web.telegram.org/a`
5. Open DevTools Console - look for "TTL:" prefixed logs

### Debugging
- **Console logs**: Track object interception with `console.log('TTL: ...')`
- **Breakpoints**: Set breakpoints on `Object.assign`, `Object.defineProperty` to see TL construction
- **Network tab**: Encrypted frames will show as binary - this is expected and correct

### Reloading Changes
- Click refresh icon on extension in `chrome://extensions`
- Hard refresh Telegram tab (`Ctrl+Shift+R`)
- Clear browser cache if Telegram's JS is cached

## Extension Manifest (Manifest V3)

- **`service_worker`**: `background.js` (currently just a log statement)
- **`content_scripts.matches`**: Only `*://web.telegram.org/a*`
- **`run_at: "document_idle"`**: Ensures Telegram's initial JS has loaded
- **No permissions needed**: Only host_permissions for Telegram domain

## Project Constraints

**Hard Requirements** (per challenge spec):
1. No external servers/localhost
2. No bundled libraries (gramjs, mtproto, etc.)
3. Must work on `web.telegram.org/a` specifically

## Common Pitfalls

### ❌ DANGEROUS: WebSocket Frame Modification
```javascript
// THIS CAUSES ACCOUNT FREEZE - encrypted frames cannot be modified
WebSocket.prototype.send = function(data) {
    let obj = JSON.parse(data); // Frames are encrypted, not JSON!
    obj.media.ttl_seconds = 10;
    return origSend.call(this, JSON.stringify(obj));
};
```

**Why it fails**:
- MTProto frames are AES-encrypted binary with HMAC-SHA-256 signatures
- Any modification breaks cryptographic integrity
- Telegram server detects corrupted frames → account freeze

### ✅ SAFE: Pre-Encryption Object Hooking
```javascript
// Modify TL objects BEFORE encryption
Object.assign = function(target, ...sources) {
    const result = origAssign.call(this, target, ...sources);
    if (result._ && result._.includes('inputMedia')) {
        // Safely add protocol-valid field
    }
    return result;
};
```

### Content Script Isolation
Must inject into page context to access Telegram's globals:
```javascript
const script = document.createElement('script');
script.textContent = `(function() { /* hooks here */ })();`;
document.documentElement.appendChild(script);
```

## Code Style

- Prefix all logs with `"TTL:"` for easy filtering
- Defensive checks: `if (obj && obj._)` before accessing TL properties
- Don't break existing functionality: always call original functions
- Keep re-patching: Telegram may reinitialize, so hook installation runs multiple times
