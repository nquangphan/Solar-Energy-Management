// The signed-in route table (Story 10.7): the gate shared with the Menu, the
// landing path, and which locations a permission set may open.
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/app/app_routes.dart';

void main() {
  group('openableKeys', () {
    test('no permission ⇒ only Hồ sơ', () => expect(openableKeys({}), {'profile'}));
    test('customers.manage ⇒ + customers', () => expect(openableKeys({'customers.manage'}), {'customers', 'profile'}));
    test('orders.view_own ⇒ + warranty', () => expect(openableKeys({'orders.view_own'}), {'warranty', 'profile'}));
    test('orders.view_all ⇒ + warranty', () => expect(openableKeys({'orders.view_all'}), {'warranty', 'profile'}));
  });

  test('landing is the Menu', () {
    expect(landingPath({}), kMenuPath);
    expect(landingPath({'customers.manage', 'orders.view_all'}), kMenuPath);
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
      expect(isOpenable('/orders', {'customers.manage', 'orders.view_all'}), isFalse);
      expect(isOpenable('/customersx', {'customers.manage'}), isFalse);
      expect(isOpenable('/', {'customers.manage'}), isFalse);
    });
  });

  test('customerPath escapes the phone into one segment', () {
    expect(customerPath('+84903176968'), '/customers/%2B84903176968');
    expect(customerPath('0903/176'), '/customers/0903%2F176');
  });
}
