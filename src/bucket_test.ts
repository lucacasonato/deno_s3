import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertThrowsAsync,
} from "../test_deps.ts";
import { S3Bucket } from "./bucket.ts";
import { S3Error } from "./error.ts";
import type { Policy } from "./types.ts";

const bucket = new S3Bucket({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  bucket: "test",
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

const versioningBucket = new S3Bucket({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  bucket: "versioning-test",
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

const encoder = new TextEncoder();

const policy: Policy = {
  version: "2012-10-17",
  id: "test",
  statement: [
    {
      effect: "Allow",
      principal: {
        AWS: ["111122223333", "444455556666"],
      },
      action: [
        "s3:PutObject",
      ],
      resource: [
        "arn:aws:s3:::*",
      ],
    },
  ],
};

Deno.test({
  name: "[bucket] put object",
  async fn() {
    await bucket.putObject("test", encoder.encode("Test1"), {
      contentType: "text/plain",
    });

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "[bucket] put object with % in key",
  async fn() {
    await bucket.putObject(
      "ltest/versions/1.0.0/raw/fixtures/%",
      encoder.encode("Test1"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject("ltest/versions/1.0.0/raw/fixtures/%");
  },
});

Deno.test({
  name: "[bucket] put object with @ in key",
  async fn() {
    await bucket.putObject(
      "dex/versions/1.0.0/raw/lib/deps/interpret@2.0.0/README.md",
      encoder.encode("bla"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject(
      "dex/versions/1.0.0/raw/lib/deps/interpret@2.0.0/README.md",
    );
  },
});

Deno.test({
  name: "[bucket] put object with 日本語 in key",
  async fn() {
    await bucket.putObject(
      "servest/versions/1.0.0/raw/fixtures/日本語.txt",
      encoder.encode("bla"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject("servest/versions/1.0.0/raw/fixtures/日本語.txt");
  },
});

Deno.test({
  name: "[bucket] head object success",
  async fn() {
    // setup
    await bucket.putObject("test", encoder.encode("Test1"), {
      contentType: "text/plain",
      meta: { foo: "bar", baz: "qux" },
    });

    const head = await bucket.headObject("test");
    assert(head);
    assertEquals(head?.etag, "e1b849f9631ffc1829b2e31402373e3c");
    assertEquals(head?.contentType, "text/plain");
    assertEquals(head?.meta, { foo: "bar", baz: "qux" });
    assertEquals(head?.contentLength, 5);
    assertEquals(head?.storageClass, "STANDARD");
    assertEquals(head?.deleteMarker, false);
    assert(new Date() >= (head?.lastModified ?? new Date(0)));

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "[bucket] head object not found",
  async fn() {
    assertEquals(await bucket.headObject("test2"), undefined);
  },
});

Deno.test({
  name: "[bucket] get object success",
  async fn() {
    // setup
    await bucket.putObject("test", encoder.encode("Test1"), {
      contentType: "text/plain",
      meta: { foo: "bar", baz: "qux" },
    });

    const res = await bucket.getObject("test");
    assert(res);
    const body = await new Response(res.body).text();
    assertEquals(body, "Test1");
    assertEquals(res?.etag, "e1b849f9631ffc1829b2e31402373e3c");
    assertEquals(res?.contentType, "text/plain");
    assertEquals(res?.meta, { foo: "bar", baz: "qux" });
    assertEquals(res?.contentLength, 5);
    assertEquals(res?.storageClass, "STANDARD");
    assertEquals(res?.deleteMarker, false);
    assert(new Date() >= (res?.lastModified ?? new Date(0)));

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "[bucket] get object not found",
  async fn() {
    assertEquals(await bucket.getObject("test2"), undefined);
  },
});

Deno.test({
  name: "[bucket] delete object",
  async fn() {
    // setup
    await bucket.putObject("test", encoder.encode("test"));

    const res = await bucket.getObject("test");
    assert(res);
    await res.body.cancel();
    assertEquals(await bucket.deleteObject("test"), {
      deleteMarker: false,
      versionID: undefined,
    });
    assertEquals(await bucket.getObject("test"), undefined);
  },
});

Deno.test({
  name: "[bucket] copy object",
  async fn() {
    await bucket.putObject("test3", encoder.encode("Test1"));
    await bucket
      .copyObject("test3", "test4", {
        contentType: "text/plain",
        metadataDirective: "REPLACE",
      })
      .catch((e) => console.log(e.response));
    const res = await bucket.getObject("test4");
    assert(res);
    await res.body.cancel();
    assertEquals(res?.contentType, "text/plain");
    assertEquals(res?.contentLength, 5);
    assertEquals(res?.contentType, "text/plain");

    // teardown
    await bucket.deleteObject("test3");
    await bucket.deleteObject("test4");
  },
});

Deno.test({
  name: "[bucket] list objects",
  async fn() {
    // setup
    const content = encoder.encode("Test1");
    const keys = [
      "fooz",
      "bar",
      "foo/sub2",
      "foo/sub3/subsub",
      "baz",
      "fruits/blueberry",
      "fruits/banana",
      "fruits/strawberry",
      "fruits/apple",
      "fruits/orange",
    ];

    try {
      for (const k of keys) {
        await bucket.putObject(k, content, { contentType: "text/plain" });
      }

      const res = await bucket.listObjects();
      assert(res);
      assertEquals(res?.isTruncated, false);
      // assertEquals(res?.maxKeys, 1000);
      assertEquals(res?.keyCount, 10);

      const res3 = await bucket.listObjects({ maxKeys: 3 });
      assert(res3);
      assertEquals(res3?.isTruncated, true);
      assertEquals(res3?.maxKeys, 3);
      assertEquals(res3?.keyCount, 3);
      assert(res3?.nextContinuationToken);

      const next = await bucket.listObjects({
        maxKeys: 3,
        continuationToken: res3?.nextContinuationToken,
      });
      assert(next);
      assertEquals(next?.isTruncated, true);
      assertEquals(next?.maxKeys, 3);
      assertEquals(next?.keyCount, 3);
      assert(next?.nextContinuationToken);

      const last = await bucket.listObjects({
        continuationToken: next?.nextContinuationToken,
      });
      assert(last);
      assertEquals(last?.isTruncated, false);
      // assertEquals(last?.maxKeys, 1000);
      assertEquals(last?.keyCount, 4);
      // assert(last?.continuationToken);
      assertEquals(last?.nextContinuationToken, undefined);

      const res4 = bucket.listAllObjects({ batchSize: 3 });
      assert(last);
      const res4Keys = [];
      for await (const object of res4) {
        res4Keys.push(object.key);
      }
      assertEquals(res4Keys, [
        "bar",
        "baz",
        "foo/sub2",
        "foo/sub3/subsub",
        "fooz",
        "fruits/apple",
        "fruits/banana",
        "fruits/blueberry",
        "fruits/orange",
        "fruits/strawberry",
      ]);
    } finally {
      // teardown
      for (const k of keys) {
        await bucket.deleteObject(k);
      }
    }
  },
});

Deno.test({
  name: "[bucket] empty bucket",
  async fn() {
    // setup
    const content = encoder.encode("Test1");
    const keys = [
      "fooz",
      "bar",
      "foo/sub2",
      "foo/sub3/subsub",
      "baz",
      "fruits/blueberry",
      "fruits/banana",
      "fruits/strawberry",
      "fruits/apple",
      "fruits/orange",
    ];

    for (const k of keys) {
      await bucket.putObject(k, content, { contentType: "text/plain" });
    }

    const deleted = await bucket.empty();
    deleted.sort();
    keys.sort();
    assertEquals(deleted, keys);
  },
});

Deno.test({
  name: "[bucket] should put a bucket policy",
  async fn() {
    await bucket.putBucketPolicy({ policy });

    // teardown
    await bucket.deleteBucketPolicy();
  },
});

Deno.test({
  name: "[bucket] should get a bucket policy",
  async fn() {
    await bucket.putBucketPolicy({ policy });
    const resp = await bucket.getBucketPolicy();
    assertEquals(resp, policy);

    // teardown
    await bucket.deleteBucketPolicy();
  },
});

Deno.test({
  name: "[bucket] should delete a bucket policy",
  async fn() {
    await bucket.putBucketPolicy({ policy });
    const resp = await bucket.getBucketPolicy();
    assert(resp);

    // teardown
    await bucket.deleteBucketPolicy();

    await assertThrowsAsync(
      () => bucket.getBucketPolicy(),
      S3Error,
      "Failed to get bucket policy: 404 Not Found",
    );
  },
});

Deno.test({
  name: "[bucket] should get the bucket policy status",
  async fn() {
    const resp = await bucket.getBucketPolicyStatus();
    assertEquals(resp, { isPublic: false });
  },
});

Deno.test({
  name: "[bucket] should put a bucket versioning configuration",
  async fn() {
    await versioningBucket.putBucketVersioning({ status: "Enabled" });

    let resp = await versioningBucket.getBucketVersioning();
    assertEquals(resp, { status: "Enabled" });

    // teardown
    await versioningBucket.putBucketVersioning({ status: "Suspended" });

    resp = await versioningBucket.getBucketVersioning();
    assertEquals(resp, { status: "Suspended" });
  },
});

Deno.test({
  name: "[bucket] should list object versions",
  async fn() {
    await versioningBucket.putBucketVersioning({ status: "Enabled" });

    await versioningBucket.putObject("test", encoder.encode("test1"));
    await versioningBucket.deleteObject("test");
    await versioningBucket.putObject("test", encoder.encode("test2"));

    const resp = await versioningBucket.listObjectVersions();

    assertObjectMatch(resp, {
      delimiter: undefined,
      encodingType: undefined,
      isTruncated: false,
      keyMarker: undefined,
      maxKeys: 1000,
      name: "versioning-test",
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
    await versioningBucket.putBucketVersioning({ status: "Suspended" });

    if (resp.versions) {
      for (const version of resp.versions) {
        await versioningBucket.deleteObject("test", {
          versionId: version.versionId,
        });
      }
    }

    if (resp.deleteMarkers) {
      for (const deleteMarker of resp.deleteMarkers) {
        await versioningBucket.deleteObject("test", {
          versionId: deleteMarker.versionId,
        });
      }
    }
  },
});
