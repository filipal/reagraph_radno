from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Konfiguracija baze i JWT tajne
app.config["SQLALCHEMY_DATABASE_URI"] = (
    # "postgresql://postgres:123456@localhost:5432/login_db"
    "sqlite:///local.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "tajna"

# Ekstenzije
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# ------------------ MODELI ------------------


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)

    role = db.relationship(
        "UserRole", backref="user", uselist=False, cascade="all, delete"
    )


class UserRole(db.Model):
    __tablename__ = "users_role"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    role = db.Column(db.String(20), nullable=False)


# ------------------ RUTA: SIGNUP ------------------


@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()

        if User.query.filter(
            (User.username == data["username"]) | (User.email == data["email"])
        ).first():
            return jsonify(error="Username or email already exists"), 409

        hashed_pw = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

        user = User(
            username=data["username"], email=data["email"], password_hash=hashed_pw
        )
        db.session.add(user)
        db.session.commit()

        # All new users are automatically assigned the 'viewer' role
        auth = UserRole(user_id=user.id, role="admin")  # !!! treba promeniti u viewer
        db.session.add(auth)
        db.session.commit()

        return jsonify(message="User created successfully"), 201

    except Exception as e:
        print("SIGNUP ERROR:", e)
        return jsonify(error="Signup failed on server"), 500


# ------------------ RUTA: LOGIN ------------------


@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        user = User.query.filter(
            (User.username == data["identifier"]) | (User.email == data["identifier"])
        ).first()

        if user and bcrypt.check_password_hash(user.password_hash, data["password"]):
            user_role = UserRole.query.filter_by(user_id=user.id).first()

            if not user_role:
                return jsonify(error="User role not found"), 403

            # Token uključuje id i rolu (u "sub" polju)
            access_token = create_access_token(
                identity={"id": user.id, "role": user_role.role}
            )
            return jsonify(access_token=access_token)

        return jsonify(error="Invalid credentials"), 401

    except Exception as e:
        print("LOGIN ERROR:", e)
        return jsonify(error="Login failed on server"), 500


# ------------------ RUTA: ME ------------------
@app.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = get_jwt_identity()
    return jsonify(user=user)


# ------------------ RUTA: ADMIN-ONLY ------------------


@app.route("/admin-area", methods=["GET"])
@jwt_required()
def admin_area():
    user = get_jwt_identity()
    if user["role"] != "admin":
        return jsonify(error="Access forbidden"), 403
    return jsonify(message="Welcome, admin!")


# ------------------ RUTA: DOWNLOAD (available to all users) ------------------


@app.route("/download", methods=["GET"])
@jwt_required()
def download():
    return jsonify(message="Here is your file...")


# ------------------ RUTA: DELETE (admin-only) ------------------


@app.route("/delete-item/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_item(item_id):
    user = get_jwt_identity()
    if user["role"] != "admin":
        return jsonify(error="Only admins can delete."), 403
    return jsonify(message=f"Item {item_id} deleted.")


# ------------------ RUTA: EDIT (admin-only) ------------------


@app.route("/edit-item/<int:item_id>", methods=["PUT"])
@jwt_required()
def edit_item(item_id):
    user = get_jwt_identity()
    if user["role"] != "admin":
        return jsonify(error="Only admins can edit."), 403
    return jsonify(message=f"Item {item_id} edited.")


# ------------------ CREATING TABLES ------------------

with app.app_context():
    db.create_all()


# ------------------ MAIN ------------------

if __name__ == "__main__":
    app.run(debug=True)



