// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'stock_voucher_return_ref_dto.g.dart';

@JsonSerializable()
class StockVoucherReturnRefDto {
  const StockVoucherReturnRefDto({
    required this.id,
    required this.code,
  });
  
  factory StockVoucherReturnRefDto.fromJson(Map<String, Object?> json) => _$StockVoucherReturnRefDtoFromJson(json);
  
  final String id;

  /// Mã phiếu nhập trả.
  final String code;

  Map<String, Object?> toJson() => _$StockVoucherReturnRefDtoToJson(this);
}
