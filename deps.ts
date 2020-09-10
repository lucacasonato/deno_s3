export { AWSSignerV4 } from "https://deno.land/x/aws_sign_v4@0.1.0/mod.ts";
import { createHash } from "https://deno.land/std@0.68.0/hash/mod.ts";
export function sha256Hex(data: string | Uint8Array): string {
  const hasher = createHash("sha256");
  hasher.update(data);
  return hasher.toString("hex");
}
