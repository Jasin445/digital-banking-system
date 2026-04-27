/**
 * Account Controller Tests
 */

const request = require('supertest');

jest.mock('../src/services/nibss.service', () => ({
  validateBVN: jest.fn(),
  validateNIN: jest.fn(),
  createAccount: jest.fn(),
  getBalance: jest.fn().mockResolvedValue({ balance: 15000 }),
  nameEnquiry: jest.fn(),
  transfer: jest.fn(),
  getTransactionStatus: jest.fn(),
}));

jest.mock('../src/config/database', () => jest.fn().mockResolvedValue(true));

const app = require('../src/app');

describe('Account Routes — unauthenticated', () => {
  it('POST /api/accounts/create returns 401 without token', async () => {
    const res = await request(app).post('/api/accounts/create');
    expect(res.status).toBe(401);
  });

  it('GET /api/accounts/me returns 401 without token', async () => {
    const res = await request(app).get('/api/accounts/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/accounts/balance returns 401 without token', async () => {
    const res = await request(app).get('/api/accounts/balance');
    expect(res.status).toBe(401);
  });

  it('GET /api/accounts/name-enquiry/:no returns 401 without token', async () => {
    const res = await request(app).get('/api/accounts/name-enquiry/1234567890');
    expect(res.status).toBe(401);
  });
});
