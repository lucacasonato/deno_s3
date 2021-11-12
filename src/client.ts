import { AWSSignerV4, parseXML } from "../deps.ts";
import type { CreateBucketOptions, ListBucketsResponses } from "./types.ts";
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

    return new S3Bucket({
      ...this.#config,
      bucket,
    });
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
}
