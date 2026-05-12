"""
Pydantic 数据模型

定义 OCR API 请求和响应的数据模型。
"""

from typing import Optional
from pydantic import BaseModel


# ==================== OCR 模型 ====================

class OcrRecognizeRequest(BaseModel):
    """OCR 识别请求"""
    image_base64: str  # Base64 编码的图片数据
