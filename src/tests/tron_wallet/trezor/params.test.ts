import { InvalidParameterError } from '../../../base_wallet/error';
import { appendTronSignature, buildTronTrezorParams } from '../../../tron_wallet/trezor/params';

const OWNER = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
const TO = '4112e0f0e2c3a4b5c6d7e8f90112233445566778899';
const CONTRACT = '41a614f803b6fd780986a42c78ec9c7f77e6ded000';
const SR = '41d1e7a6bc354106cb410e65ff8b181c600ff14292';
const PATH = "m/44'/195'/0'/0/0";

const baseRaw = {
  ref_block_bytes: 'b801',
  ref_block_hash: '0a1b2c3d4e5f6071',
  expiration: 1700000000000,
  timestamp: 1700000000000,
};

const wrap = (contract: any, extra: any = {}) => ({
  txID: 'deadbeef',
  raw_data: { ...baseRaw, ...extra, contract: [contract] },
  raw_data_hex: 'abcd',
});

describe('buildTronTrezorParams', () => {
  it('flattens a transfer and keeps uint64 amounts string-safe', () => {
    const amount = '90071992547409910';
    const transaction = wrap({
      type: 'TransferContract',
      parameter: { value: { owner_address: OWNER, to_address: TO, amount } },
    });

    const params = buildTronTrezorParams(transaction, PATH);

    expect((params as any).transaction).toBeUndefined();
    expect(params).toMatchObject({
      path: PATH,
      ...baseRaw,
      contract: [
        {
          type: 'TransferContract',
          parameter: { value: { owner_address: OWNER, to_address: TO, amount } },
        },
      ],
    });
  });

  it('keeps only Trezor-supported TriggerSmartContract fields', () => {
    const transaction = wrap(
      {
        type: 'TriggerSmartContract',
        parameter: {
          value: {
            owner_address: OWNER,
            contract_address: CONTRACT,
            data: 'a9059cbb',
            call_value: 0,
            call_token_value: 0,
            token_id: 0,
          },
        },
      },
      { fee_limit: 15_000_000 },
    );

    expect(buildTronTrezorParams(transaction, PATH)).toMatchObject({
      fee_limit: 15_000_000,
      contract: [
        {
          parameter: {
            value: {
              owner_address: OWNER,
              contract_address: CONTRACT,
              data: 'a9059cbb',
            },
          },
        },
      ],
    });
  });

  it.each([
    ['FreezeBalanceV2Contract', 'frozen_balance'],
    ['UnfreezeBalanceV2Contract', 'unfreeze_balance'],
  ])('maps %s balance fields to the SDK schema', (type, balanceKey) => {
    const transaction = wrap({
      type,
      parameter: {
        value: { owner_address: OWNER, [balanceKey]: 5_000_000, resource: 'ENERGY' },
      },
    });

    expect(buildTronTrezorParams(transaction, PATH).contract[0].parameter.value).toEqual({
      owner_address: OWNER,
      balance: 5_000_000,
      resource: 'ENERGY',
    });
  });

  it('maps witness votes to address and count', () => {
    const transaction = wrap({
      type: 'VoteWitnessContract',
      parameter: {
        value: {
          owner_address: OWNER,
          votes: [
            { vote_address: SR, vote_count: 5 },
            { address: TO, count: 10 },
          ],
        },
      },
    });

    expect(buildTronTrezorParams(transaction, PATH).contract[0].parameter.value).toEqual({
      owner_address: OWNER,
      votes: [
        { address: SR, count: 5 },
        { address: TO, count: 10 },
      ],
    });
  });

  it('supports WithdrawExpireUnfreezeContract and direct raw_data input', () => {
    const rawData = {
      ...baseRaw,
      contract: [
        {
          type: 'WithdrawExpireUnfreezeContract',
          parameter: { value: { owner_address: OWNER, ignored: true } },
        },
      ],
    };

    expect(buildTronTrezorParams(rawData, PATH).contract[0].parameter.value).toEqual({
      owner_address: OWNER,
    });
  });

  it('omits an empty memo and preserves a nonempty memo', () => {
    const contract = {
      type: 'TransferContract',
      parameter: { value: { owner_address: OWNER, to_address: TO, amount: 1 } },
    };

    expect(buildTronTrezorParams(wrap(contract, { data: '' }), PATH)).not.toHaveProperty('data');
    expect(buildTronTrezorParams(wrap(contract, { data: '68656c6c6f' }), PATH).data).toBe(
      '68656c6c6f',
    );
  });

  it.each([
    ['without contracts', []],
    [
      'with multiple contracts',
      [
        {
          type: 'TransferContract',
          parameter: { value: { owner_address: OWNER, to_address: TO, amount: 1 } },
        },
        {
          type: 'TransferContract',
          parameter: { value: { owner_address: OWNER, to_address: TO, amount: 2 } },
        },
      ],
    ],
  ])('rejects transactions %s because the SDK signs only contract[0]', (_label, contract) => {
    const transaction = {
      raw_data: { ...baseRaw, contract },
    };

    expect(() => buildTronTrezorParams(transaction, PATH)).toThrow(InvalidParameterError);
  });
});

describe('appendTronSignature', () => {
  it('preserves existing signatures without mutating the input', () => {
    const transaction = { signature: ['aaa'] };

    const result = appendTronSignature(transaction, '0xbbb');

    expect(result.signature).toEqual(['aaa', 'bbb']);
    expect(transaction.signature).toEqual(['aaa']);
  });

  it('deduplicates signatures regardless of the hex prefix', () => {
    expect(appendTronSignature({ signature: ['0xaaa'] }, 'aaa').signature).toEqual(['aaa']);
  });
});
