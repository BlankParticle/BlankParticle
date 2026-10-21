/** `alchemy dev` serves tools on localhost and sites on `<slug>.localhost` */
export const isLoopback = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
