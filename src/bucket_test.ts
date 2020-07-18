import { assert, assertEquals, assertThrowsAsync } from "../test_deps.ts";
import { S3Bucket } from "./bucket.ts";
import { S3Error } from "./error.ts";

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
    ).catch((e) => console.log(e.response));
  },
});

Deno.test({
  name: "get object success",
  async fn() {
    const res = await bucket.getObject("test");
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
    await assertThrowsAsync(
      () => bucket.getObject("test2"),
      S3Error,
      "404 Not Found",
    );
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
    await assertThrowsAsync(
      () => bucket.getObject("test"),
      S3Error,
      "404 Not Found",
    );
  },
});
