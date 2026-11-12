- Vue project 
- public page at / with no backend, data coming from json file
- admin page at /admin using backend data and requiring auth
- Design guide can be found in ./DESIGN.md

## Preview zum Teilen (z.B. mit Freunden)
- `npm run preview:package` baut ein Preview-Paket nach `~/Desktop/carousel-preview` (+ `.zip`), ohne das Repo zu verändern. Optional anderes Ziel: `npm run preview:package -- <ordner>`.
- Das Paket enthält Beispieldaten für die Community-Seite (nur im Paket, nicht im Repo), kein `CNAME` (sonst würde es `altesauto.haus` beanspruchen) und eine `_redirects`-Datei für die SPA-Routen.
- Hochladen: https://app.netlify.com/drop, Ordner ins Fenster ziehen. Link teilen, z.B. `/` und `/community`.
- **Nicht** `npm run deploy` oder den GitHub-Workflow dafür nutzen – die veröffentlichen die Live-Seite.

## Lokale öffentliche Seite mit Daten aus der Datenbank
Die öffentliche Seite liest nur `src/events.json` und `src/community.json`, die erst beim Veröffentlichen entstehen. Um neue Treffen und Mithilfe-Gesuche lokal zu sehen, ohne zu veröffentlichen:
- Im Backend: `python manage.py export_local_preview` (Community-Treffen und aktive Gesuche) oder mit `--all-events` (alle Events, auch Entwürfe). Schreibt `src/events.local.json` und `src/community.local.json` (von Git ignoriert).
- Der Dev-Server (`npm run dev:all`) lädt diese Dateien dazu, `src/utils/localPreview.ts`. In Builds und im Preview-Paket sind sie nie enthalten.
- Nach Änderungen im Admin den Befehl erneut ausführen; die Seite lädt per Hot-Reload nach.

