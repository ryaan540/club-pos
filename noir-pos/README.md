# Noir Club + Car Wash POS

React, Vite, and Tailwind tablet/phone POS with an optional Flask API. Without `VITE_API_URL`, the app keeps its local-first browser mode. With the API configured, staff, products, sales, wash jobs, inventory, and reports are shared through SQLAlchemy.

## Frontend

```sh
npm install
npm run dev
```

For shared API mode, create `noir-pos/.env.local` with `VITE_API_URL=http://localhost:5000`. Restart Vite after changing environment variables.

Drink image lookup prefers an uploaded `image_url`, then tries `public/drinks/<slug>.svg` and `<slug>.jpg`. Generate the original local drink illustrations with `node scripts/generate_drink_art.mjs`. Missing images show product initials. Admins can use `POST /api/products/<id>/image` or the CSV+ZIP import endpoint to upload image overrides.

## Flask API

```sh
cd noir-pos
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
python backend/app.py
```

The default local database is `noir-pos.sqlite3`. Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL for shared deployment, for example `postgresql+psycopg://user:password@localhost/noirpos`. Configure `JWT_SECRET_KEY` with a unique secret and set `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PIN` before first startup. The development bootstrap PIN defaults to `1234`; it must be changed before use outside a disposable local environment. `UPLOAD_DIR` controls image storage. Set `CORS_ORIGINS` to a comma-separated frontend-origin allowlist in deployment.

The first admin seeds the existing product catalog when it is empty. API login uses the selected staff name and PIN. Admins/managers can create staff with `POST /api/users`; supported roles are `admin`, `manager`, `bartender`, `car_wash_attendant`, and `cashier`.

## API Areas

- JWT login, staff roles, product catalog, local image uploads, and CSV+ZIP import
- Sales with inventory deduction, happy-hour prices, cash change, tips, manager-approved discounts, and split cash/M-Pesa/card tender
- Open tabs, car-wash jobs and queue states, attendant assignment, and service commissions
- Stock restocking, supplier records, low-stock alerts, and daily/weekly/monthly summaries

M-Pesa is currently recorded as a clearly identified mock. Daraja STK Push, asynchronous callback verification, and reconciliation are TODOs; do not treat the mock as proof of payment. Protect production deployments with HTTPS and a managed PostgreSQL service, and back up the database and upload directory.
