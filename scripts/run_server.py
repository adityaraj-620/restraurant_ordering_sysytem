#!/usr/bin/env python3
"""
Script to run the Flask restaurant ordering system server.
This script will install dependencies and start the development server.
"""

import os
import sys
import subprocess

def install_dependencies():
    """Install required Python packages"""
    print("📦 Installing dependencies...")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'flask', 'flask-sqlalchemy'])
        print("✅ Dependencies installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        sys.exit(1)

def main():
    # Install dependencies first
    install_dependencies()
    
    # Add the parent directory to the Python path so we can import app
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    try:
        from app import app
        
        print("\n🍽️ Starting Littidhuskawale Ordering System...")
        print("📱 Customer Interface: http://localhost:5000")
        print("🔧 Admin Dashboard: http://localhost:5000/admin")
        print("🛑 Press Ctrl+C to stop the server")
        print("-" * 60)
        
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"❌ Failed to import Flask app: {e}")
        print("Make sure Flask and Flask-SQLAlchemy are installed")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
