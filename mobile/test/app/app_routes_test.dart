// The signed-in route table (Story 10.7, orders/stock routes 10.8): the gate shared
// with the Menu and the tabs, the landing path, the child routes that need a
// permission of their own, and which locations a permission set may open.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/app/app_routes.dart';

void main() {
  group('openableKeys', () {
    test('no permission ⇒ only Hồ sơ', () => expect(openableKeys({}), {'profile'}));
    test('customers.manage ⇒ + customers', () => expect(openableKeys({'customers.manage'}), {'customers', 'profile'}));
    test('orders.view_own ⇒ + orders, warranty', () {
      expect(openableKeys({'orders.view_own'}), {'orders', 'warranty', 'profile'});
    });
    test('orders.view_all ⇒ + orders, warranty', () {
      expect(openableKeys({'orders.view_all'}), {'orders', 'warranty', 'profile'});
    });
    test('quotes.create_edit alone ⇒ + inventory, not orders', () {
      expect(openableKeys({'quotes.create_edit'}), {'inventory', 'profile'});
    });
    test('inventory.manage ⇒ + inventory', () => expect(openableKeys({'inventory.manage'}), {'inventory', 'profile'}));
  });

  group('landingPath', () {
    test('the order list when the account may see orders', () {
      expect(landingPath({'orders.view_own'}), kOrdersPath);
      expect(landingPath({'customers.manage', 'orders.view_all'}), kOrdersPath);
    });
    test('the Menu otherwise', () {
      expect(landingPath({}), kMenuPath);
      expect(landingPath({'customers.manage'}), kMenuPath);
      expect(landingPath({'quotes.create_edit'}), kMenuPath);
    });
  });

  group('isOpenable', () {
    test('the Menu and Hồ sơ are always open', () {
      expect(isOpenable(kMenuPath, {}), isTrue);
      expect(isOpenable(kProfilePath, {}), isTrue);
    });

    test('a customer path follows customers.manage, child paths included', () {
      for (final path in [kCustomersPath, kCustomerLookupPath, customerPath('+84903176968')]) {
        expect(isOpenable(path, {'customers.manage'}), isTrue, reason: path);
        expect(isOpenable(path, {'orders.view_all'}), isFalse, reason: path);
      }
    });

    test('the warranty path follows either order read key, never customers.manage', () {
      expect(isOpenable(kWarrantyPath, {'orders.view_own'}), isTrue);
      expect(isOpenable(kWarrantyPath, {'orders.view_all'}), isTrue);
      expect(isOpenable(kWarrantyPath, {'customers.manage'}), isFalse);
      expect(isOpenable(kWarrantyPath, {}), isFalse);
    });

    test('an unknown path or a look-alike prefix is not openable', () {
      expect(isOpenable('/ordersx', {'customers.manage', 'orders.view_all'}), isFalse);
      expect(isOpenable('/customersx', {'customers.manage'}), isFalse);
      expect(isOpenable('/', {'customers.manage'}), isFalse);
    });

    test('an order and its plain children follow the order read keys only', () {
      for (final path in [kOrdersPath, orderPath('o1'), orderTransitionPath('o1'), orderPaymentsPath('o1')]) {
        expect(isOpenable(path, {'orders.view_own'}), isTrue, reason: path);
        expect(isOpenable(path, {'orders.view_all'}), isTrue, reason: path);
        expect(isOpenable(path, {'quotes.create_edit'}), isFalse, reason: path);
      }
    });

    test('contracts need contracts.generate on top of the order gate', () {
      final path = orderContractsPath('o1');
      expect(isOpenable(path, {'orders.view_own'}), isFalse);
      expect(isOpenable(path, {'orders.view_own', 'contracts.generate'}), isTrue);
      expect(isOpenable(path, {'contracts.generate'}), isFalse);
    });

    test('invoices (list and one invoice) need invoices.manage on top of the order gate', () {
      for (final path in [orderInvoicesPath('o1'), orderInvoicePath('o1', 'inv-1')]) {
        expect(isOpenable(path, {'orders.view_all'}), isFalse, reason: path);
        expect(isOpenable(path, {'orders.view_all', 'invoices.manage'}), isTrue, reason: path);
        expect(isOpenable(path, {'invoices.manage'}), isFalse, reason: path);
      }
    });

    test('the new-quote form needs quotes.create_edit, the approvals discounts.approve', () {
      expect(isOpenable(kOrderNewPath, {'orders.view_all'}), isFalse);
      expect(isOpenable(kOrderNewPath, {'orders.view_all', 'quotes.create_edit'}), isTrue);
      expect(isOpenable(kOrderNewPath, {'quotes.create_edit'}), isFalse, reason: 'the order gate still applies');
      expect(isOpenable(kDiscountApprovalsPath, {'orders.view_all'}), isFalse);
      expect(isOpenable(kDiscountApprovalsPath, {'orders.view_all', 'discounts.approve'}), isTrue);
    });

    test('a trailing slash does not drop a child route\'s own permission', () {
      expect(isOpenable('$kOrderNewPath/', {'orders.view_all'}), isFalse);
      expect(isOpenable('$kDiscountApprovalsPath/', {'orders.view_all'}), isFalse);
      expect(isOpenable('${orderContractsPath('o1')}/', {'orders.view_all'}), isFalse);
      expect(isOpenable('$kStockVouchersPath/', {'quotes.create_edit'}), isFalse);
      expect(isOpenable('$kOrderNewPath/', {'orders.view_all', 'quotes.create_edit'}), isTrue);
    });

    test('Tồn kho opens for either stock key; Phiếu kho needs inventory.manage', () {
      expect(isOpenable(kInventoryPath, {'quotes.create_edit'}), isTrue);
      expect(isOpenable(kInventoryPath, {'inventory.manage'}), isTrue);
      expect(isOpenable(kInventoryPath, {'orders.view_all'}), isFalse);
      expect(isOpenable(kStockVouchersPath, {'quotes.create_edit'}), isFalse);
      expect(isOpenable(kStockVouchersPath, {'inventory.manage'}), isTrue);
    });
  });

  test('customerPath escapes the phone into one segment', () {
    expect(customerPath('+84903176968'), '/customers/%2B84903176968');
    expect(customerPath('0903/176'), '/customers/0903%2F176');
  });

  test('order paths escape their ids into one segment each', () {
    expect(orderPath('a/b'), '/orders/a%2Fb');
    expect(orderInvoicePath('o1', 'x/y'), '/orders/o1/invoices/x%2Fy');
    expect(orderContractsPath('o1'), '/orders/o1/contracts');
  });
}
