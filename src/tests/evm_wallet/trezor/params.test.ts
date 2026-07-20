import { normalizeEvmTrezorTx } from '../../../evm_wallet/trezor/params';
import { InvalidParameterError } from '../../../base_wallet/error';

describe('normalizeEvmTrezorTx', () => {
  it.each([
    ['0x38', 56],
    ['137', 137],
    [1, 1],
  ])('normalizes chainId %p to %p', (chainId, expected) => {
    expect(normalizeEvmTrezorTx({ chainId }).chainId).toBe(expected);
  });

  it('supplies SDK-required value and data defaults', () => {
    expect(normalizeEvmTrezorTx({ chainId: 1 })).toEqual({
      chainId: 1,
      to: null,
      value: '0x0',
      data: '0x',
    });
  });

  it('preserves provided values and all other fields', () => {
    const input = {
      chainId: '0x1',
      nonce: '0x5',
      gasLimit: '0x5208',
      value: '0x1',
      data: '0xa9059cbb',
      maxFeePerGas: '0x77359400',
      maxPriorityFeePerGas: '0x59682f00',
      type: 2 as const,
    };

    expect(normalizeEvmTrezorTx(input)).toEqual({ ...input, chainId: 1, to: null });
  });

  it('does not mutate its input', () => {
    const input = { chainId: '0x1' };
    const output = normalizeEvmTrezorTx(input);

    expect(input).toEqual({ chainId: '0x1' });
    expect(output).not.toBe(input);
  });

  it('handles missing input', () => {
    expect(normalizeEvmTrezorTx()).toEqual({ to: null, value: '0x0', data: '0x' });
  });

  it.each(['1junk', '0x', '', '-1', 0, Number.NaN])('rejects malformed chainId %p', (chainId) => {
    expect(() => normalizeEvmTrezorTx({ chainId })).toThrow(InvalidParameterError);
  });

  it('normalizes a missing recipient to null for contract creation', () => {
    expect(normalizeEvmTrezorTx({ chainId: 1 }).to).toBeNull();
  });
});
