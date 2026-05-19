# autohaus

Website für das Autohaus Heidelberg.

## Project Setup

```sh
npm install
```

### Entwicklung

```sh
npm run dev
```

## Tests

### Unit Tests

```sh
npm run test
```

### E2E Tests (Playwright)

Voraussetzungen:
1. Backend läuft auf `localhost:8000` (Django dev server mit aktiviertem venv)
2. Frontend läuft auf `localhost:5173` (`npm run dev`)

```sh
# Playwright-Browser installieren (einmalig)
npx playwright install chromium

# Alle E2E-Tests ausführen
npm run test:e2e

# Mit UI-Modus (interaktiv debuggen)
npm run test:e2e:ui
```

Die Tests nutzen `workers: 1`, da sie eine gemeinsame SQLite-Datenbank verwenden.

## Deployment

Das Deployment auf GitHub Pages läuft über eine **GitHub Action** (`Actions → Deploy to GitHub Pages → Run workflow`).

Die Action baut das Projekt, kopiert `index.html` → `404.html` (für SPA-Routing) und pusht nach `autohaus-heidelberg/autohaus-heidelberg.github.io`.

**Voraussetzung:** Ein `DEPLOY_TOKEN` Secret muss im Repository konfiguriert sein (Personal Access Token mit `repo`-Scope).

### Manuell deployen (Legacy)

Falls die Action nicht funktioniert, kann man auch lokal deployen — dafür muss das Git-Remote `gh-pages` gesetzt sein:

```sh
git remote add gh-pages https://github.com/autohaus-heidelberg/autohaus-heidelberg.github.io
npm run deploy
```

## Events bearbeiten

Events werden über das Admin-Panel verwaltet (Backend auf `content.hopfner.cc`). Die Website lädt Events dynamisch per API.