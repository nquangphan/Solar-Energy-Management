// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoices_overview_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

InvoicesOverviewResponseDto _$InvoicesOverviewResponseDtoFromJson(
  Map<String, dynamic> json,
) => InvoicesOverviewResponseDto(
  creatable: json['creatable'] as bool,
  blockedReason: json['blockedReason'] as String?,
  currentInvoiceId: json['currentInvoiceId'] as String?,
  versionNo: json['versionNo'] as num,
  customerName: json['customerName'] as String,
  customerTaxCode: json['customerTaxCode'] as String?,
  lineCount: json['lineCount'] as num,
  orderTotal: json['orderTotal'] as num,
  invoices: (json['invoices'] as List<dynamic>)
      .map((e) => InvoiceResponseDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$InvoicesOverviewResponseDtoToJson(
  InvoicesOverviewResponseDto instance,
) => <String, dynamic>{
  'creatable': instance.creatable,
  'blockedReason': instance.blockedReason,
  'currentInvoiceId': instance.currentInvoiceId,
  'versionNo': instance.versionNo,
  'customerName': instance.customerName,
  'customerTaxCode': instance.customerTaxCode,
  'lineCount': instance.lineCount,
  'orderTotal': instance.orderTotal,
  'invoices': instance.invoices,
};
