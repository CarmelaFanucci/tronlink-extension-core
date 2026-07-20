import type { TrezorTransport } from '../../base_wallet/trezor/TrezorTransport';
import { InvalidParameterError, TrezorError } from '../../base_wallet/error';
import type {
  TrezorEvmSignature,
  TrezorMessageSignParams,
  TrezorNormalizedEvmTransaction,
  TrezorSignParams,
  TrezorUnsignedEvmTransaction,
} from '../../base_wallet/trezor/types';
import { normalizeEvmTrezorTx, type TrezorEvmTransactionDraft } from './params';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function assertValidTransaction(
  transaction: TrezorEvmTransactionDraft,
): asserts transaction is TrezorNormalizedEvmTransaction {
  const type = transaction.type ?? 0;
  const hasValidBaseFields =
    Number.isSafeInteger(transaction.chainId) &&
    (transaction.chainId ?? 0) > 0 &&
    isNonEmptyString(transaction.nonce) &&
    isNonEmptyString(transaction.gasLimit) &&
    (transaction.to === null || isNonEmptyString(transaction.to)) &&
    isNonEmptyString(transaction.value) &&
    isNonEmptyString(transaction.data) &&
    (type === 0 || type === 2);
  const hasValidFeeFields =
    type === 2
      ? isNonEmptyString(transaction.maxFeePerGas) &&
        isNonEmptyString(transaction.maxPriorityFeePerGas)
      : isNonEmptyString(transaction.gasPrice);

  if (!hasValidBaseFields || !hasValidFeeFields) {
    throw new InvalidParameterError('Invalid Trezor EVM transaction');
  }
}

function parseSignatureV(v: string, label: 'parity' | 'v'): number {
  const normalized = Number(v);
  if (v.trim() === '' || !Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TrezorError('invalid_signature', `Invalid Trezor EVM signature ${label}: ${v}`);
  }
  return normalized;
}

export class TrezorEvmSigner {
  private readonly transport: TrezorTransport;

  constructor(transport: TrezorTransport) {
    this.transport = transport;
  }

  async signTransaction({
    data,
    path,
  }: TrezorSignParams<TrezorUnsignedEvmTransaction>): Promise<TrezorEvmSignature> {
    const transaction = normalizeEvmTrezorTx(data);
    assertValidTransaction(transaction);
    const { v, r, s } = await this.transport.signEvmTransaction({ path, transaction });
    const type = transaction.type ?? 0;

    if (type === 2) {
      // Typed transactions expose raw parity, while legacy transactions return EIP-155 v.
      const yParity = parseSignatureV(v, 'parity');
      if (yParity !== 0 && yParity !== 1) {
        throw new TrezorError('invalid_signature', `Invalid Trezor EVM signature parity: ${v}`);
      }
      return { r, s, yParity };
    }

    return { r, s, v: parseSignatureV(v, 'v') };
  }

  async signMessage({ message, path }: TrezorMessageSignParams): Promise<string> {
    const signature = await this.transport.signEvmMessage({
      path,
      message,
      hex: /^0x[0-9a-fA-F]+$/.test(message),
    });
    return signature.startsWith('0x') ? signature : `0x${signature}`;
  }

  signTypedData({ data, path }: TrezorSignParams<unknown>): Promise<string> {
    return this.transport.signEvmTypedData({
      path,
      data,
      metamaskV4Compat: true,
    });
  }
}
