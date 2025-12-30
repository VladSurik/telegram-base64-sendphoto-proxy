module.exports = async function usercode(data) {
  // у Corezoid часто data.post_data приходить як object або string
  let payload = data && data.post_data ? data.post_data : data;
  if (typeof payload === "string") payload = JSON.parse(payload);

  return {
    ok: true,
    got_keys: Object.keys(payload || {}),
    has_token: !!(payload && payload.token),
    has_chat_id: !!(payload && payload.chat_id),
    has_base64: !!(payload && payload.base64),
    base64_len: payload && payload.base64 ? payload.base64.length : 0
  };
};
