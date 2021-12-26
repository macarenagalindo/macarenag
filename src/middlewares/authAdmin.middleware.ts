import { MiddlewareFn } from "type-graphql";
import { verify } from "jsonwebtoken";
import { Response, Request } from "express";
import { environment } from "../config/environment";

export interface IContext {
  req: Request;
  res: Response;
  payload: { adminId: string };
}

export const isAuthAdmin: MiddlewareFn<IContext> = ({ context }, next) => {
  try {
    const bearerAdminToken = context.req.headers["authorization"];

    if (!bearerAdminToken) {
      throw new Error("Unauthorized");
    }

    const jwt = bearerAdminToken.split(" ")[1];
    const payload = verify(jwt, environment.JWTADMIN_SECRET);
    context.payload = payload as any;
  } catch (e) {
    throw new Error(e);
  }

  return next();
};
