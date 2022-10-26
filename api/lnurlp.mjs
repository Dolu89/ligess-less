import UnaConnect from "una-connect-js/dist/index.js";
import crypto from "crypto";

export default async function handler(request, response) {
  const _username = process.env.NAME;
  const _domain = process.env.DOMAIN;
  const _identifier = `${_username}@${_domain}`;
  const _lnurlpUrl = `https://${_domain}/.well-known/lnurlp/${_username}`;
  const _metadata = [
    ["text/identifier", _identifier],
    ["text/plain", `Satoshis to ${_identifier}`],
  ];

  if (!request.query.amount) {
    return response.status(200).json({
      status: "OK",
      callback: _lnurlpUrl,
      tag: "payRequest",
      maxSendable: 100000000,
      minSendable: 1000,
      metadata: JSON.stringify(_metadata),
      commentAllowed: 0,
    });
  }

  const unaConnect = new UnaConnect(
    process.env.NOSTR_PRIVATE_KEY,
    process.env.NOSTR_REMOTE_PUBKEY_KEY
  );

  const metadata = JSON.stringify(_metadata);
  const description = crypto
    .createHash("sha256")
    .update(metadata)
    .digest("hex");

  const result = await unaConnect.createInvoice(
    request.query.amount,
    description
  );

  response.status(200).json({
    status: "OK",
    successAction: { tag: "message", message: "Payment received!" },
    routes: [],
    pr: result.bolt11,
    disposable: false,
  });
}
