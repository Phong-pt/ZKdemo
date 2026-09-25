from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import api
import auth
from verifier.request_store import RequestStore


class HistoryAPITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'history.sqlite3'
        self.account = auth.Account('alice', 'alice@ntq-solution.com.vn', 'Alice', True)
        api.app.dependency_overrides[auth.verifier_account] = lambda: (self.account, 'NTQ')
        api.app.dependency_overrides[auth.wallet_account] = lambda: self.account
        self.addCleanup(api.app.dependency_overrides.clear)
        store = patch.object(api, '_verification_requests', RequestStore(self.path))
        store.start()
        self.addCleanup(store.stop)
        results = patch.object(api, '_verification_results', {})
        results.start()
        self.addCleanup(results.stop)
        schema = patch.object(api, 'revealable_attrs', return_value=['name', 'cccd'])
        schema.start()
        self.addCleanup(schema.stop)
        self.client = TestClient(api.app)
        self.addCleanup(self.client.close)

    def create(self):
        response = self.client.post('/api/requests', json={
            'name': 'Identity', 'revealed_attrs': ['name'], 'conditions': ['credValid']})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('owner_id', response.json())
        return response.json()['id']

    def test_reload_history_and_separate_accounts(self):
        id = self.create()
        api._verification_requests = RequestStore(self.path)
        self.assertEqual(self.client.get('/api/requests').json()[0]['id'], id)
        self.account = auth.Account('bob', 'bob@ntq-solution.com.vn', 'Bob', True)
        self.assertEqual(self.client.get('/api/requests').json(), [])
        api.app.dependency_overrides.pop(auth.verifier_account)
        self.assertEqual(self.client.get('/api/requests').status_code, 401)

    def test_approved_result_history_and_replay(self):
        id = self.create()
        with patch.object(api, '_verify', return_value=api.VerifyResponse(verified=True, revealed={'name': 'Alice'})):
            response = self.client.post(f'/api/requests/{id}/approve', json={'revealed_attrs': ['name']})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(self.client.post(f'/api/requests/{id}/approve', json={}).status_code, 409)
        self.assertEqual(self.client.get(f'/api/requests/{id}').json()['result']['revealed'], {'name': 'Alice'})
        api._verification_results.clear()
        api._verification_requests = RequestStore(self.path)
        row = self.client.get('/api/requests').json()[0]
        self.assertEqual(row['status'], 'verified')
        self.assertEqual(row['disclosed_attrs'], ['name'])
        self.assertEqual(row['result']['revealed'], {})

    def test_decline_and_expiry_remain_in_history(self):
        declined = self.create()
        self.assertEqual(self.client.post(f'/api/requests/{declined}/decline').status_code, 200)
        expired = self.create()
        session = api._verification_requests.get(expired)
        session['expires_at'] = time.time() - 1
        api._verification_requests.save(session)
        self.assertEqual(self.client.post(f'/api/requests/{expired}/approve', json={}).status_code, 409)
        rows = self.client.get('/api/requests').json()
        self.assertEqual({row['status'] for row in rows}, {'declined', 'expired'})
        self.assertEqual(self.client.get('/api/requests/missing').status_code, 404)


if __name__ == '__main__':
    unittest.main()
