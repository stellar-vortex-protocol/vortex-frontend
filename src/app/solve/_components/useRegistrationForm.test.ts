import { act, renderHook } from '@testing-library/react';
import { isValidStellarAddress } from '@/lib/chain/stellarAddress';
import { useRegistrationForm } from './useRegistrationForm';

const VALID_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

function flipLastChar(address: string): string {
  const last = address[address.length - 1];
  const replacement = last === 'A' ? 'B' : 'A';
  return address.slice(0, -1) + replacement;
}

describe('isValidStellarAddress', () => {
  it('accepts a valid Stellar public key', () => {
    expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it('rejects a key with a flipped checksum character', () => {
    expect(isValidStellarAddress(flipLastChar(VALID_ADDRESS))).toBe(false);
  });

  it('rejects keys that are not 56 characters', () => {
    expect(isValidStellarAddress(VALID_ADDRESS.slice(0, 55))).toBe(false);
    expect(isValidStellarAddress(VALID_ADDRESS + 'A')).toBe(false);
  });

  it('rejects keys that do not start with G', () => {
    expect(isValidStellarAddress('S' + VALID_ADDRESS.slice(1))).toBe(false);
  });

  it('rejects keys with invalid base32 characters', () => {
    expect(isValidStellarAddress('G' + '0'.repeat(55))).toBe(false);
  });
});

describe('useRegistrationForm', () => {
  it('rejects an invalid Stellar address on submit', async () => {
    const onSubmit = jest.fn();
    const { result } = renderHook(() => useRegistrationForm(onSubmit));

    act(() => {
      result.current.setAddress(flipLastChar(VALID_ADDRESS));
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Enter a valid Stellar public key.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid Stellar address', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useRegistrationForm(onSubmit));

    act(() => {
      result.current.setAddress(VALID_ADDRESS);
      result.current.setName('Solver');
    });

    let ok = false;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith({ address: VALID_ADDRESS, name: 'Solver' });
  });
});
