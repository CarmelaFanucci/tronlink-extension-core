import { HDNodeWallet, SigningKey, getBytes } from 'ethers';
import { utils as tronUtils } from 'tronweb';

import { CoinType } from '../constants';
import { InvalidParameterError } from '../error';
import { isPositiveInteger } from '../../utils';
import type { DeriveTrezorAddressesParams, TrezorChain, TrezorDerivedAccount } from './types';

export function accountLevelPath(chain: TrezorChain, accountIndex: number): string {
  if (!isPositiveInteger(accountIndex)) {
    throw new InvalidParameterError();
  }
  const coinType = chain === 'evm' ? CoinType.ETHER : CoinType.TRON;
  return `m/44'/${coinType}'/${accountIndex}'`;
}

export function trezorCoin(chain: TrezorChain): 'eth' | 'trx' {
  return chain === 'evm' ? 'eth' : 'trx';
}

export function deriveAddressesFromXpub({
  xpub,
  count,
  chain,
  accountIndex,
  startIndex = 0,
}: DeriveTrezorAddressesParams): TrezorDerivedAccount[] {
  if (
    !isPositiveInteger(count) ||
    !isPositiveInteger(startIndex) ||
    !isPositiveInteger(accountIndex)
  ) {
    throw new InvalidParameterError();
  }

  const hd = HDNodeWallet.fromExtendedKey(xpub);
  const result: TrezorDerivedAccount[] = [];
  // Account xpub children are unhardened, so address discovery can stay local and
  // avoids prompting the hardware wallet for every address.
  for (let offset = 0; offset < count; offset += 1) {
    const addressIndex = startIndex + offset;
    const childPath = `0/${addressIndex}`;
    const child = hd.derivePath(childPath);
    let address: string;

    if (chain === 'evm') {
      address = child.address;
    } else {
      const publicKey = SigningKey.computePublicKey(child.publicKey, false);
      const addressBytes = (tronUtils as any).crypto.computeAddress(getBytes(publicKey));
      address = (tronUtils as any).crypto.getBase58CheckAddress(addressBytes);
    }

    result.push({
      childPath,
      path: `${accountLevelPath(chain, accountIndex)}/${childPath}`,
      address,
    });
  }
  return result;
}
