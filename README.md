# Kabir Aqua — Water Jug Delivery App

A simple React Native (Expo) app to track water jug deliveries for small businesses.

---

## Setup

### 1. Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Add a **Web app** to the project.
3. Copy the config values into `firebase.js`:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   ```
4. In Firestore, create a database in **production mode** (start with test rules during dev).
5. Firestore security rules (for dev — tighten before production):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

### 2. Install & Run

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone.

---

## Project Structure

```
new-kabir-aqua/
├── App.js                        # Navigation root
├── firebase.js                   # Firebase config (edit this!)
├── screens/
│   ├── CustomerListScreen.js     # Screen 1 — list of customers
│   ├── CustomerDetailScreen.js   # Screen 2 — customer history + total
│   └── AddEntryScreen.js         # Screen 3 — add a delivery entry
├── app.json
├── babel.config.js
└── package.json
```

## Firestore Data Model

```
customers/                        (collection)
  {customerId}/
    name: string

    entries/                      (sub-collection)
      {entryId}/
        date:     "YYYY-MM-DD"
        quantity: number
```
