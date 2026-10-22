// hand-authored — web contracts port (Story 7.3, mirror Flutter
// mobile/lib/design_system/session/contracts_port.dart). The seam between the
// Sinh hợp đồng screen and `/orders/{id}/contracts`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). The order total, the schedule
// label, whether the order can be turned into a contract and which company fields
// are unset are the backend's; the screen only renders them.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** `ContractResponseDto` — `fileName` without extension, ASCII; `createdAt` ISO-8601 UTC. */
export type ContractSummary = Schemas['ContractResponseDto'];

export type ContractType = ContractSummary['contractType'];

/**
 * `ContractsOverviewResponseDto`. `generatable` is decided by the backend
 * (false ⇒ `blockedReason` says why); `orderTotal` integer đồng; `scheduleLabel`
 * "20/70/10", "3 đợt" or null; `missingPartyFields` are the labels of the company
 * fields not configured yet; `contracts` newest first.
 */
export type ContractsOverview = Schemas['ContractsOverviewResponseDto'];

/** The AD-5 error envelope this port rejects with (400 / 404 / 409). `message` is shown verbatim. */
export interface ContractsPortError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Injectable transport for the Sinh hợp đồng screen. A PORT, NOT an HTTP client.
 *
 * The real implementation is `web/src/api/http-contracts-port.ts` (the transport
 * attaches the Bearer token and parses the AD-5 envelope).
 */
export interface ContractsPort {
  getOverview(orderId: string): Promise<ContractsOverview>;
  /** Every call creates a NEW contract. Rejects with `ContractsPortError` on 400 / 404 / 409. */
  generateContract(orderId: string): Promise<ContractSummary>;
  /** The PDF of one generated contract, named `${fileName}.pdf`. */
  downloadContractPdf(orderId: string, contractId: string): Promise<File>;
}
