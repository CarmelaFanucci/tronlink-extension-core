const sdk = {
  init: jest.fn(),
  dispose: jest.fn(),
  cancel: jest.fn(),
  ethereumGetAddress: jest.fn(),
  tronGetAddress: jest.fn(),
  getPublicKey: jest.fn(),
  tronSignTransaction: jest.fn(),
  ethereumSignTransaction: jest.fn(),
  ethereumSignMessage: jest.fn(),
  ethereumSignTypedData: jest.fn(),
};

import { InvalidParameterError, TrezorError } from '../../../base_wallet/error';
import { TrezorConnectTransport } from '../../../base_wallet/trezor/TrezorConnectTransport';

const MANIFEST = {
  appName: 'TronLink',
  appUrl: 'https://www.tronlink.org',
  email: 'service@tronlink.org',
};

function success<T>(payload: T) {
  return Promise.resolve({ success: true, payload });
}

describe('TrezorConnectTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sdk.init.mockResolvedValue(undefined);
    sdk.dispose.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await new TrezorConnectTransport({ manifest: MANIFEST }, sdk).dispose();
  });

  it('initializes the SDK once before the first device request', async () => {
    sdk.ethereumGetAddress.mockReturnValue(
      success({ address: '0xabc', serializedPath: "m/44'/60'/0'/0/0" }),
    );
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await transport.getAddress({ path: "m/44'/60'/0'/0/0", showOnTrezor: true });
    await transport.getAddress({ path: "m/44'/60'/0'/0/0" });

    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith({
      manifest: MANIFEST,
      lazyLoad: true,
      env: 'webextension',
    });
    expect(sdk.ethereumGetAddress).toHaveBeenNthCalledWith(1, {
      path: "m/44'/60'/0'/0/0",
      showOnTrezor: true,
    });
  });

  it('loads the browser SDK lazily and only once', async () => {
    const loadClient = jest.fn().mockResolvedValue(sdk);
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, loadClient);

    expect(loadClient).not.toHaveBeenCalled();

    await Promise.all([transport.init(), transport.init()]);

    expect(loadClient).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it('maps browser SDK loading failures to an initialization error', async () => {
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, async () => {
      throw new Error('SDK chunk unavailable');
    });

    await expect(transport.init()).rejects.toMatchObject({
      name: 'TrezorError',
      code: 'init_failed',
      message: 'SDK chunk unavailable',
    });
  });

  it('shares SDK initialization across transport instances', async () => {
    const first = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);
    const second = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await Promise.all([first.init(), second.init()]);

    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it('routes TRON address requests and falls back to the requested path', async () => {
    sdk.tronGetAddress.mockReturnValue(success({ address: 'TAddress' }));
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await expect(transport.getAddress({ path: "m/44'/195'/0'/0/3" })).resolves.toEqual({
      address: 'TAddress',
      path: "m/44'/195'/0'/0/3",
    });
    expect(sdk.tronGetAddress).toHaveBeenCalledWith({
      path: "m/44'/195'/0'/0/3",
      showOnTrezor: false,
    });
  });

  it('maps public-key responses to the core DTO', async () => {
    sdk.getPublicKey.mockReturnValue(
      success({
        xpub: 'xpub',
        publicKey: 'public-key',
        chainCode: 'chain-code',
        serializedPath: "m/44'/195'/0'",
      }),
    );
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await expect(transport.getPublicKey({ path: "m/44'/195'/0'", coin: 'trx' })).resolves.toEqual({
      xpub: 'xpub',
      publicKey: 'public-key',
      chainCode: 'chain-code',
      serializedPath: "m/44'/195'/0'",
    });
  });

  it('forwards normalized TRON and EVM transactions to Trezor Connect', async () => {
    sdk.tronSignTransaction.mockReturnValue(success({ signature: 'tron-signature' }));
    sdk.ethereumSignTransaction.mockReturnValue(success({ v: '0x1', r: '0xrr', s: '0xss' }));
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);
    const tronParams = {
      path: "m/44'/195'/0'/0/0",
      ref_block_bytes: 'b801',
      ref_block_hash: '0a1b2c3d4e5f6071',
      expiration: 1,
      timestamp: 1,
      contract: [
        {
          type: 'TransferContract',
          parameter: {
            value: {
              owner_address: '41owner',
              to_address: '41recipient',
              amount: '1',
            },
          },
        },
      ],
    };
    const evmParams = {
      path: "m/44'/60'/0'/0/0",
      transaction: {
        chainId: 1,
        nonce: '0x0',
        gasLimit: '0x5208',
        gasPrice: '0x1',
        to: null,
        value: '0x0',
        data: '0x',
      },
    };

    await expect(transport.signTronTransaction(tronParams)).resolves.toEqual({
      signature: 'tron-signature',
    });
    await expect(transport.signEvmTransaction(evmParams)).resolves.toEqual({
      v: '0x1',
      r: '0xrr',
      s: '0xss',
    });
    expect(sdk.tronSignTransaction).toHaveBeenCalledWith(tronParams);
    expect(sdk.ethereumSignTransaction).toHaveBeenCalledWith(evmParams);
  });

  it('rejects transaction shapes that Trezor Connect cannot sign safely', async () => {
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await expect(
      transport.signTronTransaction({
        path: "m/44'/195'/0'/0/0",
        ref_block_bytes: 'b801',
        ref_block_hash: '0a1b2c3d4e5f6071',
        expiration: 1,
        timestamp: 1,
        contract: [],
      }),
    ).rejects.toBeInstanceOf(InvalidParameterError);
    await expect(
      transport.signEvmTransaction({
        path: "m/44'/60'/0'/0/0",
        transaction: {
          chainId: 1,
          nonce: '0x0',
          gasLimit: '0x5208',
          gasPrice: '0x1',
          to: null,
          value: '0x0',
          data: '0x',
          type: 1,
        },
      } as any),
    ).rejects.toBeInstanceOf(InvalidParameterError);

    expect(sdk.tronSignTransaction).not.toHaveBeenCalled();
    expect(sdk.ethereumSignTransaction).not.toHaveBeenCalled();
  });

  it('maps message and typed-data options to Trezor Connect', async () => {
    sdk.ethereumSignMessage.mockReturnValue(success({ signature: 'message-signature' }));
    sdk.ethereumSignTypedData.mockReturnValue(success({ signature: 'typed-signature' }));
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await expect(
      transport.signEvmMessage({ path: 'path', message: '0x1234', hex: true }),
    ).resolves.toBe('message-signature');
    await expect(
      transport.signEvmTypedData({
        path: 'path',
        data: { domain: {} },
        metamaskV4Compat: true,
      }),
    ).resolves.toBe('typed-signature');
    expect(sdk.ethereumSignMessage).toHaveBeenCalledWith({
      path: 'path',
      message: '0x1234',
      hex: true,
    });
    expect(sdk.ethereumSignTypedData).toHaveBeenCalledWith({
      path: 'path',
      data: { domain: {} },
      metamask_v4_compat: true,
    });
  });

  it('converts SDK failures into TrezorError without losing the SDK code', async () => {
    sdk.getPublicKey.mockResolvedValue({
      success: false,
      payload: { code: 'Device_Busy', error: 'Device is busy' },
    });
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await expect(transport.getPublicKey({ path: "m/44'/60'/0'", coin: 'eth' })).rejects.toEqual(
      new TrezorError('Device_Busy', 'Device is busy'),
    );
  });

  it('cancels and disposes the SDK lifecycle', async () => {
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    await transport.init();
    await transport.cancel();
    await transport.dispose();

    expect(sdk.cancel).toHaveBeenCalledWith('user_cancelled');
    expect(sdk.dispose).toHaveBeenCalledTimes(1);
  });

  it('waits for in-flight SDK initialization before disposing', async () => {
    let resolveInit: (() => void) | undefined;
    sdk.init.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
    );
    const transport = new TrezorConnectTransport({ manifest: MANIFEST }, sdk);

    const initializing = transport.init();
    await Promise.resolve();
    const disposing = transport.dispose();

    expect(sdk.dispose).not.toHaveBeenCalled();
    resolveInit?.();
    await initializing;
    await disposing;

    expect(sdk.dispose).toHaveBeenCalledTimes(1);
  });
});
