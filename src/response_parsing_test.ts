import { assertEquals } from "../test_deps.ts";
import { S3Bucket } from "./bucket.ts";

const bucket: S3Bucket = Object.create(S3Bucket.prototype)

Deno.test("[response parsing]", async (t) => {
  await t.step("parseListObjectResponseXml", async (t) => {
    await t.step("commonPrefixes", () => {
      // https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html#API_ListObjectsV2_Example_8
      const xml = `<?xml version='1.0' encoding='utf-8' ?>
        <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
          <Name>example-bucket</Name>
          <Prefix>photos/2006/</Prefix>
          <Marker></Marker>
          <MaxKeys>1000</MaxKeys>
          <Delimiter>/</Delimiter>
          <IsTruncated>false</IsTruncated>
          <CommonPrefixes>
            <Prefix>photos/2006/February/</Prefix>
          </CommonPrefixes>
          <CommonPrefixes>
            <Prefix>photos/2006/January/</Prefix>
          </CommonPrefixes>
        </ListBucketResult>`;

      assertEquals(bucket["parseListObjectResponseXml"](xml).commonPrefixes, [
        { prefix: "photos/2006/February/" },
        { prefix: "photos/2006/January/" },
      ]);
    });

    await t.step("commonPrefixes with entity escapes", () => {
      const xml = `<?xml version='1.0' encoding='utf-8' ?>
        <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
          <Name>example-bucket</Name>
          <Prefix>photos/2006/</Prefix>
          <Marker></Marker>
          <MaxKeys>1000</MaxKeys>
          <Delimiter>/</Delimiter>
          <IsTruncated>false</IsTruncated>
          <CommonPrefixes>
            <Prefix>photos/2006/a&amp;b/</Prefix>
          </CommonPrefixes>
        </ListBucketResult>`;

      assertEquals(bucket["parseListObjectResponseXml"](xml).commonPrefixes, [
        { prefix: "photos/2006/a&b/" },
      ]);
    });
  });
});
