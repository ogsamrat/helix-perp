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
