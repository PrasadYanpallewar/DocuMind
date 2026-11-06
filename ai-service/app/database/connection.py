from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Optional
import os

# Load environment configuration specifically from ai-service/.env if available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

try:
    import psycopg2
    import psycopg2.extensions
except ImportError:
    psycopg2 = None


# Database configuration loaded from environment variables with local defaults
DB_HOST: str = os.getenv("DB_HOST", "localhost")
DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
DB_NAME: str = os.getenv("DB_NAME", "documind")
DB_USER: str = os.getenv("DB_USER", "documind_user")
DB_PASSWORD: Optional[str] = os.getenv("DB_PASSWORD")


def get_db_connection() -> Any:
    """
    Creates and returns a new connection to the PostgreSQL database.
    Supports Supabase and Render connections via:
    1. Full DATABASE_URL connection string (e.g., postgresql://postgres:[PWD]@[HOST]:[PORT]/postgres?sslmode=require)
    2. Individual connection parameters (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE)

    Returns:
        psycopg2.extensions.connection: An active PostgreSQL connection object.

    Raises:
        ImportError: If psycopg2 is not installed.
        psycopg2.Error: If connection cannot be established.
    """
    if psycopg2 is None:
        raise ImportError(
            "psycopg2 is not installed. Please run 'pip install -r requirements.txt' in ai-service."
        )

    # 1. Check for complete connection URI (DATABASE_URL, DB_URL, or SUPABASE_DATABASE_URL)
    database_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
    )

    try:
        if database_url:
            # Handle postgres:// schema prefix if provided by cloud platforms
            normalized_url = database_url
            if normalized_url.startswith("postgres://"):
                normalized_url = "postgresql://" + normalized_url[len("postgres://"):]

            # If connecting to Supabase / remote cloud without sslmode in URL, enforce sslmode=require
            kwargs = {"connect_timeout": 10}
            if "sslmode=" not in normalized_url:
                sslmode = os.getenv("DB_SSLMODE") or os.getenv("PGSSLMODE")
                if sslmode:
                    kwargs["sslmode"] = sslmode
                elif "localhost" not in normalized_url and "127.0.0.1" not in normalized_url:
                    kwargs["sslmode"] = "require"

            return psycopg2.connect(normalized_url, **kwargs)

        # 2. Discrete connection parameters
        host = os.getenv("DB_HOST", "localhost")
        port = int(os.getenv("DB_PORT", "5432"))
        dbname = os.getenv("DB_NAME", "documind")
        user = os.getenv("DB_USER", "documind_user")
        password = os.getenv("DB_PASSWORD")
        sslmode = os.getenv("DB_SSLMODE") or os.getenv("PGSSLMODE")

        conn_kwargs = {
            "host": host,
            "port": port,
            "dbname": dbname,
            "user": user,
            "password": password,
            "connect_timeout": 10,
        }

        # Supabase / remote cloud connections require SSL
        if sslmode:
            conn_kwargs["sslmode"] = sslmode
        elif host not in ("localhost", "127.0.0.1", "postgres"):
            conn_kwargs["sslmode"] = "require"

        return psycopg2.connect(**conn_kwargs)
    except psycopg2.Error as err:
        # Log safe diagnostics without exposing password
        target_info = (
            f"DATABASE_URL (host={database_url.split('@')[-1].split('/')[0]})"
            if database_url and "@" in database_url
            else f"{os.getenv('DB_USER', 'documind_user')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'documind')}"
        )
        print(f"[ERROR] Database connection error to {target_info}: {err}")
        raise


@contextmanager
def get_db() -> Generator[Any, None, None]:
    """
    Context manager yielding a PostgreSQL connection.
    Automatically commits on success or rolls back on exception, then closes the connection.
    """
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        if hasattr(conn, "closed") and not conn.closed:
            conn.rollback()
        raise
    finally:
        if hasattr(conn, "closed") and not conn.closed:
            conn.close()


def test_db_connection() -> bool:
    """
    Tests database connectivity by running a verification query and pgvector check.
    Logs clear success or failure messages without leaking credentials.

    Returns:
        bool: True if connection succeeded, False otherwise.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_user, NOW();")
            row = cursor.fetchone()
            if row:
                db_name, db_user, current_time = row
                print("[SUCCESS] PostgreSQL connected successfully!")
                print(f"  Database : {db_name}")
                print(f"  User     : {db_user}")
                print(f"  Timestamp: {current_time}")

            # Verify pgvector extension availability
            cursor.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';")
            vec_row = cursor.fetchone()
            if vec_row:
                print(f"  pgvector : Enabled (v{vec_row[1]})")
            else:
                print("  pgvector : [WARNING] 'vector' extension is not enabled in this database.")
                print("             Please execute: CREATE EXTENSION IF NOT EXISTS vector;")

            return True
        return False
    except Exception as err:
        target_host = os.getenv("DB_HOST", "localhost")
        target_user = os.getenv("DB_USER", "documind_user")
        target_port = os.getenv("DB_PORT", "5432")
        target_db = os.getenv("DB_NAME", "documind")
        print("[ERROR] Failed to connect to PostgreSQL database:")
        print(f"  Target: {target_user}@{target_host}:{target_port}/{target_db}")
        print(f"  Error : {err}")
        return False
    finally:
        if conn and hasattr(conn, "closed") and not conn.closed:
            conn.close()


if __name__ == "__main__":
    test_db_connection()
