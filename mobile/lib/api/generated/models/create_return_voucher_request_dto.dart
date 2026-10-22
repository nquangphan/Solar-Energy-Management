// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'return_voucher_line_request_dto.dart';

part 'create_return_voucher_request_dto.g.dart';

@JsonSerializable()
class CreateReturnVoucherRequestDto {
  const CreateReturnVoucherRequestDto({
    required this.lines,
    this.note,
  });
  
  factory CreateReturnVoucherRequestDto.fromJson(Map<String, Object?> json) => _$CreateReturnVoucherRequestDtoFromJson(json);
  
  /// Ghi chú (vd tình trạng hàng nhận lại). Tối đa 500 ký tự.
  final String? note;

  /// Từ 1 đến 100 dòng; không lặp sản phẩm (DUPLICATE_PRODUCT), chỉ sản phẩm có trên phiếu gốc.
  final List<ReturnVoucherLineRequestDto> lines;

  Map<String, Object?> toJson() => _$CreateReturnVoucherRequestDtoToJson(this);
}
