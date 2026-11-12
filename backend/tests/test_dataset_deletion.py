import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_dataset_deletion_lifecycle():
    # 1. Login user
    login_resp = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "testpassword"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload test CSV
    csv_content = b"colA,colB\n1,2\n3,4\n5,6\n"
    upload_resp = client.post(
        "/api/datasets/upload",
        files={"file": ("temp_test_to_delete.csv", io.BytesIO(csv_content), "text/csv")},
        headers=headers
    )
    assert upload_resp.status_code == 200
    dataset_data = upload_resp.json()
    dataset_id = dataset_data["id"]
    assert dataset_id is not None
    assert dataset_data["row_count"] == 3

    # 3. Verify it exists
    get_resp = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert get_resp.status_code == 200

    # 4. Attempt deletion without token (unauthorized)
    anon_del = client.delete(f"/api/datasets/{dataset_id}")
    assert anon_del.status_code == 401

    # 5. Delete with owner token
    del_resp = client.delete(f"/api/datasets/{dataset_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Dataset deleted successfully"

    # 6. Verify it is now gone (404)
    get_after = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert get_after.status_code == 404

    # 7. Repeated delete returns 404
    del_again = client.delete(f"/api/datasets/{dataset_id}", headers=headers)
    assert del_again.status_code == 404
