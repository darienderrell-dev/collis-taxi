# Collis Taxi — Setup (Convex)

Follow these steps in order. Total time: ~10 min if everything goes smoothly.

## 1. Install dependencies (your terminal)

```bash
cd ~/"Collis Taxi"
rm -rf node_modules package-lock.json
npm install
```

Takes 1-3 minutes.

## 2. First-time Convex sync

```bash
npx convex dev
```

This is the **only manual step you need** for backend setup. Here's what happens:

1. A browser tab opens to Convex; sign in with the same account you used to make `darien.derrell's team`.
2. It asks **"Create a new Convex project?"** → choose **Yes**, name it `collis-taxi`.
3. It asks which deployment to use → choose **Development** (default).
4. The CLI writes `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` into your `.env.local` automatically.
5. The CLI keeps running, watching `convex/*.ts` for changes and pushing them up. **Leave it running.**

Output looks like:
```
✔ Setup project collis-taxi
✔ Pushed deployment dev:fast-rabbit-123
Convex functions ready! (1.2s)
```

## 3. Seed the database with default zones + price matrix

Open a **second terminal** (leave `npx convex dev` running in the first one):

```bash
cd ~/"Collis Taxi"
npx convex run seed:run
```

You should see:
```
{
  "zones": 13,
  "pricesPairs": 91,
  "driverConfigCreated": true
}
```

## 4. Start the Next.js dev server

In the second terminal (still in the project folder):

```bash
npm run dev
```

Open http://localhost:3000.

## 5. Test signup

1. Click **Sign in / Sign up**
2. Enter a test name + phone (e.g. "Test User" / "555-1234")
3. Click **Continue**
4. You should land back on the home page with a green **"Signed in"** card showing your name + phone.

To verify in Convex:
- Open https://dashboard.convex.dev → your project → **Data** tab
- Open the `users` table — you should see one row with your name, phone, `role: client`, and a synthetic `email`.

## 6. When everything works, tell me

Reply **convex working** (or paste the error if anything broke) and we'll move on to the booking flow + driver dashboard in Session 2.

---

## Troubleshooting

**`npx convex dev` opens browser to log in but Convex says I have no team** — you may have signed up with one account in the dashboard and a different one in the CLI. Run `npx convex logout` then `npx convex dev` again, and pick the right account.

**Error: NEXT_PUBLIC_CONVEX_URL is not set** — `npx convex dev` hasn't finished its first sync yet. Wait until it prints "Convex functions ready!". Then restart `npm run dev` to pick up the new env var.

**Error: PHONE_AUTH_SECRET is not set** — Your `.env.local` is missing or you didn't restart `npm run dev` after the first `convex dev` write. Stop both dev servers, confirm `.env.local` has all three lines, then restart.

**Sign up errors with "Invalid credentials"** — The deterministic password is wrong because `PHONE_AUTH_SECRET` changed between sign-up and sign-in. If you regenerated the secret, the old users can't sign in anymore.
