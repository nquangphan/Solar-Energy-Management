// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'contract_response_dto.dart';
import 'contracts_overview_response_dto_contract_type.dart';

part 'contracts_overview_response_dto.g.dart';

@JsonSerializable()
class ContractsOverviewResponseDto {
  const ContractsOverviewResponseDto({
    required this.contractType,
    required this.generatable,
    required this.blockedReason,
    required this.quoteNo,
    required this.versionNo,
    required this.customerName,
    required this.lineCount,
    required this.orderTotal,
    required this.scheduleLabel,
    required this.missingPartyFields,
    required this.contracts,
  });
  
  factory ContractsOverviewResponseDto.fromJson(Map<String, Object?> json) => _$ContractsOverviewResponseDtoFromJson(json);
  
  /// Loại hợp đồng server suy từ cờ phạm vi của đơn — không chọn tay.
  final ContractsOverviewResponseDtoContractType contractType;

  /// true ⇒ POST sẽ sinh được; false ⇒ blockedReason nói vì sao (cùng message POST trả).
  final bool generatable;

  /// Lý do không sinh được (tiếng Việt), null khi generatable.
  final String? blockedReason;

  /// Số báo giá tham chiếu — trùng số in trên báo giá của đơn.
  final String quoteNo;

  /// Số thứ tự bản đơn hiệu lực.
  final num versionNo;
  final String customerName;

  /// Số dòng vật tư của bản hiệu lực.
  final num lineCount;

  /// Tổng đơn sau VAT in vào hợp đồng — số nguyên đồng.
  final num orderTotal;

  /// Tóm tắt lịch thanh toán: "20/70/10" khi mọi đợt theo %, "N đợt" khi có đợt theo số tiền, null khi chưa có lịch.
  final String? scheduleLabel;

  /// Nhãn các ô pháp nhân công ty chưa cấu hình (in "Chưa cấu hình" — không chặn sinh).
  final List<String> missingPartyFields;

  /// Hợp đồng đã sinh của đơn, mới nhất trước.
  final List<ContractResponseDto> contracts;

  Map<String, Object?> toJson() => _$ContractsOverviewResponseDtoToJson(this);
}
