declare module "belvo" {
  interface LinksResource {
    detail(linkId: string): Promise<unknown>;
  }

  interface AccountsResource {
    retrieve(linkId: string): Promise<unknown[]>;
  }

  interface TransactionsResource {
    retrieve(
      linkId: string,
      dateFrom: string,
      options: { dateTo: string }
    ): Promise<unknown[]>;
  }

  export default class Client {
    constructor(
      secretKey: string,
      secretPassword: string,
      env: "sandbox" | "production"
    );
    connect(): Promise<void>;
    links: LinksResource;
    accounts: AccountsResource;
    transactions: TransactionsResource;
  }
}
