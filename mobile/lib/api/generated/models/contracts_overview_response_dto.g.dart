// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contracts_overview_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContractsOverviewResponseDto _$ContractsOverviewResponseDtoFromJson(
  Map<String, dynamic> json,
) => ContractsOverviewResponseDto(
  contractType: ContractsOverviewResponseDtoContractType.fromJson(
    json['contractType'] as String,
  ),
  generatable: json['generatable'] as bool,
  blockedReason: json['blockedReason'] as String?,
  quoteNo: json['quoteNo'] as String,
  versionNo: json['versionNo'] as num,
  customerName: json['customerName'] as String,
  lineCount: json['lineCount'] as num,
  orderTotal: json['orderTotal'] as num,
  scheduleLabel: json['scheduleLabel'] as String?,
  missingPartyFields: (json['missingPartyFields'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  contracts: (json['contracts'] as List<dynamic>)
      .map((e) => ContractResponseDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ContractsOverviewResponseDtoToJson(
  ContractsOverviewResponseDto instance,
) => <String, dynamic>{
  'contractType':
      _$ContractsOverviewResponseDtoContractTypeEnumMap[instance.contractType]!,
  'generatable': instance.generatable,
  'blockedReason': instance.blockedReason,
  'quoteNo': instance.quoteNo,
  'versionNo': instance.versionNo,
  'customerName': instance.customerName,
  'lineCount': instance.lineCount,
  'orderTotal': instance.orderTotal,
  'scheduleLabel': instance.scheduleLabel,
  'missingPartyFields': instance.missingPartyFields,
  'contracts': instance.contracts,
};

const _$ContractsOverviewResponseDtoContractTypeEnumMap = {
  ContractsOverviewResponseDtoContractType.construction: 'construction',
  ContractsOverviewResponseDtoContractType.sale: 'sale',
  ContractsOverviewResponseDtoContractType.$unknown: r'$unknown',
};
