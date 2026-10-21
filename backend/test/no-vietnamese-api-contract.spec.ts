import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The HTTP contract (paths, parameter names, operation ids, schema names and every request/response
 * property) is English. Generated clients take method names from `operationId`, argument names
 * from `parameters[].name` and type/field names from the schemas, so a Vietnamese token that slips
 * back in becomes a breaking rename once a client depends on it.
 *
 * Reads the COMMITTED `openapi/openapi.json`: the drift-guard already proves that file equals the
 * spec built from code, so this guard only has to judge its content.
 *
 * Path segments and property names are compared WHOLE (`split('/')`, exact key), never by
 * substring: `anh`, `tu`, `ma`, `ten` hide inside plenty of legitimate words (`status`, `email`,
 * `tenant`), and a substring match would either miss a real hit or flag a good name.
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

/** Request/response property names (and multipart form fields) the API used before. */
const OLD_SCHEMA_PROPERTIES = [
  'sdt',
  'customerSdt',
  'cccd',
  'chotAt',
  'buoc',
  'buocKeTiep',
  'coTheHuy',
  'trangThai',
  'coTheXoa',
  'nguoiTaiLen',
  'soAnhDaLuu',
  'laBanHienLuc',
  'thayDoi',
  'soDong',
  'them',
  'xoa',
  'doiSoLuong',
  'ten',
  'tu',
  'den',
  'donVi',
  'khaDung',
  'tinhTrang',
  'canNhap',
  'danhSachCanMua',
  'ma',
  'nguoiTao',
  'tongSoLuong',
  'lyDo',
  'scopeThiCong',
  'scopeThietBi',
  'scopeVanChuyen',
  'anh',
];

/** Schema (class) names the API used before. */
const OLD_SCHEMA_NAMES = [
  'ThayDoiBanUpdateDto',
  'ThayDoiSoLuongDto',
  'CanMuaViewDto',
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

interface SchemaScan {
  schemaCount: number;
  propertyCount: number;
  violations: string[];
}

/**
 * Walks every node of the components AND of every operation (request bodies, responses,
 * parameters): a property can sit at any depth (`allOf`, `items`, a nested object) and a
 * multipart body may be described inline instead of through a named schema.
 */
function scanSchemas(doc: {
  components?: { schemas?: Record<string, unknown> };
  paths?: Record<string, Record<string, unknown>>;
}): SchemaScan {
  const violations: string[] = [];
  let propertyCount = 0;

  const walk = (node: unknown, where: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, where));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const ref = record.$ref;
    if (typeof ref === 'string') {
      const target = ref.slice(ref.lastIndexOf('/') + 1);
      if (OLD_SCHEMA_NAMES.includes(target)) {
        violations.push(`${where}: $ref to schema "${target}"`);
      }
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === 'properties' && value !== null && typeof value === 'object') {
        for (const [name, child] of Object.entries(value)) {
          propertyCount++;
          if (OLD_SCHEMA_PROPERTIES.includes(name)) {
            violations.push(`property ${where}.${name}`);
          }
          walk(child, `${where}.${name}`);
        }
      } else {
        walk(value, where);
      }
    }
  };

  const schemas = Object.entries(doc.components?.schemas ?? {});
  for (const [name, schema] of schemas) {
    if (OLD_SCHEMA_NAMES.includes(name)) {
      violations.push(`schema name "${name}"`);
    }
    walk(schema, name);
  }
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS.filter((m) => m in item)) {
      walk(item[method], `${method.toUpperCase()} ${path}`);
    }
  }

  return { schemaCount: schemas.length, propertyCount, violations };
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

describe('Schemas in openapi.json have no Vietnamese name or property', () => {
  const doc = JSON.parse(
    readFileSync(resolve(__dirname, '../openapi/openapi.json'), 'utf8'),
  ) as Parameters<typeof scanSchemas>[0];
  const scan = scanSchemas(doc);

  it('scans a non-empty spec (an empty scan would pass vacuously)', () => {
    // Measured after the rename: 109 schemas, 529 properties.
    expect(scan.schemaCount).toBeGreaterThanOrEqual(100);
    expect(scan.propertyCount).toBeGreaterThanOrEqual(450);
  });

  it('no schema name, property or form field from the old Vietnamese contract', () => {
    expect(scan.violations).toEqual([]);
  });

  // The ban list alone passes if a renamed schema simply vanished; the English ones must exist.
  it('the renamed schemas exist under their English names', () => {
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'VersionChangesDto',
        'QtyChangeDto',
        'PurchaseNeedViewDto',
      ]),
    );
  });

  it('catches an old schema name, a top-level, a nested and an inline multipart property', () => {
    const bad = scanSchemas({
      components: {
        schemas: {
          ThayDoiBanUpdateDto: { properties: { them: {} } },
          X: { properties: { nested: { properties: { lyDo: {} } } } },
        },
      },
      paths: {
        '/x': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { properties: { anh: {} } },
                },
              },
            },
          },
        },
      },
    });

    expect(bad.violations).toEqual([
      'schema name "ThayDoiBanUpdateDto"',
      'property ThayDoiBanUpdateDto.them',
      'property X.nested.lyDo',
      'property POST /x.anh',
    ]);
  });

  it('catches a $ref to an old schema name, inside items/allOf', () => {
    const bad = scanSchemas({
      components: {
        schemas: {
          Y: {
            properties: {
              list: { items: { $ref: '#/components/schemas/CanMuaViewDto' } },
              one: {
                allOf: [{ $ref: '#/components/schemas/ThayDoiSoLuongDto' }],
              },
            },
          },
        },
      },
    });

    expect(bad.violations).toEqual([
      'Y.list: $ref to schema "CanMuaViewDto"',
      'Y.one: $ref to schema "ThayDoiSoLuongDto"',
    ]);
  });

  it('does not flag English properties that merely contain an old token as a substring', () => {
    const good = scanSchemas({
      components: {
        schemas: { Z: { properties: { status: {}, name: {}, tenant: {} } } },
      },
    });

    expect(good.violations).toEqual([]);
    expect(good.propertyCount).toBe(3);
  });
});
