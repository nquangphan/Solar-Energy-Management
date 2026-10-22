// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'create_product_request_dto.g.dart';

@JsonSerializable()
class CreateProductRequestDto {
  const CreateProductRequestDto({
    required this.name,
    required this.sku,
    required this.unit,
    required this.price,
    this.tracksStock = true,
    this.priceEditable = false,
    this.costPrice,
    this.warrantyMonths,
  });
  
  factory CreateProductRequestDto.fromJson(Map<String, Object?> json) => _$CreateProductRequestDtoFromJson(json);
  
  /// Tên vật tư.
  final String name;

  /// Mã vật tư — duy nhất.
  final String sku;

  /// Đơn vị tính.
  final String unit;

  /// Giá bán — số nguyên ĐỒNG (không thập phân).
  final num price;

  /// Giá vốn — số nguyên ĐỒNG. Ghi được CHỈ khi có quyền costs.view; thiếu quyền mà gửi field này ⇒ 403. Bỏ trống ⇒ 0 (từ Story 6.3 hệ thống tự cập nhật bằng bình quân gia quyền khi nhập kho).
  final num? costPrice;

  /// Có theo dõi tồn kho không (pin/inverter = true; công lắp, phí vận chuyển = false).
  final bool tracksStock;

  /// Cho phép sửa giá tại chỗ lúc lập báo giá (phí lắp đặt = true; tấm pin = false).
  final bool priceEditable;

  /// Bảo hành mặc định, tính bằng THÁNG. Bỏ trống/null = không bảo hành (công lắp, phí lắp đặt) — đây là giá trị hợp lệ, KHÔNG phải thiếu dữ liệu.
  final num? warrantyMonths;

  Map<String, Object?> toJson() => _$CreateProductRequestDtoToJson(this);
}
