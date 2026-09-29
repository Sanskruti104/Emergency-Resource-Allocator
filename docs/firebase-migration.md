# Firebase to MongoDB Migration Audit Report

**Project:** MedDecision / Real-Time Emergency Resource Allocator  
**Audit Date:** February 2026 / Local Timestamp: 2026-09-27  
**Objective:** Document all Firebase Auth and Firebase Storage dependencies to establish a non-disruptive migration path to a unified, MongoDB-native identity and data layer.

---

## 1. Firebase Auth Files

The following files directly import, configure, or invoke Firebase Authentication SDKs (`firebase/auth` or `firebase-admin`):

| File Path | Role & Usage |
| :--- | :--- |
| [`lib/firebase.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/lib/firebase.ts) | Client-side Firebase App initialization (`initializeApp`) and Client Auth instance export (`getAuth(app)`). |
| [`lib/firebase-admin.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/lib/firebase-admin.ts) | Server-side Firebase Admin SDK initialization using service account certs; exports `adminAuth` (`admin.auth()`). |
| [`lib/auth-utils.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/lib/auth-utils.ts) | Server-side session verification helper (`getServerSession()`) via `adminAuth.verifySessionCookie()`. |
| [`app/api/auth/session/route.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/api/auth/session/route.ts) | Session exchange endpoint: verifies Firebase `idToken` via `adminAuth.verifyIdToken()`, queries user role from MongoDB, and creates session cookie via `adminAuth.createSessionCookie()`. |
| [`app/signup/patient/page.tsx`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/signup/patient/page.tsx) | Creates patient credential via `createUserWithEmailAndPassword(auth, email, password)`, then syncs to MongoDB `/api/users/register`. |
| [`app/signup/hospital/page.tsx`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/signup/hospital/page.tsx) | Creates hospital admin credential via `createUserWithEmailAndPassword`, syncs hospital profile to MongoDB `/api/users/register`, and exchanges ID token for session cookie. |
| [`app/login/patient/page.tsx`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/login/patient/page.tsx) | Patient login via `signInWithEmailAndPassword`, validates `role === 'patient'` against `/api/users/${uid}`, signs out on role mismatch, and calls `/api/auth/session`. |
| [`app/login/hospital/page.tsx`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/login/hospital/page.tsx) | Hospital login via `signInWithEmailAndPassword`, exchanges ID token for session cookie, verifies `role === 'hospital'`, and redirects to `/hospital/dashboard`. |
| [`app/api/test-firebase/route.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/api/test-firebase/route.ts) | Diagnostic route checking Firebase Client and Admin initialization status. |
| [`scripts/check-connections.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/scripts/check-connections.ts) | Utility script testing Firebase Client Auth configuration. |

---

## 2. Firebase Storage Files

Firebase Storage is isolated to a single component in the entire project:

| File Path | Role & Usage |
| :--- | :--- |
| [`components/hospital/media-gallery.tsx`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/components/hospital/media-gallery.tsx) | Uploads hospital ward, ICU, and exterior facility photos using `uploadBytes`, `getDownloadURL`, and `deleteObject` from `firebase/storage`. The resulting URLs are persisted into MongoDB in the `hospitals.media` field via `PUT /api/hospital/media`. |
| [`lib/firebase.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/lib/firebase.ts) | Exports client `storage = getStorage(app)`. |

*Note:* [`app/api/hospital/media/route.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/api/hospital/media/route.ts) only receives image URL strings and writes them to MongoDB. It does not interact with the Firebase Storage SDK directly.

---

## 3. Routes & Components Dependent on Firebase

### Middleware Decoupling Note:
* **Crucial Finding:** [`middleware.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/middleware.ts) **does NOT import or invoke Firebase**. It solely inspects HTTP cookie values (`request.cookies.get('session')` and `request.cookies.get('user-role')`). Any session token strategy (Firebase or MongoDB JWT) that sets these two cookies works with the existing middleware without changes.

### Protected Endpoints Dependent on `getServerSession()`:
All of the following API route handlers call `getServerSession()` from [`lib/auth-utils.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/lib/auth-utils.ts) to resolve `session.uid`:
* `app/api/hospital/capacity/route.ts`
* `app/api/hospital/profile/route.ts`
* `app/api/hospital/doctors/route.ts` & `[id]/route.ts`
* `app/api/hospital/instruments/route.ts`
* `app/api/hospital/treatments/route.ts` & `[id]/route.ts`
* `app/api/hospital/media/route.ts`
* `app/api/hospital/insurance/*` (all 6 insurance routes)
* `app/api/patient/profile/route.ts`
* `app/api/treatment/match/route.ts` (optional session fallback)
* `app/api/recommendation/generate/route.ts` (optional session fallback)

---

## 4. Firebase Functionality That Can Be Removed

Once the MongoDB auth foundation is active, the following external Firebase dependencies can be eliminated:
1. **Firebase Admin SDK (`firebase-admin`):**
   * Service account JSON requirements (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`).
   * Remote network latency overhead for `verifyIdToken()` and `verifySessionCookie()` on protected routes.
2. **Firebase Client SDK (`firebase/auth`):**
   * External dependency bundle in client components.
   * `createUserWithEmailAndPassword()` and `signInWithEmailAndPassword()`.
3. **Firebase Cloud Storage (`firebase/storage`):**
   * Can be replaced by direct GridFS in MongoDB, public cloud object URLs, or standard base64/CDN URLs for hospital imagery.
4. **Diagnostic routes:**
   * [`app/api/test-firebase/route.ts`](file:///c:/Users/sansk/OneDrive/Desktop/Hackathon/HackMatrix/app/api/test-firebase/route.ts).

---

## 5. Functionality Needing MongoDB Replacement

| Current Firebase Feature | Proposed MongoDB Native Replacement |
| :--- | :--- |
| **User Identity Store** | Existing MongoDB `users` collection already has `uid`, `email`, `role`, `fullName`/`hospitalName`. Add `passwordHash` (Argon2id or bcrypt / Web Crypto scrypt) and `salt`. |
| **Password Credential Auth** | Direct `POST /api/auth/login` and `POST /api/auth/register` route handlers verifying credentials against `users` collection in MongoDB. |
| **Session Cookie Generation** | Standard HMAC-SHA256 signed JWT or encrypted session token issued via Node `crypto` / Web Crypto, stored in the existing `session` cookie. |
| **Session Verification (`getServerSession`)** | Verify HMAC signature of the `session` cookie locally in milliseconds without outbound Firebase network requests. |
| **Facility Photo Storage** | Store image metadata and URLs in MongoDB `hospitals.media`, with file storage via local public uploads or S3-compatible endpoints. |

---

## 6. Risks & Breaking Changes Matrix

| Risk / Potential Issue | Severity | Prevention & Mitigation Strategy |
| :--- | :---: | :--- |
| **Database `uid` Relationship Breakage** | **CRITICAL** | Every collection (`hospitals`, `patient_profiles`, `visiting_doctors`, `treatments`) references `uid: session.uid`. <br/>**Mitigation:** The native MongoDB auth design MUST retain the `uid` field (e.g. standard UUIDv4 or stringified ObjectId) and return `{ uid, email, role }` in `getServerSession()`. Existing database relationships will remain 100% intact. |
| **Middleware Cookie Incompatibility** | **HIGH** | If cookie names or expectations change, protected routes will fail redirect checks. <br/>**Mitigation:** Retain identical cookie names (`session` and `user-role`) and path `/`. |
| **Existing User Data Lockout** | **MEDIUM** | Existing users created via Firebase do not have password hashes in MongoDB. <br/>**Mitigation:** Maintain hybrid capability during transition or provide automatic registration/password seeding for mock and test users. |
| **Client-Side Form Submissions** | **LOW** | Client forms currently expect Firebase error codes (`auth/wrong-password`). <br/>**Mitigation:** Return standard error schemas `{ error: string, code: string }` from the new auth endpoints. |

---

## Conclusion & Safe Migration Strategy
Because MedDecision already stores user records and roles in the MongoDB `users` collection and queries all operational data using `session.uid`, migrating off Firebase does **not** require architectural re-engineering. By implementing a lightweight, standard Node.js crypto/JWT session provider that sets the `session` and `user-role` cookies, Firebase can be phased out without breaking any existing pages or API routes.
