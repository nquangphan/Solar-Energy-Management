// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Sự kiện chuyển trạng thái. CHỈ năm sự kiện của lane thủ công — `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` có cửa riêng mang theo logic riêng và bị từ chối 409 ở đây.
/// Name not received and was auto-generated.
@JsonEnum()
enum Enum0 {
  @JsonValue('bat_dau_thi_cong')
  batDauThiCong('bat_dau_thi_cong'),
  @JsonValue('xong_thi_cong')
  xongThiCong('xong_thi_cong'),
  @JsonValue('bat_dau_giao')
  batDauGiao('bat_dau_giao'),
  @JsonValue('xong_giao')
  xongGiao('xong_giao'),
  @JsonValue('hoan_thanh')
  hoanThanh('hoan_thanh'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const Enum0(this.json);

  factory Enum0.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<Enum0> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
