import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

let services;
export function getFirebaseServices() {
  if (services) return services;
  const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || process.env.REACT_APP_VEHICLE_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || process.env.REACT_APP_VEHICLE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.databaseURL || !config.projectId) {
    throw new Error('Firebase web configuration is incomplete');
  }
  const app = getApps().find(app => app.name === 'vehicle-dashboard') || initializeApp(config, 'vehicle-dashboard');
  services = { auth: getAuth(app), database: getDatabase(app) };
  return services;
}

export function getInitializedFirebaseAuth() { return services?.auth; }
