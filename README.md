# Task Tracker

## Local development

1. Copy `Back/.env.example` to `Back/.env` and set your Supabase URL, server-only secret key, and a random `JWT_SECRET` of at least 32 bytes.
2. Copy `Front/.env.example` to `Front/.env`.
3. Install dependencies and start the backend:

   ```powershell
   cd Back
   npm install
   node index.js
   ```

4. In another terminal, start the frontend:

   ```powershell
   cd Front
   npm install
   npm run dev
   ```

## Custom login

Login uses the Supabase `users` table with `id`, `name`, `email`, and `password_hash` columns. `name` is the username; `name` and `email` should be unique, and passwords must be bcrypt hashes. There is no public sign-up route.

The backend issues an eight-hour JWT in an HttpOnly cookie and verifies it on protected routes. The `GET /api/tasks` endpoint returns only rows assigned to the signed-in user's `id`. The existing database column is spelled `user_assigened_id`; the API exposes it as `user_assigned_id`.

Keep `SUPABASE_SECRET_KEY` and `JWT_SECRET` only in `Back/.env`; never add them to frontend environment variables or commit `.env` files.
