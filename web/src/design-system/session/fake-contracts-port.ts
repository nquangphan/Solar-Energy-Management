// hand-authored — TEST/DEMO-ONLY fake port (Story 7.3, mirror Flutter
// mobile/lib/design_system/session/fake_contracts_port.dart).
//
// NOT a real backend: it computes no money and owns no contract rule. The numbers
// are typed as the backend returns them (mockup order DH-2048, total 83.010.960 đ,
// 20/70/10). `generateContract` appends one canned contract with an increasing
// number; the options below switch the blocked / missing-party / error cases.

import type {
  ContractSummary,
  ContractType,
  ContractsOverview,
  ContractsPort,
  ContractsPortError,
} from './contracts-port';

export interface FakeContractsOptions {
  contractType?: ContractType;
  generatable?: boolean;
  blockedReason?: string | null;
  missingPartyFields?: string[];
  customerName?: string;
  contracts?: ContractSummary[];
  /** Rejects `getOverview` with this error. */
  overviewError?: ContractsPortError;
  /** Rejects `generateContract` with this error. */
  generateError?: ContractsPortError;
  /** Rejects `downloadContractPdf` with this error. */
  downloadError?: ContractsPortError;
}

export const DEMO_CONTRACT_SUMMARY: ContractSummary = {
  id: 'contract-1',
  contractNo: 'HĐTC-1/2026',
  contractType: 'construction',
  versionNo: 1,
  fileName: 'hop-dong-thi-cong-1',
  pdfSize: 48_213,
  createdAt: '2026-10-21T03:00:00.000Z',
};

export class FakeContractsPort implements ContractsPort {
  private readonly options: FakeContractsOptions;
  private contracts: ContractSummary[];
  private seq: number;

  constructor(options: FakeContractsOptions = {}) {
    this.options = options;
    this.contracts = [...(options.contracts ?? [])];
    this.seq = this.contracts.length;
  }

  getOverview(_orderId: string): Promise<ContractsOverview> {
    if (this.options.overviewError) return Promise.reject(this.options.overviewError);
    const generatable = this.options.generatable ?? true;
    return Promise.resolve({
      contractType: this.options.contractType ?? 'construction',
      generatable,
      blockedReason: generatable
        ? null
        : (this.options.blockedReason ?? 'Đơn chưa được chốt nên chưa sinh được hợp đồng.'),
      quoteNo: 'BG-2048',
      versionNo: 1,
      customerName: this.options.customerName ?? 'Nguyễn Văn An',
      lineCount: 6,
      orderTotal: 83_010_960,
      scheduleLabel: '20/70/10',
      missingPartyFields: this.options.missingPartyFields ?? [],
      contracts: [...this.contracts],
    });
  }

  generateContract(_orderId: string): Promise<ContractSummary> {
    if (this.options.generateError) return Promise.reject(this.options.generateError);
    this.seq += 1;
    // Same shapes as the backend: `HĐTC-{seq}/{yyyy}`, ASCII `hop-dong-thi-cong-{seq}`;
    // `versionNo` is the ORDER version printed (the overview's), not a contract counter.
    const type = this.options.contractType ?? 'construction';
    const created: ContractSummary = {
      id: `contract-${this.seq}`,
      contractNo: `${type === 'sale' ? 'HĐMB' : 'HĐTC'}-${this.seq}/2026`,
      contractType: type,
      versionNo: 1,
      fileName: `${type === 'sale' ? 'hop-dong-mua-ban' : 'hop-dong-thi-cong'}-${this.seq}`,
      pdfSize: 48_213,
      createdAt: '2026-10-22T03:00:00.000Z',
    };
    this.contracts = [created, ...this.contracts];
    return Promise.resolve(created);
  }

  downloadContractPdf(_orderId: string, contractId: string): Promise<File> {
    if (this.options.downloadError) return Promise.reject(this.options.downloadError);
    const found = this.contracts.find((c) => c.id === contractId);
    const name = found?.fileName ?? contractId;
    return Promise.resolve(new File(['%PDF-1.4 fake'], `${name}.pdf`, { type: 'application/pdf' }));
  }
}
