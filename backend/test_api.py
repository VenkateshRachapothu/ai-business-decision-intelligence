import requests
import time

if __name__ == "__main__":
    username = f"user_{int(time.time())}"
    # 1. Register
    res = requests.post("http://localhost:8000/api/auth/register", json={"username": username, "email": f"{username}@example.com", "password": "password"})

    # 2. Login
    res = requests.post("http://localhost:8000/api/auth/login", data={"username": username, "password": "password"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create dummy dataset in DB for testing
    dataset_id = 1

# Let's get datasets to see if there's any dataset with id=1 and user_id... wait, dataset belongs to a user.
# Better to use the database directly, or login as the existing user (maybe "test" / "test")?
