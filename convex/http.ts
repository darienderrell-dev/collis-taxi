import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Wires up Convex Auth's HTTP routes (token refresh, OAuth callbacks, etc.).
auth.addHttpRoutes(http);

export default http;
