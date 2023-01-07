import { Base64, Base64Url } from "./brand"

// eslint-disable-next-line @typescript-eslint/naming-convention
export function toBase64URL_0(base64: Base64): Base64Url {
  return base64.replaceAll("+", "-").replaceAll("/", "_") as Base64Url
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function fromBase64URL_0(base64url: Base64Url): Base64 {
  return base64url.replaceAll("-", "+").replaceAll("_", "/") as Base64
}
