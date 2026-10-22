// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Loại khách.
@JsonEnum()
enum UpdateCustomerRequestDtoCustType {
  @JsonValue('CA_NHAN')
  caNhan('CA_NHAN'),
  @JsonValue('THUONG_MAI')
  thuongMai('THUONG_MAI'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const UpdateCustomerRequestDtoCustType(this.json);

  factory UpdateCustomerRequestDtoCustType.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<UpdateCustomerRequestDtoCustType> get $valuesDefined => values.where((value) => value != $unknown).toList();
}
