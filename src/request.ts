import type { Signer } from "../deps.ts";

export interface Params {
  [key: string]: string;
}

export const encoder = new TextEncoder();

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
  const url = path == "/" ? new URL(host) : new URL(encodeURIS3(path), host);
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
  
  const contentHash = await sha256Hex(body ?? "");
  request.headers.set("x-amz-content-sha256", contentHash);
  const signedRequest = await signer.sign("s3", request);
  if (body) {
    signedRequest.headers.set("content-length", body.length.toFixed(0));
  }
  return fetch(signedRequest);
}

export function encodeURIS3(input: string): string {
  let result = "";
  for (const ch of input) {
    if (
      (ch >= "A" && ch <= "Z") ||
      (ch >= "a" && ch <= "z") ||
      (ch >= "0" && ch <= "9") ||
      ch == "_" ||
      ch == "-" ||
      ch == "~" ||
      ch == "."
    ) {
      result += ch;
    } else if (ch == "/") {
      result += "/";
    } else {
      result += stringToHex(ch);
    }
  }
  return result;
}

function stringToHex(input: string) {
  return [...encoder.encode(input)]
    .map((s) => "%" + s.toString(16))
    .join("")
    .toUpperCase();
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
