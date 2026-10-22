// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'contract_response_dto_contract_type.dart';

part 'contract_response_dto.g.dart';

@JsonSerializable()
class ContractResponseDto {
  const ContractResponseDto({
    required this.id,
    required this.contractNo,
    required this.contractType,
    required this.versionNo,
    required this.fileName,
    required this.pdfSize,
    required this.createdAt,
  });
  
  factory ContractResponseDto.fromJson(Map<String, Object?> json) => _$ContractResponseDtoFromJson(json);
  
  final String id;

  /// Số hợp đồng in trong PDF — `HĐTC-{n}/{năm}` hoặc `HĐMB-{n}/{năm}`.
  final String contractNo;

  /// construction = HĐ Thi công (đơn có cờ Thi công); sale = HĐ Mua bán (chỉ Thiết bị).
  final ContractResponseDtoContractType contractType;

  /// Số thứ tự bản đơn (version) đã in.
  final num versionNo;

  /// Tên file không đuôi (ASCII); route tải thêm `.pdf`.
  final String fileName;

  /// Kích thước file PDF (byte).
  final num pdfSize;

  /// Thời điểm sinh (ISO-8601 UTC).
  final DateTime createdAt;

  Map<String, Object?> toJson() => _$ContractResponseDtoToJson(this);
}
