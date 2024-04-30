import { LedgerEthHidStatusChecker } from '../../../evm_wallet/ledger';

// @ts-ignore
const originalLocation = globalThis.window;

describe('LedgerEthHidStatusChecker', () => {
  let checker: LedgerEthHidStatusChecker;

  beforeEach(() => {
    checker = new LedgerEthHidStatusChecker();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalLocation,
    });
  });

  test('returns true when HID is available', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        navigator: {
          hid: {},
        },
      },
      writable: true,
    });
    expect(checker.checkEnableUseHID()).toBe(true);
  });

  test('returns false when HID is not available', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        navigator: {},
      },
      writable: true,
    });

    expect(checker.checkEnableUseHID()).toBe(false);
  });

  test('returns false when navigator is not available', () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      writable: true,
    });

    expect(checker.checkEnableUseHID()).toBe(false);
  });
});
