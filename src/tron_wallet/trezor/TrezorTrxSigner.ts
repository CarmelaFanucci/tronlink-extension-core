import type { TrezorTransport } from '../../base_wallet/trezor/TrezorTransport';
import type { TrezorSignParams } from '../../base_wallet/trezor/types';
import { appendTronSignature, buildTronTrezorParams } from './params';

export class TrezorTrxSigner {
  private readonly transport: TrezorTransport;

  constructor(transport: TrezorTransport) {
    this.transport = transport;
  }

  async signTransaction({ data, path }: TrezorSignParams<any>): Promise<any> {
    const params = buildTronTrezorParams(data, path);
    const { signature } = await this.transport.signTronTransaction(params);
    return appendTronSignature(data, signature);
  }
}
