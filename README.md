# Overdesk Checklist v1.0.0

Floating productivity widget. Lives in the system tray. Drag anywhere on screen.

---

## First time setup

### 1. Install Node.js
https://nodejs.org — LTS version

### 2. Create private GitHub repo
- https://github.com/new
- Name: `overdesk-checklist`
- Visibility: **Private**
- Settings → Actions → General → **Read and write permissions** → Save

### 3. Push
```bash
npm install
git init
git add .
git commit -m "v1.0.0"
git branch -M main
git remote add origin https://github.com/Bl3551nq/overdesk-checklist.git
git push -u origin main
```

### 4. Build
```bash
git tag v1.0.0
git push origin main --tags
```
Watch: github.com/Bl3551nq/overdesk-checklist/actions (~8 min)
Download from: github.com/Bl3551nq/overdesk-checklist/releases

---

## Releasing updates (users auto-update, no reinstall needed)

```bash
# Bump "version" in package.json first, then:
git add package.json
git commit -m "v1.0.1"
git tag v1.0.1
git push origin main --tags
```

---

## Owner key (for testing without Gumroad)
```
OVERDESK-BL3551NQ-OWNER000-KEY02025
```

---

## License flow
1. First launch → activation screen
2. User enters Gumroad key (XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX)
3. Verified via https://overdesk.gumroad.com/l/app3
4. Key stored locally — never asked again

---

## Project structure
```
overdesk-checklist/
├── .github/workflows/build.yml   ← auto-build on git tag
├── scripts/generate-icons.js     ← SVG → square PNG icons
├── src/
│   ├── activate.html             ← one-time license screen
│   ├── checklist.html            ← main floating widget
│   └── preload.js                ← Electron IPC bridge
├── assets/icon.svg               ← source logo
├── main.js                       ← Electron main process
└── package.json
```

## Support
overdesk.app@gmail.com
