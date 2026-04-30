const axios = require('axios');

const NIBSS_BASE = process.env.NIBSS_BASE_URL || 'https://nibssbyphoenix.onrender.com';

let nibssToken = null;
let nibssTokenExpiry = null;
let nibssTokenPromise = null;
// console.log(nibssToken)

const nibssClient = axios.create({ baseURL: NIBSS_BASE });

/**
 * Authenticate with NIBSS and cache the token (valid ~1 hour).
 */
const getNibssToken = async () => {
  const now = Date.now();

  // Return cached token if still valid
  if (nibssToken && nibssTokenExpiry && now < nibssTokenExpiry - 60_000) {
    // console.log(nibssToken)
    return nibssToken;
  }

  // if a fetch is already in flight, reuse it
  if (nibssTokenPromise) {
    return nibssTokenPromise;
  }

  nibssTokenPromise = (async () => {
    try {
      const { data } = await nibssClient.post('/api/auth/token', {
        apiKey: process.env.NIBSS_API_KEY,
        apiSecret: process.env.NIBSS_API_SECRET,
      });

      nibssToken = data.token;

      const base64 = nibssToken.split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const payload = JSON.parse(
        Buffer.from(base64, 'base64').toString()
      );

      nibssTokenExpiry = payload.exp * 1000;
      // console.log(nibssToken)
      return nibssToken;
    } catch (err) {
      nibssToken = null;
      nibssTokenExpiry = null;
      console.error('NIBSS TOKEN ERROR:', err.message);
      throw new Error('Failed to fetch NIBSS token');
    } finally {
      nibssTokenPromise = null;
    }
  })();

  return nibssTokenPromise;
};

const authHeader = async () => {
  const token = await getNibssToken();
  return { headers: { Authorization: `Bearer ${token}` } };
};

/**
 * Almost every NIBSS response has this shape:
 * { success: true, message: '...', data: { ... } }
 *
 * This helper returns the full response body so controllers
 * can access both response.success and response.data as needed.
 */
const nibssService = {

  // ── Identity Registration ─────────────────────────────────────────────────

  async insertBVN({ bvn, firstName, lastName, dob, phone }) {
    // const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/insertBvn', { bvn, firstName, lastName, dob, phone });
    return data; // { success, message, data: { bvn, ... } }
  },

  async insertNIN({ nin, firstName, lastName, dob }) {
    // const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/insertNin', { nin, firstName, lastName, dob });
    return data; // { success, message, data: { nin, ... } }
  },

  // ── Identity Validation ───────────────────────────────────────────────────

  async validateBVN(bvn) {
    const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/validateBvn', { bvn }, cfg);
    return data; // { success, message, data: { bvn, firstName, lastName, dob, phone } }
  },

  async validateNIN(nin) {
    const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/validateNin', { nin }, cfg);
    return data; // { success, message, data: { nin, firstName, lastName, dob } }
  },

  // ── Account ───────────────────────────────────────────────────────────────

  async createAccount(kycType, kycID, dob) {
    const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/account/create', { kycType, kycID, dob }, cfg);
    return data; // { success, message, data: { accountNumber, bankCode, bankName, balance } }
  },

  async getAllAccounts() {
    const cfg = await authHeader();
    const { data } = await nibssClient.get('/api/accounts', cfg);
    return data; // { success, message, data: { accounts: [...] } }
  },

  async nameEnquiry(accountNumber) {
    const cfg = await authHeader();
    const { data } = await nibssClient.get(`/api/account/name-enquiry/${accountNumber}`, cfg);
    return data; // { success, message, data: { accountNumber, accountName, bankName } }
  },

  async getBalance(accountNumber) {
    const cfg = await authHeader();
    const { data } = await nibssClient.get(`/api/account/balance/${accountNumber}`, cfg);
    return data; // { success, message, data: { accountNumber, balance } }
  },

  // ── Transfer ─────────────────────────────────────────────────────────────

  async transfer(from, to, amount) {
    const cfg = await authHeader();
    const { data } = await nibssClient.post('/api/transfer', { from, to, amount: String(amount) }, cfg);
    return data; // { success, message, data: { transactionId, amount, from, to, status } }
  },

  async getTransactionStatus(transactionId) {
    const cfg = await authHeader();
    const { data } = await nibssClient.get(`/api/transaction/${transactionId}`, cfg);
    return data; // { success, message, data: { transactionId, status, amount, ... } }
  },
};

module.exports = nibssService;
