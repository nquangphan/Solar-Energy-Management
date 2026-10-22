// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'replace_product_group_items_request_dto.g.dart';

@JsonSerializable()
class ReplaceProductGroupItemsRequestDto {
  const ReplaceProductGroupItemsRequestDto({
    required this.productIds,
  });
  
  factory ReplaceProductGroupItemsRequestDto.fromJson(Map<String, Object?> json) => _$ReplaceProductGroupItemsRequestDtoFromJson(json);
  
  /// Danh sách sản phẩm con MỚI, thay thế toàn bộ danh sách cũ. THỨ TỰ MẢNG là thứ tự hiện trên checklist. Mảng rỗng = gói không có món nào (hợp lệ).
  final List<String> productIds;

  Map<String, Object?> toJson() => _$ReplaceProductGroupItemsRequestDtoToJson(this);
}
