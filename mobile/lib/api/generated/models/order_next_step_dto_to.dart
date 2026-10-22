// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Đơn sẽ tới trạng thái nào — do bảng transition quyết, không do client.
@JsonEnum()
enum OrderNextStepDtoTo {
  @JsonValue('baogia')
  baogia('baogia'),
  @JsonValue('choduyet')
  choduyet('choduyet'),
  @JsonValue('dachot')
  dachot('dachot'),
  @JsonValue('dacoc')
  dacoc('dacoc'),
  @JsonValue('thicong')
  thicong('thicong'),
  @JsonValue('nghiemthu')
  nghiemthu('nghiemthu'),
  @JsonValue('danggiao')
  danggiao('danggiao'),
  @JsonValue('dagiao')
  dagiao('dagiao'),
  @JsonValue('hoanthanh')
  hoanthanh('hoanthanh'),
  @JsonValue('huy')
  huy('huy'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const OrderNextStepDtoTo(this.json);

  factory OrderNextStepDtoTo.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<OrderNextStepDtoTo> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
