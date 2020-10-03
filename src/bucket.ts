import {
  AWSSignerV4,
  decodeXMLEntities,
  parseXML,
  pooledMap,
  sha256Hex,
} from "../deps.ts";
import type { S3Config } from "./client.ts";
import type {
  CommonPrefix,
  CopyObjectOptions,
  DeleteObjectOptions,
  DeleteObjectResponse,
  GetObjectOptions,
  GetObjectResponse,
  ListAllObjectsOptions,
  ListObjectsOptions,
  ListObjectsResponse,
  LockMode,
  PutObjectOptions,
  PutObjectResponse,
  ReplicationStatus,
  S3Object,
  StorageClass,
} from "./types.ts";
import { S3Error } from "./error.ts";
import type { Signer } from "../deps.ts";

interface Params {
  [key: string]: string;
}

export interface S3BucketConfig extends S3Config {
  bucket: string;
}

export class S3Bucket {
  #signer: Signer;
  #host: string;
  #bucket: string;

  constructor(config: S3BucketConfig) {
    this.#signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyID,
      awsSecretKey: config.secretKey,
      sessionToken: config.sessionToken,
    });
    this.#bucket = config.bucket;
    this.#host = config.endpointURL
      ? new URL(`/${config.bucket}/`, config.endpointURL).toString()
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com/`;
  }

  private async _doRequest(
    path: string,
    params: Params,
    method: string,
    headers: Params,
    body?: Uint8Array | undefined,
  ): Promise<Response> {
    const url = path == "/"
      ? new URL(this.#host)
      : new URL(encodeURIS3(path), this.#host);
    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }
    const request = new Request(url.toString(), {
      headers,
      method,
      body,
    });

    const signedRequest = await this.#signer.sign("s3", request);
    signedRequest.headers.set("x-amz-content-sha256", sha256Hex(body ?? ""));
    if (body) {
      signedRequest.headers.set("content-length", body.length.toFixed(0));
    }
    return fetch(signedRequest);
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

    const res = await this._doRequest(key, params, "GET", headers);
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

    const res = await this._doRequest(
      `/`,
      params,
      "GET",
      headers,
    );
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
      isTruncated: extractContent(root, "IsTruncated") === "true"
        ? true
        : false,
      contents: root.children.filter((node) => node.name === "Contents").map<
        S3Object
      >((s3obj) => {
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
      commonPrefixes: extractField(root, "CommonPrefixes")?.children.map<
        CommonPrefix
      >((prefix) => {
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
    headers["x-amz-copy-source"] = new URL(encodeURIS3(source), this.#host)
      .toString();
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
      headers["x-amz-copy-source-if-modified-since"] = options
        .copyOnlyIfModifiedSince
        .toISOString();
    }
    if (options?.copyOnlyIfUnmodifiedSince) {
      headers["x-amz-copy-source-if-unmodified-since"] = options
        .copyOnlyIfUnmodifiedSince
        .toISOString();
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
      headers["x-amz-object-lock-retain-until-date"] = options.lockRetainUntil
        .toString();
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

    const resp = await this._doRequest(
      destination,
      {},
      "PUT",
      headers,
    );
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
    const resp = await this._doRequest(key, params, "DELETE", {});
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
    let ls: ListObjectsResponse | undefined;
    do {
      ls = await this.listObjects({
        maxKeys: 20, // max keys is used as the pool size in the deleteMany function.
        continuationToken: ls?.nextContinuationToken,
      });

      const d = await this.deleteMany(ls?.contents ?? []);
      deleted.push(...d);
    } while (ls?.nextContinuationToken);
    return deleted;
  }

  private async deleteMany(objects: S3Object[]): Promise<string[]> {
    const deleted: string[] = [];
    for await (
      let k of pooledMap(
        objects.length,
        objects.filter((o) => o.key),
        async (o) => {
          await this.deleteObject(o.key as string);
          return o.key as string;
        },
      )
    ) {
      deleted.push(k);
    }
    return deleted;
  }
}

function encodeURIS3(input: string): string {
  let result = "";
  for (const ch of input) {
    if (
      (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") ||
      (ch >= "0" && ch <= "9") || ch == "_" || ch == "-" || ch == "~" ||
      ch == "."
    ) {
      result += ch;
    } else if (ch == "/") {
      result += "/";
    } else {
      result += stringToHex(ch);
    }
  }
  return result;
}

const encoder = new TextEncoder();

function stringToHex(input: string) {
  return [...encoder.encode(input)].map((s) => "%" + s.toString(16)).join("")
    .toUpperCase();
}

interface Document {
  declaration: {
    attributes: Record<string, unknown>;
  };
  root: Xml | undefined;
}

interface Xml {
  name: string;
  attributes: unknown;
  children: Xml[];
  content?: string;
}

function extractRoot(doc: Document, name: string): Xml {
  if (!doc.root || doc.root.name !== name) {
    throw new S3Error(
      `Malformed XML document. Missing ${name} field.`,
      JSON.stringify(doc, undefined, 2),
    );
  }
  return doc.root;
}

function extractField(
  node: Xml,
  name: string,
): Xml | undefined {
  return node.children.find((node) => node.name === name);
}

function extractContent(
  node: Xml,
  name: string,
): string | undefined {
  const field = extractField(node, name);
  const content = field?.content;
  if (content === undefined) {
    return content;
  }
  return decodeXMLEntities(content);
}
