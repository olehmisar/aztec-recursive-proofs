import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
  AccountWallet,
  AccountWalletWithSecretKey,
  CompleteAddress,
  Fr,
  PXE,
} from "@aztec/aztec.js";
import {
  type Barretenberg,
  deflattenFields,
  ProofData,
  RawBuffer,
  UltraHonkBackend,
} from "@aztec/bb.js";
import { CompiledCircuit, Noir } from "@aztec/noir-noir_js";
import os from "node:os";
import { beforeAll, beforeEach, describe, it } from "vitest";
import my_circuit from "../../target_circuits/my_circuit.json" with { type: "json" };
import { CounterContract } from "../artifacts/Counter.js";
import { deployCounter, setupSandbox } from "./utils.js";

describe("Counter Contract", () => {
  let pxe: PXE;
  let wallets: AccountWalletWithSecretKey[] = [];
  let accounts: CompleteAddress[] = [];

  let alice: AccountWallet;
  let bob: AccountWallet;
  let carl: AccountWallet;

  let counter: CounterContract;

  beforeAll(async () => {
    pxe = await setupSandbox();

    wallets = await getInitialTestAccountsWallets(pxe);
    accounts = wallets.map((w) => w.getCompleteAddress());

    alice = wallets[0];
    bob = wallets[1];
    carl = wallets[2];
  });

  beforeEach(async () => {
    counter = await deployCounter(alice);
  });

  it("e2e", async () => {
    const proof1 = await genProof(1, 2);
    const proof2 = await genProof(2, 3);
    await counter.methods
      .aggregate_proofs(
        [proof1.vkAsFields, proof2.vkAsFields],
        [proof1.proofAsFields, proof2.proofAsFields],
        [proof1.vkHash, proof2.vkHash],
      )
      .send()
      .wait();
  });

  const noir = new Noir(my_circuit as CompiledCircuit);
  const backend = new UltraHonkBackend(
    my_circuit.bytecode,
    { threads: os.cpus().length },
    { recursive: true },
  );
  async function genProof(x: number, y: number) {
    const { witness } = await noir.execute({ x, y });
    const proof = await backend.generateProof(witness);
    const proofArtifacts = await generateRecursiveProofArtifacts(
      backend,
      proof,
    );
    return {
      vkAsFields: proofArtifacts.vkAsFields.map((x) => Fr.fromString(x)),
      proofAsFields: proofArtifacts.proofAsFields.map((x) => Fr.fromString(x)),
      vkHash: new Fr(0),
    };
  }
});

async function generateRecursiveProofArtifacts(
  backend: UltraHonkBackend,
  proof: ProofData,
) {
  const vkBuf = await backend.getVerificationKey();
  const vkAsFields = await (
    (backend as any).api as Barretenberg
  ).acirVkAsFieldsUltraHonk(new RawBuffer(vkBuf));
  const proofAsFields = deflattenFields(proof.proof);
  return {
    proofAsFields: proofAsFields.map((p) => p.toString()),
    vkAsFields: vkAsFields.map((vk) => vk.toString()),
    publicInputs: proof.publicInputs,
  };
}
