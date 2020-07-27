import { assert, assertEquals } from "../test_deps.ts";
import { S3Bucket } from "./bucket.ts";

const bucket = new S3Bucket({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  bucket: "test",
  region: "us-east-1",
  endpointURL: "http://localhost:9000",
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
  },
});

Deno.test({
  name: "get object success",
  async fn() {
    const res = await bucket.getObject("test");
    assert(res);
    assertEquals(decoder.decode(res.body), "Test1");
    assertEquals(res.etag, "e1b849f9631ffc1829b2e31402373e3c");
    assertEquals(res.contentType, "text/plain");
    assertEquals(res.contentLength, 5);
    assertEquals(res.storageClass, "STANDARD");
    assertEquals(res.deleteMarker, false);
    assert(res.lastModified < new Date());
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
    assertEquals(res.contentType, "text/plain");
    assertEquals(res.contentLength, 5);
    assertEquals(res.contentType, "text/plain");
  },
});
