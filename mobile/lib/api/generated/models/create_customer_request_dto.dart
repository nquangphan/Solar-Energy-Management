// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'create_customer_request_dto_cust_type.dart';

part 'create_customer_request_dto.g.dart';

@JsonSerializable()
class CreateCustomerRequestDto {
  const CreateCustomerRequestDto({
    required this.phone,
    required this.custType,
    required this.name,
    required this.sourceId,
    this.nationalId,
    this.taxCode,
    this.address,
    this.bankAccount,
    this.sourceNote,
  });
  
  factory CreateCustomerRequestDto.fromJson(Map<String, Object?> json) => _$CreateCustomerRequestDtoFromJson(json);
  
  /// SĐT dạng THÔ — backend tự chuẩn hoá về E.164 (`+84…`) và dùng làm khoá chính. Không hợp lệ ⇒ 400.
  final String phone;

  /// Loại khách — quyết định bộ trường hợp lệ.
  final CreateCustomerRequestDtoCustType custType;

  /// Họ tên (Cá nhân) hoặc tên công ty (Thương mại).
  final String name;

  /// CCCD — CHỈ khách Cá nhân. Gửi kèm khách Thương mại ⇒ 400.
  final String? nationalId;

  /// Mã số thuế — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.
  final String? taxCode;

  /// Địa chỉ — dùng cho cả hai loại khách.
  final String? address;

  /// Tài khoản ngân hàng — CHỈ khách Thương mại. Gửi kèm khách Cá nhân ⇒ 400.
  final String? bankAccount;

  /// Nguồn khách (id của CustomerSource) — BẮT BUỘC, không có mặc định. Trỏ tới nguồn không tồn tại ⇒ 400.
  final String sourceId;

  /// Ghi chú nguồn — BẮT BUỘC khi nguồn được chọn mang cờ `isOther` (thiếu ⇒ 400); optional với nguồn khác.
  final String? sourceNote;

  Map<String, Object?> toJson() => _$CreateCustomerRequestDtoToJson(this);
}
