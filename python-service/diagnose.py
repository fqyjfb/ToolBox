#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Service Diagnostics Tool
Helps check if Python environment and dependencies are properly installed
"""
import sys
import os
import subprocess
import importlib.util

def check_python_version():
    """Check Python version"""
    print("=" * 60)
    print("Python Version Check")
    print("=" * 60)
    version = sys.version_info
    print(f"Current Version: {version.major}.{version.minor}.{version.micro}")
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("[WARN] Warning: Python 3.8+ is recommended")
        return False
    print("[OK] Python version meets requirements")
    return True

def check_dependency(module_name, package_name=None):
    """Check if a single dependency is installed"""
    package_name = package_name or module_name
    spec = importlib.util.find_spec(module_name)
    if spec is None:
        print(f"[FAIL] {package_name} not installed")
        return False
    print(f"[OK] {package_name} installed")
    return True

def check_dependencies():
    """Check all dependencies"""
    print("\n" + "=" * 60)
    print("Dependencies Check")
    print("=" * 60)

    dependencies = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pydantic", "pydantic"),
        ("rapidocr_onnxruntime", "rapidocr-onnxruntime"),
        ("PIL", "Pillow"),
    ]

    all_installed = True
    for module_name, package_name in dependencies:
        if not check_dependency(module_name, package_name):
            all_installed = False

    return all_installed

def check_port(port=8766):
    """Check if port is occupied"""
    print("\n" + "=" * 60)
    print(f"Port {port} Check")
    print("=" * 60)

    if sys.platform == 'win32':
        result = subprocess.run(
            f'netstat -ano | findstr ":{port}"',
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
    else:
        result = subprocess.run(
            f'lsof -i :{port}',
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

    if result.stdout.strip():
        print(f"[WARN] Port {port} is occupied:")
        print(result.stdout)
        return False
    else:
        print(f"[OK] Port {port} is available")
        return True

def check_service_files():
    """Check if service files exist"""
    print("\n" + "=" * 60)
    print("Service Files Check")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    required_files = [
        "main.py",
        "ocr_service.py",
        "requirements.txt",
        "api/__init__.py",
        "api/routers/__init__.py",
        "api/routers/ocr.py",
        "api/models.py",
    ]

    all_exist = True
    for file_path in required_files:
        full_path = os.path.join(base_dir, file_path)
        if os.path.exists(full_path):
            print(f"[OK] {file_path}")
        else:
            print(f"[FAIL] {file_path} not found")
            all_exist = False

    return all_exist

def main():
    print("\n")
    print("+" + "=" * 58 + "+")
    print("|" + " " * 15 + "OCR Service Diagnostics" + " " * 22 + "|")
    print("+" + "=" * 58 + "+")

    checks = [
        ("Python Version", check_python_version()),
        ("Service Files", check_service_files()),
        ("Dependencies", check_dependencies()),
        ("Port Check", check_port()),
    ]

    print("\n" + "=" * 60)
    print("Diagnostics Summary")
    print("=" * 60)

    all_passed = True
    for check_name, result in checks:
        status = "[OK] Passed" if result else "[FAIL] Failed"
        print(f"{check_name}: {status}")
        if not result:
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("All checks passed! Service should start normally.")
        print("\nIf service still fails to start, try:")
        print("  1. Run manually: python python-service/main.py")
        print("  2. Check error messages")
        print("  3. Reinstall dependencies: pip install -r python-service/requirements.txt")
    else:
        print("Some checks failed. Please resolve the issues above.")
        print("\nCommon solutions:")
        print("  1. Install missing dependencies:")
        print("     pip install -r python-service/requirements.txt")
        print("  2. If port is occupied, close the occupying program or change config")
        print("  3. Ensure Python version >= 3.8")
    print("=" * 60)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
