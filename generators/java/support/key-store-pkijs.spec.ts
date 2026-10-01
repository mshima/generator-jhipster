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
import { after, before, describe, expect, it } from 'esmocha';
import { execFileSync, spawnSync } from 'node:child_process';
import { X509Certificate, createPrivateKey, webcrypto } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BmpString, OctetString } from 'asn1js';
import { CertBag, CryptoEngine, PFX, PKCS8ShroudedKeyBag } from 'pkijs';

import { createKeyStore } from './key-store-pkijs.ts';

const crypto = new CryptoEngine({ name: 'node', crypto: webcrypto });

const readKeyStore = async (contents: Buffer, keyStorePassword: string) => {
  const password = new TextEncoder().encode(keyStorePassword).buffer;
  const pfx = PFX.fromBER(contents);
  await pfx.parseInternalValues({ password, checkIntegrity: true }, crypto);
  const authenticatedSafe = pfx.parsedValue!.authenticatedSafe!;
  await authenticatedSafe.parseInternalValues({ safeContents: [{}] }, crypto);
  const safeBags = authenticatedSafe.parsedValue!.safeContents.flatMap(({ value }) => value.safeBags);
  const alias = (bagValue: unknown) =>
    (safeBags.find(bag => bag.bagValue === bagValue)!.bagAttributes![0].values[0] as BmpString).valueBlock.value;
  const certificateBag = safeBags.map(bag => bag.bagValue).find(bagValue => bagValue instanceof CertBag)!;
  const keyBag = safeBags.map(bag => bag.bagValue).find(bagValue => bagValue instanceof PKCS8ShroudedKeyBag)!;
  await keyBag.parseInternalValues({ password }, crypto);
  return {
    certificate: new X509Certificate(Buffer.from((certificateBag.certValue as OctetString).valueBlock.valueHexView)),
    certificateAlias: alias(certificateBag),
    key: createPrivateKey({ key: Buffer.from(keyBag.parsedValue!.toSchema().toBER()), format: 'der', type: 'pkcs8' }),
    keyAlias: alias(keyBag),
  };
};

const contents = await createKeyStore({ packageName: 'com.mycompany.myapp' });
const keyStore = await readKeyStore(contents, 'password');

describe('generator - java - support - key-store-pkijs', () => {
  describe('createKeyStore', () => {
    it('should check the integrity of the KeyStore with the password', async () => {
      await expect(readKeyStore(contents, 'wrong')).rejects.toThrow('Integrity for the PKCS#12 data is broken!');
    });

    it('should store the key and the certificate under the selfsigned alias', () => {
      expect(keyStore.keyAlias).toBe('selfsigned');
      expect(keyStore.certificateAlias).toBe('selfsigned');
    });

    it('should store the 2048 bits RSA key of the certificate', () => {
      expect(keyStore.key.asymmetricKeyDetails?.modulusLength).toBe(2048);
      expect(keyStore.certificate.checkPrivateKey(keyStore.key)).toBe(true);
    });

    it('should generate a self-signed certificate for the package, valid for 99999 days', () => {
      const { certificate } = keyStore;
      expect(certificate.subject).toBe('O=com.mycompany.myapp\nOU=Development\nCN=Java Hipster');
      expect(certificate.issuer).toBe(certificate.subject);
      expect(certificate.verify(certificate.publicKey)).toBe(true);
      const days = (certificate.validToDate.getTime() - certificate.validFromDate.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(days)).toBe(99999);
    });

    it('should generate a new key each time', async () => {
      const other = await readKeyStore(await createKeyStore({ packageName: 'com.mycompany.myapp' }), 'password');
      expect(other.certificate.publicKey.equals(keyStore.certificate.publicKey)).toBe(false);
    });

    describe('with openssl', () => {
      let folder: string;
      let file: string;
      const opensslAvailable = spawnSync('openssl', ['version']).status === 0;

      before(function () {
        if (!opensslAvailable) {
          this.skip();
        }
        folder = mkdtempSync(join(tmpdir(), 'keystore-'));
        file = join(folder, 'keystore.p12');
        writeFileSync(file, contents);
      });

      after(() => {
        if (folder) {
          rmSync(folder, { recursive: true });
        }
      });

      it('should verify the integrity of the KeyStore with the password', () => {
        expect(() =>
          execFileSync('openssl', ['pkcs12', '-in', file, '-passin', 'pass:password', '-noout'], { stdio: 'pipe' }),
        ).not.toThrow();
        expect(() => execFileSync('openssl', ['pkcs12', '-in', file, '-passin', 'pass:wrong', '-noout'], { stdio: 'pipe' })).toThrow();
      });
    });
  });
});
