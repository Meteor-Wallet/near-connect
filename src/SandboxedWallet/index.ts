import {
  Account,
  FinalExecutionOutcome,
  Network,
  SignAndSendTransactionParams,
  SignAndSendTransactionsParams,
  SignDelegateActionsParams,
  SignedMessage,
  SignMessageParams,
  WalletManifest,
  SignDelegateActionsResponse,
} from "../types";
import { NearConnector } from "../NearConnector";
import { nearActionsToConnectorActions } from "../actions";
import SandboxExecutor from "./executor";
import { base64ToUint8Array } from "../helpers/base64";
import type { SignedDelegate } from "@near-js/transactions";
import { deserialize } from "borsh";
import { SCHEMA } from "../helpers/schema";

export class SandboxWallet {
  executor: SandboxExecutor;

  constructor(readonly connector: NearConnector, readonly manifest: WalletManifest) {
    this.executor = new SandboxExecutor(connector, manifest);
  }

  async signIn(data?: { network?: Network; contractId?: string; methodNames?: Array<string> }): Promise<Array<Account>> {
    return this.executor.call("wallet:signIn", {
      network: data?.network || this.connector.network,
      contractId: data?.contractId,
      methodNames: data?.methodNames,
    });
  }

  async signOut(data?: { network?: Network }): Promise<void> {
    const args = { ...data, network: data?.network || this.connector.network };
    await this.executor.call("wallet:signOut", args);
    await this.executor.clearStorage();
  }

  async getAccounts(data?: { network?: Network }): Promise<Array<Account>> {
    const args = { ...data, network: data?.network || this.connector.network };
    return this.executor.call("wallet:getAccounts", args);
  }

  async signAndSendTransaction(params: SignAndSendTransactionParams): Promise<FinalExecutionOutcome> {
    const actions = nearActionsToConnectorActions(params.actions);
    const args = { ...params, actions, network: params.network || this.connector.network };
    return this.executor.call("wallet:signAndSendTransaction", args);
  }

  async signAndSendTransactions(params: SignAndSendTransactionsParams): Promise<Array<FinalExecutionOutcome>> {
    const transactions = params.transactions.map((transaction) => ({
      actions: nearActionsToConnectorActions(transaction.actions),
      receiverId: transaction.receiverId,
    }));

    const args = { ...params, transactions, network: params.network || this.connector.network };
    return this.executor.call("wallet:signAndSendTransactions", args);
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const args = { ...params, network: params.network || this.connector.network };
    return this.executor.call("wallet:signMessage", args);
  }

  async signDelegateActions(params: SignDelegateActionsParams): Promise<SignDelegateActionsResponse> {
    const args = {
      ...params,
      delegateActions: params.delegateActions.map((delegateAction) => ({
        ...delegateAction,
        actions: nearActionsToConnectorActions(delegateAction.actions),
      })),
      network: params.network || this.connector.network,
    };

    const response = await this.executor.call("wallet:signDelegateActions", args) as {
      delegateActionHashBase64: string;
      signedDelegateActionBase64: string;
    }[];

    return {
      signedDelegateActions: response.map(({ delegateActionHashBase64, signedDelegateActionBase64 }) => {
        return {
          delegateHash: base64ToUint8Array(delegateActionHashBase64),
          signedDelegate: <SignedDelegate>deserialize(SCHEMA.SignedDelegate, base64ToUint8Array(signedDelegateActionBase64)),
        };
      }),
    };
  }
}

export default SandboxWallet;
