import copy
from fastapi.testclient import TestClient
from src.app import app, activities

client = TestClient(app)

# Keep a copy of the original activities to restore between tests
_original_activities = copy.deepcopy(activities)


def setup_function():
    # Reset the in-memory activities before each test
    activities.clear()
    activities.update(copy.deepcopy(_original_activities))


def test_get_activities():
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_success():
    resp = client.post("/activities/Chess Club/signup?email=test@example.com")
    assert resp.status_code == 200
    assert "Signed up test@example.com" in resp.json()["message"]
    assert "test@example.com" in activities["Chess Club"]["participants"]


def test_signup_duplicate():
    client.post("/activities/Chess Club/signup?email=dupe@example.com")
    resp = client.post("/activities/Chess Club/signup?email=dupe@example.com")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Student already signed up for this activity"


def test_signup_full_capacity():
    # Create a temporary activity with max_participants=1
    activities["Tiny Activity"] = {
        "description": "Tiny",
        "schedule": "Now",
        "max_participants": 1,
        "participants": []
    }

    r1 = client.post("/activities/Tiny Activity/signup?email=a@example.com")
    assert r1.status_code == 200

    r2 = client.post("/activities/Tiny Activity/signup?email=b@example.com")
    assert r2.status_code == 400
    assert r2.json()["detail"] == "Activity is full"

    # Clean up
    activities.pop("Tiny Activity", None)


def test_remove_participant():
    # Ensure participant exists
    activities["Gym Class"]["participants"].append("toremove@example.com")
    r = client.delete("/activities/Gym Class/participants?email=toremove@example.com")
    assert r.status_code == 200
    assert "Removed toremove@example.com" in r.json()["message"]
    assert "toremove@example.com" not in activities["Gym Class"]["participants"]


def test_remove_nonexistent():
    r = client.delete("/activities/Gym Class/participants?email=notfound@example.com")
    assert r.status_code == 404
