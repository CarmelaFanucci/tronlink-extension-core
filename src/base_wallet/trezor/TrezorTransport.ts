import type {
  TrezorAddressResult,
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

export interface TrezorTransport {
  init(): Promise<void>;
  getAddress(params: TrezorGetAddressParams): Promise<TrezorAddressResult>;
  getPublicKey(params: TrezorGetPublicKeyParams): Promise<TrezorPublicKeyResult>;
  signTronTransaction(params: TrezorTronTransactionParams): Promise<TrezorTronSignatureResult>;
  signEvmTransaction(params: TrezorEvmTransactionParams): Promise<TrezorRawEvmSignature>;
  signEvmMessage(params: TrezorEvmMessageParams): Promise<string>;
  signEvmTypedData(params: TrezorEvmTypedDataParams): Promise<string>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
}
