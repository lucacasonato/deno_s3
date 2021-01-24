# deno_s3

![ci](https://github.com/lucacasonato/deno_aws_sign_v4/workflows/ci/badge.svg)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/s3@0.3.1/mod.ts)

Amazon S3 for Deno

> ⚠️ This project is work in progress. Expect breaking changes.

## Example

```ts
import { S3Bucket } from "https://deno.land/x/s3@0.3.1/mod.ts";

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

// Retrieve an object form a bucket.
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
