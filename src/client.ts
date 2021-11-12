import { AWSSignerV4, md5, parseXML } from "../deps.ts";
import { CommonPrefix, DeleteMarkerEntry, ObjectVersion } from "./types.ts";
import type {
  CreateBucketOptions,
  GetBucketVersioningOptions,
  ListBucketsResponses,
  ListObjectVersionsOptions,
  ListVersionsResult,
  MfaDelete,
  PutBucketVersioningOptions,
  VersioningConfiguration,
  VersioningStatus,
} from "./types.ts";
import { S3Error } from "./error.ts";
import { S3Bucket } from "./bucket.ts";
import { doRequest, encoder } from "./request.ts";
import type { Params } from "./request.ts";
import {
  extractContent,
  extractField,
  extractFields,
  extractRoot,
} from "./xml.ts";
import type { Document } from "./xml.ts";

export interface S3Config {
  region: string;
  accessKeyID: string;
  secretKey: string;
  sessionToken?: string;
  endpointURL?: string;
}

export class S3 {
  readonly #signer: AWSSignerV4;
  readonly #host: string;
  readonly #config: S3Config;

  constructor(config: S3Config) {
    this.#signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyID,
      awsSecretKey: config.secretKey,
    });
    this.#host = config.endpointURL ??
      `https://s3.${config.region}.amazonaws.com/`;
    this.#config = { ...config };
  }

  getBucket(bucket: string): S3Bucket {
    return new S3Bucket({
      ...this.#config,
      bucket,
    });
  }

  async createBucket(
    bucket: string,
    options?: CreateBucketOptions,
  ): Promise<S3Bucket> {
    const headers: Params = {};

    if (options?.acl) {
      headers["x-amz-acl"] = options.acl;
    }
    if (options?.grantFullControl) {
      headers["x-amz-grant-full-control"] = options.grantFullControl;
    }
    if (options?.grantRead) {
      headers["x-amz-grant-read"] = options.grantRead;
    }
    if (options?.grantReadAcp) {
      headers["x-amz-grant-read-acp"] = options.grantReadAcp;
    }
    if (options?.grantWrite) {
      headers["x-amz-grant-write"] = options.grantWrite;
    }
    if (options?.grantWriteAcp) {
      headers["x-amz-grant-write-acp"] = options.grantWriteAcp;
    }
    if (options?.bucketObjectLockEnabled) {
      headers["x-amz-bucket-object-lock-enabled"] =
        options.bucketObjectLockEnabled;
    }

    const body = encoder.encode(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
        `   <LocationConstraint>${this.#config.region}</LocationConstraint>` +
        "</CreateBucketConfiguration>",
    );

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: bucket,
      method: "PUT",
      headers,
      body,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to create bucket "${bucket}": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    // clean up http body
    await resp.arrayBuffer();

    return this.getBucket(bucket);
  }

  async listBuckets(): Promise<ListBucketsResponses> {
    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      method: "GET",
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to list buckets": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    const xml = await resp.text();
    return this.#parseListBucketsResponseXml(xml);
  }

  async putBucketVersioning(
    bucket: string,
    options: PutBucketVersioningOptions = {},
  ): Promise<void> {
    const headers: Params = {};
    const params: Params = {};

    if (options.mfa) {
      headers["x-amz-mfa"] = options.mfa;
    }
    if (options.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    const xml = this.#parsePutBucketVersioningRequestXml(options);
    headers["Content-MD5"] = md5(xml);
    const body = encoder.encode(xml);

    params["versioning"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: bucket,
      method: "PUT",
      headers,
      params,
      body,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to update bucket versioning configuration for bucket "${bucket}": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    // clean up http body
    await resp.arrayBuffer();
  }

  async getBucketVersioning(
    bucket: string,
    options: GetBucketVersioningOptions = {},
  ): Promise<VersioningConfiguration> {
    const headers: Params = {};
    const params: Params = {};

    if (options.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["versioning"] = "true";

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: bucket,
      method: "GET",
      headers,
      params,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to get bucket versioning configuration for bucket "${bucket}"": ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    return this.#parseGetBucketVersioningResponseXml(
      await resp.text(),
    );
  }

  async listObjectVersions(
    bucket: string,
    options?: ListObjectVersionsOptions,
  ): Promise<ListVersionsResult> {
    const headers: Params = {};
    const params: Params = {};

    if (options?.expectedBucketOwner) {
      headers["x-amz-expected-bucket-owner"] = options.expectedBucketOwner;
    }

    params["versions"] = "true";

    if (options?.delimiter) {
      params["delimiter"] = options.delimiter;
    }
    if (options?.encodingType) {
      params["encoding-type"] = options.encodingType;
    }
    if (options?.keyMarker) {
      params["key-marker"] = options.keyMarker;
    }
    if (options?.maxKeys) {
      params["max-keys"] = options.maxKeys;
    }
    if (options?.prefix) {
      params["prefix"] = options.prefix;
    }
    if (options?.versionIdMarker) {
      params["version-id-marker"] = options.versionIdMarker;
    }

    const resp = await doRequest({
      host: this.#host,
      signer: this.#signer,
      path: bucket,
      method: "GET",
      headers,
      params,
    });

    if (resp.status !== 200) {
      throw new S3Error(
        `Failed to list object versions: ${resp.status} ${resp.statusText}`,
        await resp.text(),
      );
    }

    return this.#parseListObjectVersionsResponseXml(
      await resp.text(),
    );
  }

  #parseListBucketsResponseXml(xml: string): ListBucketsResponses {
    const doc: Document = parseXML(xml);
    const root = extractRoot(doc, "ListAllMyBucketsResult");
    const buckets = extractField(root, "Buckets")!;
    const owner = extractField(root, "Owner")!;

    return {
      buckets: extractFields(buckets, "Bucket")
        .map((bucket) => {
          const creationDate = extractContent(bucket, "CreationDate");
          return {
            name: extractContent(bucket, "Name"),
            creationDate: creationDate ? new Date(creationDate) : undefined,
          };
        }),
      owner: {
        id: extractContent(owner, "ID"),
        displayName: extractContent(owner, "DisplayName"),
      },
    };
  }

  #parsePutBucketVersioningRequestXml(
    options: PutBucketVersioningOptions,
  ): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';

    if (options?.status) {
      xml += `  <Status>${options.status}</Status>\n`;
    }
    if (options?.mfaDelete) {
      xml += `  <MfaDelete>${options.mfaDelete}</MfaDelete>\n`;
    }
    xml += "</VersioningConfiguration>";

    return xml;
  }

  #parseGetBucketVersioningResponseXml(x: string): VersioningConfiguration {
    const doc: Document = parseXML(x);
    const root = extractRoot(doc, "VersioningConfiguration");
    const status = extractContent(root, "Status") as
      | VersioningStatus
      | undefined;
    const mfaDelete = extractContent(root, "MfaDelete") as
      | MfaDelete
      | undefined;
    const config: VersioningConfiguration = {};

    if (status) {
      config.status = status;
    }
    if (mfaDelete) {
      config.mfaDelete = mfaDelete;
    }

    return config;
  }

  #parseListObjectVersionsResponseXml(x: string): ListVersionsResult {
    const doc: Document = parseXML(x);
    const root = extractRoot(doc, "ListVersionsResult");

    const commonPrefixFields = extractFields(root, "CommonPrefixes");
    const commonPrefixes: Array<CommonPrefix> = commonPrefixFields.map(
      (commonPrefixField) => ({
        prefix: extractContent(commonPrefixField, "Prefix"),
      }),
    );

    const deleteMarkerFields = extractFields(root, "DeleteMarker");
    const deleteMarkers: Array<DeleteMarkerEntry> = deleteMarkerFields.map(
      (deleteMarkerField) => {
        const lastModifiedField = extractContent(
          deleteMarkerField,
          "LastModified",
        );
        const ownerField = extractField(deleteMarkerField, "Owner");
        return {
          prefix: extractContent(deleteMarkerField, "Prefix"),
          isLatest: extractContent(deleteMarkerField, "IsLatest") === "true",
          key: extractContent(deleteMarkerField, "Key"),
          lastModified: lastModifiedField
            ? new Date(lastModifiedField)
            : undefined,
          owner: ownerField && {
            displayName: extractContent(ownerField, "DisplayName"),
            id: extractContent(ownerField, "ID"),
          },
          versionId: extractContent(deleteMarkerField, "VersionId"),
        };
      },
    );

    const versionFields = extractFields(root, "Version");
    const versions: Array<ObjectVersion> = versionFields.map((versionField) => {
      const lastModifiedField = extractContent(versionField, "LastModified");
      const ownerField = extractField(versionField, "Owner");
      return {
        prefix: extractContent(versionField, "Prefix"),
        eTag: extractContent(versionField, "ETag"),
        isLatest: extractContent(versionField, "IsLatest") === "true",
        key: extractContent(versionField, "Key"),
        lastModified: lastModifiedField
          ? new Date(lastModifiedField)
          : undefined,
        owner: ownerField && {
          displayName: extractContent(ownerField, "DisplayName"),
          id: extractContent(ownerField, "ID"),
        },
        size: Number(extractContent(versionField, "Size")),
        storageClass: extractContent(versionField, "StorageClass") as
          | "STANDARD"
          | undefined,
        versionId: extractContent(versionField, "VersionId"),
      };
    });

    return {
      commonPrefixes,
      deleteMarkers,
      delimiter: extractContent(root, "Delimiter"),
      encodingType: extractContent(root, "EncodingType") as "url" | undefined,
      isTruncated: extractContent(root, "IsTruncated") === "true",
      keyMarker: extractContent(root, "KeyMarker"),
      maxKeys: Number(extractContent(root, "MaxKeys")),
      name: extractContent(root, "Name"),
      nextKeyMarker: extractContent(root, "NextKeyMarker"),
      nextVersionIdMarker: extractContent(root, "NextVersionIdMarker"),
      prefix: extractContent(root, "Prefix"),
      versions,
      versionIdMarker: extractContent(root, "VersionIdMarker"),
    };
  }
}
