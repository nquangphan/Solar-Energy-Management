import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The HTTP contract (paths, parameter names, operation ids) is English. Generated clients take
 * method names from `operationId` and argument names from `parameters[].name`, so a Vietnamese
 * token that slips back in becomes a breaking rename once a client depends on it.
 *
 * Reads the COMMITTED `openapi/openapi.json`: the drift-guard already proves that file equals the
 * spec built from code, so this guard only has to judge its content.
 *
 * Path segments are compared WHOLE (`split('/')`), never by substring: `anh` hides inside plenty
 * of legitimate words, and a substring match would either miss a real hit or flag a good path.
 */

/** Route segments the API used before it was renamed to English. */
const OLD_PATH_SEGMENTS = [
  'cho-duyet-chiet-khau',
  'tra-cuu-bao-hanh',
  'anh',
  'ap-chiet-khau',
  'duyet-chiet-khau',
  'bao-gia',
  'xuat-bao-gia',
  'chot',
  'chuyen-trang-thai',
  'huy',
  'mo-lai',
  'phien-ban',
  'vong-doi',
];

/** Path/query parameter names (also checked as `{placeholder}` path segments). */
const OLD_PARAM_NAMES = ['sdt'];

/** Handler names Nest turns into `<Controller>_<handler>` operation ids. */
const OLD_OPERATION_SUFFIXES = [
  'traCuuBaoHanh',
  'chuyenTrangThai',
  'huyDon',
  'lietKe',
  'chiTiet',
];

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
];

type Parameter = { name?: string; in?: string };
type Operation = { operationId?: string; parameters?: Parameter[] };
type PathItem = Record<string, unknown> & { parameters?: Parameter[] };
type OpenApiDoc = { paths?: Record<string, PathItem> };

interface Scan {
  pathCount: number;
  parameterCount: number;
  operationIdCount: number;
  violations: string[];
}

function scanContract(doc: OpenApiDoc): Scan {
  const paths = Object.entries(doc.paths ?? {});
  const violations: string[] = [];
  let parameterCount = 0;
  let operationIdCount = 0;

  for (const [path, item] of paths) {
    for (const raw of path.split('/')) {
      const segment = raw.replace(/^\{|\}$/g, '');
      if (OLD_PATH_SEGMENTS.includes(segment)) {
        violations.push(`path ${path}: segment "${segment}"`);
      }
      if (raw.startsWith('{') && OLD_PARAM_NAMES.includes(segment)) {
        violations.push(`path ${path}: placeholder "{${segment}}"`);
      }
    }

    const operations = HTTP_METHODS.filter((m) => m in item).map(
      (m) => [m, item[m] as Operation] as const,
    );
    const parameterLists: Array<[string, Parameter[]]> = [
      [`${path}`, item.parameters ?? []],
      ...operations.map(
        ([m, op]) =>
          [`${m.toUpperCase()} ${path}`, op.parameters ?? []] as [
            string,
            Parameter[],
          ],
      ),
    ];
    for (const [where, params] of parameterLists) {
      for (const param of params) {
        parameterCount++;
        if (param.name !== undefined && OLD_PARAM_NAMES.includes(param.name)) {
          violations.push(`${where}: ${param.in} parameter "${param.name}"`);
        }
      }
    }

    for (const [m, op] of operations) {
      if (op.operationId === undefined) continue;
      operationIdCount++;
      const suffix = op.operationId.slice(op.operationId.indexOf('_') + 1);
      if (OLD_OPERATION_SUFFIXES.includes(suffix)) {
        violations.push(
          `${m.toUpperCase()} ${path}: operationId "${op.operationId}"`,
        );
      }
    }
  }

  return {
    pathCount: paths.length,
    parameterCount,
    operationIdCount,
    violations,
  };
}

describe('HTTP contract in openapi.json has no Vietnamese route, parameter or operation id', () => {
  const doc = JSON.parse(
    readFileSync(resolve(__dirname, '../openapi/openapi.json'), 'utf8'),
  ) as OpenApiDoc;
  const scan = scanContract(doc);

  it('scans a non-empty spec (an empty scan would pass vacuously)', () => {
    // Measured when the guard was written: 58 paths, 77 parameters, 82 operation ids.
    expect(scan.pathCount).toBeGreaterThanOrEqual(50);
    expect(scan.parameterCount).toBeGreaterThanOrEqual(40);
    expect(scan.operationIdCount).toBeGreaterThanOrEqual(70);
  });

  it('no path segment, parameter name or operation id from the old Vietnamese contract', () => {
    expect(scan.violations).toEqual([]);
  });

  // The ban list alone passes if a renamed route simply vanished or lost a method; the English
  // replacements and the operation ids clients generate method names from must be present.
  it('every renamed path exists with the same HTTP methods as before', () => {
    const renamed: Record<string, string[]> = {
      '/orders/pending-discount-approvals': ['get'],
      '/orders/warranty-lookup': ['get'],
      '/orders/{id}/attachments': ['get', 'post'],
      '/orders/{id}/attachments/{attachmentId}': ['delete', 'get'],
      '/orders/{id}/apply-discount': ['post'],
      '/orders/{id}/resolve-discount': ['post'],
      '/orders/{id}/quote/image': ['get'],
      '/orders/{id}/quote/pdf': ['get'],
      '/orders/{id}/export-quote': ['post'],
      '/orders/{id}/confirm': ['post'],
      '/orders/{id}/transition': ['post'],
      '/orders/{id}/cancel': ['post'],
      '/orders/{id}/reopen': ['post'],
      '/orders/{id}/versions': ['get'],
      '/orders/{id}/lifecycle': ['get'],
      '/customers/{phone}': ['get', 'patch'],
    };
    const actual = Object.fromEntries(
      Object.keys(renamed).map((path) => [
        path,
        HTTP_METHODS.filter((m) => m in (doc.paths?.[path] ?? {})).sort(),
      ]),
    );

    expect(actual).toEqual(renamed);
  });

  it('renamed handlers expose English operation ids', () => {
    const ids = Object.values(doc.paths ?? {}).flatMap((item) =>
      HTTP_METHODS.filter((m) => m in item).map(
        (m) => (item[m] as Operation).operationId,
      ),
    );

    expect(ids).toEqual(
      expect.arrayContaining([
        'OrdersController_warrantyLookup',
        'OrdersController_transition',
        'OrdersController_cancel',
        'StockItemsController_list',
        'StockVouchersController_list',
        'StockVouchersController_findOne',
      ]),
    );
  });

  it('catches all three kinds of violation in a synthetic spec', () => {
    const bad = scanContract({
      paths: {
        '/orders/{id}/chot': {
          post: {
            operationId: 'X_huyDon',
            parameters: [{ in: 'query', name: 'sdt' }],
          },
        },
        '/customers/{sdt}': { get: {} },
      },
    });

    expect(bad.violations).toEqual([
      'path /orders/{id}/chot: segment "chot"',
      'POST /orders/{id}/chot: query parameter "sdt"',
      'POST /orders/{id}/chot: operationId "X_huyDon"',
      'path /customers/{sdt}: placeholder "{sdt}"',
    ]);
  });

  it('does not flag English paths that merely contain an old token as a substring', () => {
    const good = scanContract({
      paths: {
        '/orders/{id}/attachments': {
          get: { operationId: 'OrdersController_listAttachments' },
        },
        '/orders/{id}/attachments/{attachmentId}': {
          delete: { operationId: 'OrdersController_removeAttachment' },
        },
        '/orders/{id}/quote/image': {
          get: { operationId: 'OrdersController_downloadQuoteImage' },
        },
      },
    });

    expect(good.violations).toEqual([]);
  });
});
