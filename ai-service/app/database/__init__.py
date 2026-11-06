"""
Database connectivity package for DocuMind AI Service.
Provides PostgreSQL connection utilities and diagnostic health checks.
"""

from .connection import get_db_connection, get_db, test_db_connection

__all__ = ["get_db_connection", "get_db", "test_db_connection"]
