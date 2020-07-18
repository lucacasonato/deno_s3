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

export interface GetObjectResponse {
  /** The body of this object. */
  body: Uint8Array;

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
   * */
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

  // TODO: accept-ranges
  // TODO: Content-Range
  // TODO: x-amz-expiration
  // TODO: x-amz-restore
}

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

export interface DeleteObjectOptions {
  versionId?: string;
}

export interface DeleteObjectResponse {
  versionID?: string;
  deleteMarker: boolean;
}
