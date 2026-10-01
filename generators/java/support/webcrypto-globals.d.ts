/**
 * Copyright 2013-2026 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { webcrypto } from 'node:crypto';

// pkijs declarations use the WebCrypto types of the DOM library, which the project does not include: expose node's.
declare global {
  type AesCbcParams = webcrypto.AesCbcParams;
  type AesCtrParams = webcrypto.AesCtrParams;
  type AesDerivedKeyParams = webcrypto.AesDerivedKeyParams;
  type AesGcmParams = webcrypto.AesGcmParams;
  type AesKeyAlgorithm = webcrypto.AesKeyAlgorithm;
  type AesKeyGenParams = webcrypto.AesKeyGenParams;
  type Algorithm = webcrypto.Algorithm;
  type AlgorithmIdentifier = webcrypto.AlgorithmIdentifier;
  type BufferSource = webcrypto.BufferSource;
  type Crypto = webcrypto.Crypto;
  type CryptoKey = webcrypto.CryptoKey;
  type CryptoKeyPair = webcrypto.CryptoKeyPair;
  type EcdhKeyDeriveParams = webcrypto.EcdhKeyDeriveParams;
  type EcdsaParams = webcrypto.EcdsaParams;
  type EcKeyGenParams = webcrypto.EcKeyGenParams;
  type EcKeyImportParams = webcrypto.EcKeyImportParams;
  type HkdfParams = webcrypto.HkdfParams;
  type HmacImportParams = webcrypto.HmacImportParams;
  type HmacKeyGenParams = webcrypto.HmacKeyGenParams;
  type JsonWebKey = webcrypto.JsonWebKey;
  type KeyFormat = webcrypto.KeyFormat;
  type KeyUsage = webcrypto.KeyUsage;
  type Pbkdf2Params = webcrypto.Pbkdf2Params;
  type RsaHashedImportParams = webcrypto.RsaHashedImportParams;
  type RsaHashedKeyGenParams = webcrypto.RsaHashedKeyGenParams;
  type RsaOaepParams = webcrypto.RsaOaepParams;
  type RsaPssParams = webcrypto.RsaPssParams;
  type SubtleCrypto = webcrypto.SubtleCrypto;
}
