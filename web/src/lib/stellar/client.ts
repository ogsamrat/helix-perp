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
        returnValue: got.returnValue ? scValToNative(got.returnValue) : null,
      };
    }
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(humanizeError(`Transaction ${sent.hash} failed on-chain`));
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Transaction timed out awaiting confirmation.");
}

/** Whether an account exists + is funded on the network. */
export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await server.getAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

/** Fund an account on testnet via friendbot. */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`${CONFIG.friendbot}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot funding failed (${res.status})`);
  }
}

/** Map raw Soroban/contract errors to human-readable messages. */
export function humanizeError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("oraclestale") || s.includes("#4")) return "Oracle price is stale — try again shortly.";
  if (s.includes("pricedeviation")) return "Oracle price moved too far — protection triggered.";
  if (s.includes("slippage")) return "Price moved beyond your slippage tolerance.";
  if (s.includes("exceedsmaxleverage")) return "Leverage exceeds this market's maximum.";
  if (s.includes("insufficientmargin")) return "Margin is below the initial requirement.";
  if (s.includes("exceedsmaxoi")) return "Market open-interest cap reached.";
  if (s.includes("belowminsize")) return "Position size is below the minimum.";
  if (s.includes("insufficientliquidity")) return "Vault has insufficient liquidity for this payout.";
  if (s.includes("notliquidatable")) return "Position is still above maintenance margin.";
  if (s.includes("notkeeper")) return "Only the keeper can perform this action.";
  if (s.includes("notowner")) return "You don't own this position.";
  if (s.includes("globalpaused") || s.includes("marketpaused")) return "Trading is paused.";
  if (s.includes("balance") && s.includes("insufficient")) return "Insufficient USDC balance.";
  if (s.includes("trustline") || s.includes("underfunded")) return "Insufficient balance for this action.";
  if (s.includes("txbadseq")) return "Transaction sequence error — please retry.";
  if (s.includes("user") && (s.includes("reject") || s.includes("declin"))) return "Request rejected in wallet.";
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}
