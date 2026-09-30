// Client-side JWT expiry check — no signature verification (the client
// can't validate the signature meaningfully anyway), just reads the `exp`
// claim so we don't keep trusting a cached backend token past its TTL.
export const isJwtExpired = (token, bufferSeconds = 30) => {
  if (!token) return true;
  try {
    const payloadSegment = token.split('.')[1];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp - bufferSeconds;
  } catch {
    return true;
  }
};
