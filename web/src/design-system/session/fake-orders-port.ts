// hand-authored — TEST/DEMO-ONLY fake port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/fake_orders_port.dart).
//
// NOT a real backend: an in-memory order store so the quote screen is demoable
// and guardable WITHOUT an app-runtime or network. It PLAYS THE BACKEND's role
// for the demo — which is why the line `amount` is computed HERE and never in a
// screen/component (AD-10/16: the client renders backend numbers; this fake IS
// the stand-in backend). It enforces no security rule — permissions, the
// `'baogia'` window, the priceEditable gate all live on the real server (AD-4).

import {
  DEMO_CATALOG_PRODUCTS,
} from './fake-catalog-port';
import type { CatalogProduct } from './catalog-port';
import type {
  AddOrderLineInput,
  CreateOrderInput,
  Order,
  OrderLine,
  OrdersPort,
  UpdateOrderLineInput,
} from './orders-port';

const NOW = '2026-07-16T00:00:00.000Z';

/** An `OrdersPort` backed by an in-memory store — TEST/DEMO ONLY. */
export class FakeOrdersPort implements OrdersPort {
  private readonly orders = new Map<string, Order>();
  private seq = 0;

  constructor(
    private readonly products: CatalogProduct[] = DEMO_CATALOG_PRODUCTS,
  ) {}

  create(input: CreateOrderInput): Promise<Order> {
    this.seq += 1;
    const order: Order = {
      id: `ord-demo-${this.seq}`,
      status: 'baogia',
      customerSdt: input.customerSdt,
      currentVersionId: `ver-demo-${this.seq}`,
      ownerAccountId: 'acc-demo',
      assigneeAccountId: null,
      sourceId: 'src-facebook',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: false,
      scopeVanChuyen: false,
      kWp: null,
      vatMode: null,
      lineItems: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.orders.set(order.id, order);
    return Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  get(id: string): Promise<Order> {
    const order = this.orders.get(id);
    return order === undefined
      ? Promise.reject(new Error(`Không tìm thấy đơn hàng: ${id}`))
      : Promise.resolve({ ...order, lineItems: [...order.lineItems] });
  }

  addLine(orderId: string, input: AddOrderLineInput): Promise<OrderLine> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }

    this.seq += 1;
    let line: OrderLine;
    if (input.productId !== undefined) {
      const product = this.products.find((p) => p.id === input.productId);
      if (product === undefined) {
        return Promise.reject(new Error('Sản phẩm không tồn tại.'));
      }
      // Stand-in for the backend's resolveUnitPrice(): demo has no tier data,
      // so the catalogue price wins unless the product allows a client price.
      const unitPrice =
        product.priceEditable && input.unitPrice !== undefined
          ? input.unitPrice
          : product.price;
      line = this.buildLine(order, {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: input.qty,
        unitPrice,
        priceEditable: product.priceEditable,
        warrantyMonths: product.warrantyMonths,
        note: input.note ?? null,
        isFlexible: input.isFlexible ?? false,
      });
    } else {
      line = this.buildLine(order, {
        productId: null,
        name: input.name ?? '',
        unit: input.unit ?? '',
        qty: input.qty,
        unitPrice: input.unitPrice ?? 0,
        priceEditable: true,
        warrantyMonths: null,
        note: input.note ?? null,
        isFlexible: input.isFlexible ?? false,
      });
    }

    order.lineItems.push(line);
    return Promise.resolve({ ...line });
  }

  updateLine(
    orderId: string,
    lineId: string,
    input: UpdateOrderLineInput,
  ): Promise<OrderLine> {
    const order = this.orders.get(orderId);
    const line = order?.lineItems.find((l) => l.id === lineId);
    if (order === undefined || line === undefined) {
      return Promise.reject(new Error(`Không tìm thấy dòng báo giá: ${lineId}`));
    }
    if (input.qty !== undefined) line.qty = input.qty;
    if (input.unitPrice !== undefined && line.priceEditable) {
      line.unitPrice = input.unitPrice;
    }
    if (input.note !== undefined) line.note = input.note;
    if (input.isFlexible !== undefined) line.isFlexible = input.isFlexible;
    line.amount = this.serverAmount(line.unitPrice, line.qty);
    return Promise.resolve({ ...line });
  }

  removeLine(orderId: string, lineId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order === undefined) {
      return Promise.reject(new Error(`Không tìm thấy đơn hàng: ${orderId}`));
    }
    order.lineItems = order.lineItems.filter((l) => l.id !== lineId);
    return Promise.resolve();
  }

  private buildLine(
    order: Order,
    fields: Omit<OrderLine, 'id' | 'displayOrder' | 'amount'>,
  ): OrderLine {
    return {
      ...fields,
      id: `line-demo-${this.seq}`,
      displayOrder: order.lineItems.length,
      amount: this.serverAmount(fields.unitPrice, fields.qty),
    };
  }

  /** The BACKEND's lineAmount() stand-in — lives in the fake (the demo "server"), never in UI code. */
  private serverAmount(unitPrice: number, qty: number): number {
    return unitPrice * qty;
  }
}
