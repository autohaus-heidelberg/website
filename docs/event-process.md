# Veranstaltungsprozess – Von Anlegen bis Abschluss

> Schritt-für-Schritt-Beschreibung des gesamten Workflows einer Veranstaltung im Alten Autohaus.

---

## 1. Veranstaltung anlegen

**Wo:** Admin → Veranstaltungen → „Neue Veranstaltung"

| Feld | Pflicht | Hinweis |
|------|---------|---------|
| Event-ID | ✓ | Eindeutig, z.B. `konzert-2026-06-15` (nur A-Z, a-z, 0-9, `-`) |
| Datum & Uhrzeit | ✓ | Wann Einlass ist |
| Titel | ✓ | Name der Veranstaltung |
| Kurzbeschreibung | ✓ | Wird auf der Website angezeigt (Rich-Text) |
| VVK-Preis / AK-Preis | – | Eintrittspreise |
| Shop-Link | – | Link zum Pretix-Ticketshop |
| Helferpad-Link | – | Link zum Helfer-Doodle/Pad |
| Künstler*innen | – | Aus dem Künstler-Pool auswählen |

Beim Anlegen wird automatisch eine **Checkliste** aus den hinterlegten Vorlagen erstellt (Phasen: Vorher / Während / Nachher).

---

## 2. Getränke-Verwaltung (Stammdaten)

**Wo:** Admin → Getränke

### Getränketypen

| Typ | Beispiel | `units_per_crate` | Besonderheit |
|-----|----------|-------------------|--------------|
| **Kiste** | Helles, Cola | 20, 24, … | EK = Kistenpreis, VK = Einzelflasche |
| **Einzelflasche** | Gin, Rotwein | 1 | EK = Flaschenpreis, Ausschank in Portionen |

### Felder pro Getränk

- **Name** – z.B. „Kurpfalz Helles"
- **Lieferantengruppe** – z.B. „Getränkestation", „Kaufland"
- **EK (purchase_price)** – Einkaufspreis pro Kiste (bei Kisten) oder pro Flasche
- **Pfand (deposit)** – Pfand pro Kiste (0 bei Einzelflaschen)
- **VK (selling_price)** – Verkaufspreis pro Flasche (bei Kisten)
- **Fl./Kiste (units_per_crate)** – Flaschen pro Kiste (1 = Einzelflasche)
- **Flaschengröße** – in Litern (z.B. 0.7)
- **Portionen/Flasche** – z.B. 35 bei 0.7L Spirituosen mit 2cl-Ausschank
- **VK/Portion** – Verkaufspreis pro Portion
- **Aktiv** – Nur aktive Getränke erscheinen in der Inventur

---

## 3. Lagerbestand & Einkauf

### 3.1 Bestandslogik

Der aktuelle Bestand pro Getränk ergibt sich aus der **letzten finalisierten Abrechnung**:
- `quantity_after` der letzten Abrechnung = aktueller Bestand

### 3.2 Einkauf (Purchase) anlegen

**Wo:** Admin → Einkäufe → „Neuer Einkauf"

| Feld | Beschreibung |
|------|-------------|
| Datum | Einkaufsdatum |
| Lieferant | Freitext (z.B. „Getränkestation") |
| Rechnungsnummer | Optional |
| Rechnungsbetrag | Gesamtbetrag der Rechnung |
| Netto / MwSt | Optional, für Steuer-Export |
| Steuersphäre | Wirtschaftlich / Zweckbetrieb / … |
| USt-Satz | 19% / 7% / keine |

**Positionen (Items):**

| Feld | Beschreibung |
|------|-------------|
| Getränk | Aus Stammdaten auswählen |
| Menge | Stückzahl (Einzelflaschen!) |
| Stückpreis | EK-Preis pro Kiste (wird automatisch vom Getränk übernommen) |
| Gesamtpreis | Menge × Stückpreis |

> **Inventursperre:** Während eine Abrechnung im Status „Draft" ist, können **keine** neuen Einkäufe angelegt oder gelöscht werden. Erst nach Finalisierung oder Löschung des Drafts.

### 3.3 Neues Getränk anlegen

Falls beim Einkauf ein Getränk fehlt:
1. Über Admin → Getränke → „Neues Getränk" anlegen
2. Je nach Typ (Kiste oder Einzelflasche) die Felder ausfüllen
3. Danach im Einkauf als Position hinzufügen

### 3.4 FIFO-Verbrauch

Beim Finalisieren einer Abrechnung wird der Verbrauch (= `quantity_before − quantity_after`) automatisch per **FIFO** von den ältesten Einkaufs-Lots abgezogen. Das ermöglicht korrekte Wareneinsatz-Berechnung.

---

## 4. Abrechnung (Accounting)

**Wo:** Admin → Veranstaltungen → Event auswählen → Tab „Abrechnung"

### 4.1 Abrechnung erstellen

- Pro Event gibt es **maximal eine Abrechnung im Status „Draft"** (Inventursperre)
- Beim Erstellen wird eine leere Abrechnung mit den aktiven Getränken vorbefüllt

### 4.2 Kassensturz (Einnahmen / Revenues)

Einnahmen werden nach **Quelle** erfasst:

| Quelle | Beschreibung | Steuersphäre |
|--------|-------------|--------------|
| `bar_cash` | Theke – Bargeld | Wirtschaftlich (19%) |
| `bar_paypal` | Theke – PayPal | Wirtschaftlich (19%) |
| `entrance_cash` | Eintritt – Bargeld | Zweckbetrieb (7%) |
| `entrance_paypal` | Eintritt – PayPal | Zweckbetrieb (7%) |
| `vvk_pretix` | VVK über Pretix | Zweckbetrieb (7%) |
| `vvk_stripe` | VVK über Stripe | Zweckbetrieb (7%) |
| `vvk_paypal` | VVK über PayPal | Zweckbetrieb (7%) |

**Felder pro Einnahme:**
- **Einnahme (total)** – Gesamteinnahme inkl. Wechselgeld
- **Wechselgeld (change_money)** – Muss abgezogen werden (war schon in der Kasse)
- **Gebühren (fees)** – PayPal/Stripe-Gebühren

**Externe Daten:**
- **Pretix-VVK**: Wird automatisch über die Pretix-API abgefragt (Ticketverkäufe + Stripe/PayPal-Gebühren)
- **PayPal Bar**: PayPal-Transaktionen für Bar- und Eintritts-Zahlungen werden automatisch zugeordnet

### 4.3 Inventur (Getränkebestand)

| Feld | Beschreibung |
|------|-------------|
| Bestand vorher | Automatisch aus letzter Abrechnung |
| Bestand nachher | Manuell zählen nach der Veranstaltung |
| Verbrauch | Wird berechnet: vorher − nachher |
| Warenwert | Verbrauch × EK-Preis (Kiste) ÷ Flaschen/Kiste |

Die Preise werden zum Zeitpunkt der Abrechnung als **Snapshot** gespeichert (falls sich der EK ändert, bleibt die alte Abrechnung korrekt).

### 4.4 Ausgaben (Expenses / Posten)

| Feld | Beschreibung |
|------|-------------|
| Beschreibung | Was wurde bezahlt (z.B. „Künstlerhonorar DJ XY") |
| Betrag | Bruttobetrag in € |
| Bezahlt aus | Quelle: Bar-Kasse, Eintritts-Kasse, PayPal, Überweisung, Offen |
| Förderkategorie | Künstlerhonorar / Sachkosten / Sonstiges (für Förderantrag) |
| Steuersphäre | Für Steuer-Export |
| USt-Satz | Für Steuer-Export |

**„Bezahlt aus" Optionen:**
- `bar_cash` – aus der Thekenkasse
- `entrance_cash` – aus der Eintrittskasse
- `paypal` – per PayPal
- `transfer` – per Überweisung
- `other` – Offen (= noch nicht bezahlt)

### 4.5 Pfandrückgabe

Ein separates Feld `deposit_return` erfasst den Pfanderlös nach Rückgabe der leeren Kisten.

### 4.6 Beteiligungsteilung (Splits)

Falls Einnahmen zwischen Veranstaltern aufgeteilt werden:
- Teilnehmer-Name + Anteil in %

---

## 5. Förderung (Grant Application)

**Wo:** Admin → Veranstaltungen → Event → Tab „Abrechnung" → Unter-Tab „Förderung"

### 5.1 Vor der Veranstaltung: Antrag

Der **Antrag auf Förderung von Livemusik** (Stadt Heidelberg) wird im System vorbereitet:

**Budgetplan (Ausgaben-Seite):**
- Künstlerhonorare (Name + Betrag)
- Sachkosten (z.B. Werbung, Technikmiete)
- Sonstiges
- Personalkosten-Pauschale (0,5% der jährlichen Personalkosten)
- Mietkosten-Pauschale (0,5% der jährlichen Mietkosten)

**Budgetplan (Einnahmen-Seite):**
- Erwarteter Eintritt
- Erwartete Getränkeeinnahmen
- Eigenmittel
- Drittmittel

**Beantragte Fördersumme** = Ausgaben − Einnahmen (max. Defizitfinanzierung)

→ PDF-Export: Der Antrag wird automatisch in das offizielle Formular der Stadt Heidelberg eingetragen.

### 5.2 Nach der Veranstaltung: Verwendungsnachweis

Nach der Abrechnung wird der **Verwendungsnachweis** erstellt:

- **Tatsächliche Ausgaben**: Werden aus den Abrechnung-Posten mit Förderkategorie übernommen
- **Tatsächliche Einnahmen**: Eintritt + 20% der Bar-Einnahmen (Vereinsanteil)
- **Sachbericht**: Beschreibung der Veranstaltung (wird automatisch generiert, kann angepasst werden)
- **Zuwendungsbescheid-Datum**: Wann die Bewilligung kam
- **Ausgezahlter Betrag**: Was tatsächlich überwiesen wurde

→ PDF-Export: Der Verwendungsnachweis wird automatisch in das offizielle Formular eingetragen.

---

## 6. Abschluss & Finalisierung

### 6.1 Abrechnung finalisieren

Wenn alle Daten komplett sind:
1. Status auf „Final" setzen
2. **FIFO-Verbrauch** wird automatisch gebucht
3. Neue Einkäufe und Abrechnungen werden wieder freigegeben

### 6.2 Wiedereröffnen (Reopen)

- Nur die **chronologisch letzte** finalisierte Abrechnung kann wiedereröffnet werden (LIFO-Prinzip)
- Beim Reopen wird der FIFO-Verbrauch wieder rückgängig gemacht
- Während der Wiedereröffnung gilt wieder die Inventursperre

### 6.3 Steuer-Export

**Wo:** Admin → Steuer-Export → Jahr auswählen

Exportiert alle Einnahmen und Ausgaben des Jahres aufgeschlüsselt nach:
- Steuersphäre (Zweckbetrieb / Wirtschaftlich / Vermögensverwaltung / Ideell)
- USt-Satz (19% / 7% / keine)
- Netto- und Bruttowerte

→ Grundlage für die Steuererklärung des Vereins.

### 6.4 Dokumente (Google Drive)

Pro Event können Belege und Dokumente in einen verknüpften Google-Drive-Ordner hochgeladen werden (Rechnungen, Quittungen, Verträge).

---

## Zusammenfassung: Typischer Ablauf

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Event anlegen (Titel, Datum, Künstler, Ticketshop)          │
│  2. Förderantrag vorbereiten (Budget, Fördersumme) → PDF        │
│  3. Getränke prüfen: Bestand checken, ggf. neue anlegen        │
│  4. Einkauf buchen (Kisten/Flaschen vom Lieferanten)            │
│  5. ── VERANSTALTUNG ──                                         │
│  6. Abrechnung erstellen (Draft)                                │
│     a) Kassensturz: Bar, Eintritt, PayPal, VVK eintragen       │
│     b) Inventur: Bestand nachher zählen                         │
│     c) Ausgaben: Honorare, Taxifahrten etc. erfassen            │
│     d) Pfandrückgabe eintragen                                  │
│  7. Abrechnung finalisieren → FIFO-Verbrauch wird gebucht       │
│  8. Verwendungsnachweis erstellen → PDF an Stadt                 │
│  9. Steuer-Export am Jahresende                                  │
└─────────────────────────────────────────────────────────────────┘
```
