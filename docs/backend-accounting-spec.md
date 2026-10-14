# Backend-Spezifikation: Event-Abrechnung

> **Für den Backend-Entwickler** – diese Spec beschreibt die Django-Models,
> Serializers und API-Endpoints, die das Frontend erwartet.
> Das Frontend nutzt aktuell LocalStorage als Fallback und kann
> sofort auf die echte API umgestellt werden, sobald diese steht.

---

## Übersicht

Das Feature ergänzt die bestehende Event-Verwaltung um eine vollständige
Veranstaltungsabrechnung mit:

- **Getränke-Stammkatalog** (Beverages)
- **Kassensturz** (Einnahmen nach Quelle)
- **Inventur** (Getränkebestand vorher/nachher)
- **Ausgaben** (mit Kassenzuordnung)
- **Ergebnisrechnung** (mit Beteiligungsteilung)

---

## 1. Django Models

### 1.1 `BeverageItem` – Getränke-Stammdaten

```python
class BeverageItem(models.Model):
    name = models.CharField(max_length=200)
    supplier_group = models.CharField(max_length=100)  # z.B. "Getränkestation", "Kaufland"
    purchase_price = models.DecimalField(max_digits=8, decimal_places=2)  # EK ohne Pfand
    selling_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    deposit = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['supplier_group', 'sort_order', 'name']

    def __str__(self):
        return f"{self.name} ({self.supplier_group})"
```

### 1.2 `EventAccounting` – Abrechnung pro Event

```python
class EventAccounting(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Entwurf'),
        ('final', 'Abgeschlossen'),
    ]

    event = models.OneToOneField(
        'events.Event',  # Anpassen an euren Event-Model-Pfad
        on_delete=models.CASCADE,
        related_name='accounting'
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Abrechnung: {self.event}"
```

### 1.3 `RevenueEntry` – Einnahmen (Kassensturz)

```python
class RevenueEntry(models.Model):
    SOURCE_CHOICES = [
        ('bar_cash', 'Bar (Bargeld)'),
        ('bar_paypal', 'Bar (PayPal)'),
        ('bar_sumup', 'Bar (SumUp)'),
        ('entrance_cash', 'Einlass (Bargeld)'),
        ('entrance_paypal', 'Einlass (PayPal)'),
        ('entrance_sumup', 'Einlass (SumUp)'),
        ('vvk_pretix', 'VVK (Pretix)'),
        ('vvk_paypal', 'VVK (PayPal)'),
        ('vvk_stripe', 'VVK (Stripe)'),
    ]

    accounting = models.ForeignKey(
        EventAccounting, on_delete=models.CASCADE,
        related_name='revenues'
    )
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change_money = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Wechselgeld
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Gebühren

    class Meta:
        unique_together = ['accounting', 'source']
```

### 1.4 `InventoryEntry` – Inventur

```python
class InventoryEntry(models.Model):
    accounting = models.ForeignKey(
        EventAccounting, on_delete=models.CASCADE,
        related_name='inventory_entries'
    )
    beverage_item = models.ForeignKey(
        BeverageItem, on_delete=models.PROTECT,
        related_name='inventory_entries'
    )
    # Der physisch gezählte Restbestand — die Messung, und das einzige
    # geschriebene Feld. NULL = nicht gezählt.
    counted_after = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    # Abgeleitet, aber materialisiert: rund 14 Auswertungen aggregieren das
    # Feld per SQL Sum().
    consumed_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Price snapshots — frozen at time of creation
    snapshot_purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    snapshot_selling_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    snapshot_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ['accounting', 'beverage_item']
```

> **Historie:** Früher lagen `quantity_before` und `quantity_after` als Spalten
> hier. Migration 0044 ersetzte beide durch `consumed_quantity`, weil der vom
> Client geschickte, global gerechnete `quantity_before` parallele Bearbeitung
> zerstörte. Das behob zwar den Fehler, verankerte aber die falsche Größe: wurde
> ein früheres Event nachträglich abgerechnet, verschob sich der *gezählte*
> Nachher-Wert statt des *abgeleiteten* Verbrauchs. Seit `counted_after`
> (Migration 0061) ist die Messung verankert und der Verbrauch folgt.
>
> `quantity_before` und `quantity_after` gibt es weiterhin in der API-Response,
> dort aber ausschließlich berechnet:
> `quantity_before` chronologisch aus Einkäufen und früherem Verbrauch,
> `quantity_after` = `counted_after` sofern gezählt.

### 1.5 `ExpenseEntry` – Ausgaben

```python
class ExpenseEntry(models.Model):
    PAID_FROM_CHOICES = [
        ('entrance_cash', 'Einlasskasse'),
        ('bar_cash', 'Barkasse'),
        ('other', 'Sonstiges'),
    ]

    accounting = models.ForeignKey(
        EventAccounting, on_delete=models.CASCADE,
        related_name='expenses'
    )
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True, default='')
    paid_from = models.CharField(max_length=20, choices=PAID_FROM_CHOICES, default='bar_cash')
    is_paid_out = models.BooleanField(default=False)
```

### 1.6 `AccountingSplit` – Beteiligungsteilung

```python
class AccountingSplit(models.Model):
    accounting = models.ForeignKey(
        EventAccounting, on_delete=models.CASCADE,
        related_name='splits'
    )
    participant_name = models.CharField(max_length=200)
    share_percentage = models.DecimalField(max_digits=5, decimal_places=2)  # z.B. 50.00
```

---

## 2. API Endpoints

Alle Endpoints erfordern **JWT Bearer Token** (`Authorization: Bearer <token>`)
und Zugehörigkeit zur Gruppe **`website`**.

### 2.1 Beverages (Getränke-Stammdaten)

| Method   | URL                    | Beschreibung             |
|----------|------------------------|--------------------------|
| `GET`    | `/api/beverages/`      | Alle Getränke (paginiert)|
| `POST`   | `/api/beverages/`      | Neues Getränk erstellen  |
| `GET`    | `/api/beverages/{id}/` | Einzelnes Getränk        |
| `PATCH`  | `/api/beverages/{id}/` | Getränk aktualisieren    |
| `DELETE` | `/api/beverages/{id}/` | Getränk löschen          |

**Response-Format `GET /api/beverages/`:**
```json
{
  "count": 15,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Kurpfalz Helles",
      "supplier_group": "Getränkestation",
      "purchase_price": "0.85",
      "selling_price": "3.00",
      "deposit": "0.08",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### 2.2 Event Accounting (Abrechnungen)

| Method   | URL                                      | Beschreibung                    |
|----------|------------------------------------------|---------------------------------|
| `GET`    | `/api/event-accounting/`                 | Alle Abrechnungen (paginiert)   |
| `POST`   | `/api/event-accounting/`                 | Neue Abrechnung erstellen       |
| `GET`    | `/api/event-accounting/by-event/{eventId}/` | Abrechnung nach Event-ID     |
| `PATCH`  | `/api/event-accounting/{id}/`            | Abrechnung aktualisieren        |

**POST-Body:**
```json
{
  "event": "uuid-des-events",
  "status": "draft",
  "notes": ""
}
```

**Response enthält zusätzlich:** `id`, `event_title`, `event_date`, `created_by`, `created_at`, `updated_at`

### 2.3 Revenues (Kassensturz)

| Method   | URL                                                  | Beschreibung           |
|----------|------------------------------------------------------|------------------------|
| `GET`    | `/api/event-accounting/{accId}/revenues/`            | Alle Einnahmen         |
| `POST`   | `/api/event-accounting/{accId}/revenues/`            | Neue Einnahme          |
| `PATCH`  | `/api/event-accounting/{accId}/revenues/{id}/`       | Einnahme aktualisieren |
| `DELETE` | `/api/event-accounting/{accId}/revenues/{id}/`       | Einnahme löschen       |

**Body:**
```json
{
  "source": "bar_cash",
  "total": "1250.00",
  "change_money": "200.00",
  "fees": "0.00"
}
```

### 2.4 Inventory (Inventur)

| Method   | URL                                                   | Beschreibung                |
|----------|-------------------------------------------------------|-----------------------------|
| `GET`    | `/api/event-accounting/{accId}/inventory/`            | Alle Inventur-Einträge      |
| `POST`   | `/api/event-accounting/{accId}/inventory/`            | Neuer Inventur-Eintrag      |
| `PATCH`  | `/api/event-accounting/{accId}/inventory/{id}/`       | Inventur-Eintrag updaten    |
| `POST`   | `/api/event-accounting/{accId}/inventory/bulk/`       | Mehrere auf einmal speichern|

**Body (Einzel):**
```json
{
  "beverage_item": 1,
  "quantity_before": "24",
  "quantity_after": "7"
}
```

**Body (Bulk) — Array:**
```json
[
  { "beverage_item": 1, "quantity_before": "24", "quantity_after": "7" },
  { "beverage_item": 2, "quantity_before": "48", "quantity_after": "12" }
]
```

**Response enthält zusätzlich:** `beverage_item_name`, `beverage_item_supplier_group`, `recorded_by`, `recorded_at`

### 2.5 Expenses (Ausgaben)

| Method   | URL                                                  | Beschreibung           |
|----------|------------------------------------------------------|------------------------|
| `GET`    | `/api/event-accounting/{accId}/expenses/`            | Alle Ausgaben          |
| `POST`   | `/api/event-accounting/{accId}/expenses/`            | Neue Ausgabe           |
| `PATCH`  | `/api/event-accounting/{accId}/expenses/{id}/`       | Ausgabe aktualisieren  |
| `DELETE` | `/api/event-accounting/{accId}/expenses/{id}/`       | Ausgabe löschen        |

**Body:**
```json
{
  "description": "Rewe: Eiswürfel + Müllsäcke",
  "amount": "23.50",
  "notes": "",
  "paid_from": "bar_cash",
  "is_paid_out": false
}
```

`paid_from` Werte: `entrance_cash`, `bar_cash`, `other`

### 2.6 Splits (Beteiligungsteilung)

| Method   | URL                                                  | Beschreibung             |
|----------|------------------------------------------------------|--------------------------|
| `GET`    | `/api/event-accounting/{accId}/splits/`              | Alle Beteiligungen       |
| `POST`   | `/api/event-accounting/{accId}/splits/`              | Neue Beteiligung         |
| `PATCH`  | `/api/event-accounting/{accId}/splits/{id}/`         | Beteiligung aktualisieren|
| `DELETE` | `/api/event-accounting/{accId}/splits/{id}/`         | Beteiligung löschen      |

**Body:**
```json
{
  "participant_name": "Altes Auto",
  "share_percentage": "50.00"
}
```

---

## 3. Serializers (Vorschlag)

```python
from rest_framework import serializers

class BeverageItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeverageItem
        fields = '__all__'

class RevenueEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = RevenueEntry
        fields = '__all__'

class InventoryEntrySerializer(serializers.ModelSerializer):
    beverage_item_name = serializers.CharField(
        source='beverage_item.name', read_only=True
    )
    beverage_item_supplier_group = serializers.CharField(
        source='beverage_item.supplier_group', read_only=True
    )

    class Meta:
        model = InventoryEntry
        fields = '__all__'

class ExpenseEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseEntry
        fields = '__all__'

class AccountingSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingSplit
        fields = '__all__'

class EventAccountingSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateField(source='event.date', read_only=True)

    class Meta:
        model = EventAccounting
        fields = '__all__'
```

---

## 4. ViewSets (Vorschlag)

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class BeverageItemViewSet(viewsets.ModelViewSet):
    queryset = BeverageItem.objects.all()
    serializer_class = BeverageItemSerializer
    permission_classes = [IsAuthenticated]  # + Gruppen-Check

class EventAccountingViewSet(viewsets.ModelViewSet):
    queryset = EventAccounting.objects.select_related('event').all()
    serializer_class = EventAccountingSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='by-event/(?P<event_id>[^/.]+)')
    def by_event(self, request, event_id=None):
        accounting = self.queryset.filter(event_id=event_id).first()
        if not accounting:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(accounting).data)

# Nested ViewSets für Revenues, Inventory, Expenses, Splits
# (registriert unter /api/event-accounting/{accId}/revenues/ etc.)
# Empfehlung: drf-nested-routers oder manuell in urls.py
```

---

## 5. URL-Routing (Vorschlag)

```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'beverages', BeverageItemViewSet)
router.register(r'event-accounting', EventAccountingViewSet)

# Nested routes (z.B. mit drf-nested-routers):
# /api/event-accounting/{accounting_pk}/revenues/
# /api/event-accounting/{accounting_pk}/inventory/
# /api/event-accounting/{accounting_pk}/expenses/
# /api/event-accounting/{accounting_pk}/splits/
```

---

## 6. Permissions

- Alle Endpoints: **JWT Bearer Token** erforderlich
- Gruppe: `website` (wie bestehende Endpoints)
- Optional: `final`-Status-Abrechnungen vor Bearbeitung schützen

---

## 7. Umstellung Frontend → Backend

Wenn die API steht, muss nur **eine Datei** geändert werden:

**`src/services/accounting.ts`** — den LocalStorage-Code durch die
API-Calls ersetzen (der originale API-basierte Code ist im Git-Verlauf).

Die Views und Types bleiben unverändert.

---

## 8. Inventur & FIFO-Bestandsführung

### Grundprinzip

Getränkebestände werden über `PurchaseItem.remaining_quantity` verwaltet.
Der Verbrauch wird **live bei jedem Speichern** (nicht erst beim Finalisieren) per
**FIFO** (älteste Lots zuerst) von den Einkaufs-Positionen abgezogen.

Jedes `AbrechnungsItem` hält den gezählten Restbestand in `counted_after`; der
daraus abgeleitete `consumed_quantity` steuert den FIFO-Abzug. Korrekturen
(z.B. Nachher-Wert erhöhen) buchen den Verbrauch automatisch zurück.

### Kein Inventursperre mehr

- Mehrere Abrechnungen können gleichzeitig im Status `draft` existieren.
- Einkäufe können jederzeit angelegt oder geändert werden.
- Die Konsistenz wird durch atomares Locking (`select_for_update`) auf
  PurchaseItem-Lot-Ebene gewährleistet.

### Intent-basierter Verbrauch (Parallelitätsschutz)

> **Überholt seit `counted_after` (Migration 0061).** Der Abschnitt beschreibt
> den Stand, in dem der Client `quantity_before` mitschickte und das Backend
> daraus eine Absicht ableitete. Beides gibt es nicht mehr.

Heute gilt stattdessen:

1. Der Client sendet **nur** `counted_after` — den physisch gezählten Restbestand.
2. Das Backend leitet den Verbrauch über die gesamte chronologische Kette ab:

```
consumed(N) = max(0, before(N) − counted_after(N))
before(N)   = Σ Einkäufe(≤ Datum_N) − Σ consumed(i < N)
```

   Das teleskopiert zu „gezählter Restbestand des letzten gezählten Events davor
   plus alles, was seitdem gekauft wurde".

3. Wird eine **frühere** Inventur nachgetragen, sinkt `before` aller späteren
   Events, deren `counted_after` unverändert bleibt und deren `consumed` sich
   entsprechend korrigiert. Genau dafür existiert das Feld.
4. Mehr gezählt als erwartet (`counted_after > before`): `consumed` wird auf 0
   geklemmt, der gezählte Wert ungeklemmt gespeichert und die Zeile in der UI
   markiert — meist ein nicht erfasster Einkauf.
5. Reicht der Bestand für die bearbeitete Abrechnung nicht, kommt **HTTP 400**
   mit Konflikt-Details. Abrechnungen, die nur über die Kaskade mitgezogen
   werden, lösen **nie** einen 400 aus: dort sitzt niemand davor, und ein harter
   Fehler würde das Speichern eines fremden Events blockieren.

Ein `consumed_quantity`-Delta wird aus Kompatibilitätsgründen weiter akzeptiert
und unverändert gespeichert (`counted_after` bleibt dann NULL). Es wird bewusst
**nicht** in einen Zählwert umgedeutet: das Delta entstand gegen den Vorher-Wert,
den der Client gerade sah, und als Messung eingefroren bräche es, sobald ein
früheres Event danach abgerechnet wird.

### Wieder-Öffnen / Korrektur

- Da FIFO live funktioniert, gibt es kein separates „Wieder-Öffnen".
- Jede Änderung am gezählten Nachher-Wert wird sofort in FIFO-Lots reflektiert.
- Die Lots werden dabei nicht per Delta fortgeschrieben, sondern für die
  betroffenen Getränke neu verteilt (`rebuild_fifo_for_drinks`) — eine
  Korrektur kann mehrere Abrechnungen gleichzeitig verschieben, womit Deltas
  ihren Sinn verlieren.

### Löschen einer Abrechnung

Beim Löschen werden alle `consumed_quantity`-Werte der Abrechnung per
`restore_fifo` zurückgebucht. Der Bestand wird vollständig wiederhergestellt.

### Einkauf-Update und FIFO

Beim Aktualisieren eines Einkaufs werden bestehende Items per ID/Drink gematcht:
- Bereits verbrauchte Mengen (`consumed = quantity − remaining`) bleiben erhalten
- Neuer remaining = `max(0, neue_menge − consumed)`
- Items mit Verbrauch können nicht entfernt werden
