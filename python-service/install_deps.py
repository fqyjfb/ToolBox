#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Install Python dependencies for OCR service
"""
import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("Installing OCR Service Dependencies")
    print("=" * 60)
    
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    requirements_path = os.path.join(script_dir, "requirements.txt")
    
    if not os.path.exists(requirements_path):
        print(f"[ERROR] Requirements file not found: {requirements_path}")
        return 1
    
    print(f"[INFO] Using requirements file: {requirements_path}")
    
    try:
        # Upgrade pip first
        print("\n[INFO] Upgrading pip...")
        subprocess.check_call([
            sys.executable,
            "-m", "pip", "install", "--upgrade", "pip"
        ])
        
        # Install dependencies
        print("\n[INFO] Installing dependencies...")
        subprocess.check_call([
            sys.executable,
            "-m", "pip", "install", "-r", requirements_path
        ])
        
        print("\n" + "=" * 60)
        print("[OK] Dependencies installed successfully!")
        print("=" * 60)
        return 0
        
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Installation failed with exit code {e.returncode}")
        print("\nPlease try:")
        print("  1. Check your internet connection")
        print("  2. Run with admin/sudo privileges if needed")
        print("  3. Try manually: pip install -r requirements.txt")
        return 1
    except Exception as e:
        print(f"\n[ERROR] Installation failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
