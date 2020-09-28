import { S3Bucket } from "./src/bucket.ts";

const s3 = new S3Bucket({
  region: "ca-central-1",
  accessKeyID: "AKIA3BRL",
  secretKey: "eRpvX",
  bucket: "foobar",
});

const ls = await s3.listObjects({
  prefix: "",
  maxKeys: 10,
});

console.log(ls);

if (ls?.nextContinuationToken) {
  const ls2 = await s3.listObjects({
    continuationToken: ls.nextContinuationToken,
  });

  console.log(ls2);
}
