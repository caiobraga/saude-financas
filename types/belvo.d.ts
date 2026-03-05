declare module "belvo" {
  export default class Client {
    constructor(
      secretKey: string,
      secretPassword: string,
      env: "sandbox" | "production"
    );
  }
}
