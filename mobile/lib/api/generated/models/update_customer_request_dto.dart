// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'update_customer_request_dto_cust_type.dart';

part 'update_customer_request_dto.g.dart';

@JsonSerializable()
class UpdateCustomerRequestDto {
  const UpdateCustomerRequestDto({
    this.phone,
    this.custType,
    this.name,
    this.nationalId,
    this.taxCode,
    this.address,
    this.bankAccount,
    this.sourceId,
    this.sourceNote,
  });
  
  factory UpdateCustomerRequestDto.fromJson(Map<String, Object?> json) => _$UpdateCustomerRequestDtoFromJson(json);
  
  /// KHÔNG gửi field này. SĐT là khoá chính, bất biến sau khi tạo — gửi kèm ⇒ 400 (không phải im lặng bỏ qua).
  final String? phone;

  /// Loại khách.
  final UpdateCustomerRequestDtoCustType? custType;

  /// Họ tên (Cá nhân) hoặc tên công ty (Thương mại).
  final String? name;

  /// CCCD — CHỈ khách Cá nhân.
  final String? nationalId;

  /// Mã số thuế — CHỈ khách Thương mại.
  final String? taxCode;

  /// Địa chỉ — dùng cho cả hai loại khách.
  final String? address;

  /// Tài khoản ngân hàng — CHỈ khách Thương mại.
  final String? bankAccount;

  /// Nguồn khách (id của CustomerSource). Trỏ tới nguồn không tồn tại ⇒ 400.
  final String? sourceId;

  /// Ghi chú nguồn — BẮT BUỘC khi nguồn (mới hoặc đang có) mang cờ `isOther`.
  final String? sourceNote;

  Map<String, Object?> toJson() => _$UpdateCustomerRequestDtoToJson(this);
}
