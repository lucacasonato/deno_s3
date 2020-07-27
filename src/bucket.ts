import { AWSSignerV4, sha256 } from "../deps.ts";
import { S3Config } from "./client.ts";
import type {
  GetObjectOptions,
  PutObjectOptions,
  PutObjectResponse,
  DeleteObjectOptions,
  DeleteObjectResponse,
  GetObjectResponse,
  LockMode,
  ReplicationStatus,
  StorageClass,
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
      sessionToken: config.sessionToken,
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
    const url = new URL(encodeURI(path), this.#host);
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
  ): Promise<GetObjectResponse> {
    const params: Params = {};
    const headers: Params = {};
    if (options?.ifMatch) headers["If-Match"] = options.ifMatch;
    if (options?.ifNoneMatch) headers["If-None-Match"] = options.ifNoneMatch;
    if (options?.ifModifiedSince) {
      headers["If-Modified-Since"] = options.ifModifiedSince.toISOString();
    }
    if (options?.ifUnmodifiedSince) {
      headers["If-Unmodified-Since"] = options.ifUnmodifiedSince.toISOString();
    }
    if (options?.partNumber) {
      params["PartNumber"] = options.partNumber.toFixed(0);
    }
    if (options?.responseCacheControl) {
      params["ResponseCacheControl"] = options.responseCacheControl;
    }
    if (options?.responseContentDisposition) {
      params["ResponseContentDisposition"] = options.responseContentDisposition;
    }
    if (options?.responseContentEncoding) {
      params["ResponseContentEncoding"] = options.responseContentEncoding;
    }
    if (options?.responseContentLanguage) {
      params["ResponseContentLanguage"] = options.responseContentLanguage;
    }
    if (options?.responseContentType) {
      params["ResponseContentType"] = options.responseContentType;
    }
    if (options?.responseExpires) {
      params["ResponseExpires"] = options.responseExpires;
    }
    if (options?.versionId) {
      params["VersionId"] = options.versionId;
    }

    const res = await this._doRequest(key, params, "GET", headers);
    if (res.status !== 200) {
      throw new S3Error(
        `Failed to get object: ${res.status} ${res.statusText}`,
        await res.text(),
      );
    }

    const expires = res.headers.get("expires");
    const lockRetainUntil = res.headers.get(
      "x-amz-object-lock-retain-until-date",
    );
    const partsCount = res.headers.get("x-amz-mp-parts-count");
    const legalHold = res.headers.get("x-amz-object-lock-legal-hold");

    return {
      body: new Uint8Array(await res.arrayBuffer()),
      contentLength: parseInt(res.headers.get("Content-Length")!),
      deleteMarker: res.headers.get("x-amz-delete-marker") === "true",
      etag: JSON.parse(res.headers.get("etag")!),
      lastModified: new Date(res.headers.get("Last-Modified")!),
      missingMeta: parseInt(res.headers.get("x-amz-missing-meta") ?? "0"),
      storageClass: res.headers.get("x-amz-storage-class") as StorageClass ??
        "STANDARD",
      taggingCount: parseInt(res.headers.get("x-amz-tagging-count") ?? "0"),

      cacheControl: res.headers.get("Cache-Control") ?? undefined,
      contentDisposition: res.headers.get("Content-Disposition") ?? undefined,
      contentEncoding: res.headers.get("Content-Encoding") ?? undefined,
      contentLanguage: res.headers.get("Content-Language") ?? undefined,
      contentType: res.headers.get("Content-Type") ?? undefined,
      expires: expires ? new Date(expires) : undefined,
      legalHold: legalHold ? true : (legalHold === "OFF" ? false : undefined),
      lockMode: res.headers.get("x-amz-object-lock-mode") as LockMode ??
        undefined,
      lockRetainUntil: lockRetainUntil ? new Date(lockRetainUntil) : undefined,
      partsCount: partsCount ? parseInt(partsCount) : undefined,
      replicationStatus:
        res.headers.get("x-amz-replication-status") as ReplicationStatus ??
          undefined,
      versionId: res.headers.get("x-amz-version-id") ?? undefined,
      websiteRedirectLocation:
        res.headers.get("x-amz-website-redirect-location") ?? undefined,
    };
  }

  async putObject(
    key: string,
    body: Uint8Array,
    options?: PutObjectOptions,
  ): Promise<PutObjectResponse> {
    const headers: Params = {};
    if (options?.acl) headers["x-amz-acl"] = options.acl;
    if (options?.cacheControl) headers["Cache-Control"] = options.cacheControl;
    if (options?.contentDisposition) {
      headers["Content-Disposition"] = options.contentDisposition;
    }
    if (options?.contentEncoding) {
      headers["Content-Encoding"] = options.contentEncoding;
    }
    if (options?.contentLanguage) {
      headers["Content-Language"] = options.contentLanguage;
    }
    if (options?.contentType) headers["Content-Type"] = options.contentType;
    if (options?.grantFullControl) {
      headers["x-amz-grant-full-control"] = options.grantFullControl;
    }
    if (options?.grantRead) headers["x-amz-grant-read"] = options.grantRead;
    if (options?.grantReadAcp) {
      headers["x-amz-grant-read-acp"] = options.grantReadAcp;
    }
    if (options?.grantWriteAcp) {
      headers["x-amz-grant-write-acp"] = options.grantWriteAcp;
    }
    if (options?.storageClass) {
      headers["x-amz-storage-class"] = options.storageClass;
    }

    if (options?.websiteRedirectLocation) {
      headers["x-amz-website-redirect-location"] =
        options.websiteRedirectLocation;
    }
    if (options?.tags) {
      const p = new URLSearchParams(options.tags);
      headers["x-amz-tagging"] = p.toString();
    }
    if (options?.lockMode) headers["x-amz-object-lock-mode"] = options.lockMode;
    if (options?.lockRetainUntil) {
      headers["x-amz-object-lock-retain-until-date"] = options.lockRetainUntil
        .toString();
    }
    if (options?.legalHold) {
      headers["x-amz-object-lock-legal-hold"] = options.legalHold
        ? "ON"
        : "OFF";
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
      versionId: resp.headers.get("x-amz-version-id") ?? undefined,
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
