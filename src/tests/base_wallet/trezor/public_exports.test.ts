import {
  TrezorDevice,
  TrezorConnectTransport,
  TrezorError,
  TrezorEvmSigner,
  TrezorTrxSigner,
  accountLevelPath,
  appendTronSignature,
  buildTronTrezorParams,
  deriveAddressesFromXpub,
  normalizeEvmTrezorTx,
  trezorCoin,
} from '../../..';

describe('Trezor public API', () => {
  it('exports common, TRON, and EVM capabilities from the package root', () => {
    expect(TrezorDevice).toBeDefined();
    expect(TrezorConnectTransport).toBeDefined();
    expect(TrezorError).toBeDefined();
    expect(TrezorEvmSigner).toBeDefined();
    expect(TrezorTrxSigner).toBeDefined();
    expect(accountLevelPath).toBeInstanceOf(Function);
    expect(appendTronSignature).toBeInstanceOf(Function);
    expect(buildTronTrezorParams).toBeInstanceOf(Function);
    expect(deriveAddressesFromXpub).toBeInstanceOf(Function);
    expect(normalizeEvmTrezorTx).toBeInstanceOf(Function);
    expect(trezorCoin).toBeInstanceOf(Function);
  });
});
