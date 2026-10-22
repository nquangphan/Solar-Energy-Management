// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_return_voucher_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateReturnVoucherRequestDto _$CreateReturnVoucherRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateReturnVoucherRequestDto(
  lines: (json['lines'] as List<dynamic>)
      .map(
        (e) => ReturnVoucherLineRequestDto.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
  note: json['note'] as String?,
);

Map<String, dynamic> _$CreateReturnVoucherRequestDtoToJson(
  CreateReturnVoucherRequestDto instance,
) => <String, dynamic>{'note': instance.note, 'lines': instance.lines};
