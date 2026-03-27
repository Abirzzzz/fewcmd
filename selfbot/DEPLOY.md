# Deployment Guide

## Running on Replit

1. Open the Shell tab
2. Run:
   ```
   cd selfbot
   node index.js
   ```
3. Set env vars in Replit's Secrets panel (padlock icon):
   - `DISCORD_TOKEN` = your token
   - `ALLOWED_USERS` = comma-separated user IDs, e.g. `123456789,987654321`

---

## Pushing to GitHub

### First time setup

1. Create a new **private** repository on GitHub (keep it private — your token will be in the env vars)

2. In the Replit Shell, navigate into just the selfbot folder:
   ```
   cd selfbot
   git init
   git add .
   git commit -m "Initial selfbot"
   ```

3. Link to your GitHub repo (replace the URL with yours):
   ```
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
   > If it asks for credentials, use your GitHub username and a Personal Access Token
   > (GitHub → Settings → Developer settings → Personal access tokens → Tokens classic → Generate new token → check `repo`)

### Updating after changes

```
cd selfbot
git add .
git commit -m "Update selfbot"
git push
```

---

## Deploying on Coolify

### Prerequisites
- A server running Coolify (self-hosted)
- Your selfbot repo pushed to GitHub

### Steps

1. **Log into your Coolify dashboard**

2. **Create a new Resource** → choose **Docker Compose** or **Dockerfile**

3. **Connect your GitHub repo**:
   - Click "Add Source" → GitHub → authorize → select your selfbot repo
   - Set branch: `main`

4. **Set the build context** to `/` (root of the repo, where the Dockerfile is)

5. **Set Environment Variables** in Coolify's Environment Variables section:
   | Key | Value |
   |-----|-------|
   | `DISCORD_TOKEN` | your Discord token |
   | `ALLOWED_USERS` | `123456789,987654321` (your user IDs) |

6. **Deploy** — Coolify will pull the repo, build the Docker image, and start the container

7. **Set restart policy** to "Always" so it stays running after server reboots

### Notes
- The selfbot has no web server, so no port needs to be exposed
- Coolify will show logs in the deployment panel — check there if something goes wrong
- To update: push a new commit to GitHub, then click "Redeploy" in Coolify (or enable auto-deploy on push)

---

## Getting Your Discord Token

1. Open Discord in a **browser** (not the desktop app)
2. Press **F12** to open DevTools
3. Go to the **Console** tab
4. Paste this and press Enter:
   ```js
   (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()
   ```
5. Copy the string it returns — that's your token

> **Warning**: Never share your token or commit it to a public repo. It gives full access to your account.

## Getting Your User ID

1. In Discord, go to Settings → Advanced → Enable **Developer Mode**
2. Right-click your username anywhere → **Copy User ID**
