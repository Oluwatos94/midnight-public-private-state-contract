import { describe, it, expect } from 'vitest';
import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/registry/contract/index.js';

const coinPublicKey = new Uint8Array(32);
const contractAddress = sampleContractAddress();

function createSimulator() {
  const contract = new Contract({});
  const constructorCtx = createConstructorContext({}, coinPublicKey);
  const { currentPrivateState, currentContractState, currentZswapLocalState } =
    contract.initialState(constructorCtx);

  const circuitContext = createCircuitContext(
    contractAddress,
    currentZswapLocalState,
    currentContractState,
    currentPrivateState,
  );

  return { contract, circuitContext };
}

const idA = new Uint8Array(32).fill(1);
const dataA = new Uint8Array(32).fill(2);
const dataB = new Uint8Array(32).fill(3);
const idB = new Uint8Array(32).fill(4);

describe('registry contract', () => {
  it('registers an entry and increments memberCount', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));
    const state = ledger(circuitContext.currentQueryContext.state);

    expect(state.memberCount).toBe(1n);
    expect(state.registry.member(idA)).toBe(true);
  });

  it('rejects duplicate registration', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));

    expect(() => {
      contract.impureCircuits.register(circuitContext, idA, dataA);
    }).toThrow();
  });

  it('updates an existing entry without changing memberCount', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));
    ({ context: circuitContext } = contract.impureCircuits.update(circuitContext, idA, dataB));
    const state = ledger(circuitContext.currentQueryContext.state);

    expect(state.registry.lookup(idA)).toEqual(dataB);
    expect(state.memberCount).toBe(1n);
  });

  it('deregisters an entry', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));
    ({ context: circuitContext } = contract.impureCircuits.deregister(circuitContext, idA));
    const state = ledger(circuitContext.currentQueryContext.state);

    expect(state.registry.member(idA)).toBe(false);
  });

  it('operationCount is not accessible via the generated Ledger type', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));
    ({ context: circuitContext } = contract.impureCircuits.update(circuitContext, idA, dataB));
    const state = ledger(circuitContext.currentQueryContext.state);

    // memberCount is exported - accessible
    expect(state.memberCount).toBe(1n);
    // operationCount is not exported - undefined in the generated Ledger type
    // It is still on-chain, but omitting export removes it from the TypeScript API
    expect((state as any).operationCount).toBeUndefined();
  });

  it('reports correct membership for registered and unregistered ids', () => {
    let { contract, circuitContext } = createSimulator();

    ({ context: circuitContext } = contract.impureCircuits.register(circuitContext, idA, dataA));

    const { result: isA } = contract.impureCircuits.isRegistered(circuitContext, idA);
    const { result: isB } = contract.impureCircuits.isRegistered(circuitContext, idB);

    expect(isA).toBe(true);
    expect(isB).toBe(false);
  });
});
