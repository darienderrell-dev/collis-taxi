import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Phone-only signup. Email is synthesized client-side from the phone.
 *
 * Staff convention: if a user signs up with the literal phone string
 * "DRIVER" or "ADMIN", they're auto-assigned the corresponding role.
 * Everyone else is `client`. This is the only "auth" the driver/admin
 * dashboards need — the role on the profile decides what they see.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const phone = ((params.phone as string) ?? "").trim();
        let role: "client" | "driver" | "admin" = "client";
        if (phone === "DRIVER") role = "driver";
        else if (phone === "ADMIN") role = "admin";
        return {
          email: params.email as string,
          name: (params.name as string) ?? "",
          phone,
          role,
        };
      },
    }),
  ],
});
