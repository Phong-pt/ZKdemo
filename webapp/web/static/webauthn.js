// Minh Chứng — thin WebAuthn helpers shared by auth.js.
// No client library: builds the exact JSON shape py_webauthn expects
// (id, rawId, type, response.{clientDataJSON, attestationObject|
// authenticatorData+signature+userHandle}), all as base64url strings.

function bufToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

async function webauthnRegister(optionsJSON) {
  const publicKey = {
    ...optionsJSON,
    challenge: base64urlToBuf(optionsJSON.challenge),
    user: { ...optionsJSON.user, id: base64urlToBuf(optionsJSON.user.id) },
    excludeCredentials: (optionsJSON.excludeCredentials || []).map((c) => ({
      ...c,
      id: base64urlToBuf(c.id),
    })),
  };

  const credential = await navigator.credentials.create({ publicKey });

  return {
    id: credential.id,
    rawId: bufToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufToBase64url(credential.response.clientDataJSON),
      attestationObject: bufToBase64url(credential.response.attestationObject),
    },
  };
}

async function webauthnAuthenticate(optionsJSON) {
  const publicKey = {
    ...optionsJSON,
    challenge: base64urlToBuf(optionsJSON.challenge),
    allowCredentials: (optionsJSON.allowCredentials || []).map((c) => ({
      ...c,
      id: base64urlToBuf(c.id),
    })),
  };

  const credential = await navigator.credentials.get({ publicKey });

  return {
    id: credential.id,
    rawId: bufToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    response: {
      clientDataJSON: bufToBase64url(credential.response.clientDataJSON),
      authenticatorData: bufToBase64url(credential.response.authenticatorData),
      signature: bufToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufToBase64url(credential.response.userHandle)
        : null,
    },
  };
}
