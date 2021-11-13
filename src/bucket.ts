import { AWSSignerV4, md5, parseXML, pooledMap } from "../deps.ts";
import type { S3Config } from "./client.ts";
import type {
  CommonPrefix,
  CopyObjectOptions,
  DeleteBucketPolicyOptions,
  DeleteObjectOptions,
  DeleteObjectResponse,
  GetBucketPolicyOptions,
  GetBucketPolicyStatusOptions,
  GetObjectOptions,
  GetObjectResponse,
  HeadObjectResponse,
  ListAllObjectsOptions,
  ListObjectsOptions,
  ListObjectsResponse,
  LockMode,
  Policy,
  PolicyStatus,
  PutBucketPolicyOptions,
  PutObjectOptions,
  PutObjectResponse,
  ReplicationStatus,
  S3Object,
  Statement,
  StorageClass,
} from "./types.ts";
import { S3Error } from "./error.ts";
import type { Signer } from "../deps.ts";
import { doRequest, encoder, encodeURIS3 } from "./request.ts";
import type { Params } from "./request.ts";
import type { Document } from "./xml.ts";
import { extractContent, extractField, extractRoot } from "./xml.ts";

export interface S3BucketConfig extends S3Config {
  bucket: string;
}

export class S3Bucket {
  #signer: Signer;
  #host: string;

  constructor(config: S3BucketConfig) {
    this.#signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyID,
      awsSecretKey: config.secretKey,
      sessionToken: config.sessionToken,
    });
    this.#host = config.endpointURL
      ? new URL(`/${config.bucket}/`, config.endpointURL).toString()
      : config.bucket.indexOf(".") >= 0
      ? `https://s3.${config.region}.amazonaws.com/${config.bucket}/`
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com/`;
  }

  async headObject(
    key: string,
    options?: GetObjectOptions,
  ): Promise<HeadObjectResponse | undefined> {
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

    const res = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: key,
      method: "HEAD",
      params,
      headers,
    });
    if (res.body) {
      await res.arrayBuffer();
    }
    if (res.status === 404) {
      return undefined;
    }
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

    const meta: Record<string, string> = {};
    for (const [key, value] of res.headers) {
      if (key.startsWith("x-amz-meta-")) {
        meta[key.slice("x-amz-meta-".length)] = value;
      }
    }

    return {
      contentLength: parseInt(res.headers.get("Content-Length")!),
      deleteMarker: res.headers.get("x-amz-delete-marker") === "true",
      etag: JSON.parse(res.headers.get("etag")!),
      lastModified: new Date(res.headers.get("Last-Modified")!),
      missingMeta: parseInt(res.headers.get("x-amz-missing-meta") ?? "0"),
      storageClass: (res.headers.get("x-amz-storage-class") as StorageClass) ??
        "STANDARD",
      taggingCount: parseInt(res.headers.get("x-amz-tagging-count") ?? "0"),

      cacheControl: res.headers.get("Cache-Control") ?? undefined,
      contentDisposition: res.headers.get("Content-Disposition") ?? undefined,
      contentEncoding: res.headers.get("Content-Encoding") ?? undefined,
      contentLanguage: res.headers.get("Content-Language") ?? undefined,
      contentType: res.headers.get("Content-Type") ?? undefined,
      expires: expires ? new Date(expires) : undefined,
      legalHold: legalHold ? true : legalHold === "OFF" ? false : undefined,
      lockMode: (res.headers.get("x-amz-object-lock-mode") as LockMode) ??
        undefined,
      lockRetainUntil: lockRetainUntil ? new Date(lockRetainUntil) : undefined,
      partsCount: partsCount ? parseInt(partsCount) : undefined,
      replicationStatus:
        (res.headers.get("x-amz-replication-status") as ReplicationStatus) ??
          undefined,
      versionId: res.headers.get("x-amz-version-id") ?? undefined,
      websiteRedirectLocation:
        res.headers.get("x-amz-website-redirect-location") ?? undefined,
      meta,
    };
  }

  async getObject(
    key: string,
    options?: GetObjectOptions,
  ): Promise<GetObjectResponse | undefined> {
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

    const res = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: key,
      method: "GET",
      params,
      headers,
    });
    if (res.status === 404) {
      // clean up http body
      await res.arrayBuffer();
      return undefined;
    }
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

    const meta: Record<string, string> = {};
    for (const [key, value] of res.headers) {
      if (key.startsWith("x-amz-meta-")) {
        meta[key.slice("x-amz-meta-".length)] = value;
      }
    }

    if (res.body == null) {
      throw new S3Error("S3 did not return a body for a getObject call.", "");
    }

    return {
      body: res.body,
      contentLength: parseInt(res.headers.get("Content-Length")!),
      deleteMarker: res.headers.get("x-amz-delete-marker") === "true",
      etag: JSON.parse(res.headers.get("etag")!),
      lastModified: new Date(res.headers.get("Last-Modified")!),
      missingMeta: parseInt(res.headers.get("x-amz-missing-meta") ?? "0"),
      storageClass: (res.headers.get("x-amz-storage-class") as StorageClass) ??
        "STANDARD",
      taggingCount: parseInt(res.headers.get("x-amz-tagging-count") ?? "0"),

      cacheControl: res.headers.get("Cache-Control") ?? undefined,
      contentDisposition: res.headers.get("Content-Disposition") ?? undefined,
      contentEncoding: res.headers.get("Content-Encoding") ?? undefined,
      contentLanguage: res.headers.get("Content-Language") ?? undefined,
      contentType: res.headers.get("Content-Type") ?? undefined,
      expires: expires ? new Date(expires) : undefined,
      legalHold: legalHold ? true : legalHold === "OFF" ? false : undefined,
      lockMode: (res.headers.get("x-amz-object-lock-mode") as LockMode) ??
        undefined,
      lockRetainUntil: lockRetainUntil ? new Date(lockRetainUntil) : undefined,
      partsCount: partsCount ? parseInt(partsCount) : undefined,
      replicationStatus:
        (res.headers.get("x-amz-replication-status") as ReplicationStatus) ??
          undefined,
      versionId: res.headers.get("x-amz-version-id") ?? undefined,
      websiteRedirectLocation:
        res.headers.get("x-amz-website-redirect-location") ?? undefined,
      meta,
    };
  }

  async listObjects(
    options?: ListObjectsOptions,
  ): Promise<ListObjectsResponse | undefined> {
    // list-type param has to be first
    const params: Params = { "list-type": "2" };
    const headers: Params = {};
    if (options?.delimiter) params["delimiter"] = options.delimiter;
    if (options?.encodingType) params["encoding-type"] = options.encodingType;
    if (options?.maxKeys) {
      params["max-keys"] = options.maxKeys.toString();
    }
    if (options?.prefix) {
      params["prefix"] = options.prefix;
    }
    if (options?.continuationToken) {
      params["continuation-token"] = options.continuationToken;
    }

    const res = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "GET",
      params,
      headers,
    });
    if (res.status === 404) {
      // clean up http body
      await res.arrayBuffer();
      return undefined;
    }
    if (res.status !== 200) {
      const text = await res.text();
      console.log(text);
      throw new S3Error(
        `Failed to get object: ${res.status} ${res.statusText}`,
        text,
      );
    }

    const xml = await res.text();
    return this.parseListObjectResponseXml(xml);
  }

  private parseListObjectResponseXml(x: string): ListObjectsResponse {
    const doc: Document = parseXML(x);
    const root = extractRoot(doc, "ListBucketResult");

    let keycount: number | undefined;
    let content = extractContent(root, "KeyCount");
    if (content) {
      keycount = parseInt(content);
    }

    let maxkeys: number | undefined;
    content = extractContent(root, "MaxKeys");
    if (content) {
      maxkeys = parseInt(content);
    }

    let startAfter: Date | undefined;
    content = extractContent(root, "StartAfter");
    if (content) {
      startAfter = new Date(content);
    }

    const parsed = {
      isTruncated: extractContent(root, "IsTruncated") === "true",
      contents: root.children
        .filter((node) => node.name === "Contents")
        .map<S3Object>((s3obj) => {
          let lastmod: Date | undefined;
          let content = extractContent(s3obj, "LastModified");
          if (content) {
            lastmod = new Date(content);
          }

          let size: number | undefined;
          content = extractContent(s3obj, "Size");
          if (content) {
            size = parseInt(content);
          }

          return {
            key: extractContent(s3obj, "Key"),
            lastModified: lastmod,
            eTag: extractContent(s3obj, "ETag"),
            size: size,
            storageClass: extractContent(s3obj, "StorageClass"),
            owner: extractContent(s3obj, "Owner"),
          };
        }),
      name: extractContent(root, "Name"),
      prefix: extractContent(root, "Prefix"),
      delimiter: extractContent(root, "Delimiter"),
      maxKeys: maxkeys,
      commonPrefixes: extractField(
        root,
        "CommonPrefixes",
      )?.children.map<CommonPrefix>((prefix) => {
        return {
          prefix: extractContent(prefix, "Prefix"),
        };
      }),
      encodingType: extractContent(root, "EncodingType"),
      keyCount: keycount,
      continuationToken: extractContent(root, "ContinuationToken"),
      nextContinuationToken: extractContent(root, "NextContinuationToken"),
      startAfter: startAfter,
    };
    return parsed;
  }

  async *listAllObjects(
    options: ListAllObjectsOptions,
  ): AsyncGenerator<S3Object> {
    let ls: ListObjectsResponse | undefined;
    do {
      ls = await this.listObjects({
        ...options,
        maxKeys: options.batchSize,
        continuationToken: ls?.nextContinuationToken,
      });
      if (ls?.contents) {
        for (const object of ls.contents) {
          yield object;
        }
      }
    } while (ls?.nextContinuationToken);
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
      headers[
        "x-amz-object-lock-retain-until-date"
      ] = options.lockRetainUntil.toString();
    }
    if (options?.legalHold) {
      headers["x-amz-object-lock-legal-hold"] = options.legalHold
        ? "ON"
        : "OFF";
    }
    if (options?.meta) {
      for (const [key, value] of Object.entries(options.meta)) {
        headers[`x-amz-meta-${key}`] = value;
      }
    }

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: key,
      method: "PUT",
      headers,
      body,
    });
    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to put object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }
    // clean up http body
    await resp.arrayBuffer();
    return {
      etag: JSON.parse(resp.headers.get("etag")!),
      versionId: resp.headers.get("x-amz-version-id") ?? undefined,
    };
  }

  async copyObject(
    source: string,
    destination: string,
    options?: CopyObjectOptions,
  ): Promise<PutObjectResponse> {
    const headers: Params = {};
    headers["x-amz-copy-source"] = new URL(
      encodeURIS3(source),
      this.#host,
    ).toString();
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
    if (options?.copyOnlyIfMatch) {
      headers["x-amz-copy-source-if-match"] = options.copyOnlyIfMatch;
    }
    if (options?.copyOnlyIfNoneMatch) {
      headers["x-amz-copy-source-if-none-match"] = options.copyOnlyIfNoneMatch;
    }
    if (options?.copyOnlyIfModifiedSince) {
      headers[
        "x-amz-copy-source-if-modified-since"
      ] = options.copyOnlyIfModifiedSince.toISOString();
    }
    if (options?.copyOnlyIfUnmodifiedSince) {
      headers[
        "x-amz-copy-source-if-unmodified-since"
      ] = options.copyOnlyIfUnmodifiedSince.toISOString();
    }
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
      headers[
        "x-amz-object-lock-retain-until-date"
      ] = options.lockRetainUntil.toString();
    }
    if (options?.legalHold) {
      headers["x-amz-object-lock-legal-hold"] = options.legalHold
        ? "ON"
        : "OFF";
    }
    if (options?.metadataDirective) {
      headers["x-amz-metadata-directive"] = options.metadataDirective;
    }
    if (options?.taggingDirective) {
      headers["x-amz-tagging-directive"] = options.taggingDirective;
    }

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: destination,
      method: "PUT",
      headers,
    });
    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to copy object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }
    // clean up http body
    await resp.arrayBuffer();
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
    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: key,
      method: "DELETE",
      params,
    });
    if (resp.status !== 204) {
      throw new S3Error(
        `Failed to put object: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }
    // clean up http body
    await resp.arrayBuffer();
    return {
      versionID: resp.headers.get("x-amz-version-id") ?? undefined,
      deleteMarker: resp.headers.get("x-amz-delete-marker") === "true",
    };
  }

  /**
   * Deletes all objects in the bucket recursively. Returns a list of deleted keys.
   */
  async empty(): Promise<string[]> {
    const deleted: string[] = [];
    for await (
      const k of pooledMap(
        50,
        this.listAllObjects({ batchSize: 1000 }),
        async (o) => {
          if (o.key) {
            await this.deleteObject(o.key!);
            return o.key!;
          }
        },
      )
    ) {
      deleted.push(k!);
    }
    return deleted;
  }

  /**
   * Applies an Amazon S3 bucket policy to an Amazon S3 bucket. If you are using
   * an identity other than the root user of the AWS account that owns the
   * bucket, the calling identity must have the PutBucketPolicy permissions on
   * the specified bucket and belong to the bucket owner's account in order to
   * use this operation.
   */
  async putBucketPolicy(
    options: PutBucketPolicyOptions,
  ): Promise<void> {
    const headers: Params = {};
    const params: Params = {};
    const json = JSON.stringify(options.policy);
    const body = encoder.encode(json);

    headers["Content-MD5"] = md5(json);

    if (typeof options.confirmRemoveSelfBucketAccess !== "undefined") {
      headers["x-amz-confirm-remove-self-bucket-access"] = options
        .confirmRemoveSelfBucketAccess.toString();
    }
    if (options.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["policy"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "PUT",
      headers,
      params,
      body,
    });

    if (resp.status !== 204) {
      throw new S3Error(
        `Failed to create bucket policy: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    // clean up http body
    await resp.arrayBuffer();
  }

  /**
   * Returns the policy of a specified bucket. If you are using an identity
   * other than the root user of the AWS account that owns the bucket, the
   * calling identity must have the GetBucketPolicy permissions on the specified
   * bucket and belong to the bucket owner's account in order to use this
   * operation.
   */
  async getBucketPolicy(
    options?: GetBucketPolicyOptions,
  ): Promise<Policy> {
    const headers: Params = {};
    const params: Params = {};

    if (options?.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["policy"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "GET",
      headers,
      params,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to get bucket policy: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    const result = JSON.parse(await resp.text());

    return this.#parseGetBucketPolicyResult(result);
  }

  /**
   * This implementation of the DELETE action uses the policy subresource to
   * delete the policy of a specified bucket. If you are using an identity other
   * than the root user of the AWS account that owns the bucket, the calling
   * identity must have the DeleteBucketPolicy permissions on the specified
   * bucket and belong to the bucket owner's account to use this operation.
   */
  async deleteBucketPolicy(
    options?: DeleteBucketPolicyOptions,
  ): Promise<void> {
    const headers: Params = {};
    const params: Params = {};

    if (options?.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["policy"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "DELETE",
      headers,
      params,
    });

    if (resp.status !== 204) {
      throw new S3Error(
        `Failed to delete bucket policy": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    // clean up http body
    await resp.arrayBuffer();
  }

  /**
   * Retrieves the policy status for an Amazon S3 bucket, indicating whether the
   * bucket is public. In order to use this operation, you must have the
   * s3:GetBucketPolicyStatus permission.
   */
  async getBucketPolicyStatus(
    options?: GetBucketPolicyStatusOptions,
  ): Promise<PolicyStatus> {
    const headers: Params = {};
    const params: Params = {};

    if (options?.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["policyStatus"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "GET",
      headers,
      params,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to get bucket policy status": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    return this.#parseGetBucketPolicyStatusResult(
      await resp.text(),
    );
  }

  // deno-lint-ignore no-explicit-any
  #parseGetBucketPolicyResult(result: Record<string, any>): Policy {
    const policy: Policy = {
      statement: Array.isArray(result.Statement)
        ? result.Statement.map(mapKeys) as Array<Statement>
        : mapKeys(result.Statement) as Statement,
    };

    if (result.ID) {
      policy.id = result.ID;
    }

    if (result.Version) {
      policy.version = result.Version;
    }

    return policy;

    // deno-lint-ignore no-explicit-any
    function mapKeys(obj: Record<string, unknown>): Record<string, any> {
      const mapped: Record<string, unknown> = {};
      for (const key in obj) {
        const mappedKey = key.slice(0, 1).toLowerCase() + key.slice(1);
        mapped[mappedKey] = obj[key];
      }
      return mapped;
    }
  }

  #parseGetBucketPolicyStatusResult(xml: string): PolicyStatus {
    const doc: Document = parseXML(xml);
    const root = extractRoot(doc, "PolicyStatus");
    const isPublic =
      extractContent(root, "IsPublic ")?.toLowerCase() === "true";
    return { isPublic };
  }
}
