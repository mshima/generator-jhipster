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
import { createHash, webcrypto } from 'node:crypto';

import { BmpString, Integer, OctetString, Sequence, Set as Asn1Set, Utf8String } from 'asn1js';
import {
  Attribute,
  AttributeTypeAndValue,
  AuthenticatedSafe,
  CertBag,
  Certificate,
  type ContentEncryptionAesCbcParams,
  CryptoEngine,
  PFX,
  PKCS8ShroudedKeyBag,
  PrivateKeyInfo,
  RelativeDistinguishedNames,
  SafeBag,
  SafeContents,
  Time,
  TimeType,
} from 'pkijs';

const KEY_STORE_ALIAS = 'selfsigned';
const KEY_STORE_PASSWORD = 'password';
const KEY_STORE_VALIDITY_DAYS = 99_999;
const KEY_ITERATIONS = 2048;
const MAC_ITERATIONS = 10_000;

const OID = {
  organizationName: '2.5.4.10',
  organizationalUnitName: '2.5.4.11',
  commonName: '2.5.4.3',
  friendlyName: '1.2.840.113549.1.9.20',
  localKeyId: '1.2.840.113549.1.9.21',
  pkcs8ShroudedKeyBag: '1.2.840.113549.1.12.10.1.2',
  certBag: '1.2.840.113549.1.12.10.1.3',
} as const;

// RFC 5280: UTCTime for dates through 2049, GeneralizedTime from 2050 on, which a 99999 days validity reaches.
const time = (value: Date) => new Time({ type: value.getUTCFullYear() < 2050 ? TimeType.UTCTime : TimeType.GeneralizedTime, value });

const crypto = new CryptoEngine({ name: 'node', crypto: webcrypto });

/**
 * The contents of a PKCS#12 KeyStore holding a 2048 bits RSA key and its self-signed certificate, under the `selfsigned`
 * alias and the `password` password, valid for 99999 days, as `keytool -genkey` created it.
 * Built with pkijs over WebCrypto: the key is encrypted with PBES2 (PBKDF2 with HMAC-SHA256, AES-256-CBC) and the
 * KeyStore is protected by an HMAC-SHA256 MAC.
 */
export const createKeyStore = async ({ packageName }: { packageName: string }): Promise<Buffer> => {
  const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );

  const certificate = new Certificate();
  // Version 3.
  certificate.version = 2;
  // A positive serial number.
  certificate.serialNumber = new Integer({ valueHex: webcrypto.getRandomValues(new Uint8Array(9)).fill(1, 0, 1) });
  // Most significant first: `CN=Java Hipster, OU=Development, O=<packageName>`. pkijs encodes the attributes it is given
  // as a single multi-valued RDN, so the name is encoded with one RDN per attribute and parsed back, keeping that encoding.
  const name = new Sequence({
    value: [
      [OID.organizationName, packageName],
      [OID.organizationalUnitName, 'Development'],
      [OID.commonName, 'Java Hipster'],
    ].map(([type, value]) => new Asn1Set({ value: [new AttributeTypeAndValue({ type, value: new Utf8String({ value }) }).toSchema()] })),
  }).toBER();
  certificate.subject = RelativeDistinguishedNames.fromBER(name);
  certificate.issuer = RelativeDistinguishedNames.fromBER(name);
  // Whole seconds: RFC 5280 forbids fractional seconds, which pkijs would encode in GeneralizedTime.
  const notBefore = new Date(Math.floor(Date.now() / 1000) * 1000);
  certificate.notBefore = time(notBefore);
  certificate.notAfter = time(new Date(notBefore.getTime() + KEY_STORE_VALIDITY_DAYS * 24 * 60 * 60 * 1000));
  await certificate.subjectPublicKeyInfo.importKey(publicKey, crypto);
  await certificate.sign(privateKey, 'SHA-256', crypto);

  // The same attributes on both bags pair the key with its certificate under the alias.
  const bagAttributes = [
    new Attribute({ type: OID.friendlyName, values: [new BmpString({ value: KEY_STORE_ALIAS })] }),
    new Attribute({
      type: OID.localKeyId,
      values: [new OctetString({ valueHex: createHash('sha1').update(new Uint8Array(certificate.toSchema().toBER())).digest() })],
    }),
  ];
  const keyBag = new PKCS8ShroudedKeyBag({
    parsedValue: PrivateKeyInfo.fromBER(await webcrypto.subtle.exportKey('pkcs8', privateKey)),
  });
  const password = new TextEncoder().encode(KEY_STORE_PASSWORD).buffer;
  await keyBag.makeInternalValues(
    {
      password,
      // pkijs generates a random iv, its type asks for one anyway.
      contentEncryptionAlgorithm: { name: 'AES-CBC', length: 256 } as ContentEncryptionAesCbcParams,
      hmacHashAlgorithm: 'SHA-256',
      iterationCount: KEY_ITERATIONS,
    },
    crypto,
  );

  const pfx = new PFX({
    parsedValue: {
      integrityMode: 0,
      authenticatedSafe: new AuthenticatedSafe({
        parsedValue: {
          safeContents: [
            {
              privacyMode: 0,
              value: new SafeContents({
                safeBags: [
                  new SafeBag({ bagId: OID.certBag, bagValue: new CertBag({ parsedValue: certificate }), bagAttributes }),
                  new SafeBag({ bagId: OID.pkcs8ShroudedKeyBag, bagValue: keyBag, bagAttributes }),
                ],
              }),
            },
          ],
        },
      }),
    },
  });
  await pfx.parsedValue!.authenticatedSafe!.makeInternalValues({ safeContents: [{}] }, crypto);
  await pfx.makeInternalValues(
    { password, iterations: MAC_ITERATIONS, pbkdf2HashAlgorithm: 'SHA-256', hmacHashAlgorithm: 'SHA-256' },
    crypto,
  );
  return Buffer.from(pfx.toSchema().toBER());
};
