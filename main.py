from playwright.async_api import async_playwright
from fastapi import FastAPI
from pydantic import BaseModel
import asyncio

async def fill_and_submit_form(registeration: str, name: str):
    print("function called")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        print("Browser launched")
        page = await browser.new_page()

        try:
            await page.goto('https://oromia6.ministry.et/#/result', timeout=60000)
            print("Page loaded")
        except Exception as e:
            await browser.close()
            return {
                "error_message": "Page load timeout or error: " + str(e),
                "isSuccessful": False,
                "total_value": None
            }

        try:
            await page.fill('input[placeholder="Registration Number"]', registeration)
            await page.fill('input[placeholder="First Name"]', name)
            print("Form filled")
            await page.click('button:has-text("Check your result")')
            print("Form submitted")
        except Exception as e:
            await browser.close()
            return {
                "error_message": "Error filling form: " + str(e),
                "isSuccessful": False,
                "total_value": None
            }

        try:
            await page.wait_for_selector('p:has-text("Total") + p', timeout=4000)
            total_value = await page.locator('p:has-text("Total") + p').text_content()
            print("Form submission successful")
            await browser.close()
            return {
                "error_message": None,
                "isSuccessful": True,
                "total_value": total_value
            }
        except Exception as e:
            await browser.close()
            return {
                "error_message": "Failed to get result: " + str(e),
                "isSuccessful": False,
                "total_value": None
            }

app = FastAPI()

class RegistrationData(BaseModel):
    registration: str
    name: str        

@app.post("/applicant/")
async def get_applicant(data: RegistrationData):
    try:
        print("Received data:", data)
        result = await fill_and_submit_form(data.registration, data.name)
        print("Function completed")
        print("Result:", result)
        return result
    except Exception as e:
        return {
            "error_message": str(e),
            "isSuccessful": False,
            "total_value": None
        }

@app.get("/")
async def root():
    return {"message": "Hello World"}
