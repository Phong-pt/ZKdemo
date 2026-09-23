import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import PropertyMock, patch

from eth_tester.exceptions import TransactionFailed
from web3 import Web3, EthereumTesterProvider
from web3.eth import Eth
from web3.exceptions import ContractLogicError, TimeExhausted

import chain
import registry_publish
from issuer import issuer
from test_chain import compile_registry, CRED_DEF


class RpcLikeProvider(EthereumTesterProvider):
    def make_request(self, method, params):
        try:
            return super().make_request(method, params)
        except TransactionFailed as exc:
            raise ContractLogicError(str(exc)) from exc


class PublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compiled = compile_registry()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.provider = RpcLikeProvider()
        self.w3 = Web3(self.provider)
        key = self.provider.ethereum_tester.backend.account_keys[0].to_hex()
        root = Path(self.temp.name)
        (root / 'artifact.json').write_text(json.dumps(self.compiled))
        patches = [
            patch.object(registry_publish, 'JOURNAL', root / 'journal.json'),
            patch.object(chain, 'ARTIFACT_FILE', root / 'artifact.json'),
            patch.object(chain, 'REGISTRY_FILE', root / 'deployment.json'),
            patch.object(Web3, 'HTTPProvider', return_value=self.provider),
            patch.object(Eth, 'chain_id', new_callable=PropertyMock, return_value=11155111),
            patch.object(issuer, 'get_public_cred_def', return_value=CRED_DEF),
            patch.dict(os.environ, {'SEPOLIA_RPC_URL': 'test-only', 'ISSUER_PRIVATE_KEY': key,
                                    'CREDENTIAL_REGISTRY_ADDRESS': '', 'SCHEMA_ID': '', 'CREDENTIAL_DEFINITION_ID': ''}),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        self.addCleanup(chain.clear_cache)

    def test_publish_three_receipts_then_reuse_registry(self):
        registry_publish.publish()
        result = registry_publish.status()
        self.assertEqual(result['state'], 'published', result)
        self.assertEqual(set(result['transactions']), {'deploy', 'schema', 'credential_definition'})
        for tx in result['transactions'].values():
            self.assertEqual(tx['state'], 'confirmed')
            self.assertEqual(self.w3.eth.get_transaction_receipt(tx['hash'])['status'], 1)
        self.assertEqual(chain.get_schema()['attributes'], issuer.ATTRIBUTE_NAMES)
        self.assertEqual(chain.get_cred_def()['n'], CRED_DEF['n'])
        before = self.w3.eth.block_number
        registry_publish.publish()
        self.assertEqual(registry_publish.status()['state'], 'published')
        self.assertEqual(self.w3.eth.block_number, before)

    def test_changed_key_cannot_claim_existing_registry_matches(self):
        registry_publish.publish()
        with patch.object(issuer, 'get_public_cred_def', return_value={**CRED_DEF, 'Z': 17}):
            registry_publish.publish()
        result = registry_publish.status()
        self.assertEqual(result['state'], 'error')
        self.assertIn('Khóa công khai', result['error'])

    def test_missing_rpc_never_claims_onchain_success(self):
        with patch.dict(os.environ, {'SEPOLIA_RPC_URL': ''}):
            registry_publish.publish()
        self.assertEqual(registry_publish.status()['state'], 'error')
        self.assertEqual(registry_publish.status()['transactions'], {})

    def test_retry_refreshes_receipt_after_timeout_without_duplicate_schema(self):
        original = Eth.wait_for_transaction_receipt
        calls = []
        def timeout_once(instance, tx_hash, *args, **kwargs):
            calls.append(tx_hash)
            if len(calls) == 2:
                raise TimeExhausted('Test timeout after schema was mined')
            return original(instance, tx_hash, *args, **kwargs)
        with patch.object(Eth, 'wait_for_transaction_receipt', timeout_once):
            registry_publish.publish()
        previous = registry_publish.status()
        self.assertEqual(previous['state'], 'error')
        self.assertEqual(previous['transactions']['schema']['state'], 'pending')
        before = self.w3.eth.block_number
        registry_publish.publish()
        result = registry_publish.status()
        self.assertEqual(result['state'], 'published', result)
        self.assertEqual(result['transactions']['schema']['hash'], previous['transactions']['schema']['hash'])
        self.assertEqual(result['transactions']['schema']['state'], 'confirmed')
        self.assertEqual(self.w3.eth.block_number, before + 1)

    def test_invalid_journal_does_not_leave_publish_lock_held(self):
        registry_publish.JOURNAL.write_text('invalid json')
        registry_publish.publish()
        self.assertFalse(registry_publish._lock.locked())
        registry_publish.publish()
        self.assertEqual(registry_publish.status()['state'], 'published')


if __name__ == '__main__':
    unittest.main()
