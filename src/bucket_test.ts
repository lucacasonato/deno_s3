import { assert, assertEquals } from "../test_deps.ts";
import { S3Bucket } from "./bucket.ts";

const bucket = new S3Bucket({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  bucket: "test",
  region: "us-east-1",
  endpointURL: Deno.env.get("S3_ENDPOINT_URL"),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

Deno.test({
  name: "put object",
  async fn() {
    const res = await bucket.putObject(
      "test",
      encoder.encode("Test1"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "put object with % in key",
  async fn() {
    const res = await bucket.putObject(
      "ltest/versions/1.0.0/raw/fixtures/%",
      encoder.encode("Test1"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject("ltest/versions/1.0.0/raw/fixtures/%");
  },
});

Deno.test({
  name: "put object with @ in key",
  async fn() {
    const res = await bucket.putObject(
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
  name: "put object with 日本語 in key",
  async fn() {
    const res = await bucket.putObject(
      "servest/versions/1.0.0/raw/fixtures/日本語.txt",
      encoder.encode("bla"),
      { contentType: "text/plain" },
    );

    // teardown
    await bucket.deleteObject("servest/versions/1.0.0/raw/fixtures/日本語.txt");
  },
});

Deno.test({
  name: "head object success",
  async fn() {
    // setup
    await bucket.putObject(
      "test",
      encoder.encode("Test1"),
      { contentType: "text/plain" },
    );

    const head = await bucket.headObject("test");
    assert(head);
    assertEquals(head?.etag, "e1b849f9631ffc1829b2e31402373e3c");
    assertEquals(head?.contentType, "text/plain");
    assertEquals(head?.contentLength, 5);
    assertEquals(head?.storageClass, "STANDARD");
    assertEquals(head?.deleteMarker, false);
    assert(new Date() >= (head?.lastModified ?? new Date(0)));

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "head object not found",
  async fn() {
    assertEquals(await bucket.headObject("test2"), undefined);
  },
});

Deno.test({
  name: "get object success",
  async fn() {
    // setup
    await bucket.putObject(
      "test",
      encoder.encode("Test1"),
      { contentType: "text/plain" },
    );

    const res = await bucket.getObject("test");
    assert(res);
    assertEquals(decoder.decode(res?.body), "Test1");
    assertEquals(res?.etag, "e1b849f9631ffc1829b2e31402373e3c");
    assertEquals(res?.contentType, "text/plain");
    assertEquals(res?.contentLength, 5);
    assertEquals(res?.storageClass, "STANDARD");
    assertEquals(res?.deleteMarker, false);
    assert(new Date() >= (res?.lastModified ?? new Date(0)));

    // teardown
    await bucket.deleteObject("test");
  },
});

Deno.test({
  name: "get object not found",
  async fn() {
    assertEquals(await bucket.getObject("test2"), undefined);
  },
});

Deno.test({
  name: "delete object",
  async fn() {
    // setup
    await bucket.putObject("test", encoder.encode("test"));

    assert(await bucket.getObject("test"));
    assertEquals(
      await bucket.deleteObject("test"),
      { deleteMarker: false, versionID: undefined },
    );
    assertEquals(await bucket.getObject("test"), undefined);
  },
});

Deno.test({
  name: "copy object",
  async fn() {
    await bucket.putObject(
      "test3",
      encoder.encode("Test1"),
    );
    await bucket.copyObject("test3", "test4", {
      contentType: "text/plain",
      metadataDirective: "REPLACE",
    }).catch((e) => console.log(e.response));
    const res = await bucket.getObject("test4");
    assert(res);
    assertEquals(res?.contentType, "text/plain");
    assertEquals(res?.contentLength, 5);
    assertEquals(res?.contentType, "text/plain");

    // teardown
    await bucket.deleteObject("test3");
    await bucket.deleteObject("test4");
  },
});

Deno.test({
  name: "list objects",
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

      const next = await bucket.listObjects(
        { maxKeys: 3, continuationToken: res3?.nextContinuationToken },
      );
      assert(next);
      assertEquals(next?.isTruncated, true);
      assertEquals(next?.maxKeys, 3);
      assertEquals(next?.keyCount, 3);
      assert(next?.nextContinuationToken);

      const last = await bucket.listObjects(
        { continuationToken: next?.nextContinuationToken },
      );
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
  name: "empty bucket",
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
