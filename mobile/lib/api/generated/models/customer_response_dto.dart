// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'customer_response_dto.g.dart';

@JsonSerializable()
class CustomerResponseDto {
  const CustomerResponseDto({
    required this.phone,
    required this.custType,
    required this.name,
    required this.sourceId,
    required this.createdAt,
    required this.updatedAt,
    this.nationalId,
    this.taxCode,
    this.address,
    this.bankAccount,
    this.sourceNote,
  });
  
  factory CustomerResponseDto.fromJson(Map<String, Object?> json) => _$CustomerResponseDtoFromJson(json);
  
  /// SĐT đã chuẩn hoá E.164 — khoá chính của khách hàng.
  final String phone;

  /// Loại khách: CA_NHAN | THUONG_MAI.
  final String custType;

  /// Họ tên hoặc tên công ty.
  final String name;

  /// CCCD — chỉ khách Cá nhân; `null` với khách Thương mại.
  final String? nationalId;

  /// Mã số thuế — chỉ khách Thương mại; `null` với khách Cá nhân.
  final String? taxCode;
  final String? address;

  /// Tài khoản ngân hàng — chỉ khách Thương mại.
  final String? bankAccount;

  /// Nguồn khách (id của CustomerSource).
  final String sourceId;

  /// Ghi chú nguồn — bắt buộc khi nguồn mang cờ `isOther`.
  final String? sourceNote;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$CustomerResponseDtoToJson(this);
}
