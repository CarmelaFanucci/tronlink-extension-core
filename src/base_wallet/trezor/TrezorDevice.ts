import type { TrezorTransport } from './TrezorTransport';
import type {
  TrezorAddressResult,
  TrezorGetAddressParams,
  TrezorGetPublicKeyParams,
  TrezorPublicKeyResult,
} from './types';

export class TrezorDevice {
  private readonly transport: TrezorTransport;

  constructor(transport: TrezorTransport) {
    this.transport = transport;
  }

  init(): Promise<void> {
    return this.transport.init();
  }

  getAddress(params: TrezorGetAddressParams): Promise<TrezorAddressResult> {
    return this.transport.getAddress(params);
  }

  getPublicKey(params: TrezorGetPublicKeyParams): Promise<TrezorPublicKeyResult> {
    return this.transport.getPublicKey(params);
  }

  cancel(): Promise<void> {
    return this.transport.cancel();
  }

  dispose(): Promise<void> {
    return this.transport.dispose();
  }
}
