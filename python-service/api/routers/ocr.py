"""
OCR API 路由
"""

import logging

from fastapi import APIRouter

from api.models import OcrRecognizeRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.post("/recognize")
async def ocr_recognize(data: OcrRecognizeRequest):
    """
    OCR 识别 - 接受 Base64 图片数据

    返回识别结果，包含：
    - success: 是否成功
    - text: 识别的完整文字内容
    - blocks: 文字块列表（含置信度和位置）
    """
    try:
        from ocr_service import ocr_recognize_base64

        result = ocr_recognize_base64(data.image_base64)
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"OCR 识别失败: {e}")
        return {"success": False, "error": str(e)}


@router.get("/recognize-file")
async def ocr_recognize_file(file_path: str):
    """
    OCR 识别 - 接受文件路径

    Args:
        file_path: 图片文件路径

    Returns:
        识别结果
    """
    try:
        from ocr_service import ocr_recognize_image

        result = ocr_recognize_image(file_path)
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"OCR 识别失败: {e}")
        return {"success": False, "error": str(e)}


@router.get("/status")
async def ocr_status():
    """
    获取 OCR 服务状态

    返回 OCR 服务是否可用
    """
    try:
        from ocr_service import OcrService

        service = OcrService.get_instance()
        available = service.is_available()
        error_message = service.get_error_message()

        if available:
            message = "OCR 服务可用"
        elif error_message:
            message = error_message
        else:
            message = "OCR 服务不可用"

        return {
            "success": True,
            "data": {
                "available": available,
                "message": message
            }
        }
    except Exception as e:
        return {
            "success": True,
            "data": {
                "available": False,
                "message": f"OCR 服务初始化失败: {str(e)}"
            }
        }
