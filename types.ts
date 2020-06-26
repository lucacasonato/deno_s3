export interface PutObjectOptions {
  acl: "private" | "public-read" | "public-read-write" | "authenticated-read" | "aws-exec-read" | "bucket-owner-read" | "bucket-owner-full-control"
}
export interface PutObjectResponse {
  etag: string;
}
