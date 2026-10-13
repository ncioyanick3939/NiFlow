// Erzeugt ein Schlüsselpaar für Web Push (VAPID). Einmal ausführen: node scripts/vapid-keys.mjs
// Die Werte gehören NUR in Supabase → Edge Functions → Secrets, nicht in den Code und nicht in den Chat.
const { subtle } = globalThis.crypto
const b64 = (buf) => Buffer.from(buf).toString('base64url')
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = await subtle.exportKey('raw', pair.publicKey)
const jwk = await subtle.exportKey('jwk', pair.privateKey)
console.log('VAPID_PUBLIC_KEY=' + b64(pub))
console.log('VAPID_PRIVATE_KEY=' + jwk.d)
