// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'audit_change_dto.g.dart';

@JsonSerializable()
class AuditChangeDto {
  const AuditChangeDto({
    required this.field,
    required this.before,
    required this.after,
    required this.isMoney,
  });
  
  factory AuditChangeDto.fromJson(Map<String, Object?> json) => _$AuditChangeDtoFromJson(json);
  
  /// Đường dẫn tới giá trị bị đổi (status, lines[0].unitCost, [1].price); chuỗi rỗng khi dữ liệu là một giá trị đơn.
  final String field;

  /// Giá trị trước dạng chuỗi (tối đa 500 ký tự); null khi không có.
  final String? before;

  /// Giá trị sau dạng chuỗi (tối đa 500 ký tự); null khi không có.
  final String? after;

  /// Field là số tiền nguyên: client hiển thị qua bộ định dạng tiền khi giá trị là số nguyên.
  final bool isMoney;

  Map<String, Object?> toJson() => _$AuditChangeDtoToJson(this);
}
