// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'warranty_line_item_dto_warranty_status.dart';

part 'warranty_line_item_dto.g.dart';

@JsonSerializable()
class WarrantyLineItemDto {
  const WarrantyLineItemDto({
    required this.id,
    required this.name,
    required this.qty,
    required this.unit,
    required this.warrantyMonths,
    required this.warrantyStartAt,
    required this.warrantyEndAt,
    required this.remainingDays,
    required this.remainingMonths,
    required this.warrantyStatus,
  });
  
  factory WarrantyLineItemDto.fromJson(Map<String, Object?> json) => _$WarrantyLineItemDtoFromJson(json);
  
  final String id;

  /// Tên vật tư.
  final String name;
  final num qty;
  final String unit;

  /// Số tháng bảo hành của DÒNG này.
  final num warrantyMonths;

  /// Ngày DÒNG NÀY chốt lần đầu (ISO-8601 UTC) — mốc theo DÒNG, không theo Đơn (FR-36): hai dòng cùng đơn được phép khác nhau.
  final DateTime warrantyStartAt;

  /// Hạn bảo hành (ISO-8601 UTC, luôn `00:00:00Z`) = `warrantyStartAt` + `warrantyMonths` tháng, kẹp về ngày cuối tháng đích.
  final DateTime warrantyEndAt;

  /// Số ngày còn lại — ÂM khi đã hết hạn. Đây là số điều khiển `warrantyStatus`; client KHÔNG tự suy trạng thái từ nó.
  final num remainingDays;

  /// Số tháng còn lại, làm tròn XUỐNG, sàn 0 — CHỈ để dựng câu hiển thị "Còn 5 năm".
  final num remainingMonths;

  /// Trạng thái bảo hành — backend quyết, client chỉ ánh xạ ra màu + nhãn.
  final WarrantyLineItemDtoWarrantyStatus warrantyStatus;

  Map<String, Object?> toJson() => _$WarrantyLineItemDtoToJson(this);
}
