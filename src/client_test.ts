import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertThrowsAsync,
} from "../test_deps.ts";
import { S3Error } from "./error.ts";
import { S3Bucket } from "./bucket.ts";
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
    assert(bucket instanceof S3Bucket);

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
    const bucket = await s3.createBucket("test.bucket", {
      acl: "public-read-write",
    });
    assert(bucket instanceof S3Bucket);

    // Check if returned bucket instance is working.
    await bucket.putObject("test", encoder.encode("test"));
    const resp = await bucket.getObject("test");
    const body = await new Response(resp?.body).text();
    assertEquals(body, "test");

    // teardown
    await bucket.deleteObject("test");
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

Deno.test({
  name: "[client] should put a bucket versioning configuration",
  async fn() {
    await s3.putBucketVersioning("test.bucket", { status: "Enabled" });

    let resp = await s3.getBucketVersioning("test.bucket");
    assertEquals(resp, { status: "Enabled" });

    // teardown
    await s3.putBucketVersioning("test.bucket", { status: "Suspended" });

    resp = await s3.getBucketVersioning("test.bucket");
    assertEquals(resp, { status: "Suspended" });
  },
});

Deno.test({
  name: "[client] should list object versions",
  async fn() {
    await s3.putBucketVersioning("test.bucket", { status: "Enabled" });
    const bucket = s3.getBucket("test.bucket");

    await bucket.putObject("test", encoder.encode("test1"));
    await bucket.deleteObject("test");
    await bucket.putObject("test", encoder.encode("test1"));

    const resp = await s3.listObjectVersions("test.bucket");

    assertObjectMatch(resp, {
      delimiter: undefined,
      encodingType: undefined,
      isTruncated: false,
      keyMarker: undefined,
      maxKeys: 1000,
      name: "test.bucket",
      nextKeyMarker: undefined,
      nextVersionIdMarker: undefined,
      prefix: undefined,
      versionIdMarker: undefined,
    });

    assert(resp.versions);
    assert(resp.deleteMarkers);
    assertEquals(resp.versions.length, 2);
    assertEquals(resp.deleteMarkers.length, 1);

    assertObjectMatch(resp.deleteMarkers[0], {
      prefix: undefined,
      isLatest: false,
      key: "test",
      owner: {
        displayName: "minio",
      },
    });

    assertObjectMatch(resp.versions[0], {
      isLatest: true,
      key: "test",
      owner: {
        displayName: "minio",
      },
      prefix: undefined,
      size: 5,
      storageClass: "STANDARD",
    });

    assertObjectMatch(resp.versions[1], {
      isLatest: false,
      key: "test",
      owner: {
        displayName: "minio",
      },
      prefix: undefined,
      size: 5,
      storageClass: "STANDARD",
    });

    // teardown
    await s3.putBucketVersioning("test.bucket", { status: "Suspended" });

    if (resp.versions) {
      for (const version of resp.versions) {
        await bucket.deleteObject("test", { versionId: version.versionId });
      }
    }

    if (resp.deleteMarkers) {
      for (const deleteMarker of resp.deleteMarkers) {
        await bucket.deleteObject("test", {
          versionId: deleteMarker.versionId,
        });
      }
    }
  },
});
