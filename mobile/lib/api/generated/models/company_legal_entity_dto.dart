// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'company_legal_entity_dto.g.dart';

@JsonSerializable()
class CompanyLegalEntityDto {
  const CompanyLegalEntityDto({
    required this.legalName,
    required this.taxCode,
    required this.address,
    required this.representative,
    required this.representativeTitle,
    required this.phone,
    required this.bankAccount,
  });
  
  factory CompanyLegalEntityDto.fromJson(Map<String, Object?> json) => _$CompanyLegalEntityDtoFromJson(json);
  
  /// Tên công ty (pháp nhân) — chuỗi rỗng = chưa cấu hình.
  final String legalName;

  /// Mã số thuế công ty.
  final String taxCode;

  /// Địa chỉ công ty.
  final String address;

  /// Người đại diện ký hợp đồng.
  final String representative;

  /// Chức danh người đại diện.
  final String representativeTitle;

  /// Điện thoại công ty.
  final String phone;

  /// Tài khoản ngân hàng nhận thanh toán (in trên hợp đồng).
  final String bankAccount;

  Map<String, Object?> toJson() => _$CompanyLegalEntityDtoToJson(this);
}
