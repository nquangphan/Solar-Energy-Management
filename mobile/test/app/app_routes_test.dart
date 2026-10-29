// The signed-in route table (Story 10.7, orders/stock routes 10.8): the gate shared
// with the Menu and the tabs, the landing path, the child routes that need a
// permission of their own, and which locations a permission set may open.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/app/app_routes.dart';
import 'package:pns_mobile/design_system/shell/app_menu_nav.dart';

void main() {
  group('openableKeys', () {
    // Trang chủ needs no permission (web SIDEBAR_NAV `home` has no requires).
    test('no permission ⇒ only Trang chủ + Hồ sơ', () => expect(openableKeys({}), {'home', 'profile'}));
    test('customers.manage ⇒ + customers', () {
      expect(openableKeys({'customers.manage'}), {'home', 'customers', 'profile'});
    });
    test('orders.view_own ⇒ + orders, warranty', () {
      expect(openableKeys({'orders.view_own'}), {'home', 'orders', 'warranty', 'profile'});
    });
    test('orders.view_all ⇒ + orders, warranty', () {
      expect(openableKeys({'orders.view_all'}), {'home', 'orders', 'warranty', 'profile'});
    });
    test('quotes.create_edit alone ⇒ + inventory, not orders', () {
      expect(openableKeys({'quotes.create_edit'}), {'home', 'inventory', 'profile'});
    });
    test('inventory.manage ⇒ + inventory', () {
      expect(openableKeys({'inventory.manage'}), {'home', 'inventory', 'profile'});
    });
    test('permissions.manage ⇒ + permissions', () {
      expect(openableKeys({'permissions.manage'}), {'home', 'permissions', 'profile'});
    });
    test('audit.read ⇒ + audit', () {
      expect(openableKeys({'audit.read'}), {'home', 'audit', 'profile'});
    });
    test('costs.view ⇒ + profit', () {
      expect(openableKeys({'costs.view'}), {'home', 'profit', 'profile'});
    });
  });

  group('landingPath', () {
    test('Trang chủ for every account, like the web', () {
      for (final perms in <Set<String>>[
        {},
        {'orders.view_own'},
        {'customers.manage', 'orders.view_all'},
        {'quotes.create_edit'},
      ]) {
        expect(landingPath(perms), kHomePath, reason: '$perms');
      }
    });
    test('Trang chủ is openable without any permission', () {
      expect(isOpenable(kHomePath, {}), isTrue);
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

    test('Phân quyền and one account follow permissions.manage only', () {
      for (final path in [
        kPermissionsPath,
        permissionAccountPath('acc-1'),
        kAccountNewPath,
        accountEditPath('acc-1'),
      ]) {
        expect(isOpenable(path, {'permissions.manage'}), isTrue, reason: path);
        expect(isOpenable(path, {'settings.manage', 'orders.view_all'}), isFalse, reason: path);
      }
    });

    test('the Audit log follows audit.read only — not settings.manage, not every other key', () {
      expect(kAuditPath, '/audit');
      expect(isOpenable(kAuditPath, {'audit.read'}), isTrue);
      expect(isOpenable(kAuditPath, {'settings.manage'}), isFalse);
      // Every key a Menu entry or tab is gated on, except audit.read.
      final Set<String> everyOtherGate = {
        for (final link in [for (final s in kMobileMenu) ...s.links, ...kMobileTabLinks]) ...[
          if (link.requires != null && link.requires != 'audit.read') link.requires!,
          ...?link.requiresAny,
        ],
      };
      expect(everyOtherGate, isNotEmpty);
      expect(isOpenable(kAuditPath, everyOtherGate), isFalse);
    });

    test('the profit report follows costs.view only — not the order or finance keys', () {
      expect(kProfitReportPath, '/reports/profit');
      expect(kNavRoutes['profit'], kProfitReportPath);
      expect(isOpenable(kProfitReportPath, {'costs.view'}), isTrue);
      expect(isOpenable(kProfitReportPath, {'orders.view_all', 'dashboard.finance_view', 'payments.record'}), isFalse);
      final Set<String> everyOtherGate = {
        for (final link in [for (final s in kMobileMenu) ...s.links, ...kMobileTabLinks]) ...[
          if (link.requires != null && link.requires != 'costs.view') link.requires!,
          ...?link.requiresAny,
        ],
      };
      expect(everyOtherGate, isNotEmpty);
      expect(isOpenable(kProfitReportPath, everyOtherGate), isFalse);
    });

    test('the Menu lists Báo cáo lợi nhuận after Tra cứu bảo hành and before Phân quyền', () {
      final List<String> keys = [for (final s in kMobileMenu) for (final l in s.links) l.key];
      expect(keys.indexOf('profit'), keys.indexOf('warranty') + 1);
      expect(keys.indexOf('permissions'), keys.indexOf('profit') + 1);
    });
  });

  test('customerPath escapes the phone into one segment', () {
    expect(customerPath('+84903176968'), '/customers/%2B84903176968');
    expect(customerPath('0903/176'), '/customers/0903%2F176');
  });

  test('permissionAccountPath escapes the id into one segment', () {
    expect(permissionAccountPath('a/b'), '/permissions/a%2Fb');
  });

  test('the account form paths: new, and edit under the escaped id', () {
    expect(kAccountNewPath, '/permissions/new');
    expect(accountEditPath('a/b'), '/permissions/a%2Fb/edit');
  });

  test('order paths escape their ids into one segment each', () {
    expect(orderPath('a/b'), '/orders/a%2Fb');
    expect(orderInvoicePath('o1', 'x/y'), '/orders/o1/invoices/x%2Fy');
    expect(orderContractsPath('o1'), '/orders/o1/contracts');
  });
}
