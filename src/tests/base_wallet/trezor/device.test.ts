import { TrezorDevice } from '../../../base_wallet/trezor/TrezorDevice';
import type { TrezorTransport } from '../../../base_wallet/trezor/TrezorTransport';

describe('TrezorDevice', () => {
  it('delegates address and public-key requests to the injected transport', async () => {
    const getAddress = jest.fn().mockResolvedValue({ address: 'TAddress', path: 'm/path' });
    const getPublicKey = jest.fn().mockResolvedValue({
      xpub: 'xpub',
      publicKey: 'public-key',
      chainCode: 'chain-code',
      serializedPath: 'm/account',
    });
    const transport = { getAddress, getPublicKey } as unknown as TrezorTransport;
    const device = new TrezorDevice(transport);

    await expect(device.getAddress({ path: 'm/path' })).resolves.toEqual({
      address: 'TAddress',
      path: 'm/path',
    });
    await expect(device.getPublicKey({ path: 'm/account', coin: 'trx' })).resolves.toMatchObject({
      xpub: 'xpub',
    });
    expect(getAddress).toHaveBeenCalledWith({ path: 'm/path' });
    expect(getPublicKey).toHaveBeenCalledWith({ path: 'm/account', coin: 'trx' });
  });

  it('does not replace transport errors', async () => {
    const error = new Error('device unavailable');
    const transport = {
      getAddress: jest.fn().mockRejectedValue(error),
    } as unknown as TrezorTransport;

    await expect(new TrezorDevice(transport).getAddress({ path: 'm/path' })).rejects.toBe(error);
  });

  it('delegates transport lifecycle operations', async () => {
    const transport = {
      init: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    } as unknown as TrezorTransport;
    const device = new TrezorDevice(transport);

    await device.init();
    await device.cancel();
    await device.dispose();

    expect(transport.init).toHaveBeenCalledTimes(1);
    expect(transport.cancel).toHaveBeenCalledTimes(1);
    expect(transport.dispose).toHaveBeenCalledTimes(1);
  });
});
