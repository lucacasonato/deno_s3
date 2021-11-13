export {
  AWSSignerV4,
  toAmz,
  toDateStamp,
} from "https://deno.land/x/aws_sign_v4@1.0.1/mod.ts";
export type {
  Credentials,
  Signer,
} from "https://deno.land/x/aws_sign_v4@1.0.0/mod.ts";
import { createHash } from "https://deno.land/std@0.95.0/hash/mod.ts";
export function sha256Hex(data: string | Uint8Array): string {
  const hasher = createHash("sha256");
  hasher.update(data);
  return hasher.toString("hex");
}
export function md5(data: string | Uint8Array): string {
  const hasher = createHash("md5");
  hasher.update(data);
  return hasher.toString("base64");
}
export { default as parseXML } from "https://raw.githubusercontent.com/nekobato/deno-xml-parser/0bc4c2bd2f5fad36d274279978ca57eec57c680c/index.ts";
export { decode as decodeXMLEntities } from "https://deno.land/x/html_entities@v1.0/lib/xml-entities.js";
export { pooledMap } from "https://deno.land/std@0.95.0/async/pool.ts";
