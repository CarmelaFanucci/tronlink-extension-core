import { HDNodeWallet, SigningKey, getBytes } from 'ethers';
import { utils as tronUtils } from 'tronweb';

import {
  accountLevelPath,
  deriveAddressesFromXpub,
  trezorCoin,
} from '../../../base_wallet/trezor/derive';
import { InvalidParameterError } from '../../../base_wallet/error';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const root = HDNodeWallet.fromPhrase(MNEMONIC, '', 'm');

const accountXpub = (coinType: number, accountIndex = 0) =>
  root.derivePath(`m/44'/${coinType}'/${accountIndex}'`).neuter().extendedKey;

const tronAddressFromFullPath = (fullPath: string): string => {
  const child = root.derivePath(fullPath);
  const uncompressed = SigningKey.computePublicKey(child.publicKey, false);
  const addressBytes = (tronUtils as any).crypto.computeAddress(getBytes(uncompressed));
  return (tronUtils as any).crypto.getBase58CheckAddress(addressBytes);
};

describe('Trezor xpub derivation', () => {
  it('builds account-level paths and SDK coin names', () => {
    expect(accountLevelPath('tron', 3)).toBe("m/44'/195'/3'");
    expect(accountLevelPath('evm', 2)).toBe("m/44'/60'/2'");
    expect(trezorCoin('tron')).toBe('trx');
    expect(trezorCoin('evm')).toBe('eth');
  });

  it('derives only the requested nonzero EVM address range', () => {
    const result = deriveAddressesFromXpub({
      xpub: accountXpub(60),
      chain: 'evm',
      accountIndex: 0,
      startIndex: 5,
      count: 2,
    });

    expect(result).toEqual([
      {
        childPath: '0/5',
        path: "m/44'/60'/0'/0/5",
        address: root.derivePath("m/44'/60'/0'/0/5").address,
      },
      {
        childPath: '0/6',
        path: "m/44'/60'/0'/0/6",
        address: root.derivePath("m/44'/60'/0'/0/6").address,
      },
    ]);
  });

  it('derives TRON base58 addresses from an account xpub', () => {
    const result = deriveAddressesFromXpub({
      xpub: accountXpub(195),
      chain: 'tron',
      accountIndex: 0,
      count: 2,
    });

    expect(result.map(({ address }) => address)).toEqual([
      tronAddressFromFullPath("m/44'/195'/0'/0/0"),
      tronAddressFromFullPath("m/44'/195'/0'/0/1"),
    ]);
  });

  it.each([
    { count: -1, startIndex: 0, accountIndex: 0 },
    { count: 1.5, startIndex: 0, accountIndex: 0 },
    { count: 1, startIndex: -1, accountIndex: 0 },
    { count: 1, startIndex: 0, accountIndex: -1 },
  ])('rejects invalid indexes: %o', (indexes) => {
    expect(() =>
      deriveAddressesFromXpub({
        xpub: accountXpub(60),
        chain: 'evm',
        ...indexes,
      }),
    ).toThrow(InvalidParameterError);
  });
});
