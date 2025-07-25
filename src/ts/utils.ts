import { AccountWallet, Contract } from "@aztec/aztec.js";
import {
  CounterContract,
  CounterContractArtifact,
} from "../artifacts/Counter.js";

/**
 * Deploys the Counter contract.
 * @param deployer - The wallet to deploy the contract with.
 * @param owner - The address of the owner of the contract.
 * @returns A deployed contract instance.
 */
export async function deployCounter(
  deployer: AccountWallet,
): Promise<CounterContract> {
  const contract = await Contract.deploy(
    deployer,
    CounterContractArtifact,
    [],
    "constructor",
  )
    .send()
    .deployed();
  return contract as CounterContract;
}
