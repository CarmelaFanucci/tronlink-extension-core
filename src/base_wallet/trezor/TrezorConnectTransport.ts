import { InvalidParameterError, TrezorError } from '../error';
import type { TrezorTransport } from './TrezorTransport';
import type {
  TrezorAddressResult,
  TrezorConnectTransportOptions,
  TrezorEvmMessageParams,
  TrezorEvmTransactionParams,
  TrezorEvmTypedDataParams,
  TrezorGetAddressParams,
  TrezorGetPublicKeyParams,
  TrezorPublicKeyResult,
  TrezorRawEvmSignature,
  TrezorTronSignatureResult,
  TrezorTronTransactionParams,
} from './types';

type SuccessfulResult<T> = { success: true; payload: T };
type FailedResult = {
  success: false;
  payload?: { code?: unknown; error?: unknown; message?: unknown } | unknown;
};

export interface TrezorConnectClient {
  init(settings: unknown): Promise<void>;
  dispose(): Promise<unknown> | unknown;
  cancel(reason?: string): void;
  ethereumGetAddress(params: unknown): Promise<unknown>;
  tronGetAddress(params: unknown): Promise<unknown>;
  getPublicKey(params: unknown): Promise<unknown>;
  tronSignTransaction(params: unknown): Promise<unknown>;
  ethereumSignTransaction(params: unknown): Promise<unknown>;
  ethereumSignMessage(params: unknown): Promise<unknown>;
  ethereumSignTypedData(params: unknown): Promise<unknown>;
}

export type TrezorConnectClientLoader = () => Promise<TrezorConnectClient>;

async function loadDefaultClient(): Promise<TrezorConnectClient> {
  // Keep the browser SDK out of consumers that only use core's signer and DTO exports.
  const module = await import('@trezor/connect-web');
  return module.default as unknown as TrezorConnectClient;
}

// Trezor Connect is a singleton in browser environments. Sharing lifecycle state by
// client prevents separate transport instances from initializing the same SDK twice.
interface TrezorConnectClientState {
  initialized: boolean;
  initPromise: Promise<void> | null;
}

const clientStates = new WeakMap<TrezorConnectClient, TrezorConnectClientState>();

function clientState(client: TrezorConnectClient): TrezorConnectClientState {
  const existing = clientStates.get(client);
  if (existing) return existing;
  const state = { initialized: false, initPromise: null };
  clientStates.set(client, state);
  return state;
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const details = value as { error?: unknown; message?: unknown };
    if (typeof details.error === 'string') return details.error;
    if (typeof details.message === 'string') return details.message;
  }
  return fallback;
}

function toTrezorError(error: unknown, fallbackCode: string): TrezorError {
  if (error instanceof TrezorError) return error;
  const details = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const code = typeof details.code === 'string' ? details.code : fallbackCode;
  return new TrezorError(code, errorMessage(error, fallbackCode));
}

function unwrap<T>(result: SuccessfulResult<T> | FailedResult, fallbackCode: string): T {
  if (result.success) return result.payload;
  const payload = result.payload;
  const details =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const code = typeof details.code === 'string' ? details.code : fallbackCode;
  throw new TrezorError(code, errorMessage(payload, fallbackCode));
}

function addressChain(path: string): 'evm' | 'tron' {
  if (/^m\/44'\/60'\//.test(path)) return 'evm';
  if (/^m\/44'\/195'\//.test(path)) return 'tron';
  throw new InvalidParameterError(`Unsupported Trezor address path: ${path}`);
}

export class TrezorConnectTransport implements TrezorTransport {
  private readonly settings: TrezorConnectTransportOptions;
  private readonly clientLoader: TrezorConnectClientLoader;
  private client?: TrezorConnectClient;
  private clientPromise?: Promise<TrezorConnectClient>;

  constructor(
    options: TrezorConnectTransportOptions,
    clientOrLoader: TrezorConnectClient | TrezorConnectClientLoader = loadDefaultClient,
  ) {
    this.settings = {
      // The extension runs Connect inside an offscreen document rather than a regular tab.
      lazyLoad: true,
      env: 'webextension',
      ...options,
    };
    if (typeof clientOrLoader === 'function') {
      this.clientLoader = clientOrLoader;
    } else {
      this.client = clientOrLoader;
      this.clientLoader = async () => clientOrLoader;
    }
  }

  async init(): Promise<void> {
    let client: TrezorConnectClient;
    try {
      client = await this.getClient();
    } catch (error) {
      throw toTrezorError(error, 'init_failed');
    }
    const state = clientState(client);
    if (state.initialized) return;
    if (state.initPromise) return state.initPromise;

    state.initPromise = Promise.resolve()
      .then(() => client.init(this.settings))
      .then(() => {
        state.initialized = true;
      })
      .catch((error) => {
        throw toTrezorError(error, 'init_failed');
      })
      .finally(() => {
        state.initPromise = null;
      });
    return state.initPromise;
  }

  async getAddress(params: TrezorGetAddressParams): Promise<TrezorAddressResult> {
    const chain = addressChain(params.path);
    const request = { ...params, showOnTrezor: params.showOnTrezor ?? false };
    const payload = await this.invoke<{ address: string; serializedPath?: string }>(
      (client) =>
        chain === 'evm' ? client.ethereumGetAddress(request) : client.tronGetAddress(request),
      'getAddress_failed',
    );
    return { address: payload.address, path: payload.serializedPath ?? params.path };
  }

  async getPublicKey(params: TrezorGetPublicKeyParams): Promise<TrezorPublicKeyResult> {
    const payload = await this.invoke<{
      xpub: string;
      publicKey: string;
      chainCode: string;
      serializedPath?: string;
    }>((client) => client.getPublicKey(params), 'getPublicKey_failed');
    return {
      xpub: payload.xpub,
      publicKey: payload.publicKey,
      chainCode: payload.chainCode,
      serializedPath: payload.serializedPath ?? params.path,
    };
  }

  async signTronTransaction(
    params: TrezorTronTransactionParams,
  ): Promise<TrezorTronSignatureResult> {
    // Connect 9.7.3 signs only contract[0]. Accepting more would sign a payload that
    // differs from the transaction to which the returned signature is appended.
    if (params.contract.length !== 1) {
      throw new InvalidParameterError(
        `Trezor Connect requires exactly one TRON contract, received ${params.contract.length}`,
      );
    }
    const payload = await this.invoke<{ signature: string }>(
      (client) => client.tronSignTransaction(params),
      'signTron_failed',
    );
    return { signature: payload.signature };
  }

  async signEvmTransaction(params: TrezorEvmTransactionParams): Promise<TrezorRawEvmSignature> {
    const type = params.transaction.type ?? 0;
    // Connect 9.7.3 cannot encode an EIP-2930 access list safely and serializes its
    // legacy branch as type 0, so type 1 must remain unsupported here.
    if (type !== 0 && type !== 2) {
      throw new InvalidParameterError(`Unsupported Trezor EVM transaction type: ${type}`);
    }
    const payload = await this.invoke<TrezorRawEvmSignature>(
      (client) => client.ethereumSignTransaction(params),
      'signEvm_failed',
    );
    return { v: payload.v, r: payload.r, s: payload.s };
  }

  async signEvmMessage(params: TrezorEvmMessageParams): Promise<string> {
    const payload = await this.invoke<{ signature: string }>(
      (client) => client.ethereumSignMessage(params),
      'signEvmMessage_failed',
    );
    return payload.signature;
  }

  async signEvmTypedData(params: TrezorEvmTypedDataParams): Promise<string> {
    const payload = await this.invoke<{ signature: string }>(
      (client) =>
        client.ethereumSignTypedData({
          path: params.path,
          data: params.data as never,
          metamask_v4_compat: params.metamaskV4Compat,
        }),
      'signTypedData_failed',
    );
    return payload.signature;
  }

  async cancel(): Promise<void> {
    if (!this.client) return;
    try {
      this.client.cancel('user_cancelled');
    } catch (error) {
      throw toTrezorError(error, 'cancel_failed');
    }
  }

  async dispose(): Promise<void> {
    if (!this.client) return;
    const state = clientState(this.client);
    // Let initialization settle before releasing any partially-created SDK resources.
    if (state.initPromise) {
      try {
        await state.initPromise;
      } catch {
        // Initialization failures are reported to the caller that started init.
        // Disposal should still release any partially-created SDK resources.
      }
    }
    state.initialized = false;
    state.initPromise = null;
    try {
      await this.client.dispose();
    } catch (error) {
      throw toTrezorError(error, 'dispose_failed');
    }
  }

  private async getClient(): Promise<TrezorConnectClient> {
    if (this.client) return this.client;
    if (!this.clientPromise) {
      this.clientPromise = this.clientLoader()
        .then((client) => {
          this.client = client;
          return client;
        })
        .catch((error) => {
          this.clientPromise = undefined;
          throw error;
        });
    }
    return this.clientPromise;
  }

  private async invoke<T>(
    operation: (client: TrezorConnectClient) => Promise<unknown>,
    fallbackCode: string,
  ): Promise<T> {
    try {
      await this.init();
      const result = (await operation(await this.getClient())) as
        | SuccessfulResult<T>
        | FailedResult;
      return unwrap(result, fallbackCode);
    } catch (error) {
      throw toTrezorError(error, fallbackCode);
    }
  }
}
