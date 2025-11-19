"""
Test Supabase Access - MediTrack

This script tests if the Supabase API is accessible for:
1. Reading medications
2. Reading inventory
3. Inserting into dispensing_logs

Run this to verify permissions are working correctly.
"""

import sys
import io
import requests
import json
from datetime import datetime

# Fix Windows encoding issues
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Supabase configuration
SUPABASE_URL = "https://autqxusmzujnzlymeccc.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dHF4dXNtenVqbnpseW1lY2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1Njc0MjAsImV4cCI6MjA3NDE0MzQyMH0.7ZRP3RScuMpro3HSElG03N0b86i0UcGV9cG-wzPZJtw"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("=" * 60)
print("SUPABASE ACCESS TEST - MEDITRACK")
print("=" * 60)
print()

# Test 1: Read medications
print("TEST 1: Reading medications...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/medications",
    headers=headers,
    params={"select": "id,name,strength", "limit": 5}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    medications = response.json()
    print(f"✅ SUCCESS! Fetched {len(medications)} medications")
    if medications:
        print(f"   First medication: {medications[0]['name']} {medications[0].get('strength', '')}")
        first_med_id = medications[0]['id']
    else:
        print("   ⚠️ No medications found")
        first_med_id = None
else:
    print(f"❌ FAILED: {response.text}")
    first_med_id = None
print()

# Test 2: Read inventory
print("TEST 2: Reading inventory...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/inventory",
    headers=headers,
    params={"select": "medication_id,qty_units,lot_number", "limit": 5}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    inventory = response.json()
    print(f"✅ SUCCESS! Fetched {len(inventory)} inventory items")
    if inventory:
        print(f"   First item: Lot {inventory[0]['lot_number']}, Qty: {inventory[0]['qty_units']}")
    else:
        print("   ⚠️ No inventory found")
else:
    print(f"❌ FAILED: {response.text}")
print()

# Test 3: Read dispensing logs
print("TEST 3: Reading dispensing_logs...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/dispensing_logs",
    headers=headers,
    params={"select": "id,patient_id,medication_name", "limit": 5, "order": "created_at.desc"}
)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    logs = response.json()
    print(f"✅ SUCCESS! Fetched {len(logs)} dispensing logs")
    if logs:
        print(f"   Latest: {logs[0]['medication_name']} for patient {logs[0]['patient_id']}")
else:
    print(f"❌ FAILED: {response.text}")
print()

# Test 4: Insert into dispensing_logs (THIS IS THE CRITICAL TEST)
if first_med_id:
    print("TEST 4: Inserting into dispensing_logs...")
    test_record = {
        "log_date": datetime.now().strftime("%Y-%m-%d"),
        "patient_id": "TEST-999",
        "medication_id": first_med_id,
        "medication_name": "Test Medication",
        "dose_instructions": "Test dose",
        "lot_number": "TEST-LOT",
        "expiration_date": "2026-12-31",
        "amount_dispensed": "1 tab",
        "physician_name": "Test Physician",
        "student_name": "Test Student",
        "notes": "Python test script - safe to delete"
    }

    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/dispensing_logs",
        headers=headers,
        json=test_record
    )
    print(f"Status: {response.status_code}")
    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✅ SUCCESS! Dispensing record created")
        print(f"   Record ID: {result[0]['id'] if isinstance(result, list) else result.get('id')}")
        print()
        print("🎉 ALL TESTS PASSED! Supabase access is working correctly.")
    else:
        print(f"❌ FAILED: {response.text}")
        print()
        print("⚠️ This is the problem! The frontend cannot create dispensing records.")
        print("   Check the error message above for details.")
else:
    print("TEST 4: Skipped (no medications found)")

print()
print("=" * 60)
print("TEST COMPLETE")
print("=" * 60)
