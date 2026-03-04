export type TransactionType = "credit" | "debit";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  raw?: string; // descrição original do banco
}

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: "checking" | "savings" | "credit";
  balance: number;
  lastSynced?: string;
}

export interface BankConnection {
  id: string;
  institution: string;
  accounts: string[];
  connectedAt: string;
  status: "active" | "error" | "pending";
}
