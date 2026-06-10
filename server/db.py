# server/db.py
import os
from pathlib import Path

from dotenv import load_dotenv  # type: ignore
from sqlalchemy import create_engine  # type: ignore
from sqlalchemy.orm import sessionmaker, DeclarativeBase  # type: ignore


class Base(DeclarativeBase):
    pass


# Load the .env that sits in the server/ folder
env_path = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL_ODBC = os.getenv("DATABASE_URL_ODBC")

if not DATABASE_URL_ODBC:
    raise RuntimeError("DATABASE_URL_ODBC missing in server/.env")


engine = create_engine(
    DATABASE_URL_ODBC,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)