export interface S3Object {
  /**
   * The name that you assign to an object. You use the object key to retrieve the object.
   */
  key?: string;
  /**
   * The date the Object was Last Modified
   */
  lastModified?: Date;
  /**
   * The entity tag is a hash of the object. The ETag reflects changes only to the contents of an object, not its metadata. The ETag may or may not be an MD5 digest of the object data. Whether or not it is depends on how the object was created and how it is encrypted as described below:   Objects created by the PUT Object, POST Object, or Copy operation, or through the AWS Management Console, and are encrypted by SSE-S3 or plaintext, have ETags that are an MD5 digest of their object data.   Objects created by the PUT Object, POST Object, or Copy operation, or through the AWS Management Console, and are encrypted by SSE-C or SSE-KMS, have ETags that are not an MD5 digest of their object data.   If an object is created by either the Multipart Upload or Part Copy operation, the ETag is not an MD5 digest, regardless of the method of encryption.
   */
  eTag?: string;
  /**
   * Size in bytes of the object
   */
  size?: number;
  /**
   * The class of storage used to store the object.
   */
  storageClass?: string;
  /**
   * The owner of the object
   */
  owner?: string;
}

export interface CommonPrefix {
  /**
   * Container for the specified common prefix.
   */
  prefix?: string;
}

/** The mode the object lock is in. */
export type LockMode = "GOVERNANCE" | "COMPLIANCE";

/** The status of a object replication. */
export type ReplicationStatus = "COMPLETE" | "PENDING" | "FAILED" | "REPLICA";

/** A S3 storage class.  */
export type StorageClass =
  | "STANDARD"
  | "REDUCED_REDUNDANCY"
  | "STANDARD_IA"
  | "ONEZONE_IA"
  | "INTELLIGENT_TIERING"
  | "GLACIER"
  | "DEEP_ARCHIVE";

export type CopyDirective = "COPY" | "REPLACE";

export interface GetObjectOptions {
  /**
   * Return the object only if its entity tag (ETag) is the same as the one
   * specified, otherwise return a 412 (precondition failed).
   */
  ifMatch?: string;

  /**
   * Return the object only if its entity tag (ETag) is different from the one
   * specified, otherwise return a 304 (not modified).
   */
  ifNoneMatch?: string;

  /**
   * Return the object only if it has been modified since the specified time,
   * otherwise return a 304 (not modified).
   */
  ifModifiedSince?: Date;

  /**
   * Return the object only if it has not been modified since the specified
   * time, otherwise return a 412 (precondition failed).
   */
  ifUnmodifiedSince?: Date;

  /**
   * Part number of the object being read. This is a positive integer between
   * 1 and 10,000. Effectively performs a 'ranged' GET request for the part
   * specified. Useful for downloading just a part of an object.
   */
  partNumber?: number;

  /** VersionId used to reference a specific version of the object. */
  versionId?: string;

  /** Sets the `Cache-Control` header of the response. */
  responseCacheControl?: string;

  /** Sets the `Content-Disposition` header of the response */
  responseContentDisposition?: string;

  /** Sets the `Content-Encoding` header of the response */
  responseContentEncoding?: string;

  /** Sets the `Content-Language` header of the response */
  responseContentLanguage?: string;

  /** Sets the `Content-Type` header of the response */
  responseContentType?: string;

  /** Sets the `Expires` header of the response */
  responseExpires?: string;

  // TODO: range
}

export interface HeadObjectResponse {
  /** Specifies caching behavior along the request/reply chain. */
  cacheControl?: string;

  /** Specifies presentational information for the object. */
  contentDisposition?: string;

  /**
   * Specifies what content encodings have been applied to the object
   * and thus what decoding mechanisms must be applied to obtain the
   * media-type referenced by the Content-Type field.
   */
  contentEncoding?: string;

  /** The language the content is in. */
  contentLanguage?: string;

  /** Size of the body in bytes. */
  contentLength: number;

  /** A standard MIME type describing the format of the object data. */
  contentType?: string;

  /**
   * An ETag is an opaque identifier assigned by a web server to a
   * specific version of a resource found at a URL.
   */
  etag: string;

  /** The date and time at which the object is no longer cacheable. */
  expires?: Date;

  /** Last modified date of the object */
  lastModified: Date;

  /**
   * Specifies whether the object retrieved was (true) or was not (false)
   * a Delete Marker
   */
  deleteMarker: boolean;

  /** The count of parts this object has. */
  partsCount?: number;

  /**
   * This is set to the number of metadata entries not returned in x-amz-meta
   * headers. This can happen if you create metadata using an API like SOAP
   * that supports more flexible metadata than the REST API. For example,
   * using SOAP, you can create metadata whose values are not legal HTTP
   * headers.
   */
  missingMeta: number;

  /**
   * Indicates whether this object has an active legal hold. This field
   * is only returned if you have permission to view an object's legal
   * hold status.
   */
  legalHold?: boolean;

  /** The Object Lock mode currently in place for this object. */
  lockMode?: LockMode;

  /** The date and time when this object's Object Lock will expire. */
  lockRetainUntil?: Date;

  /**
   * Amazon S3 can return this if your request involves a bucket that is
   * either a source or destination in a replication rule.
   */
  replicationStatus?: ReplicationStatus;

  /**
   * Provides storage class information of the object. Amazon S3 returns
   * this for all objects except for S3 Standard storage class objects.
   */
  storageClass: StorageClass;

  /** The number of tags, if any, on the object. */
  taggingCount: number;

  /** Version of the object. */
  versionId?: string;

  /**
   * If the bucket is configured as a website, redirects requests for
   * this object to another object in the same bucket or to an external
   * URL. Amazon S3 stores the value of this field in the object
   * metadata.
   */
  websiteRedirectLocation?: string;

  /**
   * The user-defined metadata of this object as a number of key-value pairs
   * with the prefixed `x-amz-meta-` stripped from the key
   */
  meta: Record<string, string>;

  // TODO: accept-ranges
  // TODO: Content-Range
  // TODO: x-amz-expiration
  // TODO: x-amz-restore
}

export interface GetObjectResponse extends HeadObjectResponse {
  /** The body of this object. */
  body: ReadableStream<Uint8Array>;
}

export interface ListObjectsResponse {
  /**
   * Set to false if all of the results were returned. Set to true if more keys are available to return. If the number of results exceeds that specified by MaxKeys, all of the results might not be returned.
   */
  isTruncated?: boolean;
  /**
   * Metadata about each object returned.
   */
  contents?: S3Object[];
  /**
   * Bucket name.  When using this API with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this operation using an access point through the AWS SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using Access Points in the Amazon Simple Storage Service Developer Guide.
   */
  name?: string;
  /**
   *  Keys that begin with the indicated prefix.
   */
  prefix?: string;
  /**
   * Causes keys that contain the same string between the prefix and the first occurrence of the delimiter to be rolled up into a single result element in the CommonPrefixes collection. These rolled-up keys are not returned elsewhere in the response. Each rolled-up result counts as only one return against the MaxKeys value.
   */
  delimiter?: string;
  /**
   * Sets the maximum number of keys returned in the response. By default the API returns up to 1,000 key names. The response might contain fewer keys but will never contain more.
   */
  maxKeys?: number;
  /**
   * All of the keys rolled up into a common prefix count as a single return when calculating the number of returns. A response can contain CommonPrefixes only if you specify a delimiter.  CommonPrefixes contains all (if there are any) keys between Prefix and the next occurrence of the string specified by a delimiter.  CommonPrefixes lists keys that act like subdirectories in the directory specified by Prefix. For example, if the prefix is notes/ and the delimiter is a slash (/) as in notes/summer/july, the common prefix is notes/summer/. All of the keys that roll up into a common prefix count as a single return when calculating the number of returns.
   */
  commonPrefixes?: CommonPrefix[];
  /**
   * Encoding type used by Amazon S3 to encode object key names in the XML response. If you specify the encoding-type request parameter, Amazon S3 includes this element in the response, and returns encoded key name values in the following response elements:  Delimiter, Prefix, Key, and StartAfter.
   */
  encodingType?: string;
  /**
   * KeyCount is the number of keys returned with this request. KeyCount will always be less than equals to MaxKeys field. Say you ask for 50 keys, your result will include less than equals 50 keys
   */
  keyCount?: number;
  /**
   *  If ContinuationToken was sent with the request, it is included in the response.
   */
  continuationToken?: string;
  /**
   *  NextContinuationToken is sent when isTruncated is true, which means there are more keys in the bucket that can be listed. The next list requests to Amazon S3 can be continued with this NextContinuationToken. NextContinuationToken is obfuscated and is not a real key
   */
  nextContinuationToken?: string;
  /**
   * If StartAfter was sent with the request, it is included in the response.
   */
  startAfter?: Date;
}

export interface ListObjectsOptions {
  /**
   * A delimiter is a character you use to group keys.
   */
  delimiter?: string;
  /**
   * Encoding type used by Amazon S3 to encode object keys in the response.
   */
  encodingType?: string;
  /**
   * Sets the maximum number of keys returned in the response. By default the API returns up to 1,000 key names. The response might contain fewer keys but will never contain more.
   */
  maxKeys?: number;
  /**
   * Limits the response to keys that begin with the specified prefix.
   */
  prefix?: string;
  /**
   * ContinuationToken indicates Amazon S3 that the list is being continued on this bucket with a token. ContinuationToken is obfuscated and is not a real key.
   */
  continuationToken?: string;

  // TODO(wperron): implement those fields
  /**
   * The owner field is not present in listV2 by default, if you want to return owner field with each key in the result then set the fetch owner field to true.
   */
  // FetchOwner?: FetchOwner;
  /**
   * StartAfter is where you want Amazon S3 to start listing from. Amazon S3 starts listing after this specified key. StartAfter can be any key in the bucket.
   */
  // StartAfter?: StartAfter;
  /**
   * Confirms that the requester knows that she or he will be charged for the list objects request in V2 style. Bucket owners need not specify this parameter in their requests.
   */
  // RequestPayer?: RequestPayer;
  /**
   * The account id of the expected bucket owner. If the bucket is owned by a different account, the request will fail with an HTTP 403 (Access Denied) error.
   */
  // ExpectedBucketOwner?: AccountId;
}

export type ListAllObjectsOptions =
  & Omit<Omit<ListObjectsOptions, "maxKeys">, "continuationToken">
  & {
    /** The batch size for each listObjects request. */
    batchSize: number;
  };

export interface PutObjectOptions {
  acl?:
    | "private"
    | "public-read"
    | "public-read-write"
    | "authenticated-read"
    | "aws-exec-read"
    | "bucket-owner-read"
    | "bucket-owner-full-control";

  /** Can be used to specify caching behavior along the request/reply chain. */
  cacheControl?: string;

  /** Specifies presentational information for the object. */
  contentDisposition?: string;

  /**
   * Specifies what content encodings have been applied to the object
   * and thus what decoding mechanisms must be applied to obtain the
   * media-type referenced by the Content-Type field.
   */
  contentEncoding?: string;

  /** The language the content is in. */
  contentLanguage?: string;

  /** A standard MIME type describing the format of the object data. */
  contentType?: string;

  /** The date and time at which the object is no longer cacheable. */
  expires?: Date;

  // TOOD: better structured data
  /** Gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object. */
  grantFullControl?: string;

  // TOOD: better structured data
  /** Allows grantee to read the object data and its metadata. */
  grantRead?: string;

  // TOOD: better structured data
  /** Allows grantee to write the ACL for the applicable object. */
  grantReadAcp?: string;

  // TOOD: better structured data
  /** Allows grantee to write the ACL for the applicable object. */
  grantWriteAcp?: string;

  /** Specifies whether a legal hold will be applied to this object. */
  legalHold?: boolean;

  /** The Object Lock mode that you want to apply to this object. */
  lockMode?: LockMode;

  /** The date and time when you want this object's Object Lock to expire. */
  lockRetainUntil?: Date;

  /**
   * If you don't specify, S3 Standard is the default storage class.
   * Amazon S3 supports other storage classes.
   */
  storageClass?: StorageClass;

  tags?: { [key: string]: string };

  /**
   * If the bucket is configured as a website, redirects requests for this
   * object to another object in the same bucket or to an external URL.
   * Amazon S3 stores the value of this header in the object metadata.
   */
  websiteRedirectLocation?: string;

  /**
   * User-defined object metadata passed as a number of key-value pairs
   * that are converted into `x-amz-meta-` prefixed key headers.
   */
  meta?: Record<string, string>;
}

export interface PutObjectResponse {
  /**
   * An ETag is an opaque identifier assigned by a web server to a
   * specific version of a resource found at a URL.
   */
  etag: string;

  /**
   * Version of the object.
   */
  versionId?: string;
}

export interface CopyObjectOptions {
  acl?:
    | "private"
    | "public-read"
    | "public-read-write"
    | "authenticated-read"
    | "aws-exec-read"
    | "bucket-owner-read"
    | "bucket-owner-full-control";

  /** Can be used to specify caching behavior along the request/reply chain. */
  cacheControl?: string;

  /** Specifies presentational information for the object. */
  contentDisposition?: string;

  /**
   * Specifies what content encodings have been applied to the object
   * and thus what decoding mechanisms must be applied to obtain the
   * media-type referenced by the Content-Type field.
   */
  contentEncoding?: string;

  /** The language the content is in. */
  contentLanguage?: string;

  /** A standard MIME type describing the format of the object data. */
  contentType?: string;

  /** The date and time at which the object is no longer cacheable. */
  expires?: Date;

  /**
   * Copy the object only if its entity tag (ETag) is the same as the one
   * specified, otherwise return a 412 (precondition failed).
   */
  copyOnlyIfMatch?: string;

  /**
   * Copy the object only if its entity tag (ETag) is different from the one
   * specified, otherwise return a 304 (not modified).
   */
  copyOnlyIfNoneMatch?: string;

  /**
   * Copy the object only if it has been modified since the specified time,
   * otherwise return a 304 (not modified).
   */
  copyOnlyIfModifiedSince?: Date;

  /**
   * Copy the object only if it has not been modified since the specified
   * time, otherwise return a 412 (precondition failed).
   */
  copyOnlyIfUnmodifiedSince?: Date;

  // TOOD: better structured data
  /** Gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object. */
  grantFullControl?: string;

  // TOOD: better structured data
  /** Allows grantee to read the object data and its metadata. */
  grantRead?: string;

  // TOOD: better structured data
  /** Allows grantee to write the ACL for the applicable object. */
  grantReadAcp?: string;

  // TOOD: better structured data
  /** Allows grantee to write the ACL for the applicable object. */
  grantWriteAcp?: string;

  /**
   * Specifies whether the metadata is copied from the source object or replaced
   * with metadata provided in the request.
   */
  metadataDirective?: CopyDirective;

  /** Specifies whether a legal hold will be applied to this object. */
  legalHold?: boolean;

  /** The Object Lock mode that you want to apply to this object. */
  lockMode?: LockMode;

  /** The date and time when you want this object's Object Lock to expire. */
  lockRetainUntil?: Date;

  /**
   * If you don't specify, S3 Standard is the default storage class.
   * Amazon S3 supports other storage classes.
   */
  storageClass?: StorageClass;

  tags?: { [key: string]: string };

  /**
   * Specifies whether the object tag-set are copied from the source object or
   * replaced with tag-set provided in the request.
   */
  taggingDirective?: CopyDirective;

  /**
   * If the bucket is configured as a website, redirects requests for this
   * object to another object in the same bucket or to an external URL.
   * Amazon S3 stores the value of this header in the object metadata.
   */
  websiteRedirectLocation?: string;
}

export interface CopyObjectResponse {
  /**
   * An ETag is an opaque identifier assigned by a web server to a
   * specific version of a resource found at a URL.
   */
  etag: string;

  /**
   * Version of the object.
   */
  versionId?: string;
}

export interface DeleteObjectOptions {
  versionId?: string;
}

export interface DeleteObjectResponse {
  versionID?: string;
  deleteMarker: boolean;
}

export type LocationConstraint =
  | "af-south-1"
  | "ap-east-1"
  | "ap-northeast-1"
  | "ap-northeast-2"
  | "ap-northeast-3"
  | "ap-south-1"
  | "ap-southeast-1"
  | "ap-southeast-2"
  | "ca-central-1"
  | "cn-north-1"
  | "cn-northwest-1"
  | "EU"
  | "Europe"
  | "eu-central-1"
  | "eu-north-1"
  | "eu-south-1"
  | "eu-west-1"
  | "eu-west-2"
  | "eu-west-3"
  | "me-south-1"
  | "sa-east-1"
  | "us-east-1"
  | "us-east-2"
  | "us-gov-east-1"
  | "us-gov-west-1"
  | "us-west-1"
  | "us-west-2";

export interface CreateBucketConfiguration {
  /**
   * Specifies the Region where the bucket will be created. If you don't
   * specify a Region, the bucket is created in the US East (N. Virginia)
   * Region (us-east-1).
   */
  locationConstraint?: LocationConstraint;
}

export interface CreateBucketOptions extends CreateBucketConfiguration {
  /** The canned ACL to apply to the bucket */
  acl?:
    | "private"
    | "public-read"
    | "public-read-write"
    | "authenticated-read";

  /** Specifies whether you want S3 Object Lock to be enabled for the new bucket. */
  bucketObjectLockEnabled?: string;

  /** Allows grantee the read, write, read ACP, and write ACP permissions on the bucket. */
  grantFullControl?: string;

  /** Allows grantee to list the objects in the bucket. */
  grantRead?: string;

  /** Allows grantee to read the bucket ACL. */
  grantReadAcp?: string;

  /**
   * Allows grantee to create new objects in the bucket.
   * For the bucket and object owners of existing objects, also allows deletions and overwrites of those objects.
   */
  grantWrite?: string;

  /** Allows grantee to write the ACL for the applicable bucket. */
  grantWriteAcp?: string;
}
