import { encodeUriS3 } from "../deps.ts";
import type { Signer } from "../deps.ts";

const encoder = new TextEncoder();

export interface Params {
  [key: string]: string;
}

interface S3RequestOptions {
  host: string;
  signer: Signer;
  method: string;
  path?: string;
  params?: Params;
  headers?: Params;
  body?: Uint8Array | undefined;
}

export async function doRequest({
  host,
  signer,
  path = "/",
  params,
  method,
  headers,
  body,
}: S3RequestOptions): Promise<Response> {
  const url = path == "/" ? new URL(host) : new URL(encodeUriS3(path), host);
  if (params) {
    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }
  }
  const request = new Request(url.toString(), {
    headers,
    method,
    body,
  });

  const signedRequest = await signer.sign("s3", request);
  const contentHash = await sha256Hex(body ?? "");
  signedRequest.headers.set("x-amz-content-sha256", contentHash);
  if (body) {
    signedRequest.headers.set("content-length", body.length.toFixed(0));
  }
  return fetch(signedRequest);
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  if (typeof data === "string") {
    data = encoder.encode(data);
  }
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
