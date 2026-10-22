// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contract_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContractResponseDto _$ContractResponseDtoFromJson(Map<String, dynamic> json) =>
    ContractResponseDto(
      id: json['id'] as String,
      contractNo: json['contractNo'] as String,
      contractType: ContractResponseDtoContractType.fromJson(
        json['contractType'] as String,
      ),
      versionNo: json['versionNo'] as num,
      fileName: json['fileName'] as String,
      pdfSize: json['pdfSize'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$ContractResponseDtoToJson(
  ContractResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'contractNo': instance.contractNo,
  'contractType':
      _$ContractResponseDtoContractTypeEnumMap[instance.contractType]!,
  'versionNo': instance.versionNo,
  'fileName': instance.fileName,
  'pdfSize': instance.pdfSize,
  'createdAt': instance.createdAt.toIso8601String(),
};

const _$ContractResponseDtoContractTypeEnumMap = {
  ContractResponseDtoContractType.construction: 'construction',
  ContractResponseDtoContractType.sale: 'sale',
  ContractResponseDtoContractType.$unknown: r'$unknown',
};
