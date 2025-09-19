/**
 * Express middleware for validating incoming request authentication.
 *
 * Supports API key, basic auth, and bearer token authentication methods.
 * Uses secure string comparison to prevent timing-based attacks.
 */

import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthConfig } from "./domain.js";

/**
 * Authentication error class
 */
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthValidator {
  constructor(private readonly authConfig?: AuthConfig) {}

  /**
   * Express middleware factory that returns an authentication middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        this.validate(req);
        next();
      } catch (error) {
        if (error instanceof AuthError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    };
  }

  /**
   * Validate the request authentication
   */
  private validate(req: Request): void {
    if (!this.authConfig) {
      return;
    }

    switch (this.authConfig.type) {
      case "api_key":
        this.verifyApiKey(req);
        break;
      case "basic":
        this.verifyBasicAuth(req);
        break;
      case "bearer":
        this.verifyBearerToken(req);
        break;
      default:
        throw new AuthError(500, "Unknown auth type");
    }
  }

  private verifyApiKey(req: Request): void {
    if (this.authConfig?.type !== "api_key") {
      throw new AuthError(500, "Invalid auth config");
    }

    const headerValue = req.headers[this.authConfig.headerName.toLowerCase()] as string;
    if (!headerValue) {
      throw new AuthError(401, `Missing ${this.authConfig.headerName} header`);
    }

    if (!this.secureCompare(headerValue, this.authConfig.apiKey)) {
      throw new AuthError(401, "Invalid API key");
    }
  }

  private verifyBasicAuth(req: Request): void {
    if (this.authConfig?.type !== "basic") {
      throw new AuthError(500, "Invalid auth config");
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Basic ")) {
      throw new AuthError(401, "Missing or invalid Authorization header");
    }

    try {
      const encodedCredentials = authorization.slice(6); // Remove "Basic "
      const decoded = Buffer.from(encodedCredentials, "base64").toString("utf-8");
      const colonIndex = decoded.indexOf(":");

      if (colonIndex === -1) {
        throw new AuthError(401, "Invalid Basic auth format");
      }

      const username = decoded.slice(0, colonIndex);
      const password = decoded.slice(colonIndex + 1);

      if (
        !this.secureCompare(username, this.authConfig.username) ||
        !this.secureCompare(password, this.authConfig.password)
      ) {
        throw new AuthError(401, "Invalid credentials");
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(401, "Invalid Basic auth format");
    }
  }

  private verifyBearerToken(req: Request): void {
    if (this.authConfig?.type !== "bearer") {
      throw new AuthError(500, "Invalid auth config");
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new AuthError(401, "Missing or invalid Authorization header");
    }

    const token = authorization.slice(7); // Remove "Bearer "
    if (!this.secureCompare(token, this.authConfig.token)) {
      throw new AuthError(401, "Invalid bearer token");
    }
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a, "utf8");
    const bufferB = Buffer.from(b, "utf8");

    return timingSafeEqual(bufferA, bufferB);
  }
}
