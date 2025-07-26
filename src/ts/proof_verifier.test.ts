import "fake-indexeddb/auto";

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import {
  createAztecNodeClient,
  Fr,
  type PXE,
  TxStatus,
  type Wallet,
} from "@aztec/aztec.js";
import {
  type Barretenberg,
  deflattenFields,
  type ProofData,
  RawBuffer,
  UltraHonkBackend,
} from "@aztec/bb.js";
import { type CompiledCircuit, Noir } from "@aztec/noir-noir_js";
import {
  createPXEService,
  getPXEServiceConfig,
} from "@aztec/pxe/client/bundle";
import { times } from "lodash-es";
import os from "node:os";
import { assert } from "ts-essentials";
import { beforeAll, beforeEach, describe, it } from "vitest";
import my_circuit from "../../target_circuits/my_circuit.json" with { type: "json" };
import { ProofVerifierContract } from "../artifacts/ProofVerifier.js";
import { faucet } from "./fee_juice_faucet.js";

describe("Proof Verifier Contract", () => {
  let pxe: PXE;
  let alice: Wallet;

  let proofVerifier: ProofVerifierContract;

  beforeAll(async () => {
    const aztecSandboxUrl = "http://localhost:8080";
    const aztecTestnetUrl = "http://34.169.171.199:8080";
    const runOnTestnet = process.env.CHAIN === "testnet";
    const node = createAztecNodeClient(
      runOnTestnet ? aztecTestnetUrl : aztecSandboxUrl,
    );

    const pxeConfig = getPXEServiceConfig();
    pxeConfig.proverEnabled = runOnTestnet;
    pxe = await createPXEService(node, pxeConfig);

    if (runOnTestnet) {
      // sepolia
      alice = await faucet({
        pxe,
        l1Url: "https://sepolia.drpc.org",
      });
    } else {
      // sandbox
      const managers = await getInitialTestAccountsManagers(pxe);
      alice = await managers[0].register();
    }
  });

  beforeEach(async () => {
    console.log("deploying proof verifier");
    proofVerifier = await ProofVerifierContract.deploy(alice).send().deployed();
    console.log("proof verifier deployed");
  });

  const noir = new Noir(my_circuit as CompiledCircuit);
  const backend = new UltraHonkBackend(
    my_circuit.bytecode,
    { threads: os.cpus().length },
    { recursive: true },
  );

  it("e2e", async () => {
    const proof1 = await genProof(1, 2);
    const proof2 = await genProof(2, 3);
    const PROOFS_LEN = 128;
    const receipt = await proofVerifier.methods
      .aggregate_proofs(
        proof1.vkAsFields,
        // [proof1.proofAsFields, proof2.proofAsFields],
        times(PROOFS_LEN, () => proof1.proofAsFields),
        proof1.vkHash,
      )
      .send()
      .wait();
    assert(
      receipt.status === TxStatus.SUCCESS,
      `proof verification failed: ${receipt.status} ${receipt.error}`,
    );
    console.log("receipt", receipt);
  });

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
