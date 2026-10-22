// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'resolve_discount_request_dto.g.dart';

@JsonSerializable()
class ResolveDiscountRequestDto {
  const ResolveDiscountRequestDto({
    required this.approve,
    this.reason,
  });
  
  factory ResolveDiscountRequestDto.fromJson(Map<String, Object?> json) => _$ResolveDiscountRequestDtoFromJson(json);
  
  /// true = đồng ý (đơn Ở NGUYÊN choduyet — được Chốt qua /confirm); false = từ chối (đơn về baogia).
  final bool approve;

  /// Lý do duyệt / từ chối — BẮT BUỘC khi từ chối (thiếu ⇒ 400), optional khi đồng ý; ghi Audit log.
  final String? reason;

  Map<String, Object?> toJson() => _$ResolveDiscountRequestDtoToJson(this);
}
