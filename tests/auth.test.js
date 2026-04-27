/**
 * Auth Controller Tests
 * Run: npm test
 *
 * These tests mock mongoose and the NIBSS service so no real
 * network or database connections are needed.
 */

const request = require('supertest');
const mongoose = require('mongoose');

// ── Mock dependencies before requiring app ────────────────────────────────────

jest.mock('../src/services/nibss.service', () => ({
  validateBVN: jest.fn(),
  validateNIN: jest.fn(),
  createAccount: jest.fn(),
  getBalance: jest.fn(),
  nameEnquiry: jest.fn(),
  transfer: jest.fn(),
  getTransactionStatus: jest.fn(),
}));

jest.mock('../src/config/database', () => jest.fn().mockResolvedValue(true));

// Use in-memory MongoDB via mongoose mock
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return actual;
});

const nibssService = require('../src/services/nibss.service');
const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const validPayload = {
    firstName: 'Onyekachi',
    lastName: 'Obute',
    email: 'test@example.com',
    phone: '08012345678',
    password: 'password123',
    dob: '2005-04-04',
    kycType: 'bvn',
    kycID: '10840712847',
  };

  it('should return 422 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('should return 422 when kycID is not 11 digits', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, kycID: '123' });
    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid kycType', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, kycType: 'passport' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('should return 422 when email or password missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(422);
  });

  it('should return 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass123' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
  });
});

describe('Health check', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('404 handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
