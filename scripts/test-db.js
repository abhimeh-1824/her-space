import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const dbNamed = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log('\n--- Testing Anonymous Auth ---');
  try {
    const cred = await signInAnonymously(auth);
    console.log('✓ Anonymous Auth SUCCESS! UID:', cred.user.uid);
    
    console.log('Writing test doc with Anonymous Auth to named DB...');
    const testDoc = doc(dbNamed, 'users', 'test_anon_doc');
    await setDoc(testDoc, {
      uid: cred.user.uid,
      name: 'Anon Test',
      email: 'anon@test.com',
      role: 'super_admin',
      createdAt: new Date().toISOString()
    });
    console.log('✓ Write with Anonymous Auth SUCCESS!');
    const snap = await getDoc(testDoc);
    console.log('✓ Read with Anonymous Auth SUCCESS! Data:', snap.data());
  } catch (err) {
    console.error('✗ Anonymous Auth / Write FAILED:', err.message, err.code);
  }
  process.exit(0);
}

run();
