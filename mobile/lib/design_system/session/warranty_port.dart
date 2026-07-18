// hand-authored — mobile warranty-lookup port (Story 5.9, mirror web
// web/src/design-system/session/warranty-port.ts). The seam between the
// Tra cứu bảo hành screen and `GET /orders/tra-cuu-bao-hanh`.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). The [sdt] that crosses this
// port OUTBOUND is the RAW string the staffer typed while the customer is on the
// phone (`0903 176 968`, `+84903176968`); the backend owns the single normaliser
// and returns the E.164 key.
//
// THE CLIENT NEVER DOES DATE ARITHMETIC EITHER. [WarrantyLine.warrantyEndAt],
// [WarrantyLine.remainingDays], [WarrantyLine.remainingMonths] and
// [WarrantyLine.warrantyStatus] all arrive computed. Neither platform ships a date
// library, and "start + N months" is arithmetic with real traps (31/01 + 1 month =
// ?) — two implementations would be two answers. The screen maps the status to a
// colour and a label; it never derives it.

/// Mirrors the backend `WarrantyCustomerDto` — only what confirms "the right person".
class WarrantyCustomer {
  const WarrantyCustomer({
    required this.sdt,
    required this.name,
    required this.custType,
  });

  final String sdt;
  final String name;
  final String custType;
}

/// Mirrors `WarrantyLineItemDto`. Every date is an ISO-8601 UTC string;
/// [warrantyEndAt] is always at `00:00:00Z` so slicing `YYYY-MM-DD` off the front
/// cannot shift the day.
///
/// [warrantyStartAt] is the date THIS LINE was first finalised — two lines of the
/// same order may legitimately differ (FR-36, AD-20).
class WarrantyLine {
  const WarrantyLine({
    required this.id,
    required this.name,
    required this.qty,
    required this.unit,
    required this.warrantyMonths,
    required this.warrantyStartAt,
    required this.warrantyEndAt,
    required this.remainingDays,
    required this.remainingMonths,
    required this.warrantyStatus,
  });

  final String id;
  final String name;
  final num qty;
  final String unit;
  final int warrantyMonths;
  final String warrantyStartAt;
  final String warrantyEndAt;

  /// Negative once expired. This is the number the backend derived the status from.
  final int remainingDays;

  /// Rounded DOWN, floored at 0 — display only ("Còn 5 năm").
  final int remainingMonths;

  /// One of `con_han` | `sap_het` | `het_han`.
  final String warrantyStatus;
}

/// Mirrors `WarrantyOrderDto` — only lines of the effective version, only lines WITH warranty.
class WarrantyOrder {
  const WarrantyOrder({
    required this.id,
    required this.status,
    this.chotAt,
    required this.lineItems,
  });

  final String id;
  final String status;
  final String? chotAt;
  final List<WarrantyLine> lineItems;
}

/// Mirrors `WarrantyLookupResponseDto`. [found] `false` is a NORMAL 200 result, not
/// an error — the staffer asked a question and "no such customer" is an answer.
/// [sdt] carries the normalised key back even when nothing was found.
class WarrantyLookup {
  const WarrantyLookup({
    required this.found,
    required this.sdt,
    this.customer,
    required this.orders,
  });

  final bool found;
  final String sdt;
  final WarrantyCustomer? customer;
  final List<WarrantyOrder> orders;
}

/// The AD-5 error envelope this port throws (400 invalid phone, 403 missing both
/// read permissions). The screen renders [message] VERBATIM — the client owns no
/// rule about what a valid phone is (AD-9), so it owns no words for one either.
class WarrantyPortException implements Exception {
  const WarrantyPortException(this.message, {this.fieldErrors = const {}});

  final String message;
  final Map<String, String> fieldErrors;

  @override
  String toString() => message;
}

/// Injectable transport for the warranty-lookup screen. This is a PORT, NOT an HTTP
/// client — the seam that lets the screen exist before the app owns a
/// router/token store.
///
/// READ-ONLY on purpose (FR-36, Phase 1): there is no method to open a warranty
/// claim or move a warranty through a lifecycle. Those are a later phase, and a
/// port method the backend cannot serve is a button the UI would have to fake.
abstract class WarrantyPort {
  /// Look warranty up by RAW phone. Throws on 400 (invalid phone) — NOT on "not found".
  Future<WarrantyLookup> lookup(String sdt);
}
