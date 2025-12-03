/**
 * Authentication middleware tests
 */

import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { AuthError, AuthValidator } from "../src/auth.js";
import { createAPIKeyAuth, createBasicAuth, createBearerTokenAuth } from "../src/domain.js";

// Mock Express request/response objects
const mockRequest = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers: headers,
});

const mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const mockNext = jest.fn();

describe("AuthValidator", () => {
  beforeEach(() => {
    mockNext.mockClear();
  });

  test("should pass when no auth config is provided", () => {
    const validator = new AuthValidator();
    const middleware = validator.middleware();

    const req = mockRequest();
    const res = mockResponse();

    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  describe("API Key Authentication", () => {
    test("should pass with valid API key", () => {
      const authConfig = createAPIKeyAuth("X-API-Key", "secret-key");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest({ "x-api-key": "secret-key" });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test("should fail with missing API key", () => {
      const authConfig = createAPIKeyAuth("X-API-Key", "secret-key");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should fail with invalid API key", () => {
      const authConfig = createAPIKeyAuth("X-API-Key", "secret-key");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest({ "x-api-key": "wrong-key" });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Basic Authentication", () => {
    test("should pass with valid credentials", () => {
      const authConfig = createBasicAuth("user", "pass");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      // Base64 encode "user:pass"
      const credentials = Buffer.from("user:pass").toString("base64");
      const req = mockRequest({ authorization: `Basic ${credentials}` });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test("should fail with missing authorization header", () => {
      const authConfig = createBasicAuth("user", "pass");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should fail with invalid credentials", () => {
      const authConfig = createBasicAuth("user", "pass");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const credentials = Buffer.from("wrong:credentials").toString("base64");
      const req = mockRequest({ authorization: `Basic ${credentials}` });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should fail with malformed authorization header", () => {
      const authConfig = createBasicAuth("user", "pass");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest({ authorization: "Basic invalid-base64!" });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Bearer Token Authentication", () => {
    test("should pass with valid token", () => {
      const authConfig = createBearerTokenAuth("secret-token");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest({ authorization: "Bearer secret-token" });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test("should fail with missing authorization header", () => {
      const authConfig = createBearerTokenAuth("secret-token");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("should fail with invalid token", () => {
      const authConfig = createBearerTokenAuth("secret-token");
      const validator = new AuthValidator(authConfig);
      const middleware = validator.middleware();

      const req = mockRequest({ authorization: "Bearer wrong-token" });
      const res = mockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("AuthError", () => {
    test("should create auth error with status and message", () => {
      const error = new AuthError(401, "Unauthorized");

      expect(error.status).toBe(401);
      expect(error.message).toBe("Unauthorized");
      expect(error.name).toBe("AuthError");
    });
  });
});
