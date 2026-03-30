Discord Selfbot


Setup

1. Install dependencies

    cd selfbot
    npm install

2. Add your token

    Create selfbot/.env and set:

    DISCORD_TOKEN=your_token_here
    OPENROUTER_API_KEY=your_key_here   (required for jarvis and ggif ai matching)

    Or set OPENROUTER_API_KEY in config.js directly.

3. Add your Discord user ID to allowedUsers in config.js

4. Run

    node index.js

    Works on any system with Node.js including Termux.
    On Termux: pkg install nodejs, then same steps.


Commands

Only users listed in allowedUsers can trigger anything. Everyone else is ignored.


spam

    <message> spam <n>

Sends the message n times (max 200). React to any message to stop mid-spam.

    hello spam 10


delete

    delete <n>
    delete all

Deletes your last n messages, or all of them.


snipe

    snipe
    snipe all

Shows last 5 (or 10) deleted/edited messages in the current channel.


giphy

    giphy <query>
    giphy <query> <page>

Searches Giphy and returns 4 results. Paginate with a page number.


ggif

Saved gif library. Per user, max 150.

    ggif add <url>        save a gif
    ggif remove <id>      remove by id
    ggif name <id> <name> give it a name
    ggif                  list your gifs (page 1)
    ggif <n>              list page n


post

    post <id or name>

Posts a saved gif by exact id or name. Falls back to fuzzy/AI matching if no exact match.


jarvis

Two-step trigger. First say:

    jarvis

This opens a 20 second window. If nothing valid is sent within 20 seconds, jarvis responds with "aborted." and the window closes.

Within the 20 second window, send one of:

    start
    Activates jarvis. He will now respond to every message you send in that channel using AI.
    Uses OpenRouter (gpt-4o-mini). Personality: dry, lowercase, chronically online, helpful but not cringe.
    Knows slang: ts, tuff icl, fuh, dih, blud, ngl, icl, deadass, no cap, frfr, lowkey.
    Knows memes: diddy blud, epstein, ela desce ela sobe, low cortisol, elite ball knowledge, sigma, rizz, based, mid, ratio.
    Will roast you. Will help you. Will do both at the same time.

    stop
    Deactivates jarvis. He stops responding until you trigger him again.
    Also works without the trigger window if jarvis is already active: just say stop.

    clearmem
    Wipes jarvis conversation memory. Fresh context.

    know this <anything>
    Adds a custom personality note to jarvis permanently.
    Example: know this my name is mike and i hate mornings
    Jarvis will remember and factor it in going forward.

Memory is saved to selfbot/data/jarvis_memory.json. It keeps the last 40 messages for context.
Custom notes from "know this" persist across restarts.


Getting your Discord token

Open Discord in browser, press F12, go to Console, paste:

    (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()

Never share your token. It is your account password.
