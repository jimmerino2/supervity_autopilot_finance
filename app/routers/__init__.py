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
from .invoice import router as invoice_router
from .vendor import router as vendor_router

# New Supabase read/CRUD modules
from .company import router as company_router
from .email_log import router as email_log_router
from .fx_rate import router as fx_rate_router
from .gl_account import router as gl_account_router
from .goods_receipt import router as goods_receipt_router
from .invoices_log import router as invoices_log_router
from .price_condition import router as price_condition_router
from .purchase_order import router as purchase_order_router
from .purchase_order_line import router as purchase_order_line_router

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
    "invoice_router",
    "vendor_router",
    "company_router",
    "email_log_router",
    "fx_rate_router",
    "gl_account_router",
    "goods_receipt_router",
    "invoices_log_router",
    "price_condition_router",
    "purchase_order_router",
    "purchase_order_line_router",
]
