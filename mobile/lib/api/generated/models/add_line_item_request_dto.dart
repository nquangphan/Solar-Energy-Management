// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'add_line_item_request_dto.g.dart';

@JsonSerializable()
class AddLineItemRequestDto {
  const AddLineItemRequestDto({
    required this.qty,
    this.isFlexible = false,
    this.productId,
    this.unitPrice,
    this.name,
    this.unit,
    this.note,
  });
  
  factory AddLineItemRequestDto.fromJson(Map<String, Object?> json) => _$AddLineItemRequestDtoFromJson(json);
  
  /// Id sản phẩm danh mục. Vắng mặt = dòng tự do. Id không tồn tại ⇒ 400 kèm fieldErrors.
  final String? productId;

  /// Số lượng — nguyên, tối thiểu 1.
  final num qty;

  /// Đơn giá — số nguyên ĐỒNG. BẮT BUỘC với dòng tự do. Với dòng catalog: CHỈ được gửi khi Product.priceEditable = true (ngược lại 400) — mặc định backend auto-điền theo danh mục hiện tại.
  final num? unitPrice;

  /// Tên dòng (nhiều dòng được) — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).
  final String? name;

  /// Đơn vị tính — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).
  final String? unit;

  /// Diễn giải cho dòng — nullable.
  final String? note;

  /// Cờ "linh động/dự kiến" — CHỈ hiển thị, không đổi hành vi giá.
  final bool isFlexible;

  Map<String, Object?> toJson() => _$AddLineItemRequestDtoToJson(this);
}
