"""
API 模块（简化版 - 仅 OCR 功能）
"""

from .models import OcrRecognizeRequest
from .routers.ocr import router as ocr_router

__all__ = [
    "OcrRecognizeRequest",
    "ocr_router",
]
