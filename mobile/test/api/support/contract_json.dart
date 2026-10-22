// Backend response bodies for the order/stock/money/document adapter tests (Story
// 10.8), shaped as the contract (openapi.json) declares them — what the fake
// backend answers, not what a screen expects. Figures are arbitrary backend
// numbers: adapter tests assert the mapping, never the business rule.
Map<String, Object?> lineJson({String id = 'l1', String? productId = 'p-1', num qty = 2, num? warrantyMonths = 12}) => {
  'id': id,
  'productId': productId,
  'name': 'Tấm pin AE 630W',
  'unit': 'tấm',
  'qty': qty,
  'unitPrice': 2450000,
  'priceEditable': false,
  'isFlexible': false,
  'note': null,
  'warrantyMonths': warrantyMonths,
  'displayOrder': 0,
  'amount': 4900000,
};

Map<String, Object?> orderJson({String id = 'o1', String status = 'baogia', num? kWp = 8.82}) => {
  'id': id,
  'status': status,
  'customerPhone': '+84903176968',
  'currentVersionId': 'v1',
  'ownerAccountId': 'acc-1',
  'assigneeAccountId': null,
  'sourceId': 'src-1',
  'custType': 'CA_NHAN',
  'scopeEquipment': true,
  'scopeConstruction': true,
  'scopeDelivery': false,
  'kWp': kWp,
  'vatMode': 'co_vat',
  'validityNote': '48h',
  'cancelReason': null,
  'cancelledAt': null,
  'lineItems': [lineJson()],
  'discount': null,
  'createdAt': '2026-07-18T00:00:00.000Z',
  'updatedAt': '2026-07-18T00:00:00.000Z',
};

Map<String, Object?> orderPageJson() => {
  'items': [
    {
      'id': 'o1',
      'status': 'dachot',
      'customerPhone': '+84903176968',
      'customerName': 'Anh An',
      'ownerAccountId': 'acc-1',
      'assigneeAccountId': null,
      'createdAt': '2026-07-18T00:00:00.000Z',
      'updatedAt': '2026-07-18T00:00:00.000Z',
    },
  ],
  'total': 41,
  'page': 2,
  'pageSize': 20,
};

Map<String, Object?> lifecycleJson() => {
  'steps': [
    {'status': 'baogia', 'progress': 'done'},
    {'status': 'dachot', 'progress': 'current'},
  ],
  'nextSteps': [
    {'event': 'xong_giao', 'to': 'dagiao', 'requires': 'delivery.confirm'},
  ],
  'canCancel': true,
};

Map<String, Object?> versionsJson() => {
  'items': [
    {
      'id': 'v1',
      'versionNo': 1,
      'isCurrent': true,
      'createdAt': '2026-07-18T00:00:00.000Z',
      'confirmedAt': null,
      'createdByAccountId': 'acc-1',
      'createdByDisplayName': 'Quản lý',
      'lineCount': 3,
      'changes': {'added': <String>[], 'removed': <String>[], 'qtyChanged': <Object?>[]},
    },
  ],
};

Map<String, Object?> previewTotalJson() => {
  'subtotal': 4900000,
  'discountAmount': 0,
  'vatAmount': 392000,
  'total': 5292000,
  'vatRate': 8,
  'applyVat': true,
};

List<Object?> pendingDiscountsJson() => [
  {
    'orderId': 'o1',
    'customerPhone': '+84903176968',
    'amount': 100000,
    'requestNote': null,
    'requestedByAccountId': 'acc-1',
    'requestedByDisplayName': 'Bán hàng',
    'requestedAt': '2026-07-18T00:00:00.000Z',
    'subtotal': 4900000,
    'afterDiscount': 4800000,
    'lines': [
      {'name': 'Tấm pin AE 630W', 'qty': 2, 'unitPrice': 2450000, 'estimatedMarginPct': null},
    ],
  },
];

Map<String, Object?> quoteExportJson() => {
  'orderId': 'o1',
  'orderVersionId': 'v1',
  'exportedAt': '2026-07-18T00:00:00.000Z',
  'image': {'fileName': 'bao-gia-BG-0001.png', 'size': 3},
  'pdf': {'fileName': 'bao-gia-BG-0001.pdf', 'size': 4},
};

Map<String, Object?> statusChangeJson() => {
  'status': 'dagiao',
  'occurredAt': '2026-07-18T00:00:00.000Z',
  'savedAttachmentCount': 2,
};

Map<String, Object?> cancelJson() => {'status': 'huy', 'occurredAt': '2026-07-18T00:00:00.000Z'};

Map<String, Object?> attachmentsJson() => {
  'items': [
    {
      'id': 'a1',
      'fileName': 'a.jpg',
      'contentType': 'image/jpeg',
      'size': 2048,
      'createdAt': '2026-07-18T00:00:00.000Z',
      'uploadedBy': 'Trần Thợ',
      'statusFrom': null,
      'statusTo': null,
      'canDelete': true,
    },
  ],
};

Map<String, Object?> uploadJson() => {
  'savedAttachmentCount': 2,
  'attachmentIds': ['a1', 'a2'],
};

Map<String, Object?> voucherJson({String id = 'pk-1', String type = 'xuat', Object? unitCost}) => {
  'id': id,
  'code': 'PK-X-0097',
  'type': type,
  'orderId': 'o1',
  'returnOfVoucherId': null,
  'createdAt': '2026-07-18T00:00:00.000Z',
  'createdBy': {'id': 'acc-kho', 'displayName': 'Kho'},
  'lineCount': 1,
  'totalQty': 2,
  'note': null,
  'lines': [
    {'productId': 'p-1', 'name': 'Tấm pin AE 630W', 'sku': 'PIN', 'unit': 'tấm', 'qty': 2, 'unitCost': unitCost},
  ],
  'returnOf': null,
  'returnVoucher': null,
  'canReturn': false,
};

Map<String, Object?> stockIssueJson() => {
  'issued': false,
  'voucher': null,
  'canIssue': true,
  'blocked': false,
  'lines': [
    {
      'productId': 'p-1',
      'name': 'Tấm pin AE 630W',
      'sku': 'PIN',
      'unit': 'tấm',
      'qty': 2,
      'onHand': 40,
      'shortfall': 0,
    },
  ],
  'untrackedItems': ['Công lắp đặt'],
};

Map<String, Object?> stockCheckJson() => {
  'lines': [
    {
      'productId': 'p-1',
      'name': 'Tấm pin AE 630W',
      'unit': 'tấm',
      'qty': 2,
      'onHand': 1,
      'reserved': 0,
      'available': 1,
      'shortfall': 1,
      'status': 'short',
    },
  ],
};

Map<String, Object?> stockListJson() => {
  'items': [
    {
      'productId': 'p-1',
      'name': 'Tấm pin AE 630W',
      'sku': 'PIN',
      'unit': 'tấm',
      'onHand': 0,
      'reserved': 2,
      'available': -2,
      'toPurchase': 2,
      'stockStatus': 'am',
    },
  ],
  'purchaseList': [
    {'productId': 'p-1', 'name': 'Tấm pin AE 630W', 'unit': 'tấm', 'toPurchase': 2},
  ],
};

Map<String, Object?> voucherListJson() => {
  'items': [
    {
      'id': 'pk-1',
      'code': 'PK-X-0097',
      'type': 'xuat',
      'orderId': null,
      'returnOfVoucherId': null,
      'createdAt': '2026-07-18T00:00:00.000Z',
      'createdBy': {'id': 'acc-kho', 'displayName': 'Kho'},
      'lineCount': 1,
      'totalQty': 2,
    },
  ],
};

Map<String, Object?> paymentJson() => {
  'id': 'pay-1',
  'installmentId': 'inst-1',
  'amount': 16602192,
  'paidOn': '2026-10-21',
  'method': 'bank_transfer',
  'note': null,
  'recordedAt': '2026-10-21T03:00:00.000Z',
};

Map<String, Object?> scheduleJson({List<Object?>? payments}) => {
  'orderId': 'o1',
  'configured': true,
  'editable': false,
  'orderTotal': 83010960,
  'scheduledTotal': 83010960,
  'difference': 0,
  'totalMatches': true,
  'paidTotal': 16602192,
  'remainingTotal': 66408768,
  'paidPercent': 20,
  'paymentStatus': 'partial',
  'recordable': true,
  'installments': [
    {
      'id': 'inst-1',
      'seq': 1,
      'percent': 20,
      'amount': 16602192,
      'conditionNote': 'Cọc',
      'milestone': 'coc',
      'paidAmount': 16602192,
      'remainingAmount': 0,
      'status': 'paid',
      'payments': payments ?? [paymentJson()],
    },
  ],
  'updatedAt': '2026-10-21T03:00:00.000Z',
};

Map<String, Object?> recordPaymentJson({bool autoTransition = true}) => {
  'payment': paymentJson(),
  'schedule': scheduleJson(),
  'orderStatus': 'dacoc',
  'autoTransition': autoTransition ? {'event': 'du_coc', 'outcome': 'applied', 'message': null} : null,
};

Map<String, Object?> contractJson({String id = 'c1', String fileName = 'hop-dong-mua-ban-7'}) => {
  'id': id,
  'contractNo': 'HĐMB-123456/2026',
  'contractType': 'sale',
  'versionNo': 1,
  'fileName': fileName,
  'pdfSize': 4096,
  'createdAt': '2026-10-22T03:00:00.000Z',
};

Map<String, Object?> contractsOverviewJson({List<Object?>? contracts}) => {
  'contractType': 'sale',
  'generatable': true,
  'blockedReason': null,
  'quoteNo': 'BG-2048',
  'versionNo': 1,
  'customerName': 'Anh An',
  'lineCount': 4,
  'orderTotal': 83010960,
  'scheduleLabel': '20/70/10',
  'missingPartyFields': <String>[],
  'contracts': contracts ?? [contractJson()],
};

Map<String, Object?> invoiceJson({String id = 'inv-1'}) => {
  'id': id,
  'invoiceNo': 'HD-2026-0001',
  'versionNo': 1,
  'issuedAt': '2026-10-22T03:00:00.000Z',
  'customerName': 'Anh An',
  'customerTaxCode': null,
  'vatRate': 8,
  'applyVat': true,
  'subtotal': 76862000,
  'discountAmount': 0,
  'vatAmount': 6148960,
  'total': 83010960,
  'lineCount': 4,
};

Map<String, Object?> invoicesOverviewJson() => {
  'creatable': false,
  'blockedReason': null,
  'currentInvoiceId': 'inv-1',
  'versionNo': 1,
  'customerName': 'Anh An',
  'customerTaxCode': null,
  'lineCount': 4,
  'orderTotal': 83010960,
  'invoices': [invoiceJson()],
};

Map<String, Object?> invoicePdfJson() => {
  'fileName': 'hoa-don-HD-2026-0001.pdf',
  'pdfSize': 48213,
  'exportedAt': '2026-10-22T04:00:00.000Z',
};

Map<String, Object?> invoiceDetailJson({bool exported = true}) => {
  ...invoiceJson(),
  'orderId': 'o1',
  'quoteNo': 'BG-2048',
  'customerPhone': '+84903176968',
  'customerAddress': null,
  'seller': {
    'legalName': 'CÔNG TY NLMT PHƯƠNG NAM',
    'taxCode': '0312998771',
    'address': '',
    'representative': '',
    'representativeTitle': '',
    'phone': '',
    'bankAccount': '',
  },
  'lines': [
    {'displayOrder': 0, 'name': 'Tấm pin AE 630W', 'unit': 'Tấm', 'qty': 14, 'unitPrice': 2583000, 'amount': 36162000},
  ],
  'pdf': exported ? invoicePdfJson() : null,
};
