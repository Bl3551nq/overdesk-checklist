# Overdesk Checklist

Floating productivity widget for Windows & macOS. Lives in the system tray.

---

## First time setup (do this once)

### 1. Install Node.js
Download from https://nodejs.org — install the LTS version.

### 2. Create a private GitHub repo
- Go to https://github.com/new
- Name: `overdesk-checklist`
- Visibility: **Private**
- Click **Create repository**

### 3. Enable Actions write permission
In your new repo:
- Settings → Actions → General
- Scroll to "Workflow permissions"
- Select **Read and write permissions**
- Click Save

### 4. Push this code
Open Terminal (Mac) or Command Prompt (Windows) in this folder and run:

```bash
npm install
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Bl3551nq/overdesk-checklist.git
git push -u origin main
```

---

## Building the app (every release)

```bash
# 1. Bump the version in package.json  e.g. "version": "1.0.1"
# 2. Commit the change
git add package.json
git commit -m "v1.0.1"

# 3. Tag and push — this triggers the automatic build
git tag v1.0.1
git push origin main --tags
```

Then go to **github.com/Bl3551nq/overdesk-checklist/actions** to watch the build.
When it finishes (~8 min), the `.dmg` (Mac) and `.exe` (Windows) appear under
**github.com/Bl3551nq/overdesk-checklist/releases**

---

## Auto-updates (zero effort for your users)

When you release a new version (tag + push), existing installs silently
download the update in the background. The app shows a banner asking
the user to restart — no re-downloading from Gumroad needed.

---

## How the license works

1. First launch → activation screen appears
2. User pastes their Gumroad key (XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX)
3. App verifies against https://overdesk.gumroad.com/l/app3
4. Key saved locally — activation screen never shows again
5. Future launches go straight to the widget

---

## Project structure

```
overdesk-checklist/
├── .github/workflows/build.yml   ← Auto-builds on every git tag
├── scripts/generate-icons.js     ← Converts icon.svg → PNG for all platforms
├── src/
│   ├── activate.html             ← One-time license activation screen
│   ├── checklist.html            ← Main floating widget
│   └── preload.js                ← Bridge between UI and Electron
├── assets/
│   └── icon.svg                  ← Your logo (source of all icons)
├── main.js                       ← Electron main process
└── package.json
```

---

## Support
overdesk.app@gmail.com
