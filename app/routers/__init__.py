# app/routers/__init__.py
"""
API Routers - Modular endpoint organization.

Note: File endpoints are defined in main.py to maintain proper path ordering.
"""

from .admin import router as admin_router
from .audit import router as audit_router
from .auth import router as auth_router
from .examples import router as examples_router
from .health import router as health_router
from .items import router as items_router

# Supervity
from .supervity import router as supervity_router

# Supabase tables
from .approval_log import router as approval_log_router
from .approval_matrix import router as approval_matrix_router
from .vendor import router as vendor_router

__all__ = [
    "health_router",
    "auth_router",
    "admin_router",
    "audit_router",
    "items_router",
    "examples_router",
    "supervity_router",
    "approval_log_router",
    "approval_matrix_router",
    "vendor_router",
]
