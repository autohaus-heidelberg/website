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
    deposit_return = models.DecimalField(max_digits=10, decimal_places=2, default=0)
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
        ('entrance_cash', 'Einlass (Bargeld)'),
        ('entrance_paypal', 'Einlass (PayPal)'),
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
    quantity_before = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity_after = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['accounting', 'beverage_item']

    @property
    def consumption(self):
        return self.quantity_before - self.quantity_after

    @property
    def value(self):
        return self.consumption * self.beverage_item.purchase_price
```

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
  "notes": "",
  "deposit_return": "0.00"
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
