import * as process from 'process';

export default () => ({
  AAIO_API: process.env.AAIO_API,
  AAIO_API_KEY: process.env.AAIO_API_KEY,
  AAIO_ID: process.env.AAIO_ID,
  AAIO_SECOND_SECRET: process.env.AAIO_SECOND_SECRET,
  AAIO_SECRET: process.env.AAIO_SECRET,
  AAIO_URL: process.env.AAIO_URL,
  AFFILIATE_BASE_URL: process.env.AFFILIATE_BASE_URL,
  BOVA_API_KEY: process.env.BOVA_API_KEY,
  BOVA_BASE_URL: process.env.BOVA_BASE_URL,
  BOVA_MERCHANT_BASE_URL: process.env.BOVA_MERCHANT_BASE_URL,
  BOVA_USERID_KEY: process.env.BOVA_USERID_KEY,
  GREENGO_API_KEY: process.env.GREENGO_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  ODDSCORP_AUTH_KEY: process.env.ODDSCORP_AUTH_KEY,
  ODDSCORP_WS_URL: 'ws://api.oddscp.com:8001',
  PASSWORD_HASH_SALT: 13,
  PAYLINK_API_KEY: process.env.PAYLINK_API_KEY,
  PAYLINK_BASE_URL: process.env.PAYLINK_BASE_URL,
  PAYLINK_MERCH_ID: process.env.PAYLINK_MERCH_ID,
  SUPERUSER_TOKEN: process.env.SUPERUSER_TOKEN,
});
