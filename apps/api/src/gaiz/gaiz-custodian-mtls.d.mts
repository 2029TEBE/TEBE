export interface GaizMtlsTransportConfig {
  endpoint:string;
  ca:string|Buffer;
  clientCert:string|Buffer;
  clientKey:string|Buffer;
  serverSpkiSha256:string;
  custodianId:string;
}
export interface GaizMtlsTransport {
  requestAttestation(claim:unknown):Promise<unknown>;
}
export declare function makeCustodianMtlsTransport(
  config:GaizMtlsTransportConfig
): Readonly<GaizMtlsTransport>;
