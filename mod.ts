import { AWSSignerV4, sha256 } from "./deps.ts";
import {
  GetObjectOptions,
  PutObjectResponse,
  PutObjectOptions,
} from "./types.ts";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyID: string;
  secretKey: string;
}

export class S3Client {
  #signer: AWSSignerV4;
  #host: string;

  constructor(private config: S3Config) {
    this.#signer = new AWSSignerV4(
      config.region,
      { awsAccessKeyId: config.accessKeyID, awsSecretKey: config.secretKey },
    );
    this.#host = `https://${config.bucket}.s3.${config.region}.amazonaws.com/`;
  }

  private _doRequest(
    path: string,
    method: string,
    headers: { [key: string]: string },
    body?: Uint8Array | undefined,
  ): Promise<Response> {
    const url = `${this.#host}${path}`;
    const signedHeaders = this.#signer.sign("s3", url, method, headers, body);
    if (body) {
      signedHeaders["x-amz-content-sha256"] = sha256(
        body,
        "utf8",
        "hex",
      ) as string;
    }
    return fetch(url, {
      method,
      headers: signedHeaders,
      body,
    });
  }

  async getObject(
    key: string,
    options?: GetObjectOptions,
  ): Promise<Uint8Array> {
    const resp = await this._doRequest(key, "GET", {});
    if (!resp.ok) {
      throw new Error(`Failed to get object: ${resp.statusText}`);
    }
    return new Uint8Array(await resp.arrayBuffer());
  }

  async putObject(
    key: string,
    body: Uint8Array,
    options?: PutObjectOptions,
  ): Promise<PutObjectResponse> {
    const headers: HeadersInit = {};
    if (options?.acl) {
      headers["x-amz-acl"] = options?.acl;
    }
    const resp = await this._doRequest(key, "PUT", headers, body);
    if (!resp.ok) {
      throw new Error(`Failed to put object: ${resp.statusText}`);
    }
    return {
      etag: JSON.parse(resp.headers.get("etag")!),
    };
  }
}
