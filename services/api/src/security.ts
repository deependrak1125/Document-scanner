import type { ClientSession } from "mongoose";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { DeviceSession, User } from "./models.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export interface Identity {
  userId: string;
  sessionId: string;
  role: string;
}
declare module "express-serve-static-core" {
  interface Request {
    identity?: Identity;
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function issueTokens(
  userId: string,
  deviceId: string,
  familyId: string = randomUUID(),
  mongoSession?: ClientSession,
) {
  const refreshToken = randomBytes(48).toString("base64url");
  const [session] = await DeviceSession.create(
    [
      {
        userId,
        deviceId,
        familyId,
        refreshTokenHash: hash(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 86400000),
        lastActiveAt: new Date(),
      },
    ],
    { session: mongoSession },
  );
  const accessToken = jwt.sign({ sid: session.id }, config.JWT_SECRET, {
    subject: userId,
    issuer: "folio",
    audience: "folio-app",
    expiresIn: "15m",
  });
  return { accessToken, refreshToken };
}
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, "Sign in to continue.");
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "folio",
        audience: "folio-app",
      }) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Session expired.");
    }
    const [user, session] = await Promise.all([
      User.findById(payload.sub),
      DeviceSession.findOne({
        _id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }),
    ]);
    if (!user || !session || user.accountStatus !== "active")
      throw new HttpError(401, "Session is no longer active.");
    req.identity = { userId: user.id, sessionId: session.id, role: user.role! };
    next();
  } catch (error) {
    next(error);
  }
}
export function admin(req: Request, _res: Response, next: NextFunction) {
  next(
    req.identity?.role === "admin"
      ? undefined
      : new HttpError(403, "Administrator access required."),
  );
}
export function identity(req: Request) {
  if (!req.identity) throw new HttpError(401, "Authentication required.");
  return req.identity;
}
