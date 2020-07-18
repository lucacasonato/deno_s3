import { AWSSignerV4, sha256 } from "../deps.ts";
import { S3Config } from "./client.ts";
import type {
  GetObjectOptions,
  PutObjectOptions,
  PutObjectResponse,
  DeleteObjectOptions,
  DeleteObjectResponse,
} from "./types.ts";
import { S3Error } from "./error.ts";

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
    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to get object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
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
    const resp = await this._doRequest(
      key,
      {},
      "PUT",
      headers,
      body,
    );
    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to put object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }
    return {
      etag: JSON.parse(resp.headers.get("etag")!),
    };
  }

  async deleteObject(
    key: string,
    options?: DeleteObjectOptions,
  ): Promise<DeleteObjectResponse> {
    const params: Params = {};
    if (options?.versionId) {
      params.versionId = options.versionId;
    }
    const resp = await this._doRequest(key, params, "DELETE", {});
    if (resp.status !== 204) {
      throw new S3Error(
        `Failed to put object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }
    return {
      versionID: resp.headers.get("x-amz-version-id") ?? undefined,
      deleteMarker: resp.headers.get("x-amz-delete-marker") === "true",
    };
  }
}
