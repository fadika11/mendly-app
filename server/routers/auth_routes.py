# server/routers/auth_routes.py
import os
import smtplib
import secrets
import string
import re
import httpx
from urllib.parse import quote
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Dict, Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Header
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..schemas import PsychologistCreate
from ..deps import get_db
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from ..schemas import (
    UserCreate,
    UserLogin,
    UserPublic,
    Token,
    ForgotPasswordStart,
    ForgotPasswordVerify,
    UserUpdate,
    ChangePassword,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ================== REGULAR SIGNUP ==================

@router.post("/signup", response_model=UserPublic)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        text("""
            SELECT TOP 1 user_id
            FROM dbo.Users
            WHERE Email = :email OR Username = :username
        """),
        {"email": payload.email, "username": payload.username},
    ).fetchone()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already in use",
        )

    try:
        db.execute(
            text("""
                INSERT INTO dbo.Users (Username, Email, Password, Age, Gender, Role)
                VALUES (:username, :email, :password, :age, :gender, :role)
            """),
            {
                "username": payload.username,
                "email": payload.email,
                "password": hash_password(payload.password),
                "age": payload.age,
                "gender": payload.gender,
                "role": "regular",
            },
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already in use",
        )

    row = db.execute(
        text("""
            SELECT TOP 1 user_id, Username, Email, Age, Gender, Role
            FROM dbo.Users
            WHERE Email = :email
        """),
        {"email": payload.email},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="User created but not found")

    return UserPublic(
        user_id=str(row.user_id),
        username=row.Username,
        email=row.Email,
        age=row.Age,
        gender=row.Gender,
        role=row.Role,
    )


# ================== PSYCHOLOGIST LICENSE CHECK ==================

MOH_PSYCHOLOGIST_REGISTRY_BASE = "https://practitioners.health.gov.il/Practitioners/27/search"


def normalize_psychologist_license(raw: str) -> str:
    value = (raw or "").strip()

    if not value:
        raise HTTPException(status_code=400, detail="License number is required")

    value = value.replace(" ", "")

    if not re.fullmatch(r"27-\d{4,8}", value):
        raise HTTPException(
            status_code=400,
            detail="Invalid license format. Use format like 27-147619.",
        )

    return value


def verify_psychologist_license_with_moh(license_number: str) -> bool:
    normalized = normalize_psychologist_license(license_number)
    url = f"{MOH_PSYCHOLOGIST_REGISTRY_BASE}?license={quote(normalized)}"

    headers = {
        "User-Agent": "MendlyApp/1.0 psychologist-license-check",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True, headers=headers) as client:
            response = client.get(url)

        if response.status_code != 200:
            return False

        page_text = response.text or ""

        has_license = normalized in page_text
        has_psychologist_registry_text = (
            "פסיכולוגים בעלי רשיון" in page_text
            or "פסיכולוגים בעלי רישיון" in page_text
            or "Psychologists" in page_text
        )

        no_results_markers = [
            "groupTitleFound 0",
            "groupTitleNoResults",
            "לא נמצאו",
            "no results",
        ]

        has_no_results = any(marker.lower() in page_text.lower() for marker in no_results_markers)

        return has_license and has_psychologist_registry_text and not has_no_results

    except Exception:
        return False


# ================== PSYCHOLOGIST SIGNUP ==================

@router.post("/signup-psychologist", response_model=UserPublic)
def signup_psychologist(payload: PsychologistCreate, db: Session = Depends(get_db)):
    license_number = normalize_psychologist_license(payload.license_number)

    is_valid_license = verify_psychologist_license_with_moh(license_number)

    if not is_valid_license:
        raise HTTPException(
            status_code=400,
            detail="Invalid psychologist license number. Please enter a valid Israeli Ministry of Health psychologist license.",
        )

    existing = db.execute(
        text("""
            SELECT TOP 1 user_id
            FROM dbo.Users
            WHERE Email = :email OR Username = :username
        """),
        {"email": payload.email, "username": payload.username},
    ).fetchone()

    if existing:
        raise HTTPException(status_code=400, detail="Username or email already in use")

    lic_exists = db.execute(
        text("""
            SELECT TOP 1 user_id
            FROM dbo.PsychologistProfiles
            WHERE license_number = :lic
        """),
        {"lic": license_number},
    ).fetchone()

    if lic_exists:
        raise HTTPException(status_code=400, detail="License number already in use")

    created_user_id = None

    try:
        db.execute(
            text("""
                INSERT INTO dbo.Users (Username, Email, Password, Age, Gender, Role)
                VALUES (:username, :email, :password, :age, :gender, :role)
            """),
            {
                "username": payload.username,
                "email": payload.email,
                "password": hash_password(payload.password),
                "age": payload.age,
                "gender": payload.gender,
                "role": "psychologist",
            },
        )
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or email already in use")

    try:
        row = db.execute(
            text("""
                SELECT TOP 1 user_id, Username, Email, Age, Gender, Role
                FROM dbo.Users
                WHERE Email = :email
            """),
            {"email": payload.email},
        ).fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="User created but not found")

        created_user_id = row.user_id

        db.execute(
            text("""
                INSERT INTO dbo.PsychologistProfiles
                (user_id, specialty, workplace, city, bio, years_experience, license_number)
                VALUES (:user_id, :specialty, :workplace, :city, :bio, :years_experience, :license_number)
            """),
            {
                "user_id": row.user_id,
                "specialty": "Not completed",
                "workplace": None,
                "city": None,
                "bio": "",
                "years_experience": None,
                "license_number": license_number,
            },
        )

        db.commit()

        return UserPublic(
            user_id=str(row.user_id),
            username=row.Username,
            email=row.Email,
            age=row.Age,
            gender=row.Gender,
            role=row.Role,
        )

    except IntegrityError:
        db.rollback()

        if created_user_id is not None:
            db.execute(
                text("DELETE FROM dbo.Users WHERE user_id = :uid"),
                {"uid": created_user_id},
            )
            db.commit()

        raise HTTPException(status_code=400, detail="Psychologist profile already exists")

    except Exception:
        db.rollback()

        if created_user_id is not None:
            db.execute(
                text("DELETE FROM dbo.Users WHERE user_id = :uid"),
                {"uid": created_user_id},
            )
            db.commit()

        raise


# ================== LOGIN ==================

@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT TOP 1 user_id, Username, Email, Password, Role
            FROM dbo.Users
            WHERE Username = :username
        """),
        {"username": payload.username},
    ).fetchone()

    if not row or not verify_password(payload.password, row.Password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        {"sub": str(row.user_id), "username": row.Username}
    )

    return Token(
        access_token=access_token,
        user_id=str(row.user_id),
        role=row.Role,
        username=row.Username,
    )


# ================== FORGOT PASSWORD ==================

RESET_CODES: Dict[str, Dict[str, object]] = {}


def generate_reset_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


def send_reset_email(to_email: str, code: str) -> None:
    email_user = os.getenv("EMAIL")
    email_pass = os.getenv("EMAILPASSWORD")

    if not email_user or not email_pass:
        print("[email] EMAIL or EMAILPASSWORD missing in .env")
        return

    msg = EmailMessage()
    msg["Subject"] = "Mendly – Password Reset Code"
    msg["From"] = email_user
    msg["To"] = to_email
    msg.set_content(
        f"Your Mendly password reset code is: {code}\n\n"
        "This code is valid for 10 minutes."
    )

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(email_user, email_pass)
            server.send_message(msg)
        print(f"[email] Reset code sent to {to_email}")
    except Exception as e:
        print("[email] Failed to send email:", e)


@router.post("/forgot-password/start")
def forgot_password_start(
    payload: ForgotPasswordStart,
    db: Session = Depends(get_db),
):
    email = payload.email.lower()

    row = db.execute(
        text("""
            SELECT TOP 1 user_id
            FROM dbo.Users
            WHERE Email = :email
        """),
        {"email": email},
    ).fetchone()

    if not row:
        print(f"[forgot-password] No user with email {email}, but returning OK.")
        return {"ok": True, "message": "If this email is registered, a code was sent."}

    code = generate_reset_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    RESET_CODES[email] = {"code": code, "expires_at": expires_at}

    send_reset_email(email, code)

    return {"ok": True, "message": "If this email is registered, a code was sent."}


@router.post("/forgot-password/verify")
def forgot_password_verify(
    payload: ForgotPasswordVerify,
    db: Session = Depends(get_db),
):
    email = payload.email.lower()
    entry = RESET_CODES.get(email)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code.",
        )

    stored_code = entry["code"]
    expires_at = entry["expires_at"]

    if not isinstance(stored_code, str) or not isinstance(expires_at, datetime):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code.",
        )

    if datetime.now(timezone.utc) > expires_at:
        RESET_CODES.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code expired. Please request a new one.",
        )

    if payload.code != stored_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect code. Please try again.",
        )

    db.execute(
        text("""
            UPDATE dbo.Users
            SET Password = :new_password
            WHERE Email = :email
        """),
        {
            "email": email,
            "new_password": hash_password(payload.new_password),
        },
    )

    db.commit()
    RESET_CODES.pop(email, None)

    return {"ok": True, "message": "Password updated successfully."}


# ================== /auth/me ==================

JWT_SECRET = os.getenv("JWT_SECRET", "change_me_very_secret")
JWT_ALG = "HS256"


def _user_id_from_authorization(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    token = authorization.split(" ", 1)[1].strip()

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    sub = payload.get("sub")

    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    return str(sub)


@router.get("/me")
def get_me(
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    user = db.execute(
        text("""
            SELECT TOP 1 user_id, Username, Email, Age, Gender, Role
            FROM dbo.Users
            WHERE user_id = :uid
        """),
        {"uid": user_id},
    ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    psychologist_profile = None

    if user.Role == "psychologist":
        psy = db.execute(
            text("""
                SELECT TOP 1 specialty, workplace, city, bio, years_experience, license_number
                FROM dbo.PsychologistProfiles
                WHERE user_id = :uid
            """),
            {"uid": user_id},
        ).fetchone()

        if psy:
            psychologist_profile = {
                "specialty": psy.specialty,
                "workplace": psy.workplace,
                "city": psy.city,
                "bio": psy.bio,
                "years_experience": psy.years_experience,
                "license_number": psy.license_number,
            }

    return {
        "user_id": str(user.user_id),
        "username": user.Username,
        "email": user.Email,
        "age": user.Age,
        "gender": user.Gender,
        "role": user.Role,
        "psychologist_profile": psychologist_profile,
    }


@router.put("/me", response_model=UserPublic)
def update_me(
    payload: UserUpdate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    db.execute(
        text("""
            UPDATE dbo.Users
            SET Username = :username,
                Email = :email,
                Age = :age,
                Gender = :gender,
                updated_at = SYSDATETIMEOFFSET()
            WHERE user_id = :uid
        """),
        {
            "username": payload.username,
            "email": payload.email,
            "age": payload.age,
            "gender": payload.gender,
            "uid": user_id,
        },
    )

    db.commit()

    row = db.execute(
        text("""
            SELECT TOP 1 user_id, Username, Email, Age, Gender, Role
            FROM dbo.Users
            WHERE user_id = :uid
        """),
        {"uid": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found after update")

    return UserPublic(
        user_id=str(row.user_id),
        username=row.Username,
        email=row.Email,
        age=row.Age,
        gender=row.Gender,
        role=row.Role,
    )


# ================== CHANGE PASSWORD ==================

@router.post("/change-password")
def change_password(
    payload: ChangePassword,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.execute(
        text("""
            SELECT TOP 1 user_id, Password
            FROM dbo.Users
            WHERE user_id = :uid
        """),
        {"uid": current_user.user_id},
    ).fetchone()

    if not row or not verify_password(payload.current_password, row.Password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    db.execute(
        text("""
            UPDATE dbo.Users
            SET Password = :new_password,
                updated_at = SYSDATETIMEOFFSET()
            WHERE user_id = :uid
        """),
        {
            "uid": current_user.user_id,
            "new_password": hash_password(payload.new_password),
        },
    )

    db.commit()

    return {"ok": True, "message": "Password updated successfully."}


# ================== PSYCHOLOGIST PROFILE ==================

class PsychologistProfileUpdate(BaseModel):
    specialty: str
    workplace: str
    city: str
    bio: Optional[str] = ""
    years_experience: Optional[int] = None
    license_number: Optional[str] = None


@router.put("/psychologist-profile")
def upsert_psychologist_profile(
    payload: PsychologistProfileUpdate,
    user_id: str = Depends(_user_id_from_authorization),
    db: Session = Depends(get_db),
):
    user = db.execute(
        text("""
            SELECT TOP 1 user_id, Role
            FROM dbo.Users
            WHERE user_id = :uid
        """),
        {"uid": user_id},
    ).fetchone()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.Role != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can update this profile")

    existing = db.execute(
        text("""
            SELECT TOP 1 user_id, license_number
            FROM dbo.PsychologistProfiles
            WHERE user_id = :uid
        """),
        {"uid": user_id},
    ).fetchone()

    # Keep the original verified license number.
    # Do not require/send license_number from complete profile.
    current_license = None
    if existing and existing.license_number:
        current_license = existing.license_number
    elif payload.license_number:
        current_license = normalize_psychologist_license(payload.license_number)

    if not current_license:
        raise HTTPException(status_code=400, detail="Missing verified psychologist license number")

    if existing:
        db.execute(
            text("""
                UPDATE dbo.PsychologistProfiles
                SET specialty = :specialty,
                    workplace = :workplace,
                    city = :city,
                    bio = :bio,
                    years_experience = :years_experience,
                    license_number = :license_number
                WHERE user_id = :uid
            """),
            {
                "uid": user_id,
                "specialty": payload.specialty,
                "workplace": payload.workplace,
                "city": payload.city,
                "bio": payload.bio or "",
                "years_experience": payload.years_experience,
                "license_number": current_license,
            },
        )
    else:
        db.execute(
            text("""
                INSERT INTO dbo.PsychologistProfiles
                (user_id, specialty, workplace, city, bio, years_experience, license_number)
                VALUES (:uid, :specialty, :workplace, :city, :bio, :years_experience, :license_number)
            """),
            {
                "uid": user_id,
                "specialty": payload.specialty,
                "workplace": payload.workplace,
                "city": payload.city,
                "bio": payload.bio or "",
                "years_experience": payload.years_experience,
                "license_number": current_license,
            },
        )

    db.commit()

    return {"ok": True}