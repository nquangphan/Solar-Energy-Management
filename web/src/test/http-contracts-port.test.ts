// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpContractsPort } from '../api/http-contracts-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const CONTRACT = {
  id: 'c1',
  contractNo: 'HD-0001',
  contractType: 'sale',
  versionNo: 1,
  fileName: 'HD-0001',
  pdfSize: 4,
  createdAt: '2026-10-01T00:00:00.000Z',
};

function pdf(headers: Record<string, string> = {}): Response {
  return new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf', ...headers } });
}

describe('HttpContractsPort', () => {
  it('getOverview GETs the overview of the order', async () => {
    const overview = { contractType: 'sale', generatable: true, blockedReason: null, contracts: [CONTRACT] };
    const h = setupHarness(() => json(200, overview));
    await expect(new HttpContractsPort(h.client).getOverview('o1')).resolves.toEqual(overview);
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/orders/o1/contracts');
  });

  it('generateContract POSTs and returns the new contract', async () => {
    const h = setupHarness(() => json(201, CONTRACT));
    await expect(new HttpContractsPort(h.client).generateContract('o1')).resolves.toEqual(CONTRACT);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/orders/o1/contracts');
  });

  it('downloadContractPdf returns a File named by Content-Disposition, with the PDF type', async () => {
    const h = setupHarness(() => pdf({ 'content-disposition': 'attachment; filename="HD-0001.pdf"' }));
    const file = await new HttpContractsPort(h.client).downloadContractPdf('o1', 'c1');
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    expect(target(h.requests[0])).toBe('/orders/o1/contracts/c1/pdf');
    expect(h.requests[0].headers.get('authorization')).toBe('Bearer access-1');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('HD-0001.pdf');
    expect(file.type).toBe('application/pdf');
    expect(await file.text()).toBe('%PDF');
  });

  it('downloadContractPdf falls back to `<contractId>.pdf` without the header', async () => {
    const h = setupHarness(() => pdf());
    const file = await new HttpContractsPort(h.client).downloadContractPdf('o1', 'c1');
    expect(file.name).toBe('c1.pdf');
  });

  it('downloadContractPdf falls back to `<contractId>.pdf` when the header has no quoted filename', async () => {
    const h = setupHarness(() => pdf({ 'content-disposition': 'attachment; filename*=UTF-8\'\'H%C4%90-0001.pdf' }));
    const file = await new HttpContractsPort(h.client).downloadContractPdf('o1', 'c1');
    expect(file.name).toBe('c1.pdf');
  });

  it('a 409 (order not contractable) is rejected as ApiError', async () => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Đơn chưa chốt.'));
    const error = await new HttpContractsPort(h.client).generateContract('o1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Đơn chưa chốt.' });
  });
});
