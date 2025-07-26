import {
  AccountManager,
  type FeePaymentMethod,
  type PXE,
} from "@aztec/aztec.js";

export async function ensureAccountDeployed(
  accountManager: AccountManager,
  paymentMethod?: FeePaymentMethod,
  toast?: {
    promise: <T>(
      promise: Promise<T>,
      msgs: {
        loading: string;
        success: string;
        error: (error: unknown) => string;
      },
    ) => Promise<T>;
  },
) {
  const isDeployed: boolean = await isAccountDeployed(accountManager);
  if (!isDeployed) {
    await accountManager
      .deploy({
        fee: { paymentMethod },
      })
      .wait({ timeout: 10000000000 });

    console.log("Account created");
  }
  return await accountManager.register();
}

export async function isAccountDeployed(accountManager: AccountManager) {
  const pxe: PXE = (accountManager as any).pxe;
  const { isContractInitialized } = await pxe.getContractMetadata(
    accountManager.getAddress(),
  );
  return isContractInitialized;
}
