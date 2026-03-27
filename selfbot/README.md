# Discord Selfbot

## Setup

1. **Install dependencies**:
   ```
   cd selfbot
   npm install
   ```

2. **Configure** `config.js`:
   - Set your Discord token (or set `DISCORD_TOKEN` env variable)
   - Add your Discord user ID to `allowedUsers`

3. **Run**:
   ```
   node index.js
   ```

## Commands

Only users whose IDs are in `allowedUsers` can trigger commands. All others are silently ignored.

### spam
Format: `<message> spam <times>`

Example: `hello there spam 5`
- Sends "hello there" 5 times in the channel
- No cooldown

### snipe
- `snipe` — shows the last 5 deleted/edited messages in the current channel
- `snipe all` — shows the last 10

**Deleted format:**
```
**DisplayName**
del = the deleted message
```

**Edited format:**
```
**DisplayName**
edited: old content
now: new content
```

## Getting Your Token

Open Discord in browser → F12 → Console → type:
```js
(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()
```

> **Warning**: Never share your token. This is your account password.
