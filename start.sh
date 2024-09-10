#!/usr/bin/env bash
# Install Chromium for Playwright
playwright install chromium

# Start Uvicorn server
uvicorn main:app --host 0.0.0.0 --port $PORT
