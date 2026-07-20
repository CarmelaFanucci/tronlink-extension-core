import { InvalidParameterError } from '../../base_wallet/error';
import type { TrezorTronTransactionParams } from '../../base_wallet/trezor/types';

const ADDRESS_KEYS = new Set(['owner_address', 'to_address', 'contract_address']);

function stripHexPrefix(signature: string): string {
  return signature.replace(/^0x/i, '');
}

function mapContractValue(source: Record<string, any>): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (ADDRESS_KEYS.has(key)) {
      value[key] = item;
    } else if (key === 'frozen_balance' || key === 'unfreeze_balance') {
      value.balance = item;
    } else if (key === 'votes' && Array.isArray(item)) {
      value.votes = item.map((vote: any) => ({
        address: vote?.vote_address ?? vote?.address,
        count: vote?.vote_count ?? vote?.count,
      }));
    } else if (key === 'amount') {
      // Preserve uint64 values as decimal strings instead of losing precision in JS numbers.
      value.amount = typeof item === 'number' ? String(item) : item;
    } else if (key === 'resource' || key === 'data') {
      value[key] = item;
    }
  }
  return value;
}

export function appendTronSignature<T extends Record<string, any>>(
  transaction: T,
  signature: string,
): T & { signature: string[] } {
  const normalizedSignature = stripHexPrefix(signature);
  const signatures = Array.isArray(transaction.signature)
    ? transaction.signature.map(stripHexPrefix)
    : [];

  if (!signatures.includes(normalizedSignature)) {
    signatures.push(normalizedSignature);
  }

  return {
    ...transaction,
    signature: signatures,
  };
}

export function buildTronTrezorParams(transaction: any, path: string): TrezorTronTransactionParams {
  const rawData = transaction?.raw_data ?? transaction ?? {};
  const contracts = Array.isArray(rawData.contract) ? rawData.contract : [];
  // The SDK validates an array but currently sends only its first item to the device.
  if (contracts.length !== 1) {
    throw new InvalidParameterError(
      `Trezor Connect requires exactly one TRON contract, received ${contracts.length}`,
    );
  }
  const params: TrezorTronTransactionParams = {
    path,
    ref_block_bytes: rawData.ref_block_bytes,
    ref_block_hash: rawData.ref_block_hash,
    expiration: rawData.expiration,
    timestamp: rawData.timestamp,
    contract: contracts.map((contract: any) => ({
      type: contract?.type,
      parameter: {
        value: mapContractValue(contract?.parameter?.value ?? {}),
      },
    })),
  };

  if (rawData.fee_limit != null) {
    params.fee_limit = rawData.fee_limit;
  }
  if (rawData.data != null && rawData.data !== '') {
    params.data = rawData.data;
  }
  return params;
}
