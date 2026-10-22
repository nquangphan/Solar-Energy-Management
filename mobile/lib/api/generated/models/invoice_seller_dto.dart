// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'invoice_seller_dto.g.dart';

@JsonSerializable()
class InvoiceSellerDto {
  const InvoiceSellerDto({
    required this.legalName,
    required this.taxCode,
    required this.address,
    required this.representative,
    required this.representativeTitle,
    required this.phone,
    required this.bankAccount,
  });
  
  factory InvoiceSellerDto.fromJson(Map<String, Object?> json) => _$InvoiceSellerDtoFromJson(json);
  
  /// Tên pháp nhân bên bán lúc lập; rỗng = chưa cấu hình.
  final String legalName;

  /// MST bên bán lúc lập; rỗng = chưa cấu hình.
  final String taxCode;

  /// Địa chỉ bên bán lúc lập; rỗng = chưa cấu hình.
  final String address;

  /// Người đại diện lúc lập; rỗng = chưa cấu hình.
  final String representative;

  /// Chức danh người đại diện lúc lập; rỗng = chưa cấu hình.
  final String representativeTitle;

  /// Điện thoại bên bán lúc lập; rỗng = chưa cấu hình.
  final String phone;

  /// Tài khoản ngân hàng bên bán lúc lập; rỗng = chưa cấu hình.
  final String bankAccount;

  Map<String, Object?> toJson() => _$InvoiceSellerDtoToJson(this);
}
