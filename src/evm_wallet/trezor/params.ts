import { InvalidParameterError } from '../../base_wallet/error';
import type {
  TrezorNormalizedEvmTransaction,
  TrezorUnsignedEvmTransaction,
} from '../../base_wallet/trezor/types';

export type TrezorEvmTransactionDraft = Omit<
  Partial<TrezorNormalizedEvmTransaction>,
  'to' | 'value' | 'data'
> & {
  to: string | null;
  value: string;
  data: string;
};

function normalizeChainId(chainId: number | string): number {
  if (typeof chainId === 'number') {
    if (!Number.isSafeInteger(chainId) || chainId <= 0) {
      throw new InvalidParameterError(`Invalid EVM chainId: ${chainId}`);
    }
    return chainId;
  }

  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(chainId)) {
    throw new InvalidParameterError(`Invalid EVM chainId: ${chainId}`);
  }

  const normalized = Number(chainId);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new InvalidParameterError(`Invalid EVM chainId: ${chainId}`);
  }
  return normalized;
}

export function normalizeEvmTrezorTx(
  unsignedTransaction: Partial<TrezorUnsignedEvmTransaction> = {},
): TrezorEvmTransactionDraft {
  const { chainId, ...transaction } = unsignedTransaction;
  return {
    ...transaction,
    ...(chainId == null ? {} : { chainId: normalizeChainId(chainId) }),
    to: unsignedTransaction.to ?? null,
    value: unsignedTransaction.value ?? '0x0',
    data: unsignedTransaction.data ?? '0x',
  };
}
