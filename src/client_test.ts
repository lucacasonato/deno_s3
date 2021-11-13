import { assert, assertEquals, assertThrowsAsync } from "../test_deps.ts";
import { S3Error } from "./error.ts";
import { S3 } from "./client.ts";
import { encoder } from "./request.ts";

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

Deno.test({
  name: "[client] should get an existing bucket",
  async fn() {
    const bucket = await s3.getBucket("test");

    // Check if returned bucket instance is working.
    await bucket.putObject("test", encoder.encode("test"));
    const resp = await bucket.getObject("test");
    const body = await new Response(resp?.body).text();
    assertEquals(body, "test");

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "[client] should create a new bucket",
  async fn() {
    const bucket = await s3.createBucket("test2", {
      acl: "public-read-write",
    });

    // Check if returned bucket instance is working.
    await bucket.putObject("test", encoder.encode("test"));
    const resp = await bucket.getObject("test");
    const body = await new Response(resp?.body).text();
    assertEquals(body, "test");

    await assertThrowsAsync(
      () => s3.createBucket("test2"),
      S3Error,
      'Failed to create bucket "test2": 409 Conflict',
    );

    // teardown
    await bucket.deleteObject("test");
    await s3.deleteBucket("test2");
  },
});

Deno.test({
  name: "[client] should delete a bucket",
  async fn() {
    await s3.createBucket("test2");
    await s3.deleteBucket("test2");
    await assertThrowsAsync(
      () => s3.deleteBucket("test2"),
      S3Error,
      'Failed to delete bucket "test2": 404 Not Found',
    );
  },
});

Deno.test({
  name: "[client] should list all buckets",
  async fn() {
    const { buckets, owner } = await s3.listBuckets();
    assert(buckets.length, "no buckets available");
    assertEquals(buckets[0].name, "test");
    assert(
      buckets[0].creationDate instanceof Date,
      "creationDate is not of type Date",
    );
    assertEquals(owner.displayName, "minio");
  },
});
