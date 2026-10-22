// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Đơn đã qua bước này / đang đứng ở đây / sắp tới.
@JsonEnum()
enum OrderLifecycleStepDtoProgress {
  @JsonValue('done')
  done('done'),
  @JsonValue('current')
  current('current'),
  @JsonValue('upcoming')
  upcoming('upcoming'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const OrderLifecycleStepDtoProgress(this.json);

  factory OrderLifecycleStepDtoProgress.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<OrderLifecycleStepDtoProgress> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
