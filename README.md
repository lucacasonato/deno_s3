# deno_s3

![ci](https://github.com/lucacasonato/deno_aws_sign_v4/workflows/ci/badge.svg)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/s3@0.4.1/mod.ts)
[![Coverage Status](https://coveralls.io/repos/github/lucacasonato/deno_s3/badge.svg?branch=main)](https://coveralls.io/github/lucacasonato/deno_s3?branch=main)

Amazon S3 for Deno

> ⚠️ This project is work in progress. Expect breaking changes.

## Example

```ts
import { S3, S3Bucket } from "https://deno.land/x/s3@0.4.1/mod.ts";

// Create a new bucket.
const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

const myBucket = await s3.createBucket("my-bucket", { acl: "private" });

// Create a bucket instance from an existing bucket.
const bucket = new S3Bucket({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  bucket: "test",
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

const encoder = new TextEncoder();

// Put an object into a bucket.
await bucket.putObject("test", encoder.encode("Test1"), {
  contentType: "text/plain",
});

// Retrieve an object from a bucket.
const { body } = await bucket.getObject("test");
const data = await new Response(body).text();
console.log("File 'test' contains:", data);

// List objects in the bucket.
const list = bucket.listAllObjects({});
for await (const obj of list) {
  console.log("Item in bucket:", obj.key);
}

// Delete an object from a bucket.
await bucket.deleteObject("test");
```

## Contributing

To run tests you need to Docker and docker-compose installed.

```
make test
```
