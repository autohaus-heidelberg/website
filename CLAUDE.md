- Vue project 
- public page at / with no backend, data coming from json file
- admin page at /admin using backend data and requiring auth
- Design guide can be found in ./DESIGN.md

## Preview zum Teilen (z.B. mit Freunden)
- `npm run preview:package` baut ein Preview-Paket nach `~/Desktop/carousel-preview` (+ `.zip`), ohne das Repo zu verändern. Optional anderes Ziel: `npm run preview:package -- <ordner>`.
- Das Paket enthält Beispieldaten für die Community-Seite (nur im Paket, nicht im Repo), kein `CNAME` (sonst würde es `altesauto.haus` beanspruchen) und eine `_redirects`-Datei für die SPA-Routen.
- Hochladen: https://app.netlify.com/drop, Ordner ins Fenster ziehen. Link teilen, z.B. `/` und `/community`.
- **Nicht** `npm run deploy` oder den GitHub-Workflow dafür nutzen – die veröffentlichen die Live-Seite.
