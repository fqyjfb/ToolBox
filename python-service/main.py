#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR 识别服务
基于 FastAPI 提供 OCR 文字识别 HTTP API
"""
import sys
import os

# Windows 控制台编码设置（解决乱码问题）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==================== FastAPI 应用 ====================

app = FastAPI(
    title="ToolBox OCR Service",
    description="OCR 文字识别服务",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 健康检查 ====================

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


# ==================== 注册路由 ====================

from api.routers.ocr import router as ocr_router
app.include_router(ocr_router)


# ==================== 启动入口 ====================

def run_http_server(host: str = "127.0.0.1", port: int = 8766):
    """运行 HTTP 服务"""
    logger.info(f"启动 OCR 服务: http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


def main():
    """主函数"""
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("HTTP_PORT", "8766"))
    run_http_server(host, port)


if __name__ == "__main__":
    main()
