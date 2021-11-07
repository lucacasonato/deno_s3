import { assert, assertEquals, assertThrowsAsync } from "../test_deps.ts";
import { S3Error } from "./error.ts";
import { S3Bucket } from "./bucket.ts";
import { S3 } from "./client.ts";
import { encoder } from "./request.ts";

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: Deno.env.get("S3_REGION")!,
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

Deno.test({
  name: "[client] should get a bucket",
  async fn() {
    const resp = await s3.headBucket("test");
    assertEquals(resp, {
      bucketRegion: "us-east-1",
      accessPointAlias: false,
    });
  },
});

Deno.test({
  name:
    "[client] should throw when getting a bucket if the bucket does not exist",
  async fn() {
    await assertThrowsAsync(
      () => s3.headBucket("not-existing-bucket"),
      S3Error,
      'Failed to get bucket "not-existing-bucket": 404 Not Found',
    );
  },
});

Deno.test({
  name: "[client] should create a new bucket",
  async fn() {
    const bucket = await s3.createBucket("test.bucket", {
      acl: "public-read-write",
    });
    assert(bucket instanceof S3Bucket);

    // Check if returned bucket instance is working.
    await bucket.putObject("foo", encoder.encode("bar"));
    const resp = await bucket.getObject("foo");
    const body = await new Response(resp?.body).text();
    assertEquals(body, "bar");

    // teardown
    await bucket.deleteObject("foo");
    // @TODO: delete also bucket once s3.deleteBucket is implemented.
  },
});

Deno.test({
  name:
    "[client] should throw when creating a bucket if the bucket already exists",
  async fn() {
    await assertThrowsAsync(
      () => s3.createBucket("test.bucket"),
      S3Error,
      'Failed to create bucket "test.bucket": 409 Conflict',
    );
  },
});
