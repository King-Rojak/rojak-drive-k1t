import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyAQL4Sq2WuNWpfiQ-fe1skRX_8v9E_2Am8",
  authDomain: "rojak-drivekit.firebaseapp.com",
  projectId: "rojak-drivekit",
  storageBucket: "rojak-drivekit.firebasestorage.app",
  messagingSenderId: "29128061301",
  appId: "1:29128061301:web:5ac3230f2671964fba233c",
  measurementId: "G-3KX6GKXBDF"
};


const app =
  initializeApp(firebaseConfig);

const auth =
  getAuth(app);

const db =
  getFirestore(app);


export {
  app,
  auth,
  db
};