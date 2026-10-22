// hand-authored — mobile warranty-lookup port (Story 5.9, mirror web
// web/src/design-system/session/warranty-port.ts). The seam between the
// Tra cứu bảo hành screen and `GET /orders/warranty-lookup`.
//
// THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9). The phone that crosses this
// port OUTBOUND is the RAW string the staffer typed while the customer is on the
// phone (`0903 176 968`, `+84903176968`); the backend owns the single normaliser
// and returns the E.164 key.
//
// THE CLIENT NEVER DOES DATE ARITHMETIC EITHER. `warrantyEndAt`, `remainingDays`,
// `remainingMonths` and `warrantyStatus` all arrive computed. Neither platform
// ships a date library, and "start + N months" is arithmetic with real traps
// (31/01 + 1 month = ?) — two implementations would be two answers. The screen maps the status to a
// colour and a label; it never derives it.
//
// Every data type below is the GENERATED contract type (Story 10.7, AD-12).

import '../../api/generated/models/warranty_customer_dto.dart';
import '../../api/generated/models/warranty_line_item_dto.dart';
import '../../api/generated/models/warranty_lookup_response_dto.dart';
import '../../api/generated/models/warranty_order_dto.dart';

export '../../api/generated/models/warranty_line_item_dto_warranty_status.dart';

/// The backend `WarrantyCustomerDto` — only what confirms "the right person".
typedef WarrantyCustomer = WarrantyCustomerDto;

/// `WarrantyLineItemDto`. Every date is a UTC `DateTime`; `warrantyEndAt` is
/// always at `00:00:00Z`, so reading its UTC calendar day cannot shift the day.
/// `remainingDays` is negative once expired — the number the backend derived
/// `warrantyStatus` from; `remainingMonths` is rounded DOWN, floored at 0,
/// display only ("Còn 5 năm").
///
/// `warrantyStartAt` is the date THIS LINE was first finalised — two lines of the
/// same order may legitimately differ (FR-36, AD-20).
typedef WarrantyLine = WarrantyLineItemDto;

/// `WarrantyOrderDto` — only lines of the effective version, only lines WITH warranty.
typedef WarrantyOrder = WarrantyOrderDto;

/// `WarrantyLookupResponseDto`. `found == false` is a NORMAL 200 result, not an
/// error — the staffer asked a question and "no such customer" is an answer.
/// `phone` carries the normalised key back even when nothing was found.
typedef WarrantyLookup = WarrantyLookupResponseDto;

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
