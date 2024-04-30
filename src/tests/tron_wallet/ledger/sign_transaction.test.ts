import { LedgerTrxWebHid } from '../../../tron_wallet/ledger';
import AppTrx from '@ledgerhq/hw-app-trx';

jest.mock('@ledgerhq/hw-app-trx');

const DEFAULT_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const DEFAULT_USER_ADDRESS1 = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf'; // privateKey is 000...0001
const DEFAULT_USER_ADDRESS2 = '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF'; // privateKey is 000...0002

const mockUnSignTransaction = {
  from: DEFAULT_USER_ADDRESS1,
  to: DEFAULT_USER_ADDRESS2,
  value: '0x1',
  isUserEdit: false,
  type: '0x2',
  maxFeePerGas: '0x59682f0b',
  maxPriorityFeePerGas: '0x59682f00',
  gasLimit: '0x5208',
  nonce: '0xe',
  hex: 'testHex',
  info: 'testInfo',
};

describe('ledgerTrxWebHid - signTransaction', () => {
  let ledgerTrxWebHid: LedgerTrxWebHid;

  beforeEach(() => {
    ledgerTrxWebHid = new LedgerTrxWebHid();
    // @ts-ignore
    ledgerTrxWebHid.makeApp = jest.fn();
    // @ts-ignore
    ledgerTrxWebHid.cleanUp = jest.fn();
  });

  test('signs transaction successfully', async () => {
    const mockTransaction = mockUnSignTransaction;
    const mockPath = "44'/60'/0'/0/0";
    AppTrx.prototype.signTransaction = jest.fn();
    // @ts-ignore
    ledgerTrxWebHid.makeApp = jest.fn().mockReturnValue(new AppTrx());
    // @ts-ignore
    ledgerTrxWebHid._app = new AppTrx();

    const response = await ledgerTrxWebHid.signTransaction(mockTransaction, mockPath);
    expect(AppTrx.prototype.signTransaction).toHaveBeenCalledWith(
      mockPath,
      mockTransaction.hex,
      mockTransaction.info,
    );
  });

  test('handles exceptions during transaction signing', async () => {
    const mockTransaction = mockUnSignTransaction;
    const mockPath = "44'/60'/0'/0/0";
    AppTrx.prototype.signTransaction = jest.fn().mockRejectedValue(new Error('Signing failed'));
    // @ts-ignore
    ledgerTrxWebHid.makeApp = jest.fn().mockReturnValue(new AppTrx());
    // @ts-ignore
    ledgerTrxWebHid._app = new AppTrx();

    await expect(ledgerTrxWebHid.signTransaction(mockTransaction, mockPath)).rejects.toThrow(
      'Signing failed',
    );
  });

  test('handles exceptions during makeApp call', async () => {
    const mockTransaction = mockUnSignTransaction;
    const mockPath = "44'/60'/0'/0/0";
    // @ts-ignore
    ledgerTrxWebHid.makeApp = jest.fn().mockRejectedValue(new Error('Error creating app'));

    await expect(ledgerTrxWebHid.signTransaction(mockTransaction, mockPath)).rejects.toThrow(
      'Error creating app',
    );
  });

  test('performs cleanup after signing transaction', async () => {
    const mockTransaction = mockUnSignTransaction;
    const mockPath = "44'/60'/0'/0/0";
    AppTrx.prototype.signTransaction = jest.fn();
    // @ts-ignore
    ledgerTrxWebHid.makeApp = jest.fn().mockReturnValue(new AppTrx());
    // @ts-ignore
    ledgerTrxWebHid._app = new AppTrx();

    // @ts-ignore
    ledgerTrxWebHid.cleanUp = jest.fn();

    await ledgerTrxWebHid.signTransaction(mockTransaction, mockPath);
    // @ts-ignore
    expect(ledgerTrxWebHid.cleanUp).toHaveBeenCalled();
  });
});
