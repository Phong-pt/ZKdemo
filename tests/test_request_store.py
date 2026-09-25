from pathlib import Path
import tempfile
import time
import unittest

from verifier.request_store import RequestStore


class RequestStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'requests.sqlite3'
        self.store = RequestStore(self.path)

    def session(self, id='first', owner='alice', **overrides):
        return dict(id=id, owner_id=owner, created_at=time.time(), expires_at=time.time()+300,
                    status='pending', result=None, **overrides)

    def test_request_survives_new_store_instance(self):
        session = self.session(name='Identity', revealed_attrs=['name'])
        self.store.save(session)
        self.assertEqual(RequestStore(self.path).get('first'), session)

    def test_history_is_isolated_by_account_and_newest_first(self):
        self.store.save(self.session())
        self.store.save(self.session('other', 'bob'))
        self.store.save(self.session('latest'))
        self.assertEqual([s['id'] for s in self.store.list_for('alice')], ['latest', 'first'])
        self.assertEqual(self.store.list_for('stranger'), [])

    def test_expiry_survives_restart_and_history_is_not_pruned(self):
        session = self.session()
        session['expires_at'] = time.time() - 7200
        self.store.save(session)
        self.assertEqual(RequestStore(self.path).list_for('alice')[0]['status'], 'expired')
        self.assertEqual(self.store.get('first')['status'], 'expired')

    def test_all_terminal_statuses_persist(self):
        for status in ('verified', 'rejected', 'declined'):
            session = self.session(status)
            self.store.save(session)
            session['status'] = status
            self.store.save(session)
            self.assertEqual(RequestStore(self.path).get(status)['status'], status)

    def test_disclosed_values_never_written_to_disk(self):
        session = self.session()
        session.update(status='verified', result={'verified': True, 'revealed': {'name': 'SENSITIVE VALUE'}})
        self.store.save(session)
        stored = self.store.get('first')
        self.assertEqual(stored['disclosed_attrs'], ['name'])
        self.assertEqual(stored['result'], {'verified': True, 'revealed': {}})
        self.assertNotIn(b'SENSITIVE VALUE', self.path.read_bytes())
        self.assertEqual(session['result']['revealed']['name'], 'SENSITIVE VALUE')
        self.store.save(stored)
        self.assertEqual(self.store.get('first')['disclosed_attrs'], ['name'])

    def test_reset_removes_persisted_history(self):
        self.store.save(self.session())
        self.store.clear()
        self.assertIsNone(RequestStore(self.path).get('first'))
        self.assertEqual(self.store.list_for('alice'), [])


if __name__ == '__main__':
    unittest.main()
