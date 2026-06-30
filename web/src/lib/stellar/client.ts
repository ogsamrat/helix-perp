import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { CONFIG } from "@/config";

export const server = new rpc.Server(CONFIG.rpcUrl, {
  allowHttp: CONFIG.rpcUrl.startsWith("http://"),
});

/** Throwaway source used only for read-only simulation (never signs/submits). */
const SIM_SOURCE = Keypair.random().publicKey();

/** Read a contract method via simulation and decode the return value. */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const contract = new Contract(contractId);
  const account = new Account(SIM_SOURCE, "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(humanizeError(sim.error));
  const retval = sim.result?.retval;
  if (!retval) return null as T;
  return scValToNative(retval) as T;
}

export type SignFn = (
  xdr: string,
  opts: { networkPassphrase: string; address?: string },
) => Promise<{ signedTxXdr: string } | string>;

export interface InvokeResult {
  hash: string;
  returnValue: unknown;
}

/**
 * Full write flow: build → simulate → assemble (auth + resource fees) →
 * wallet-sign → submit → poll to confirmation. `onHash` fires as soon as the
 * network accepts the tx, driving the optimistic UI / tx-lifecycle center.
 */
export async function invokeContract(opts: {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  publicKey: string;
  sign: SignFn;
  onHash?: (hash: string) => void;
}): Promise<InvokeResult> {
  const { contractId, method, args = [], publicKey, sign, onHash } = opts;
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) throw new Error(humanizeError(sim.error));
  const prepared = rpc.assembleTransaction(built, sim).build();

  const signed = await sign(prepared.toXDR(), {
    networkPassphrase: CONFIG.networkPassphrase,
    address: publicKey,
  });
  const signedXdr = typeof signed === "string" ? signed : signed.signedTxXdr;
  const signedTx = TransactionBuilder.fromXDR(signedXdr, CONFIG.networkPassphrase);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(humanizeError(JSON.stringify(sent.errorResult ?? sent.status)));
  }
  onHash?.(sent.hash);

  for (let i = 0; i < 40; i++) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash: sent.hash,
