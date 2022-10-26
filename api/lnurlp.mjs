import UnaConnect from "una-connect-js/dist/index.js";
import crypto from "crypto";
import fetch from "node-fetch";

export default async function handler(request, response) {
  const _username = process.env.NAME;
  const _domain = process.env.DOMAIN;
  const _identifier = `${_username}@${_domain}`;
  const _lnurlpUrl = `https://${_domain}/.well-known/lnurlp/${_username}`;
  const _metadata = [
    ["text/identifier", _identifier],
    ["text/plain", `Satoshis to ${_identifier}`],
  ];
  const minSendable = process.env.MIN_SENDABLE || 1000000;
  const maxSendable = process.env.MAX_SENDABLE || 1000000000000;

  if (!request.query.amount) {
    return response.status(200).json({
      status: "OK",
      callback: _lnurlpUrl,
      tag: "payRequest",
      maxSendable,
      minSendable,
      metadata: JSON.stringify(_metadata),
      commentAllowed: 0,
    });
  }

  let amountMsats = request.query.amount;
  if (amountMsats < minSendable) {
    return response.status(200).json({
      status: "ERROR",
      reason:
        "Amount should be in milliSats and can't be under minSendable params",
    });
  }

  let bolt11 = "";

  const unaConnect = new UnaConnect(
    process.env.NOSTR_PRIVATE_KEY,
    process.env.NOSTR_REMOTE_PUBKEY_KEY
  );

  const metadata = JSON.stringify(_metadata);
  const descriptionHash = crypto
    .createHash("sha256")
    .update(metadata)
    .digest("hex");

  let routingMsats = 0;
  if (process.env.LNPROXY_URL) {
    const lnproxyBaseMsat = process.env.LNPROXY_BASE_FEE || 1000;
    const lnproxyPpmMsat = process.env.LNPROXY_PPM_FEE || 6000;
    routingMsats =
      +lnproxyBaseMsat + (+lnproxyPpmMsat * amountMsats) / 1_000_000;
    amountMsats = amountMsats - routingMsats;
  }

  const result = await unaConnect.createInvoice({
    amountMsats,
    descriptionHash,
  });

  bolt11 = result.bolt11;

  if (process.env.LNPROXY_URL) {
    const res = await fetch(
      `${process.env.LNPROXY_URL}/api/${bolt11}?routing_msat=${routingMsats}`,
      {
        method: "GET",
      }
    );

    const invoiceProxy = await res.text();
    bolt11 = invoiceProxy.replace("\n", "");
  }

  response.status(200).json({
    status: "OK",
    successAction: { tag: "message", message: "Payment received!" },
    routes: [],
    pr: bolt11,
    disposable: false,
  });
}
