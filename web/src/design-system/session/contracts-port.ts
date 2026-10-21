// hand-authored — web contracts port (Story 7.3, mirror Flutter
// mobile/lib/design_system/session/contracts_port.dart). The seam between the
// Sinh hợp đồng screen and `/orders/{id}/contracts`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). The order total, the schedule
// label, whether the order can be turned into a contract and which company fields
// are unset are the backend's; the screen only renders them.

export type ContractType = 'construction' | 'sale';

/** Mirrors `ContractResponseDto` field for field. */
export interface ContractSummary {
  id: string;
  contractNo: string;
  contractType: ContractType;
  versionNo: number;
  /** File name without extension, ASCII. */
  fileName: string;
  pdfSize: number;
  /** ISO-8601 UTC. */
  createdAt: string;
}

/** Mirrors `ContractsOverviewResponseDto` field for field. */
export interface ContractsOverview {
  contractType: ContractType;
  /** Decided by the backend. false ⇒ `blockedReason` says why. */
  generatable: boolean;
  blockedReason: string | null;
  quoteNo: string;
  versionNo: number;
  customerName: string;
  lineCount: number;
  /** Integer đồng, computed by the backend. */
  orderTotal: number;
  /** "20/70/10", "3 đợt" or null when the order has no schedule. */
  scheduleLabel: string | null;
  /** Labels of the company fields not configured yet (printed "Chưa cấu hình"). */
  missingPartyFields: string[];
  /** Newest first. */
  contracts: ContractSummary[];
}

/** The AD-5 error envelope this port rejects with (400 / 404 / 409). `message` is shown verbatim. */
export interface ContractsPortError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Injectable transport for the Sinh hợp đồng screen. A PORT, NOT an HTTP client.
 *
 * TODO(app-runtime/login-network): the real implementation attaches the bearer
 * token and parses the AD-5 envelope into `ContractsPortError`.
 */
export interface ContractsPort {
  getOverview(orderId: string): Promise<ContractsOverview>;
  /** Every call creates a NEW contract. Rejects with `ContractsPortError` on 400 / 404 / 409. */
  generateContract(orderId: string): Promise<ContractSummary>;
  /** The PDF of one generated contract, named `${fileName}.pdf`. */
  downloadContractPdf(orderId: string, contractId: string): Promise<File>;
}
