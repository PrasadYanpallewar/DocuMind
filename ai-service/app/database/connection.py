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

    try:
        connection = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=5,
        )
        return connection
    except psycopg2.Error as err:
        # Log safe diagnostics without exposing password
        print(f"[ERROR] Database connection error: {err}")
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
    Tests database connectivity by running a verification query.
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
                return True
        return False
    except Exception as err:
        print("[ERROR] Failed to connect to PostgreSQL database:")
        print(f"  Target: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
        print(f"  Error : {err}")
        return False
    finally:
        if conn and hasattr(conn, "closed") and not conn.closed:
            conn.close()


if __name__ == "__main__":
    test_db_connection()
