import { Transaction } from 'ethers';

import type { TrezorTransport } from '../../../base_wallet/trezor/TrezorTransport';
import { InvalidParameterError, TrezorError } from '../../../base_wallet/error';
import { TrezorEvmSigner } from '../../../evm_wallet/trezor/TrezorEvmSigner';

const PATH = "m/44'/60'/0'/0/0";
const R = `0x${'11'.repeat(32)}`;
const S = `0x${'22'.repeat(32)}`;
const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;
const LEGACY_TRANSACTION = {
  chainId: 1,
  nonce: '0x0',
  gasLimit: '0x5208',
  gasPrice: '0x3b9aca00',
  to: ZERO_ADDRESS,
  type: 0 as const,
};
const EIP1559_TRANSACTION = {
  chainId: 1,
  nonce: '0x0',
  gasLimit: '0x5208',
  maxFeePerGas: '0x77359400',
  maxPriorityFeePerGas: '0x3b9aca00',
  to: ZERO_ADDRESS,
  type: 2 as const,
};

describe('TrezorEvmSigner', () => {
  it('maps type 2 raw v to yParity', async () => {
    const type = 2;
    const v = '0x1';
    const yParity = 1;
    const signEvmTransaction = jest.fn().mockResolvedValue({ v, r: R, s: S });
    const signer = new TrezorEvmSigner({ signEvmTransaction } as unknown as TrezorTransport);

    await expect(
      signer.signTransaction({
        data: { ...EIP1559_TRANSACTION, chainId: '0x1' },
        path: PATH,
      }),
    ).resolves.toEqual({ r: R, s: S, yParity });
    expect(signEvmTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        path: PATH,
        transaction: expect.objectContaining({
          chainId: 1,
          nonce: '0x0',
          gasLimit: '0x5208',
          type,
          value: '0x0',
          data: '0x',
        }),
      }),
    );
  });

  it('rejects EIP-2930 transactions that Trezor Connect 9.7.3 cannot encode safely', async () => {
    const signEvmTransaction = jest.fn();
    const signer = new TrezorEvmSigner({ signEvmTransaction } as unknown as TrezorTransport);

    await expect(
      signer.signTransaction({
        data: { ...LEGACY_TRANSACTION, type: 1 } as any,
        path: PATH,
      }),
    ).rejects.toBeInstanceOf(InvalidParameterError);
    expect(signEvmTransaction).not.toHaveBeenCalled();
  });

  it('maps a legacy EIP-155 v to a number', async () => {
    const transport = {
      signEvmTransaction: jest.fn().mockResolvedValue({ v: '0x25', r: R, s: S }),
    } as unknown as TrezorTransport;
    const signer = new TrezorEvmSigner(transport);

    const signature = await signer.signTransaction({ data: LEGACY_TRANSACTION, path: PATH });

    expect(signature).toEqual({ r: R, s: S, v: 37 });
    const transaction = Transaction.from({
      chainId: 1,
      type: 0,
      nonce: 0,
      gasPrice: 1_000_000_000n,
      gasLimit: 21_000,
      to: ZERO_ADDRESS,
      value: 0n,
      data: '0x',
      signature,
    });
    expect(transaction.serialized).toMatch(/^0x/);
    expect(transaction.signature?.yParity).toBe(0);
  });

  it('returns an ethers v6 serializable typed-transaction signature', async () => {
    const transport = {
      signEvmTransaction: jest.fn().mockResolvedValue({ v: '0x1', r: R, s: S }),
    } as unknown as TrezorTransport;
    const signer = new TrezorEvmSigner(transport);
    const signature = await signer.signTransaction({ data: EIP1559_TRANSACTION, path: PATH });

    const transaction = Transaction.from({
      chainId: 1,
      type: 2,
      nonce: 0,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      gasLimit: 21_000,
      to: ZERO_ADDRESS,
      value: 0n,
      data: '0x',
      signature,
    });
    expect(transaction.serialized).toMatch(/^0x02/);
    expect(transaction.signature?.yParity).toBe(1);
  });

  it.each([
    ['0x68656c6c6f', true],
    ['hello', false],
  ])('signs message %p with hex=%p', async (message, hex) => {
    const signEvmMessage = jest.fn().mockResolvedValue('deadbeef');
    const signer = new TrezorEvmSigner({ signEvmMessage } as unknown as TrezorTransport);

    await expect(signer.signMessage({ message, path: PATH })).resolves.toBe('0xdeadbeef');
    expect(signEvmMessage).toHaveBeenCalledWith({ path: PATH, message, hex });
  });

  it('requests MetaMask v4 compatibility for typed data', async () => {
    const signEvmTypedData = jest.fn().mockResolvedValue('0xsig');
    const signer = new TrezorEvmSigner({ signEvmTypedData } as unknown as TrezorTransport);
    const data = { domain: {}, types: {}, primaryType: 'Mail', message: {} };

    await expect(signer.signTypedData({ data, path: PATH })).resolves.toBe('0xsig');
    expect(signEvmTypedData).toHaveBeenCalledWith({
      path: PATH,
      data,
      metamaskV4Compat: true,
    });
  });

  it('propagates transport errors unchanged', async () => {
    const error = new Error('device busy');
    const transport = {
      signEvmTransaction: jest.fn().mockRejectedValue(error),
    } as unknown as TrezorTransport;

    await expect(
      new TrezorEvmSigner(transport).signTransaction({ data: LEGACY_TRANSACTION, path: PATH }),
    ).rejects.toBe(error);
  });

  it.each([
    [{ ...LEGACY_TRANSACTION, nonce: 0 }, 'numeric nonce'],
    [{ ...LEGACY_TRANSACTION, gasLimit: undefined }, 'missing gasLimit'],
    [{ ...LEGACY_TRANSACTION, gasPrice: undefined }, 'missing legacy gasPrice'],
    [{ ...EIP1559_TRANSACTION, maxFeePerGas: undefined }, 'missing maxFeePerGas'],
  ])('rejects invalid transaction before transport invocation: %s (%s)', async (data, _reason) => {
    const signEvmTransaction = jest.fn();
    const signer = new TrezorEvmSigner({ signEvmTransaction } as unknown as TrezorTransport);

    await expect(signer.signTransaction({ data: data as any, path: PATH })).rejects.toBeInstanceOf(
      InvalidParameterError,
    );
    expect(signEvmTransaction).not.toHaveBeenCalled();
  });

  it.each(['0x1b', 'invalid', '0x2'])('rejects invalid typed-transaction parity %p', async (v) => {
    const transport = {
      signEvmTransaction: jest.fn().mockResolvedValue({ v, r: R, s: S }),
    } as unknown as TrezorTransport;

    await expect(
      new TrezorEvmSigner(transport).signTransaction({
        data: EIP1559_TRANSACTION,
        path: PATH,
      }),
    ).rejects.toEqual(
      new TrezorError('invalid_signature', `Invalid Trezor EVM signature parity: ${v}`),
    );
  });
});
