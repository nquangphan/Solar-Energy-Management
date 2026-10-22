// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'create_order_request_dto.g.dart';

@JsonSerializable()
class CreateOrderRequestDto {
  const CreateOrderRequestDto({
    required this.customerPhone,
  });
  
  factory CreateOrderRequestDto.fromJson(Map<String, Object?> json) => _$CreateOrderRequestDtoFromJson(json);
  
  /// SĐT khách — thô hay E.164 đều được, backend chuẩn hoá trước khi tra (AD-9). Khách chưa tồn tại ⇒ 404 (luồng tạo khách inline đã có ở màn tra SĐT).
  final String customerPhone;

  Map<String, Object?> toJson() => _$CreateOrderRequestDtoToJson(this);
}
