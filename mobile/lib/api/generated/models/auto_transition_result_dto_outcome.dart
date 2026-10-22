// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// applied = đơn đã chuyển; already = đơn đã ở đích; skipped = chuyển bị từ chối (tiền VẪN được ghi).
@JsonEnum()
enum AutoTransitionResultDtoOutcome {
  @JsonValue('applied')
  applied('applied'),
  @JsonValue('already')
  already('already'),
  @JsonValue('skipped')
  skipped('skipped'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const AutoTransitionResultDtoOutcome(this.json);

  factory AutoTransitionResultDtoOutcome.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<AutoTransitionResultDtoOutcome> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
