import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "dentalpro_secret_key_2026_super_secure";

export interface AuthUser {
  userId: number;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Faça login para continuar" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.auth = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  }
};

// Perfis que podem tomar decisões clínicas (revisar achados, mudar preços).
export const requireRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res
        .status(403)
        .json({ error: "Seu perfil não tem permissão para esta ação" });
    }
    next();
  };
