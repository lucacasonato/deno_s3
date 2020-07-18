import { AWSSignerV4 } from "../deps.ts";

export interface S3Config {
  region: string;
  accessKeyID: string;
  secretKey: string;
  endpointURL?: string;
}

export class S3 {
  #signer: AWSSignerV4;
  #host: string;

  constructor(config: S3Config) {
    this.#signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyID,
      awsSecretKey: config.secretKey,
    });
    this.#host = config.endpointURL ??
      `https://s3.${config.region}.amazonaws.com/`;
  }
}
