import { AWSSignerV4, sha256 } from "../deps.ts";
import { S3Config } from "./client.ts";
import type {
  GetObjectOptions,
  PutObjectOptions,
  PutObjectResponse,
  DeleteObjectOptions,
} from "./types.ts";

interface Params {
  [key: string]: string;
}

export interface S3BucketConfig extends S3Config {
  bucket: string;
}

export class S3Bucket {
  #signer: AWSSignerV4;
  #host: string;

  constructor(config: S3BucketConfig) {
    this.#signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyID,
      awsSecretKey: config.secretKey,
    });
    this.#host = config.endpointURL
      ? new URL(`/${config.bucket}/`, config.endpointURL).toString()
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com/`;
  }

  private _doRequest(
    path: string,
    params: Params,
    method: string,
    headers: Params,
    body?: Uint8Array | undefined,
  ): Promise<Response> {
    const url = new URL(path, this.#host);
    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }
    const signedHeaders = this.#signer.sign(
      "s3",
      url.toString(),
      method,
      headers,
      body,
    );
    signedHeaders["x-amz-content-sha256"] = sha256(
      body ?? "",
      "utf8",
      "hex",
    ) as string;
    if (body) {
      signedHeaders["content-length"] = body.length.toFixed(0);
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
    const resp = await this._doRequest(key, {}, "GET", {});
    const data = new Uint8Array(await resp.arrayBuffer());
    if (resp.status === 404) {
      throw new Error("Object not found.");
    }
    if (!resp.ok) {
      throw new Error(
        `Failed to get object: ${resp.statusText}\n${await resp.text()}`,
      );
    }
    return data;
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
    const resp = await this._doRequest(
      key,
      {},
      "PUT",
      headers,
      body,
    );
    if (!resp.ok) {
      throw new Error(
        `Failed to put object: ${resp.statusText}\n${await resp.text()}`,
      );
    }
    return {
      etag: JSON.parse(resp.headers.get("etag")!),
    };
  }

  async deleteObject(
    key: string,
    options?: DeleteObjectOptions,
  ): Promise<void> {
    const params: Params = {};
    if (options?.versionId) {
      params.versionId = options.versionId;
    }
    const resp = await this._doRequest(key, params, "DELETE", {});
    if (resp.status === 404) throw new Error("Object not found.");
    if (!resp.ok) {
      throw new Error(
        `Failed to get object: ${resp.statusText}\n${await resp.text()}`,
      );
    }
    await resp.arrayBuffer();
    return;
  }
}
