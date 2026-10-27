import csv
import io
import json
import os
import re
import secrets
import zipfile
from datetime import datetime, time, timedelta, timezone
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, redirect, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, decode_token, get_jwt_identity, jwt_required
from flask_sqlalchemy import SQLAlchemy
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", ROOT / "uploads"))
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"jpg", "jpeg", "png", "webp"}
ROLES = {"admin", "manager", "bartender", "car_wash_attendant", "cashier"}
WASH_STATUSES = ("Queued", "In Progress", "Ready", "Paid/Collected")
db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True)
    role = db.Column(db.String(32), nullable=False, default="bartender")
    pin_hash = db.Column(db.String(255), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    sub = db.Column(db.String(120), default="")
    image_url = db.Column(db.String(500), default="")
    is_service = db.Column(db.Boolean, nullable=False, default=False)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=10)
    bottle_tots = db.Column(db.Integer, nullable=False, default=0)
    tots_remaining = db.Column(db.Integer, nullable=False, default=0)
    happy_hour_price = db.Column(db.Integer)
    happy_hour_start = db.Column(db.String(5))
    happy_hour_end = db.Column(db.String(5))


class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(64), unique=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    department = db.Column(db.String(24), nullable=False, default="club")
    items_json = db.Column(db.Text, nullable=False)
    subtotal = db.Column(db.Integer, nullable=False)
    discount = db.Column(db.Integer, nullable=False, default=0)
    tip = db.Column(db.Integer, nullable=False, default=0)
    total = db.Column(db.Integer, nullable=False)
    payment_method = db.Column(db.String(24), nullable=False)
    payments_json = db.Column(db.Text, nullable=False, default="[]")
    change_due = db.Column(db.Integer, nullable=False, default=0)
    customer = db.Column(db.String(120), default="")
    phone = db.Column(db.String(40), default="")
    notes = db.Column(db.Text, default="")
    served_by = db.Column(db.String(120), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    discount_approved_by = db.Column(db.String(120), default="")


class WashJob(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    plate = db.Column(db.String(24), nullable=False)
    vehicle_type = db.Column(db.String(24), nullable=False)
    customer = db.Column(db.String(120), default="")
    phone = db.Column(db.String(40), default="")
    services_json = db.Column(db.Text, nullable=False)
    total = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(24), nullable=False, default="Queued")
    attendant_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    attendant_name = db.Column(db.String(120), default="")
    commission = db.Column(db.Integer, nullable=False, default=0)
    estimated_minutes = db.Column(db.Integer, nullable=False, default=30)
    sale_id = db.Column(db.Integer, db.ForeignKey("sale.id"))


class OpenTab(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer = db.Column(db.String(120), nullable=False)
    table_number = db.Column(db.String(24), default="")
    items_json = db.Column(db.Text, nullable=False, default="[]")
    status = db.Column(db.String(16), nullable=False, default="open")
    opened_by = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class Supplier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False)
    phone = db.Column(db.String(40), default="")
    email = db.Column(db.String(180), default="")
    notes = db.Column(db.Text, default="")


class StockMovement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    kind = db.Column(db.String(24), nullable=False)
    supplier = db.Column(db.String(140), default="")
    note = db.Column(db.String(255), default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    recorded_by = db.Column(db.String(120), nullable=False)


def make_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", f"sqlite:///{ROOT / 'noir-pos.sqlite3'}"
    ).replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-only-change-this-secret")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})
    db.init_app(app)
    JWTManager(app)

    with app.app_context():
        db.create_all()
        if not User.query.filter_by(role="admin").first():
            db.session.add(User(
                name=os.getenv("BOOTSTRAP_ADMIN_NAME", "Eric Muchina"),
                email=os.getenv("BOOTSTRAP_ADMIN_EMAIL", "eric@noir.co.ke"),
                role="admin",
                pin_hash=generate_password_hash(os.getenv("BOOTSTRAP_ADMIN_PIN", "1234")),
            ))
            db.session.commit()

    @app.errorhandler(413)
    def image_too_large(_error):
        return jsonify(error="Upload exceeds the 5 MB limit"), 413

    def current_user():
        identity = get_jwt_identity()
        return db.session.get(User, int(identity)) if identity else None

    def require_roles(*roles):
        def decorator(handler):
            @wraps(handler)
            @jwt_required()
            def wrapped(*args, **kwargs):
                user = current_user()
                if not user or not user.active:
                    return jsonify(error="Account is inactive"), 403
                if user.role not in roles:
                    return jsonify(error="Insufficient role"), 403
                return handler(*args, **kwargs)
            return wrapped
        return decorator

    def user_json(user):
        return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

    def product_json(product):
        return {
            "id": product.id, "name": product.name, "category": product.category,
            "price": product.price, "current_price": price_at(product),
            "stock": product.stock, "sub": product.sub,
            "image_url": product.image_url, "is_service": product.is_service,
            "low_stock_threshold": product.low_stock_threshold,
            "bottle_tots": product.bottle_tots, "tots_remaining": product.tots_remaining,
            "happy_hour_price": product.happy_hour_price,
            "happy_hour_start": product.happy_hour_start, "happy_hour_end": product.happy_hour_end,
        }

    def sale_json(sale):
        return {
            "id": sale.id, "timestamp": sale.created_at.isoformat(),
            "department": sale.department, "items": json.loads(sale.items_json),
            "subtotal": sale.subtotal, "discount": sale.discount, "tip": sale.tip,
            "total": sale.total, "method": sale.payment_method,
            "payments": json.loads(sale.payments_json), "change": sale.change_due,
            "customer": sale.customer, "phone": sale.phone, "notes": sale.notes,
            "servedBy": sale.served_by, "userId": sale.user_id,
            "discountApprovedBy": sale.discount_approved_by,
        }

    def job_json(job):
        return {
            "id": job.id, "created_at": job.created_at.isoformat(), "plate": job.plate,
            "vehicle_type": job.vehicle_type, "customer": job.customer, "phone": job.phone,
            "services": json.loads(job.services_json), "total": job.total,
            "status": job.status, "attendant_id": job.attendant_id,
            "attendant": job.attendant_name, "commission": job.commission,
            "estimated_minutes": job.estimated_minutes, "sale_id": job.sale_id,
        }

    def slugify(value):
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

    def price_at(product, timestamp=None):
        if not product.happy_hour_price or not product.happy_hour_start or not product.happy_hour_end:
            return product.price
        local_time = (timestamp or datetime.now(ZoneInfo("Africa/Nairobi"))).astimezone(ZoneInfo("Africa/Nairobi")).time()
        start = time.fromisoformat(product.happy_hour_start)
        end = time.fromisoformat(product.happy_hour_end)
        active = start <= local_time < end if start <= end else local_time >= start or local_time < end
        return product.happy_hour_price if active else product.price

    def record_sale(payload, user):
        client_id = payload.get("client_id")
        if client_id:
            existing = Sale.query.filter_by(client_id=client_id).first()
            if existing:
                return existing, 0
        lines = payload.get("items", [])
        if not lines:
            raise ValueError("Sale must contain at least one item")
        normalized = []
        subtotal = 0
        for line in lines:
            product_id = line.get("id", line.get("product_id"))
            if product_id is None:
                raise ValueError("Each sale item needs a product id")
            product = db.session.get(Product, int(product_id))
            if not product:
                product = Product(
                    id=int(product_id), name=line.get("name", "Product"),
                    category=line.get("category", "Beer"), price=int(line.get("price", 0)),
                    stock=int(line.get("stock", 0)), sub=line.get("sub", ""),
                    image_url=line.get("image_url", line.get("image", "")),
                    is_service=bool(line.get("is_service", line.get("category") in {"Car Wash", "Pool"})),
                )
                db.session.add(product)
                db.session.flush()
            quantity = int(line.get("qty", line.get("quantity", 0)))
            if quantity < 1:
                raise ValueError("Sale quantities must be positive")
            if not product.is_service and product.stock < quantity:
                raise ValueError(f"Insufficient stock for {product.name}")
            unit_price = price_at(product)
            line_total = unit_price * quantity
            normalized.append({
                "id": product.id, "name": product.name, "category": product.category,
                "price": unit_price, "qty": quantity, "note": line.get("note", ""),
                "line_total": line_total, "image_url": product.image_url,
            })
            if not product.is_service:
                product.stock -= quantity
                if product.bottle_tots:
                    product.tots_remaining = max(0, product.tots_remaining - quantity)
            subtotal += line_total

        discount_data = payload.get("discount", 0)
        discount = 0
        if isinstance(discount_data, dict):
            value = max(0, int(discount_data.get("value", 0)))
            discount = subtotal * value // 100 if discount_data.get("type") == "percent" else value
        else:
            discount = max(0, int(discount_data or 0))
        discount = min(discount, subtotal)
        approver_name = ""
        if discount and user.role not in {"admin", "manager"}:
            try:
                claims = decode_token(payload.get("discountApprovalToken", ""))
                approver = db.session.get(User, int(claims.get("sub", 0)))
                if claims.get("purpose") != "discount_approval" or not approver or approver.role not in {"admin", "manager"}:
                    raise ValueError
                approver_name = approver.name
            except Exception as error:
                raise PermissionError("A manager must approve discounts") from error
        elif discount:
            approver_name = user.name
        tip = max(0, int(payload.get("tip", 0)))
        total = subtotal - discount + tip
        payments = payload.get("payments") or [{"method": payload.get("method", "cash"), "amount": total}]
        paid = sum(max(0, int(payment.get("amount", 0))) for payment in payments)
        if paid < total:
            raise ValueError("Payment total is less than the sale total")
        if any(payment.get("method") not in {"cash", "mpesa", "card"} for payment in payments):
            raise ValueError("Unsupported payment method")
        payment_method = payments[0]["method"] if len(payments) == 1 else "split"
        cash_paid = sum(int(payment.get("amount", 0)) for payment in payments if payment.get("method") == "cash")
        change_due = max(0, paid - total) if len(payments) == 1 and payment_method == "cash" else 0
        sale = Sale(
            client_id=client_id,
            department=payload.get("department", "club"), items_json=json.dumps(normalized),
            subtotal=subtotal, discount=discount, tip=tip, total=total,
            payment_method=payment_method, payments_json=json.dumps(payments), change_due=change_due,
            customer=payload.get("customer", ""), phone=payload.get("phone", ""),
            notes=payload.get("notes", ""), served_by=user.name, user_id=user.id,
            discount_approved_by=approver_name,
        )
        db.session.add(sale)
        db.session.flush()
        return sale, cash_paid

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", database="connected")

    @app.get("/")
    def frontend():
        return redirect(os.getenv("FRONTEND_URL", "http://localhost:5173/"))

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        user = User.query.filter(db.func.lower(User.name) == str(payload.get("name", "")).lower()).first()
        if not user or not user.active or not check_password_hash(user.pin_hash, str(payload.get("pin", ""))):
            return jsonify(error="Invalid name or PIN"), 401
        return jsonify(access_token=create_access_token(identity=str(user.id)), user=user_json(user))

    @app.post("/api/auth/discount-approval")
    @jwt_required()
    def approve_discount():
        payload = request.get_json(silent=True) or {}
        manager = User.query.filter(db.func.lower(User.name) == str(payload.get("name", "")).lower()).first()
        if not manager or not manager.active or manager.role not in {"admin", "manager"} or not check_password_hash(manager.pin_hash, str(payload.get("pin", ""))):
            return jsonify(error="Manager PIN was not approved"), 403
        token = create_access_token(identity=str(manager.id), additional_claims={"purpose": "discount_approval"},
                                    expires_delta=timedelta(minutes=3))
        return jsonify(approval_token=token)

    @app.get("/api/auth/users")
    def login_profiles():
        return jsonify([{"id": user.id, "name": user.name, "role": user.role}
                        for user in User.query.filter_by(active=True).order_by(User.name).all()])

    @app.get("/api/auth/me")
    @require_roles(*ROLES)
    def who_am_i():
        return jsonify(user=user_json(current_user()))

    @app.get("/api/users")
    @require_roles("admin", "manager")
    def list_users():
        return jsonify([user_json(user) for user in User.query.order_by(User.name).all()])

    @app.post("/api/users")
    @require_roles("admin", "manager")
    def create_user():
        payload = request.get_json() or {}
        name = str(payload.get("name", "")).strip()
        role = payload.get("role", "bartender")
        pin = str(payload.get("pin", ""))
        if not name or len(pin) < 4 or role not in ROLES:
            return jsonify(error="Name, valid role, and a PIN of at least 4 characters are required"), 400
        user = User(name=name, email=payload.get("email") or None, role=role,
                    pin_hash=generate_password_hash(pin))
        db.session.add(user)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify(error="That email is already in use"), 409
        return jsonify(user_json(user)), 201

    @app.get("/api/products")
    @require_roles(*ROLES)
    def list_products():
        return jsonify([product_json(product) for product in Product.query.order_by(Product.category, Product.name).all()])

    @app.post("/api/products")
    @require_roles("admin", "manager")
    def create_product():
        payload = request.get_json() or {}
        name = str(payload.get("name", "")).strip()
        if not name or not payload.get("category"):
            return jsonify(error="Product name and category are required"), 400
        image_url = payload.get("image_url") or f"/drinks/{slugify(name)}.jpg"
        candidate = ROOT / "public" / image_url.lstrip("/")
        if not image_url.startswith(("http://", "https://", "/uploads/")) and not candidate.is_file():
            image_url = ""
        product = Product(
            name=name, category=payload["category"], price=max(0, int(payload.get("price", 0))),
            stock=max(0, int(payload.get("stock", 0))), sub=payload.get("sub", ""),
            image_url=image_url, is_service=bool(payload.get("is_service", payload["category"] in {"Car Wash", "Pool"})),
            low_stock_threshold=max(0, int(payload.get("low_stock_threshold", 10))),
            bottle_tots=max(0, int(payload.get("bottle_tots", 0))),
            tots_remaining=max(0, int(payload.get("tots_remaining", 0))),
            happy_hour_price=payload.get("happy_hour_price"),
            happy_hour_start=payload.get("happy_hour_start"), happy_hour_end=payload.get("happy_hour_end"),
        )
        db.session.add(product)
        db.session.commit()
        return jsonify(product_json(product)), 201

    @app.post("/api/products/seed")
    @require_roles("admin")
    def seed_products():
        if Product.query.first():
            return jsonify(imported=0, existing=True), 200
        payload = request.get_json() or {}
        for item in payload.get("products", []):
            db.session.add(Product(
                id=int(item["id"]), name=item["name"], category=item["category"],
                price=int(item["price"]), stock=int(item.get("stock", 0)),
                sub=item.get("sub", ""), image_url=item.get("image_url", item.get("image", "")),
                is_service=item.get("category") in {"Car Wash", "Pool"},
            ))
        db.session.commit()
        return jsonify(imported=len(payload.get("products", []))), 201

    @app.patch("/api/products/<int:product_id>")
    @require_roles("admin", "manager")
    def update_product(product_id):
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify(error="Product not found"), 404
        payload = request.get_json() or {}
        for field in ("name", "category", "sub", "image_url", "happy_hour_start", "happy_hour_end"):
            if field in payload:
                setattr(product, field, payload[field])
        for field in ("price", "stock", "low_stock_threshold", "bottle_tots", "tots_remaining", "happy_hour_price"):
            if field in payload:
                setattr(product, field, int(payload[field]) if payload[field] is not None else None)
        if "is_service" in payload:
            product.is_service = bool(payload["is_service"])
        db.session.commit()
        return jsonify(product_json(product))

    @app.delete("/api/products/<int:product_id>")
    @require_roles("admin", "manager")
    def delete_product(product_id):
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify(error="Product not found"), 404
        db.session.delete(product)
        db.session.commit()
        return jsonify(deleted=product_id)

    def save_image(file_storage, stem):
        extension = file_storage.filename.rsplit(".", 1)[-1].lower() if "." in file_storage.filename else ""
        if extension not in ALLOWED_IMAGE_TYPES:
            raise ValueError("Use a JPG, PNG, or WebP image")
        raw = file_storage.read(MAX_IMAGE_BYTES + 1)
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("Upload exceeds the 5 MB limit")
        try:
            image = Image.open(io.BytesIO(raw))
            image.verify()
            image = Image.open(io.BytesIO(raw)).convert("RGB")
        except (UnidentifiedImageError, OSError):
            raise ValueError("The uploaded file is not a valid image")
        image = ImageOps.fit(image, (400, 400), method=Image.Resampling.LANCZOS)
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{slugify(secure_filename(stem)) or secrets.token_hex(6)}.jpg"
        image.save(UPLOAD_DIR / filename, format="JPEG", quality=86, optimize=True)
        return filename

    @app.post("/api/products/<int:product_id>/image")
    @require_roles("admin", "manager")
    def upload_product_image(product_id):
        product = db.session.get(Product, product_id)
        image = request.files.get("image")
        if not product or not image:
            return jsonify(error="Product and image are required"), 400
        try:
            product.image_url = f"/uploads/{save_image(image, product.name)}"
        except ValueError as error:
            return jsonify(error=str(error)), 400
        db.session.commit()
        return jsonify(product_json(product))

    @app.post("/api/products/import")
    @require_roles("admin", "manager")
    def import_products():
        csv_file = request.files.get("csv")
        archive = request.files.get("images")
        if not csv_file:
            return jsonify(error="CSV file is required"), 400
        images = {}
        if archive:
            try:
                with zipfile.ZipFile(archive) as zipped:
                    for info in zipped.infolist():
                        if info.is_dir() or info.file_size > MAX_IMAGE_BYTES or ".." in Path(info.filename).parts:
                            continue
                        if Path(info.filename).suffix.lower().lstrip(".") in ALLOWED_IMAGE_TYPES:
                            images[slugify(Path(info.filename).stem)] = zipped.read(info)
            except zipfile.BadZipFile:
                return jsonify(error="Images upload must be a valid ZIP"), 400
        created = 0
        reader = csv.DictReader(io.TextIOWrapper(csv_file.stream, encoding="utf-8-sig"))
        for row in reader:
            name = (row.get("name") or "").strip()
            category = (row.get("category") or "").strip()
            if not name or not category:
                continue
            product = Product.query.filter(db.func.lower(Product.name) == name.lower(), Product.category == category).first()
            if not product:
                product = Product(name=name, category=category)
                db.session.add(product)
            product.price = int(row.get("price") or 0)
            product.stock = int(row.get("stock") or 0)
            product.sub = row.get("sub") or ""
            product.is_service = category in {"Car Wash", "Pool"}
            if slugify(name) in images:
                image = Image.open(io.BytesIO(images[slugify(name)])).convert("RGB")
                image = ImageOps.fit(image, (400, 400), method=Image.Resampling.LANCZOS)
                UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                filename = f"{slugify(name)}.jpg"
                image.save(UPLOAD_DIR / filename, format="JPEG", quality=86, optimize=True)
                product.image_url = f"/uploads/{filename}"
            elif (ROOT / "public" / "drinks" / f"{slugify(name)}.jpg").is_file():
                product.image_url = f"/drinks/{slugify(name)}.jpg"
            created += 1
        db.session.commit()
        return jsonify(imported=created), 200

    @app.post("/api/sales")
    @require_roles(*ROLES)
    def create_sale():
        try:
            sale, _cash_paid = record_sale(request.get_json() or {}, current_user())
            db.session.commit()
        except PermissionError as error:
            db.session.rollback()
            return jsonify(error=str(error)), 403
        except (ValueError, TypeError) as error:
            db.session.rollback()
            return jsonify(error=str(error)), 400
        result = sale_json(sale)
        if result["method"] == "mpesa":
            result["payment_note"] = "Mock M-Pesa payment recorded. TODO: connect Safaricom Daraja STK Push and callback verification."
        return jsonify(result), 201

    @app.get("/api/sales")
    @require_roles(*ROLES)
    def list_sales():
        limit = min(max(int(request.args.get("limit", 250)), 1), 1000)
        sales = Sale.query.order_by(Sale.created_at.desc()).limit(limit).all()
        return jsonify([sale_json(sale) for sale in sales])

    @app.get("/api/tabs")
    @require_roles(*ROLES)
    def list_tabs():
        return jsonify([{
            "id": tab.id, "customer": tab.customer, "table_number": tab.table_number,
            "items": json.loads(tab.items_json), "status": tab.status,
            "opened_by": tab.opened_by, "created_at": tab.created_at.isoformat(),
        } for tab in OpenTab.query.filter_by(status="open").order_by(OpenTab.created_at).all()])

    @app.post("/api/tabs")
    @require_roles("admin", "manager", "bartender", "cashier")
    def create_tab():
        payload = request.get_json() or {}
        customer = str(payload.get("customer", "")).strip()
        if not customer and not payload.get("table_number"):
            return jsonify(error="Customer name or table number is required"), 400
        tab = OpenTab(customer=customer or f"Table {payload['table_number']}",
                      table_number=str(payload.get("table_number", "")),
                      opened_by=current_user().name)
        db.session.add(tab)
        db.session.commit()
        return jsonify(id=tab.id, customer=tab.customer, table_number=tab.table_number, items=[]), 201

    @app.patch("/api/tabs/<int:tab_id>")
    @require_roles("admin", "manager", "bartender", "cashier")
    def update_tab(tab_id):
        tab = db.session.get(OpenTab, tab_id)
        if not tab or tab.status != "open":
            return jsonify(error="Open tab not found"), 404
        payload = request.get_json() or {}
        if "items" in payload:
            tab.items_json = json.dumps(payload["items"])
        if payload.get("close"):
            sale_payload = {**payload, "items": json.loads(tab.items_json), "customer": tab.customer}
            try:
                sale, _ = record_sale(sale_payload, current_user())
                tab.status = "closed"
                db.session.commit()
                return jsonify(sale_json(sale))
            except (PermissionError, ValueError, TypeError) as error:
                db.session.rollback()
                return jsonify(error=str(error)), 400
        db.session.commit()
        return jsonify(id=tab.id, customer=tab.customer, table_number=tab.table_number,
                       items=json.loads(tab.items_json), status=tab.status)

    @app.get("/api/wash/jobs")
    @require_roles(*ROLES)
    def list_wash_jobs():
        jobs = WashJob.query.filter(WashJob.status != "Paid/Collected").order_by(WashJob.created_at).all()
        return jsonify([job_json(job) for job in jobs])

    @app.post("/api/wash/jobs")
    @require_roles(*ROLES)
    def create_wash_job():
        payload = request.get_json() or {}
        plate = str(payload.get("plate", "")).strip().upper()
        services = payload.get("services", [])
        if not plate or not payload.get("vehicle_type") or not services:
            return jsonify(error="Plate, vehicle type, and at least one service are required"), 400
        total = sum(max(0, int(service.get("price", 0))) for service in services)
        attendant = db.session.get(User, int(payload["attendant_id"])) if payload.get("attendant_id") else None
        if attendant and attendant.role != "car_wash_attendant":
            return jsonify(error="Assigned user is not a car wash attendant"), 400
        job = WashJob(
            plate=plate, vehicle_type=payload["vehicle_type"], customer=payload.get("customer", ""),
            phone=payload.get("phone", ""), services_json=json.dumps(services), total=total,
            attendant_id=attendant.id if attendant else None, attendant_name=attendant.name if attendant else "",
            commission=max(0, int(payload.get("commission", 0))),
            estimated_minutes=max(5, int(payload.get("estimated_minutes", 30))),
        )
        db.session.add(job)
        db.session.commit()
        return jsonify(job_json(job)), 201

    @app.patch("/api/wash/jobs/<int:job_id>")
    @require_roles(*ROLES)
    def update_wash_job(job_id):
        job = db.session.get(WashJob, job_id)
        if not job:
            return jsonify(error="Wash job not found"), 404
        payload = request.get_json() or {}
        if "status" in payload:
            if payload["status"] not in WASH_STATUSES:
                return jsonify(error="Invalid wash-job status"), 400
            job.status = payload["status"]
        if "attendant_id" in payload:
            attendant = db.session.get(User, int(payload["attendant_id"])) if payload["attendant_id"] else None
            if attendant and attendant.role != "car_wash_attendant":
                return jsonify(error="Assigned user is not a car wash attendant"), 400
            job.attendant_id = attendant.id if attendant else None
            job.attendant_name = attendant.name if attendant else ""
        if "commission" in payload:
            job.commission = max(0, int(payload["commission"]))
        if job.status == "Paid/Collected" and not job.sale_id:
            user = current_user()
            if not isinstance(payload.get("payments"), list) or not payload["payments"]:
                db.session.rollback()
                return jsonify(error="Payment details are required to collect a wash job"), 400
            lines = [{"id": 900000 + job.id, "name": service["name"], "category": "Car Wash",
                      "price": int(service["price"]), "qty": int(service.get("qty", 1)),
                      "is_service": True} for service in json.loads(job.services_json)]
            try:
                sale, _ = record_sale({**payload, "items": lines, "department": "car_wash",
                                       "customer": job.customer, "phone": job.phone,
                                       "notes": f"Vehicle {job.plate}"}, user)
                job.sale_id = sale.id
            except (PermissionError, ValueError, TypeError) as error:
                db.session.rollback()
                return jsonify(error=str(error)), 400
        db.session.commit()
        return jsonify(job_json(job))

    @app.get("/api/attendants")
    @require_roles(*ROLES)
    def list_attendants():
        return jsonify([user_json(user) for user in User.query.filter_by(role="car_wash_attendant", active=True).all()])

    @app.post("/api/inventory/restock")
    @require_roles("admin", "manager")
    def restock_product():
        payload = request.get_json() or {}
        product = db.session.get(Product, int(payload.get("product_id", 0)))
        quantity = int(payload.get("quantity", 0))
        if not product or quantity <= 0:
            return jsonify(error="A valid product and positive quantity are required"), 400
        product.stock += quantity
        movement = StockMovement(product_id=product.id, quantity=quantity, kind="restock",
                                 supplier=payload.get("supplier", ""), note=payload.get("note", ""),
                                 recorded_by=current_user().name)
        db.session.add(movement)
        db.session.commit()
        return jsonify(product=product_json(product), movement_id=movement.id), 201

    @app.get("/api/inventory/movements")
    @require_roles("admin", "manager")
    def list_stock_movements():
        movements = StockMovement.query.order_by(StockMovement.created_at.desc()).limit(100).all()
        return jsonify([{
            "id": movement.id, "product_id": movement.product_id,
            "product": db.session.get(Product, movement.product_id).name if db.session.get(Product, movement.product_id) else "Deleted product",
            "quantity": movement.quantity, "kind": movement.kind,
            "supplier": movement.supplier, "note": movement.note,
            "created_at": movement.created_at.isoformat(), "recorded_by": movement.recorded_by,
        } for movement in movements])

    @app.get("/api/inventory/low-stock")
    @require_roles("admin", "manager")
    def low_stock():
        products = Product.query.filter(Product.is_service.is_(False), Product.stock <= Product.low_stock_threshold).all()
        return jsonify([product_json(product) for product in products])

    @app.get("/api/suppliers")
    @require_roles("admin", "manager")
    def list_suppliers():
        return jsonify([{"id": supplier.id, "name": supplier.name, "phone": supplier.phone,
                         "email": supplier.email, "notes": supplier.notes} for supplier in Supplier.query.all()])

    @app.post("/api/suppliers")
    @require_roles("admin", "manager")
    def create_supplier():
        payload = request.get_json() or {}
        name = str(payload.get("name", "")).strip()
        if not name:
            return jsonify(error="Supplier name is required"), 400
        supplier = Supplier(name=name, phone=payload.get("phone", ""), email=payload.get("email", ""),
                            notes=payload.get("notes", ""))
        db.session.add(supplier)
        db.session.commit()
        return jsonify(id=supplier.id, name=supplier.name, phone=supplier.phone, email=supplier.email,
                       notes=supplier.notes), 201

    @app.get("/api/reports/summary")
    @require_roles("admin", "manager")
    def report_summary():
        period = request.args.get("period", "daily")
        local_now = datetime.now(ZoneInfo("Africa/Nairobi"))
        if period == "daily":
            local_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "weekly":
            local_start = (local_now - timedelta(days=local_now.weekday())).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        elif period == "monthly":
            local_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return jsonify(error="period must be daily, weekly, or monthly"), 400
        sales = Sale.query.filter(
            Sale.created_at >= local_start.astimezone(timezone.utc),
            Sale.created_at <= local_now.astimezone(timezone.utc),
        ).all()
        departments = {key: sum(sale.total for sale in sales if sale.department == key)
                       for key in ("club", "car_wash")}
        top_items = {}
        hours = {}
        attendants = {}
        commissions = {}
        wash_jobs = {
            job.sale_id: job for job in WashJob.query.filter(WashJob.sale_id.isnot(None)).all()
        }
        for sale in sales:
            local = sale.created_at.astimezone(ZoneInfo("Africa/Nairobi"))
            hours[local.strftime("%H:00")] = hours.get(local.strftime("%H:00"), 0) + sale.total
            if sale.department == "car_wash":
                job = wash_jobs.get(sale.id)
                attendant = job.attendant_name if job and job.attendant_name else sale.served_by
                attendants[attendant] = attendants.get(attendant, 0) + sale.total
                if job:
                    commissions[attendant] = commissions.get(attendant, 0) + job.commission
            for item in json.loads(sale.items_json):
                top_items[item["name"]] = top_items.get(item["name"], 0) + int(item["qty"])
        return jsonify(period=period, total=sum(sale.total for sale in sales), sales_count=len(sales),
                       by_department=departments,
                       top_items=sorted(top_items.items(), key=lambda item: item[1], reverse=True)[:10],
                       busiest_hours=sorted(hours.items(), key=lambda item: item[1], reverse=True)[:5],
                       revenue_by_attendant=attendants, commission_by_attendant=commissions)

    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(UPLOAD_DIR, filename)

    return app


app = make_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")