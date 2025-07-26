import "dotenv/config";

import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import {
  AztecAddress,
  createLogger,
  FeeJuicePaymentMethodWithClaim,
  Fq,
  Fr,
  getFeeJuiceBalance,
  L1FeeJuicePortalManager,
  ProtocolContractAddress,
  retryUntil,
  type PXE,
  type Wallet,
} from "@aztec/aztec.js";
import { createEthereumChain, createExtendedL1Client } from "@aztec/ethereum";
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { Hex } from "ox";
import { assert } from "ts-essentials";
import { ensureAccountDeployed } from "./utils.js";

const AMOUNT = 1000000000000000000n;

const anvilPrivateKey =
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";

type FaucetChains = {
  pxe: PXE;
  l1Url: string;
};

export async function faucet(chains: FaucetChains) {
  const privateKey = getPrivateKey();
  const aztecPrivateKey = Hex.concat("0x00", Hex.slice(privateKey, 1));
  const accountManager = await getSchnorrAccount(
    chains.pxe,
    Fr.fromString(aztecPrivateKey),
    Fq.fromString(aztecPrivateKey),
    0,
  );
  if (
    (await getFeeJuiceBalance(accountManager.getAddress(), chains.pxe)) >
    AMOUNT / 2n
  ) {
    console.log("using existing account");
    return accountManager.register();
  }

  console.log("minting & bridging...");
  const portal = await getPortal(chains);
  const claim = await portal.bridgeTokensPublic(
    accountManager.getAddress(),
    AMOUNT,
    true /* mint */,
  );
  console.log("claim", claim);
  const paymentMethod = new FeeJuicePaymentMethodWithClaim(
    await accountManager.getWallet(),
    claim,
  );

  await advanceL2Block(chains.pxe);
  await advanceL2Block(chains.pxe);

  console.log("deploying account...");
  const account = ensureAccountDeployed(accountManager, paymentMethod);
  return account;
}

export async function faucetTo(
  to: AztecAddress,
  account: Wallet,
  chains: FaucetChains,
) {
  const bal = await getFeeJuiceBalance(to, chains.pxe);
  if (bal > AMOUNT / 2n) {
    console.log(`fee juice balance of ${to} is sufficient (${bal})`);
    return;
  }

  console.log(`minting & bridging fee juice to ${to}...`);
  const portal = await getPortal(chains);
  const claim = await portal.bridgeTokensPublic(to, AMOUNT, true /* mint */);

  await advanceL2Block(chains.pxe);
  await advanceL2Block(chains.pxe);

  const feeJuice = await FeeJuiceContract.at(
    ProtocolContractAddress.FeeJuice,
    account,
  );
  const tx = feeJuice.methods
    .claim(to, claim.claimAmount, claim.claimSecret, claim.messageLeafIndex)
    .send();
  console.log("claim tx", (await tx.getTxHash()).toString());
  await tx.wait({ timeout: 100000000000 });
}

async function getPortal({ pxe, l1Url }: FaucetChains) {
  const { l1ChainId } = await pxe.getNodeInfo();
  const l1Chain = createEthereumChain([l1Url], l1ChainId);
  const extendedClient = createExtendedL1Client(
    l1Chain.rpcUrls,
    getPrivateKey(),
    l1Chain.chainInfo,
  );

  const portal = await L1FeeJuicePortalManager.new(
    pxe,
    extendedClient,
    createLogger("l1-fee-juice-portal"),
  );
  return portal;
}

async function advanceL2Block(pxe: PXE) {
  const initialBlockNumber = await pxe.getBlockNumber();
  await retryUntil(
    async () => (await pxe.getBlockNumber()) >= initialBlockNumber + 1,
  );
  console.log("advanced block");
}

function getPrivateKey() {
  const sepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;
  assert(
    typeof sepoliaPrivateKey === "string",
    "SEPOLIA_PRIVATE_KEY is not set",
  );
  return sepoliaPrivateKey as Hex.Hex;
}
