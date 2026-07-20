export type TrezorChain = 'tron' | 'evm';

export interface TrezorConnectManifest {
  appName: string;
  appIcon?: string;
  appUrl: string;
  email: string;
}

export interface TrezorConnectTransportOptions {
  manifest: TrezorConnectManifest;
  lazyLoad?: boolean;
  env?: 'web' | 'webextension';
  coreMode?: 'auto' | 'popup' | 'iframe' | 'suite-desktop' | 'suite-web';
  debug?: boolean;
  popup?: boolean;
}

export interface TrezorGetAddressParams {
  path: string;
  showOnTrezor?: boolean;
}

export interface TrezorAddressResult {
  address: string;
  path: string;
}

export interface TrezorGetPublicKeyParams {
  path: string;
  coin: string;
}

export interface TrezorPublicKeyResult {
  xpub: string;
  publicKey: string;
  chainCode: string;
  serializedPath: string;
}

export interface TrezorSignParams<T = unknown> {
  data: T;
  path: string;
}

export interface TrezorMessageSignParams {
  message: string;
  path: string;
}

export interface TrezorTronContract {
  type: string;
  parameter: { value: Record<string, unknown> };
}

export interface TrezorTronTransactionParams {
  path: string;
  ref_block_bytes: string;
  ref_block_hash: string;
  expiration: number;
  timestamp: number;
  fee_limit?: number;
  data?: string;
  contract: TrezorTronContract[];
}

export interface TrezorTronSignatureResult {
  signature: string;
}

export interface TrezorUnsignedEvmTransaction {
  chainId: number | string;
  nonce: string;
  gasLimit: string;
  to?: string | null;
  value?: string;
  data?: string;
  type?: 0 | 2;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
}

export interface TrezorNormalizedEvmTransaction extends Omit<
  TrezorUnsignedEvmTransaction,
  'chainId' | 'to' | 'value' | 'data'
> {
  chainId: number;
  to: string | null;
  value: string;
  data: string;
}

export interface TrezorEvmTransactionParams {
  path: string;
  transaction: TrezorNormalizedEvmTransaction;
}

export interface TrezorRawEvmSignature {
  v: string;
  r: string;
  s: string;
}

export type TrezorEvmSignature =
  | { r: string; s: string; v: number }
  | { r: string; s: string; yParity: 0 | 1 };

export interface TrezorEvmMessageParams extends TrezorMessageSignParams {
  hex: boolean;
}

export interface TrezorEvmTypedDataParams extends TrezorSignParams<unknown> {
  metamaskV4Compat: boolean;
}

export interface TrezorDerivedAccount {
  childPath: string;
  path: string;
  address: string;
}

export interface DeriveTrezorAddressesParams {
  xpub: string;
  count: number;
  chain: TrezorChain;
  accountIndex: number;
  startIndex?: number;
}
