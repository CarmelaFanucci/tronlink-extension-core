import type { TrezorTransport } from '../../../base_wallet/trezor/TrezorTransport';
import { TrezorTrxSigner } from '../../../tron_wallet/trezor/TrezorTrxSigner';

const OWNER = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
const TO = '4112e0f0e2c3a4b5c6d7e8f90112233445566778899';
const PATH = "m/44'/195'/0'/0/0";

describe('TrezorTrxSigner', () => {
  it('builds SDK params and appends the transport signature', async () => {
    const signTronTransaction = jest.fn().mockResolvedValue({ signature: '0xbbb' });
    const signer = new TrezorTrxSigner({ signTronTransaction } as unknown as TrezorTransport);
    const transaction = {
      raw_data: {
        ref_block_bytes: 'b801',
        ref_block_hash: '0a1b2c3d4e5f6071',
        expiration: 1700000000000,
        timestamp: 1700000000000,
        contract: [
          {
            type: 'TransferContract',
            parameter: { value: { owner_address: OWNER, to_address: TO, amount: 1 } },
          },
        ],
      },
      signature: ['aaa'],
    };

    await expect(signer.signTransaction({ data: transaction, path: PATH })).resolves.toMatchObject({
      signature: ['aaa', 'bbb'],
    });
    expect(signTronTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ path: PATH, ref_block_bytes: 'b801' }),
    );
    expect(transaction.signature).toEqual(['aaa']);
  });

  it('propagates transport errors unchanged', async () => {
    const error = new Error('user rejected');
    const transport = {
      signTronTransaction: jest.fn().mockRejectedValue(error),
    } as unknown as TrezorTransport;
    const signer = new TrezorTrxSigner(transport);
    const transaction = {
      raw_data: {
        ref_block_bytes: 'b801',
        ref_block_hash: '0a1b2c3d4e5f6071',
        expiration: 1700000000000,
        timestamp: 1700000000000,
        contract: [
          {
            type: 'TransferContract',
            parameter: { value: { owner_address: OWNER, to_address: TO, amount: 1 } },
          },
        ],
      },
    };

    await expect(signer.signTransaction({ data: transaction, path: PATH })).rejects.toBe(error);
  });
});
