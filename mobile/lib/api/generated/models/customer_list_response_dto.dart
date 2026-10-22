// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'customer_response_dto.dart';

part 'customer_list_response_dto.g.dart';

@JsonSerializable()
class CustomerListResponseDto {
  const CustomerListResponseDto({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });
  
  factory CustomerListResponseDto.fromJson(Map<String, Object?> json) => _$CustomerListResponseDtoFromJson(json);
  
  final List<CustomerResponseDto> items;

  /// Tổng số khách khớp bộ lọc (TOÀN BẢNG, không phải số dòng của trang này).
  final num total;

  /// Trang hiện tại (bắt đầu từ 1).
  final num page;

  /// Số bản ghi mỗi trang.
  final num pageSize;

  Map<String, Object?> toJson() => _$CustomerListResponseDtoToJson(this);
}
